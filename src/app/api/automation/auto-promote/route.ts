import { NextRequest, NextResponse } from "next/server";
import {
  requireCronSecretOrDeny,
  createServiceRoleClientOrThrow,
  requireExistingSchoolOrDeny,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const supabase = createServiceRoleClientOrThrow();

    const { schoolId, academicYear, criteria } = await request.json();

    if (!academicYear) {
      return NextResponse.json(
        { error: "Missing required parameter: academicYear" },
        { status: 400 },
      );
    }

    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    const promotionCriteria = criteria || {
      minAverageScore: 50,
      minAttendancePercent: 75,
      maxFailedSubjects: 2,
    };

    // Use service role to bypass RLS
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select(
        `
        id, first_name, last_name, class_id, student_number, school_id,
        classes (id, name, level),
        grades (subject_id, ca1, ca2, ca3, exam_score, subjects (name)),
        attendance (status)
      `,
      )
      .eq("school_id", school.schoolId)
      .eq("status", "active");

    if (studentsError) {
      return NextResponse.json(
        { error: "Failed to fetch students", details: studentsError.message },
        { status: 500 },
      );
    }

    if (!students || students.length === 0) {
      return NextResponse.json(
        {
          error: "No students found for this school",
          summary: { promoted: 0, retained: 0, errors: 0 },
        },
        { status: 400 },
      );
    }

    const promoted: any[] = [];
    const retained: any[] = [];
    const errors: any[] = [];

    for (const student of students as any[]) {
      try {
        const studentClass = Array.isArray(student.classes)
          ? student.classes[0]
          : student.classes;
        if (!studentClass) {
          errors.push({ studentId: student.id, reason: "No class assigned" });
          continue;
        }

        const grades = student.grades || [];
        const validGrades = grades.filter(
          (g: any) =>
            g.ca1 !== null &&
            g.ca2 !== null &&
            g.ca3 !== null &&
            g.exam_score !== null,
        );

        let averageScore = 0;
        let failedSubjects = 0;

        if (validGrades.length > 0) {
          const totalScore = validGrades.reduce(
            (sum: number, g: any) =>
              sum +
              (g.ca1 || 0) +
              (g.ca2 || 0) +
              (g.ca3 || 0) +
              (g.exam_score || 0),
            0,
          );
          averageScore = totalScore / (validGrades.length * 4);
          failedSubjects = validGrades.filter((g: any) => {
            const total =
              (g.ca1 || 0) + (g.ca2 || 0) + (g.ca3 || 0) + (g.exam_score || 0);
            return total / 4 < 40;
          }).length;
        }

        const attendanceRecords = student.attendance || [];
        const totalDays = attendanceRecords.length;
        const presentDays = attendanceRecords.filter((r: any) =>
          ["present", "late"].includes(r.status),
        ).length;
        const attendancePercent =
          totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

        const isEligible =
          averageScore >= promotionCriteria.minAverageScore &&
          attendancePercent >= promotionCriteria.minAttendancePercent &&
          failedSubjects <= promotionCriteria.maxFailedSubjects;

        if (isEligible) {
          const levelNum = parseInt(studentClass.level.replace(/\D/g, ""));
          let nextLevelPattern = "";
          if (studentClass.level === "P.7" || studentClass.level.includes("P7"))
            nextLevelPattern = "S.1";
          else if (
            studentClass.level === "S.4" ||
            studentClass.level.includes("S4")
          )
            nextLevelPattern = "S.5";
          else nextLevelPattern = String(levelNum + 1);

          const { data: nextClasses } = await supabase
            .from("classes")
            .select("id, name")
            .eq("school_id", school.schoolId)
            .ilike("level", `%${nextLevelPattern}%`)
            .limit(1);

          if (nextClasses && nextClasses.length > 0) {
            const nextClassId = nextClasses[0].id;
            await (supabase as any)
              .from("students")
              .update({ class_id: nextClassId, repeating: false })
              .eq("id", student.id);
            await (supabase as any).from("student_promotions").insert({
              school_id: school.schoolId,
              student_id: student.id,
              from_class_id: studentClass.id,
              to_class_id: nextClassId,
              academic_year: academicYear,
              promotion_type: "promoted",
              promoted_by: "system",
              promoted_at: new Date().toISOString(),
              notes: `Auto-promoted: Avg ${averageScore.toFixed(1)}, Att ${attendancePercent.toFixed(1)}%`,
            });
            promoted.push({
              studentId: student.id,
              name: `${student.first_name} ${student.last_name}`,
              fromClass: studentClass.name,
              toClass: nextClasses[0].name,
            });
          } else {
            retained.push({
              studentId: student.id,
              name: `${student.first_name} ${student.last_name}`,
              reason: "No next class found",
            });
          }
        } else {
          const reasons: string[] = [];
          if (averageScore < promotionCriteria.minAverageScore)
            reasons.push(
              `Avg ${averageScore.toFixed(1)} < ${promotionCriteria.minAverageScore}`,
            );
          if (attendancePercent < promotionCriteria.minAttendancePercent)
            reasons.push(
              `Att ${attendancePercent.toFixed(1)}% < ${promotionCriteria.minAttendancePercent}%`,
            );
          if (failedSubjects > promotionCriteria.maxFailedSubjects)
            reasons.push(
              `${failedSubjects} failed > ${promotionCriteria.maxFailedSubjects}`,
            );
          retained.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: reasons.join("; "),
          });
        }
      } catch (err) {
        errors.push({
          studentId: student.id,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: students.length,
        promoted: promoted.length,
        retained: retained.length,
        errors: errors.length,
      },
      results: { promoted, retained, errors },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Auto-promotion failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
