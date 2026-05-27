import { NextRequest, NextResponse } from "next/server";
import {
  assertApiAccessOrDeny,
  apiError,
  apiSuccess,
  handleApiError,
  requireUserWithSchool,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseStudentScanValue } from "@/lib/scan-parsers";
import { extractScannerContext, logScanEvent } from "@/lib/scan-events";
import {
  hashScanValue,
  shouldRequireScanSignature,
  verifySignedScanPayload,
} from "@/lib/scan-security";

const SERVING_ROLES = new Set([
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "teacher",
  "secretary",
  "dorm_master",
  "bursar",
  "super_admin",
]);

const VALID_MEALS = new Set(["breakfast", "lunch", "supper"]);

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
    const mealType = String(body?.mealType || "").toLowerCase();
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
    const scannerIdFromBody =
      typeof body?.scannerId === "string" ? body.scannerId.trim() : null;

    const supabase = await createSupabaseServerClient();
    const scannerContext = extractScannerContext(request, scannerIdFromBody);
    const scanHash = hashScanValue(scanValue);
    const signatureCheck = verifySignedScanPayload(scanValue, "student");

    const logBlocked = async (
      reasonCode: string,
      message: string,
      status: number,
      targetId?: string,
    ) => {
      await logScanEvent(supabase, {
        schoolId,
        entityType: "student_meal",
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
        mealType,
        metadata: scannerContext.metadata,
      });
      return scanError(message, reasonCode, status);
    };

    const accessCheck = assertApiAccessOrDeny({
      userRole: auth.context.user.role,
      permission: "students",
      allowedRoles: Array.from(SERVING_ROLES),
    });
    if (!accessCheck.ok) {
      return logBlocked("FORBIDDEN_ROLE", "Forbidden", 403);
    }

    if (!scanValue) {
      return logBlocked("SCAN_VALUE_REQUIRED", "Scan value is required", 400);
    }

    if (!VALID_MEALS.has(mealType)) {
      return logBlocked("MEAL_TYPE_INVALID", "Invalid meal type", 400);
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
      ? parseStudentScanValue(signatureCheck.payload.id)
      : parseStudentScanValue(scanValue);

    if (!parsed.studentId && !parsed.studentNumber) {
      return logBlocked(
        "STUDENT_IDENTIFICATION_FAILED",
        "Unable to identify student from scan",
        400,
      );
    }

    let studentQuery = supabase
      .from("students")
      .select("id, first_name, last_name, student_number, boarding_status, status")
      .eq("school_id", schoolId)
      .limit(1);

    if (parsed.studentId) {
      studentQuery = studentQuery.eq("id", parsed.studentId);
    } else {
      studentQuery = studentQuery.eq("student_number", parsed.studentNumber || "");
    }

    const { data: studentRows, error: studentError } = await studentQuery;

    if (studentError) {
      return logBlocked("STUDENT_LOOKUP_FAILED", "Failed to verify student", 500);
    }

    const student = studentRows?.[0];

    if (!student) {
      return logBlocked("STUDENT_NOT_FOUND", "Student not found", 404);
    }

    if (student.status && student.status !== "active") {
      return logBlocked(
        "STUDENT_NOT_ACTIVE",
        "Student is not active",
        400,
        student.id,
      );
    }

    const { data: rule, error: ruleError } = await supabase
      .from("meal_service_rules")
      .select("meal_type, is_enabled, eligibility")
      .eq("school_id", schoolId)
      .eq("meal_type", mealType)
      .maybeSingle();

    if (ruleError) {
      return logBlocked(
        "MEAL_RULE_LOOKUP_FAILED",
        "Failed to verify meal rules",
        500,
        student.id,
      );
    }

    if (!rule || !rule.is_enabled) {
      return logBlocked(
        "MEAL_DISABLED",
        "This meal service is disabled",
        400,
        student.id,
      );
    }

    if (
      rule.eligibility === "boarding_only" &&
      (student.boarding_status || "day") === "day"
    ) {
      return logBlocked(
        "MEAL_BOARDING_ONLY",
        "Meal is only enabled for boarding students",
        403,
        student.id,
      );
    }

    const { data: insertData, error: insertError } = await supabase
      .from("meal_scan_logs")
      .insert({
        school_id: schoolId,
        student_id: student.id,
        meal_type: mealType,
        served_by: auth.context.user.id,
        source: "scanner",
        notes,
      })
      .select("id, service_date, served_at")
      .maybeSingle();

    if (insertError) {
      const code = (insertError as any)?.code;
      if (code === "23505") {
        return logBlocked(
          "MEAL_ALREADY_SERVED",
          `${student.first_name} ${student.last_name} already received ${mealType} today`,
          409,
          student.id,
        );
      }
      return logBlocked(
        "MEAL_RECORD_FAILED",
        "Failed to record meal service",
        500,
        student.id,
      );
    }

    await logScanEvent(supabase, {
      schoolId,
      entityType: "student_meal",
      targetId: student.id,
      operatorUserId: auth.context.user.id,
      scannerId: scannerContext.scannerId,
      source: "scanner",
      rawScanHash: scanHash,
      isSigned: signatureCheck.isSigned,
      signatureValid: signatureCheck.isSigned ? signatureCheck.signatureValid : null,
      decision: "allowed",
      reasonCode: "MEAL_SERVED",
      reasonMessage: `${student.first_name} ${student.last_name} served ${mealType}`,
      mealType,
      metadata: scannerContext.metadata,
    });

    return apiSuccess(
      {
        reasonCode: "MEAL_SERVED",
        served: true,
        mealType,
        serviceDate: insertData?.service_date,
        servedAt: insertData?.served_at,
        student: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          student_number: student.student_number,
        },
      },
      `${student.first_name} ${student.last_name} served ${mealType}`,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
