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
import { requireModuleEntitlement } from "@/lib/subscription-guard";
import { logger } from "@/lib/logger";

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

    const validationError = validateRequiredFields(body, ["class_id", "date_from", "date_to", "status"]);
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

    const moduleCheck = await requireModuleEntitlement({
      supabase,
      schoolId: scope.schoolId,
      moduleKey: "attendance",
    });
    if (!moduleCheck.ok) return moduleCheck.response;

    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, school_id")
      .eq("id", class_id)
      .maybeSingle();

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
      logger.error("Failed to fetch students:", studentsError);
      return apiError(studentsError.message, 500);
    }

    if (!students || students.length === 0) {
      return apiError("No active students found in this class", 400);
    }

    // Build the date list using LOCAL calendar arithmetic on the YYYY-MM-DD
    // strings the client sends. `new Date(str).toISOString()` would convert to
    // UTC, which can shift a day for schools ahead of UTC (e.g. Uganda) and
    // makes the bulk-marker disagree with the attendance page's local dates.
    function addDays(dateStr: string, days: number): string {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d + days);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    }

    const dates: string[] = [];
    let cur = date_from;
    // Cap at 31 days: larger ranges (1000 students x 30 days = 30k rows)
    // time out and OOM low-end devices. Callers must page month-by-month.
    const MAX_BULK_DAYS = 31;
    let guard = 0;
    while (cur <= date_to && guard < MAX_BULK_DAYS) {
      dates.push(cur);
      cur = addDays(cur, 1);
      guard++;
    }
    if (cur <= date_to) {
      return apiError(
        `Date range too large: capped at ${MAX_BULK_DAYS} days per request. Split into smaller ranges.`,
        400,
      );
    }

    const MAX_BULK_RECORDS = 5000;
    if (students.length * dates.length > MAX_BULK_RECORDS) {
      return apiError(
        `Bulk range too large (${students.length} students x ${dates.length} days). Reduce the date range or class size.`,
        400,
      );
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
          period_number: 1,
        });
      }
    }

    const BATCH_SIZE = 500;
    let upserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from("attendance")
        .upsert(batch, { onConflict: "student_id,date,period_number" });
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
