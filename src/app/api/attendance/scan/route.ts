import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertApiAccessOrDeny, apiError, apiSuccess, handleApiError, requireUserWithSchool } from "@/lib/api-utils";
import { canAccessClass, isClassScopedRole } from "@/lib/server/class-scope";
import { parseStudentScanValue } from "@/lib/scan-parsers";
import { getKampalaDate } from "@/lib/kampala-date";

const ALLOWED_ROLES = new Set([
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "teacher",
  "secretary",
  "super_admin",
]);

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    if (!auth.context.schoolId) return apiError("School context required", 403);
    const schoolId = auth.context.schoolId;

    const body = await request.json().catch(() => ({}));
    const scanValue = typeof body?.scanValue === "string" ? body.scanValue.trim() : "";
    if (!scanValue) return apiError("Scan value is required", 400);

    const accessCheck = assertApiAccessOrDeny({
      userRole: auth.context.user.role,
      permission: "attendance",
      allowedRoles: Array.from(ALLOWED_ROLES),
    });
    if (!accessCheck.ok) return apiError("Forbidden", 403);

    const parsed = parseStudentScanValue(scanValue);
    if (!parsed.studentId && !parsed.studentNumber) {
      return apiError("Unable to identify student from scan", 400);
    }

    const supabase = await createSupabaseServerClient();

    let studentQuery = supabase
      .from("students")
      .select("id, first_name, last_name, student_number, class_id, status")
      .eq("school_id", schoolId)
      .limit(1);
    if (parsed.studentId) studentQuery = studentQuery.eq("id", parsed.studentId);
    else studentQuery = studentQuery.eq("student_number", parsed.studentNumber || "");

    const { data: studentRows, error: studentError } = await studentQuery;
    if (studentError) return apiError("Failed to verify student", 500);
    const student = studentRows?.[0];
    if (!student) return apiError("Student not found", 404);
    if (student.status && student.status !== "active") return apiError("Student is not active", 400);

    // Keep the scan path aligned with manual and bulk attendance: a teacher
    // may only mark learners in a class assigned to them.
    if (
      isClassScopedRole(auth.context.user.role) &&
      !(await canAccessClass(supabase, auth.context.user.role, auth.context.user.id, student.class_id))
    ) {
      return apiError("You can only mark attendance for classes you teach", 403);
    }

    const today = getKampalaDate();
    const { error: upsertError } = await supabase.from("attendance").upsert(
      {
        student_id: student.id,
        class_id: student.class_id,
        date: today,
        status: "present",
        period_number: 1,
        recorded_by: auth.context.user.id,
      },
      { onConflict: "student_id,date,period_number" },
    );

    if (upsertError) return apiError("Failed to record attendance", 500);

    try {
      await supabase.from("audit_log").insert({
        school_id: schoolId,
        user_id: auth.context.user.id,
        user_name: auth.context.user.full_name || auth.context.user.email || "system",
        action: "create",
        module: "attendance",
        description: `Scanned attendance: ${student.first_name} ${student.last_name} marked present`,
        record_id: student.id,
        new_value: { student_id: student.id, date: today, status: "present" },
      });
    } catch (auditErr) {
      // non-fatal
    }

    return apiSuccess(
      {
        student: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          student_number: student.student_number,
        },
        date: today,
      },
      student.first_name + " " + student.last_name + " marked present",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
