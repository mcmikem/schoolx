import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireUserWithSchool,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseStudentScanValue } from "@/lib/scan-parsers";

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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!auth.context.schoolId) {
      return apiError("School context required", 403);
    }

    if (!SERVING_ROLES.has(auth.context.user.role)) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const scanValue = typeof body?.scanValue === "string" ? body.scanValue.trim() : "";
    const mealType = String(body?.mealType || "").toLowerCase();
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

    if (!scanValue) {
      return apiError("Scan value is required", 400);
    }

    if (!VALID_MEALS.has(mealType)) {
      return apiError("Invalid meal type", 400);
    }

    const parsed = parseStudentScanValue(scanValue);

    if (!parsed.studentId && !parsed.studentNumber) {
      return apiError("Unable to identify student from scan", 400);
    }

    const supabase = await createSupabaseServerClient();

    let studentQuery = supabase
      .from("students")
      .select("id, first_name, last_name, student_number, boarding_status, status")
      .eq("school_id", auth.context.schoolId)
      .limit(1);

    if (parsed.studentId) {
      studentQuery = studentQuery.eq("id", parsed.studentId);
    } else {
      studentQuery = studentQuery.eq("student_number", parsed.studentNumber || "");
    }

    const { data: studentRows, error: studentError } = await studentQuery;

    if (studentError) {
      return apiError("Failed to verify student", 500);
    }

    const student = studentRows?.[0];

    if (!student) {
      return apiError("Student not found", 404);
    }

    if (student.status && student.status !== "active") {
      return apiError("Student is not active", 400);
    }

    const { data: rule, error: ruleError } = await supabase
      .from("meal_service_rules")
      .select("meal_type, is_enabled, eligibility")
      .eq("school_id", auth.context.schoolId)
      .eq("meal_type", mealType)
      .maybeSingle();

    if (ruleError) {
      return apiError("Failed to verify meal rules", 500);
    }

    if (!rule || !rule.is_enabled) {
      return apiError("This meal service is disabled", 400);
    }

    if (
      rule.eligibility === "boarding_only" &&
      (student.boarding_status || "day") === "day"
    ) {
      return apiError("Meal is only enabled for boarding students", 403);
    }

    const { data: insertData, error: insertError } = await supabase
      .from("meal_scan_logs")
      .insert({
        school_id: auth.context.schoolId,
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
        return apiError(
          `${student.first_name} ${student.last_name} already received ${mealType} today`,
          409,
        );
      }
      return apiError("Failed to record meal service", 500);
    }

    return apiSuccess(
      {
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
