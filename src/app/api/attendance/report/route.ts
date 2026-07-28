import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const REPORT_ALLOWED_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "teacher",
  "secretary",
  "bursar",
];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: REPORT_ALLOWED_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const { searchParams } = request.nextUrl;
    const school_id = searchParams.get("school_id") || auth.context.schoolId;
    const class_id = searchParams.get("class_id");
    const student_id = searchParams.get("student_id");
    const date_from = searchParams.get("date_from");
    const date_to = searchParams.get("date_to");

    if (!school_id) {
      return apiError("school_id is required", 400);
    }

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: school_id,
    });
    if (!scope.ok) return scope.response;

    const supabase = createServiceRoleClientOrThrow();

    let attendanceQuery = supabase
      .from("attendance")
      .select("id, student_id, class_id, date, status, recorded_by, created_at")
      .gte("date", date_from || "1970-01-01")
      .lte("date", date_to || "2099-12-31");

    if (class_id) {
      attendanceQuery = attendanceQuery.eq("class_id", class_id);
    }
    if (student_id) {
      attendanceQuery = attendanceQuery.eq("student_id", student_id);
    }

    const { data: attendance, error: attError } = await attendanceQuery;
    if (attError) {
      logger.error("Failed to fetch attendance records:", attError);
      return apiError(attError.message, 500);
    }

    if (!attendance || attendance.length === 0) {
      return apiSuccess({
        summary: { total: 0, present: 0, absent: 0, late: 0, excused: 0, rate: 0 },
        students: [],
        class_aggregate: null,
      });
    }

    const studentIds = [...new Set(attendance.map((a: any) => a.student_id))];

    const { data: studentsData, error: studentsError } = await supabase
      .from("students")
      .select("id, first_name, last_name, student_number, class_id")
      .in("id", studentIds);

    if (studentsError) {
      logger.error("Failed to fetch student details:", studentsError);
      return apiError(studentsError.message, 500);
    }

    const studentMap = new Map((studentsData || []).map((s: any) => [s.id, s]));

    const perStudent: Record<string, any> = {};
    for (const sid of studentIds) {
      perStudent[sid] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    }

    for (const record of attendance as any[]) {
      const s = perStudent[record.student_id];
      if (s) {
        s[record.status] = (s[record.status] || 0) + 1;
        s.total++;
      }
    }

    const studentSummaries = Object.entries(perStudent).map(([sid, counts]: [string, any]) => {
      const student = studentMap.get(sid);
      const rate = counts.total > 0 ? counts.present / counts.total : 0;
      return {
        student_id: sid,
        first_name: student?.first_name || "Unknown",
        last_name: student?.last_name || "Unknown",
        student_number: student?.student_number || "",
        ...counts,
        rate: Math.round(rate * 1000) / 10,
      };
    });

    const totalPresent = attendance.filter((a: any) => a.status === "present").length;
    const totalAbsent = attendance.filter((a: any) => a.status === "absent").length;
    const totalLate = attendance.filter((a: any) => a.status === "late").length;
    const totalExcused = attendance.filter((a: any) => a.status === "excused").length;
    const totalAll = attendance.length;
    const overallRate = totalAll > 0 ? (totalPresent / totalAll) * 100 : 0;

    let classAggregate = null;
    if (!student_id) {
      classAggregate = {
        total_records: totalAll,
        present: totalPresent,
        absent: totalAbsent,
        late: totalLate,
        excused: totalExcused,
        rate: Math.round(overallRate * 10) / 10,
        student_count: studentIds.length,
      };
    }

    return apiSuccess({
      summary: {
        total: totalAll,
        present: totalPresent,
        absent: totalAbsent,
        late: totalLate,
        excused: totalExcused,
        rate: Math.round(overallRate * 10) / 10,
      },
      students: studentSummaries,
      class_aggregate: classAggregate,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
