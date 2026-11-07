import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
  withSecurity,
} from "@/lib/api-utils";
import { requireModuleEntitlement } from "@/lib/subscription-guard";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";

// Transactional bell-schedule replacement (docs/timetable-design.md §7.6/§11 Phase 2).
// Replaces the school's timetable_slots for one school, bumps the schedule
// version, migrates existing teacher constraints by stable slot order, and
// optionally clears old lesson entries. Everything is atomic inside the
// replace_timetable_schedule database function; failure leaves the old
// schedule untouched.

const TIMETABLE_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "dean_of_studies"];
const MAX_SLOTS = 50;
const TIMEOUT_MS = 20000;

interface ScheduleSlotInput {
  name?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  is_lesson?: unknown;
  order_number?: unknown;
}

interface ScheduleBody {
  schoolId?: string;
  academicYear?: unknown;
  expectedVersion?: unknown;
  slots?: ScheduleSlotInput[];
  retainEntries?: unknown;
}

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

function isTimeout(result: unknown): boolean {
  return (result as { status?: number })?.status === 408;
}

function invalidSlots(slots: ScheduleSlotInput[] | undefined): string | null {
  if (!Array.isArray(slots) || slots.length === 0) {
    return "slots must be a non-empty array";
  }
  if (slots.length > MAX_SLOTS) {
    return `Too many slots (max ${MAX_SLOTS})`;
  }
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (typeof slot.name !== "string" || slot.name.trim() === "") {
      return `Slot ${i + 1} needs a name`;
    }
    const start = slot.start_time;
    const end = slot.end_time;
    if (typeof start !== "string" || typeof end !== "string" || !TIME_RE.test(start) || !TIME_RE.test(end)) {
      return `Slot ${i + 1} ("${slot.name}") has invalid times`;
    }
    if (end <= start) return `Slot ${i + 1} ("${slot.name}") ends before it starts`;
    const order = slot.order_number;
    if (order !== i + 1) {
      return "slot order_number must be sequential starting at 1";
    }
    if (slot.is_lesson !== undefined && typeof slot.is_lesson !== "boolean") {
      return `Slot ${i + 1} ("${slot.name}") has invalid is_lesson flag`;
    }
  }
  return null;
}

async function handlePost(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: TIMETABLE_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    let body: ScheduleBody;
    try {
      body = (await request.json()) as ScheduleBody;
    } catch {
      return apiError("Malformed request body", 400);
    }
    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: body.schoolId || auth.context.schoolId,
    });
    if (!scope.ok) return scope.response;

    const schoolId = scope.schoolId;
    const academicYear = body.academicYear;
    if (!academicYear || typeof academicYear !== "string" || academicYear.length > 20) {
      return apiError("academicYear is required (max 20 characters)", 400);
    }
    const slotsError = invalidSlots(body.slots);
    if (slotsError) return apiError(slotsError, 400);
    const slots = body.slots as Array<{
      name: string;
      start_time: string;
      end_time: string;
      is_lesson?: boolean;
    }>;
    const slotRows = slots.map((s, i) => ({
      name: s.name.trim(),
      start_time: s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time,
      end_time: s.end_time.length === 5 ? `${s.end_time}:00` : s.end_time,
      is_lesson: s.is_lesson === undefined ? true : s.is_lesson,
      order_number: i + 1,
    }));

    if (body.expectedVersion !== undefined) {
      const version = Number(body.expectedVersion);
      if (!Number.isInteger(version) || version < 0 || version > 1000000) {
        return apiError("expectedVersion must be a non-negative integer", 400);
      }
    }
    if (body.retainEntries !== undefined && typeof body.retainEntries !== "boolean") {
      return apiError("retainEntries must be a boolean", 400);
    }

    let supabase: any;
    try {
      supabase = createServiceRoleClientOrThrow();
    } catch (err) {
      logger.error("[timetable/schedule] missing service role config:", err);
      return apiError("Server configuration error", 500);
    }

    // Module entitlement check (timetable is free for every plan tier).
    const modCheck = await requireModuleEntitlement({
      supabase,
      schoolId,
      moduleKey: "operations",
    });
    if (!modCheck.ok) return modCheck.response;

    const result = await withTimeout(
      supabase.rpc("replace_timetable_schedule", {
        p_school_id: schoolId,
        p_academic_year: academicYear,
        p_expected_version: body.expectedVersion === undefined ? null : Number(body.expectedVersion),
        p_slots: slotRows,
        p_actor_id: auth.context.user.id,
        p_retain_entries: body.retainEntries === undefined ? true : body.retainEntries,
      }),
      TIMEOUT_MS,
      timeoutFallback(),
    );
    if (isTimeout(result)) {
      return apiError("Request timed out replacing the bell schedule. Nothing was changed.", 504);
    }
    if (result.error) {
      const err = result.error as { code?: string; message?: string };
      const message = err.message || "";
      if (message.includes("stale schedule version")) {
        return apiError(
          "The bell schedule changed while you were editing. Reload the current schedule and try again.",
          409,
        );
      }
      if (message.includes("constraints cannot be mapped")) {
        return apiError(
          "Existing teacher constraints do not fit the new bell schedule. Remove or update them first.",
          409,
        );
      }
      if (err.code === "42501") {
        return apiError("You do not have permission to change this school's bell schedule.", 403);
      }
      if (err.code === "22023" || message.includes("must be") || message.includes("has invalid")) {
        return apiError(message, 400);
      }
      logger.error("[timetable/schedule] replacement failed:", result.error);
      return apiError("Failed to replace the bell schedule. Nothing was changed.", 500);
    }

    const payload = (result.data || {}) as { version?: number; slots?: unknown; constraints?: unknown };
    return apiSuccess(
      {
        version: payload.version ?? null,
        slots: payload.slots ?? [],
        constraints: payload.constraints ?? [],
      },
      "Bell schedule updated",
      200,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withSecurity(handlePost, {
  rateLimit: { limit: 20, windowMs: 60000 },
});
