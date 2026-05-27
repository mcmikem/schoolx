import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireUserWithSchool,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseStaffScanValue } from "@/lib/scan-parsers";

const ALLOWED_ROLES = new Set([
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "secretary",
  "super_admin",
]);

const STAFF_EXCLUDED_ROLES = new Set(["student", "parent"]);

function getKampalaDateParts() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  return { date, time };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!auth.context.schoolId) {
      return apiError("School context required", 403);
    }

    if (!ALLOWED_ROLES.has(auth.context.user.role)) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const scanValue = typeof body?.scanValue === "string" ? body.scanValue.trim() : "";
    const action = body?.action === "check_out" ? "check_out" : "check_in";

    if (!scanValue) {
      return apiError("Scan value is required", 400);
    }

    const parsed = parseStaffScanValue(scanValue);
    if (!parsed.staffId) {
      return apiError("Unable to identify staff from scan", 400);
    }

    const supabase = await createSupabaseServerClient();

    const { data: staff, error: staffError } = await supabase
      .from("users")
      .select("id, full_name, role, school_id")
      .eq("id", parsed.staffId)
      .eq("school_id", auth.context.schoolId)
      .maybeSingle();

    if (staffError) {
      return apiError("Failed to verify staff member", 500);
    }

    if (!staff) {
      return apiError("Staff member not found", 404);
    }

    if (STAFF_EXCLUDED_ROLES.has(staff.role)) {
      return apiError("Scanned card is not a staff card", 400);
    }

    const { date, time } = getKampalaDateParts();

    const { data: existing, error: existingError } = await supabase
      .from("staff_attendance")
      .select("id, status, time_in, time_out")
      .eq("staff_id", staff.id)
      .eq("date", date)
      .maybeSingle();

    if (existingError) {
      return apiError("Failed to read attendance status", 500);
    }

    if (action === "check_in") {
      if (existing?.time_in) {
        return apiSuccess(
          {
            alreadyMarked: true,
            action,
            staff: { id: staff.id, full_name: staff.full_name },
            date,
            time_in: existing.time_in,
          },
          `${staff.full_name} was already checked in today`,
        );
      }

      const payload = {
        staff_id: staff.id,
        date,
        status: "present",
        time_in: time,
        time_out: existing?.time_out || null,
        recorded_by: auth.context.user.id,
        remarks: "ID scan check-in",
      };

      const { error: upsertError } = await supabase
        .from("staff_attendance")
        .upsert(payload, { onConflict: "staff_id,date" });

      if (upsertError) {
        return apiError("Failed to mark check-in", 500);
      }

      return apiSuccess(
        {
          alreadyMarked: false,
          action,
          staff: { id: staff.id, full_name: staff.full_name },
          date,
          time_in: time,
        },
        `${staff.full_name} checked in`,
      );
    }

    const payload = {
      staff_id: staff.id,
      date,
      status: existing?.status || "present",
      time_in: existing?.time_in || null,
      time_out: time,
      recorded_by: auth.context.user.id,
      remarks: "ID scan check-out",
    };

    const { error: upsertError } = await supabase
      .from("staff_attendance")
      .upsert(payload, { onConflict: "staff_id,date" });

    if (upsertError) {
      return apiError("Failed to mark check-out", 500);
    }

    return apiSuccess(
      {
        action,
        staff: { id: staff.id, full_name: staff.full_name },
        date,
        time_out: time,
      },
      `${staff.full_name} checked out`,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
