import { NextRequest, NextResponse } from "next/server";
import {
  computeSubjectTotal,
  computePLEAggregate,
  computeUCEDivision,
  computeUACEResult,
  getGradeLabel,
  generateAutoComment,
} from "@/lib/automation";
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

    const { schoolId, classIds, academicYear, term } = await request.json();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    if (!classIds || !Array.isArray(classIds) || classIds.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid parameter: classIds (array required)" },
        { status: 400 },
      );
    }

    const currentYear = academicYear || new Date().getFullYear().toString();
    const currentTerm = term || 1;

    // Get students in selected classes
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select(
        `
        id,
        first_name,
        last_name,
        student_number,
        parent_email,
        parent_phone,
        class_id,
        classes (id, name, level)
      `,
      )
      .in("class_id", classIds)
      .eq("school_id", school.schoolId)
      .eq("status", "active");

    if (studentsError) {
      return NextResponse.json(
        {
          error: "Failed to fetch students",
          details: studentsError.message,
        },
        { status: 500 },
      );
    }

    const results: {
      generated: any[];
      emailed: any[];
      skipped: any[];
      errors: any[];
    } = {
      generated: [],
      emailed: [],
      skipped: [],
      errors: [],
    };

    for (const student of students as any[]) {
      try {
        const studentClass = Array.isArray(student.classes)
          ? student.classes[0]
          : student.classes;

        if (!studentClass) {
          results.skipped.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: "No class assigned",
          });
          continue;
        }

        // Fetch grades for this student for the term
        const { data: grades, error: gradesError } = await supabase
          .from("student_grades")
          .select(
            `
            id,
            subject_id,
            ca1,
            ca2,
            ca3,
            ca4,
            project,
            exam_score,
            subjects (name)
          `,
          )
          .eq("student_id", student.id)
          .eq("academic_year", currentYear)
          .eq("term", currentTerm);

        if (gradesError) {
          results.errors.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: `Failed to fetch grades: ${gradesError.message}`,
          });
          continue;
        }

        if (!grades || grades.length === 0) {
          results.skipped.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: "No grades found for this term",
          });
          continue;
        }

        // Compute subject totals and aggregates
        const subjectResults: any[] = [];
        const subjectScores: number[] = [];

        for (const grade of grades as any[]) {
          const ca1 = grade.ca1 || 0;
          const ca2 = grade.ca2 || 0;
          const ca3 = grade.ca3 || 0;
          const ca4 = grade.ca4 || 0;
          const project = grade.project || 0;
          const exam = grade.exam_score || 0;

          const {
            totalCA,
            finalScore,
            grade: letterGrade,
            gradeLabel,
          } = computeSubjectTotal(ca1, ca2, ca3, ca4, project, exam);

          const comment = generateAutoComment(
            finalScore,
            grade.subjects?.name || "Subject",
            `${student.first_name} ${student.last_name}`,
          );

          subjectResults.push({
            subjectId: grade.subject_id,
            subjectName: grade.subjects?.name || "Unknown",
            ca1,
            ca2,
            ca3,
            ca4,
            project,
            exam,
            totalCA,
            finalScore,
            grade: letterGrade,
            gradeLabel,
            comment,
          });

          subjectScores.push(finalScore);
        }

        // Compute aggregate/division based on school level
        const level = studentClass.level || "";
        let aggregate = null;
        let division = null;
        let best4: number[] | null = null;

        if (level.startsWith("P") || level.includes("Primary")) {
          const pleResult = computePLEAggregate(subjectScores);
          aggregate = pleResult.aggregate;
          division = pleResult.division;
          best4 = pleResult.best4;
        } else if (level.startsWith("S") && level.includes("4")) {
          const gradeStrings = subjectResults.map((r: any) => r.grade);
          division = computeUCEDivision(gradeStrings);
        } else if (level.startsWith("S") && level.includes("6")) {
          const principalScores = subjectScores.slice(0, 3);
          const subsidiaryScores = subjectScores.slice(3);
          const uaceResult = computeUACEResult(
            principalScores,
            subsidiaryScores,
          );
          division = uaceResult.division;
          aggregate = uaceResult.points;
        }

        // Compute attendance for the term
        const { data: attendanceRecords } = await supabase
          .from("attendance")
          .select("status")
          .eq("student_id", student.id)
          .gte("date", `${currentYear}-01-01`)
          .lte("date", `${currentYear}-12-31`);

        const totalDays = attendanceRecords?.length || 0;
        const presentDays =
          attendanceRecords?.filter(
            (r: any) => r.status === "present" || r.status === "late",
          ).length || 0;
        const attendanceRate =
          totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

        // Check if report card already exists
        const { data: existingCards } = await supabase
          .from("report_cards")
          .select("id")
          .eq("student_id", student.id)
          .eq("academic_year", currentYear)
          .eq("term", currentTerm)
          .limit(1);

        let reportCardId: string;

        if (existingCards && existingCards.length > 0) {
          // Update existing report card
          reportCardId = existingCards[0].id;
          const { error: updateError } = await supabase
            .from("report_cards")
            .update({
              subjects: subjectResults,
              aggregate,
              division,
              best4,
              attendance_rate: attendanceRate,
              generated_at: new Date().toISOString(),
              generated_by: "system",
            })
            .eq("id", reportCardId);

          if (updateError) {
            results.errors.push({
              studentId: student.id,
              name: `${student.first_name} ${student.last_name}`,
              reason: `Failed to update report card: ${updateError.message}`,
            });
            continue;
          }
        } else {
          // Insert new report card
          const { data: newCard, error: insertError } = await supabase
            .from("report_cards")
            .insert({
              school_id: school.schoolId,
              student_id: student.id,
              class_id: student.class_id,
              academic_year: currentYear,
              term: currentTerm,
              subjects: subjectResults,
              aggregate,
              division,
              best4,
              attendance_rate: attendanceRate,
              generated_at: new Date().toISOString(),
              generated_by: "system",
            })
            .select("id")
            .single();

          if (insertError) {
            results.errors.push({
              studentId: student.id,
              name: `${student.first_name} ${student.last_name}`,
              reason: `Failed to create report card: ${insertError.message}`,
            });
            continue;
          }

          reportCardId = newCard.id;
        }

        results.generated.push({
          studentId: student.id,
          name: `${student.first_name} ${student.last_name}`,
          className: studentClass.name,
          reportCardId,
          subjectCount: subjectResults.length,
          division,
          attendanceRate,
        });

        // Send via email if parent email is configured
        if (student.parent_email) {
          try {
            await sendReportCardEmail(
              student.parent_email,
              `${student.first_name} ${student.last_name}`,
              studentClass.name,
              currentYear,
              currentTerm,
              subjectResults,
              division,
              attendanceRate,
            );

            results.emailed.push({
              studentId: student.id,
              email: student.parent_email,
            });
          } catch (emailErr) {
            results.errors.push({
              studentId: student.id,
              name: `${student.first_name} ${student.last_name}`,
              reason: `Email failed: ${emailErr instanceof Error ? emailErr.message : "Unknown error"}`,
            });
          }
        }
      } catch (err) {
        results.errors.push({
          studentId: student.id,
          name: `${student.first_name} ${student.last_name}`,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalStudents: students.length,
        generated: results.generated.length,
        emailed: results.emailed.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        academicYear: currentYear,
        term: currentTerm,
      },
      results,
    });
  } catch (error) {
    console.error("Auto report card generation error:", error);
    return NextResponse.json(
      {
        error: "Auto report card generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

async function sendReportCardEmail(
  email: string,
  studentName: string,
  className: string,
  academicYear: string,
  term: number,
  subjects: any[],
  division: string | null,
  attendanceRate: number,
) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.log(
      `[EMAIL] Report card for ${studentName} (${className}, ${academicYear} Term ${term}) would be sent to ${email}`,
    );
    return { success: true, messageId: "dev-mode" };
  }

  const subjectTable = subjects
    .map(
      (s: any) =>
        `<tr><td>${s.subjectName}</td><td>${s.finalScore}</td><td>${s.grade}</td><td>${s.gradeLabel}</td></tr>`,
    )
    .join("");

  const html = `
    <h2>Report Card - ${studentName}</h2>
    <p>Class: ${className} | Academic Year: ${academicYear} | Term: ${term}</p>
    <table border="1" cellpadding="5" cellspacing="0">
      <tr><th>Subject</th><th>Score</th><th>Grade</th><th>Remark</th></tr>
      ${subjectTable}
    </table>
    <p><strong>Division:</strong> ${division || "N/A"}</p>
    <p><strong>Attendance Rate:</strong> ${attendanceRate}%</p>
    <p>This is an automated report card generated by the school management system.</p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "noreply@omuto.org",
      to: [email],
      subject: `Report Card - ${studentName} | ${academicYear} Term ${term}`,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email send failed: ${errorText}`);
  }

  const data = await response.json();
  return { success: true, messageId: data.id };
}
