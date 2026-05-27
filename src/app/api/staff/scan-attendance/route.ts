import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireUserWithSchool,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseStaffScanValue } from "@/lib/scan-parsers";
import { extractScannerContext, logScanEvent } from "@/lib/scan-events";
import {
  hashScanValue,
  shouldRequireScanSignature,
  verifySignedScanPayload,
} from "@/lib/scan-security";

const ALLOWED_ROLES = new Set([
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "secretary",
  "super_admin",
]);

const STAFF_EXCLUDED_ROLES = new Set(["student", "parent"]);

function scanError(error: string, reasonCode: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
      reasonCode,
    },
    { status },
  );
}

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
    const schoolId = auth.context.schoolId;

    const body = await request.json();
    const scanValue = typeof body?.scanValue === "string" ? body.scanValue.trim() : "";
    const action = body?.action === "check_out" ? "check_out" : "check_in";
    const scannerIdFromBody =
      typeof body?.scannerId === "string" ? body.scannerId.trim() : null;

    const supabase = await createSupabaseServerClient();
    const scannerContext = extractScannerContext(request, scannerIdFromBody);
    const scanHash = hashScanValue(scanValue);
    const signatureCheck = verifySignedScanPayload(scanValue, "staff");

    const logBlocked = async (
      reasonCode: string,
      message: string,
      status: number,
      targetId?: string,
    ) => {
      await logScanEvent(supabase, {
        schoolId,
        entityType: "staff_attendance",
        targetId: targetId || null,
        operatorUserId: auth.context.user.id,
        scannerId: scannerContext.scannerId,
        source: "scanner",
        rawScanHash: scanHash,
        isSigned: signatureCheck.isSigned,
        signatureValid: signatureCheck.isSigned
          ? signatureCheck.signatureValid
          : null,
        decision: "blocked",
        reasonCode,
        reasonMessage: message,
        attendanceAction: action,
        metadata: scannerContext.metadata,
      });
      return scanError(message, reasonCode, status);
    };

    if (!ALLOWED_ROLES.has(auth.context.user.role)) {
      return logBlocked("FORBIDDEN_ROLE", "Forbidden", 403);
    }

    if (!scanValue) {
      return logBlocked("SCAN_VALUE_REQUIRED", "Scan value is required", 400);
    }

    if (shouldRequireScanSignature() && !signatureCheck.isSigned) {
      return logBlocked(
        "SIGNATURE_REQUIRED",
        "Card signature is required for this scanner",
        401,
      );
    }

    if (signatureCheck.isSigned && !signatureCheck.signatureValid) {
      return logBlocked(
        signatureCheck.reasonCode || "SIGNED_SIGNATURE_INVALID",
        "Card signature verification failed",
        401,
      );
    }

    if (
      signatureCheck.payload?.schoolId &&
      signatureCheck.payload.schoolId !== auth.context.schoolId
    ) {
      return logBlocked(
        "SIGNED_SCHOOL_MISMATCH",
        "Scanned card does not belong to this school",
        403,
      );
    }

    const parsed = signatureCheck.payload
      ? parseStaffScanValue(signatureCheck.payload.id)
      : parseStaffScanValue(scanValue);
    if (!parsed.staffId) {
      return logBlocked(
        "STAFF_IDENTIFICATION_FAILED",
        "Unable to identify staff from scan",
        400,
      );
    }

    const { data: staff, error: staffError } = await supabase
      .from("users")
      .select("id, full_name, role, school_id")
      .eq("id", parsed.staffId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (staffError) {
      return logBlocked(
        "STAFF_LOOKUP_FAILED",
        "Failed to verify staff member",
        500,
      );
    }

    if (!staff) {
      return logBlocked("STAFF_NOT_FOUND", "Staff member not found", 404);
    }

    if (STAFF_EXCLUDED_ROLES.has(staff.role)) {
      return logBlocked(
        "STAFF_ROLE_INVALID",
        "Scanned card is not a staff card",
        400,
        staff.id,
      );
    }

    const { date, time } = getKampalaDateParts();

    const { data: existing, error: existingError } = await supabase
      .from("staff_attendance")
      .select("id, status, time_in, time_out")
      .eq("staff_id", staff.id)
      .eq("date", date)
      .maybeSingle();

    if (existingError) {
      return logBlocked(
        "ATTENDANCE_STATUS_LOOKUP_FAILED",
        "Failed to read attendance status",
        500,
        staff.id,
      );
    }

    if (action === "check_in") {
      if (existing?.time_in) {
        await logScanEvent(supabase, {
          schoolId,
          entityType: "staff_attendance",
          targetId: staff.id,
          operatorUserId: auth.context.user.id,
          scannerId: scannerContext.scannerId,
          source: "scanner",
          rawScanHash: scanHash,
          isSigned: signatureCheck.isSigned,
          signatureValid: signatureCheck.isSigned ? signatureCheck.signatureValid : null,
          decision: "blocked",
          reasonCode: "STAFF_ALREADY_CHECKED_IN",
          reasonMessage: `${staff.full_name} was already checked in today`,
          attendanceAction: action,
          metadata: scannerContext.metadata,
        });

        return apiSuccess(
          {
            alreadyMarked: true,
            reasonCode: "STAFF_ALREADY_CHECKED_IN",
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
        return logBlocked(
          "STAFF_CHECKIN_FAILED",
          "Failed to mark check-in",
          500,
          staff.id,
        );
      }

      await logScanEvent(supabase, {
        schoolId,
        entityType: "staff_attendance",
        targetId: staff.id,
        operatorUserId: auth.context.user.id,
        scannerId: scannerContext.scannerId,
        source: "scanner",
        rawScanHash: scanHash,
        isSigned: signatureCheck.isSigned,
        signatureValid: signatureCheck.isSigned ? signatureCheck.signatureValid : null,
        decision: "allowed",
        reasonCode: "STAFF_CHECKIN_RECORDED",
        reasonMessage: `${staff.full_name} checked in`,
        attendanceAction: action,
        metadata: scannerContext.metadata,
      });

      return apiSuccess(
        {
          alreadyMarked: false,
          reasonCode: "STAFF_CHECKIN_RECORDED",
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
      return logBlocked(
        "STAFF_CHECKOUT_FAILED",
        "Failed to mark check-out",
        500,
        staff.id,
      );
    }

    await logScanEvent(supabase, {
      schoolId,
      entityType: "staff_attendance",
      targetId: staff.id,
      operatorUserId: auth.context.user.id,
      scannerId: scannerContext.scannerId,
      source: "scanner",
      rawScanHash: scanHash,
      isSigned: signatureCheck.isSigned,
      signatureValid: signatureCheck.isSigned ? signatureCheck.signatureValid : null,
      decision: "allowed",
      reasonCode: "STAFF_CHECKOUT_RECORDED",
      reasonMessage: `${staff.full_name} checked out`,
      attendanceAction: action,
      metadata: scannerContext.metadata,
    });

    return apiSuccess(
      {
        reasonCode: "STAFF_CHECKOUT_RECORDED",
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
