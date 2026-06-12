import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
  validateRequiredFields,
} from "@/lib/api-utils";

const ATTENDANCE_ALLOWED_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "teacher",
  "secretary",
  "dorm_master",
];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: ATTENDANCE_ALLOWED_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const body = await request.json();
    const { class_id, date_from, date_to, status, school_id } = body;

    const validationError = validateRequiredFields(body, [
      "class_id",
      "date_from",
      "date_to",
      "status",
    ]);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const validStatuses = ["present", "absent", "late", "excused"];
    if (!validStatuses.includes(status)) {
      return apiError("Invalid status. Must be present, absent, late, or excused", 400);
    }

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: school_id || auth.context.schoolId,
    });
    if (!scope.ok) return scope.response;

    if (new Date(date_from) > new Date(date_to)) {
      return apiError("date_from must be before or equal to date_to", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, school_id")
      .eq("id", class_id)
      .single();

    if (classError || !classData) {
      return apiError("Class not found", 404);
    }

    if (classData.school_id !== scope.schoolId) {
      return apiError("Class does not belong to the requested school", 403);
    }

    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", class_id)
      .eq("school_id", scope.schoolId)
      .eq("status", "active");

    if (studentsError) {
      return apiError("Failed to fetch students", 500);
    }

    if (!students || students.length === 0) {
      return apiError("No active students found in this class", 400);
    }

    const dates: string[] = [];
    const start = new Date(date_from);
    const end = new Date(date_to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }

    const records = [];
    for (const date of dates) {
      for (const student of students) {
        records.push({
          student_id: student.id,
          class_id,
          date,
          status,
          recorded_by: auth.context.user.id,
        });
      }
    }

    const BATCH_SIZE = 500;
    let upserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from("attendance")
        .upsert(batch, { onConflict: "student_id,date" });
      if (upsertError) throw upsertError;
      upserted += batch.length;
    }

    return apiSuccess({
      total_records: records.length,
      students_count: students.length,
      dates_count: dates.length,
      status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
