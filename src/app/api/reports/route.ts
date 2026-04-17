import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  validateRequiredFields,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";
const REPORT_ALLOWED_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "teacher",
  "secretary",
];

function getUNEBGrade(score: number): string {
  if (score >= 80) return "D1";
  if (score >= 70) return "D2";
  if (score >= 65) return "C3";
  if (score >= 60) return "C4";
  if (score >= 55) return "C5";
  if (score >= 50) return "C6";
  if (score >= 45) return "P7";
  if (score >= 40) return "P8";
  return "F9";
}

function getUNEBDivision(avg: number): string {
  if (avg >= 80) return "Division I";
  if (avg >= 60) return "Division II";
  if (avg >= 40) return "Division III";
  if (avg >= 20) return "Division IV";
  return "Ungraded";
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: REPORT_ALLOWED_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const { studentId, schoolId, term, academicYear } = await request.json();

    const validationError = validateRequiredFields({ studentId, schoolId }, [
      "studentId",
      "schoolId",
    ]);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    });
    if (!scope.ok) return scope.response;

    // Fetch student with class info
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*, classes (id, name, level)")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return apiError("Student not found", 404);
    }

    if (student.school_id !== schoolId) {
      return apiError("Student does not belong to the requested school", 403);
    }

    // Fetch school info
    const { data: school } = await supabase
      .from("schools")
      .select("*")
      .eq("id", scope.schoolId)
      .single();

    // Fetch grades for this term
    const { data: grades } = await supabase
      .from("grades")
      .select("*, subjects (name, code)")
      .eq("student_id", studentId)
      .eq("term", term || 1)
      .eq("academic_year", academicYear || new Date().getFullYear().toString());

    // Fetch attendance summary
    const { data: attendanceRecords } = await supabase
      .from("attendance")
      .select("status")
      .eq("student_id", studentId);

    const attendanceSummary = {
      total: attendanceRecords?.length || 0,
      present:
        attendanceRecords?.filter((a: { status: string }) => a.status === "present")
          .length || 0,
      absent:
        attendanceRecords?.filter((a: { status: string }) => a.status === "absent")
          .length || 0,
      late:
        attendanceRecords?.filter((a: { status: string }) => a.status === "late")
          .length || 0,
    };

    // Organize grades by subject
    const subjectGrades: Record<string, any> = {};
    grades?.forEach((grade: any) => {
      const subjectName = grade.subjects?.name || "Unknown";
      if (!subjectGrades[subjectName]) {
        subjectGrades[subjectName] = {
          name: subjectName,
          code: grade.subjects?.code || "",
          ca1: 0,
          ca2: 0,
          ca3: 0,
          ca4: 0,
          project: 0,
          exam: 0,
        };
      }
      subjectGrades[subjectName][grade.assessment_type] = Number(grade.score);
    });

    // Calculate averages and grades
    const reportData = Object.values(subjectGrades).map((subject: any) => {
      const totalCA =
        (subject.ca1 +
          subject.ca2 +
          subject.ca3 +
          subject.ca4 +
          subject.project) /
        5;
      const finalScore = totalCA * 0.8 + subject.exam * 0.2;
      const grade = getUNEBGrade(finalScore);
      return {
        ...subject,
        totalCA: Math.round(totalCA * 10) / 10,
        finalScore: Math.round(finalScore * 10) / 10,
        grade,
      };
    });

    // Calculate overall average
    const overallAvg =
      reportData.length > 0
        ? reportData.reduce((sum, s) => sum + s.finalScore, 0) /
          reportData.length
        : 0;

    const division = getUNEBDivision(overallAvg);

    return apiSuccess({
      student,
      school,
      term: term || 1,
      academicYear: academicYear || new Date().getFullYear().toString(),
      subjects: reportData,
      attendance: attendanceSummary,
      overall: {
        average: Math.round(overallAvg * 10) / 10,
        grade: getUNEBGrade(overallAvg),
        division,
        position: null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
