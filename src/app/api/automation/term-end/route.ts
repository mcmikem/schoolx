import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  computeSubjectTotal,
  computePLEAggregate,
  computeUCEDivision,
  computeUACEResult,
  generateAutoComment,
} from "@/lib/automation";
import {
  buildRolloverPreview,
  isTerminalClass,
  getNextClassName,
} from "@/lib/operations";
import { requireCronSecretOrDeny } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { schoolId, currentTerm, academicYear } = await request.json();

    if (!schoolId) {
      return NextResponse.json(
        { error: "Missing required parameter: schoolId" },
        { status: 400 },
      );
    }

    const term = currentTerm || 3;
    const year = academicYear || new Date().getFullYear().toString();

    const steps: {
      step: string;
      status: "pending" | "completed" | "failed";
      details?: any;
      error?: string;
    }[] = [
      { step: "lock_grades", status: "pending" },
      { step: "generate_report_cards", status: "pending" },
      { step: "archive_term_data", status: "pending" },
      { step: "send_term_end_notices", status: "pending" },
      { step: "prepare_next_term", status: "pending" },
    ];

    let overallSuccess = true;

    // ==========================================
    // STEP 1: Lock all grades for the term
    // ==========================================
    try {
      const { data: grades, error: gradesError } = await supabase
        .from("student_grades")
        .select("id, student_id, subject_id, status")
        .eq("academic_year", year)
        .eq("term", term);

      if (gradesError) {
        throw new Error(gradesError.message);
      }

      const gradeIds = (grades || []).map((g: any) => g.id);

      if (gradeIds.length > 0) {
        const { error: updateError } = await supabase
          .from("student_grades")
          .update({
            status: "published",
            locked: true,
            locked_at: new Date().toISOString(),
          })
          .in("id", gradeIds);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      steps[0] = {
        step: "lock_grades",
        status: "completed",
        details: { gradesLocked: gradeIds.length },
      };
    } catch (err) {
      steps[0] = {
        step: "lock_grades",
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      };
      overallSuccess = false;
    }

    // ==========================================
    // STEP 2: Generate all report cards
    // ==========================================
    try {
      // Get all classes for this school
      const { data: classes, error: classesError } = await supabase
        .from("classes")
        .select("id, name, level")
        .eq("school_id", schoolId);

      if (classesError) {
        throw new Error(classesError.message);
      }

      const classIds = (classes || []).map((c: any) => c.id);

      if (classIds.length === 0) {
        throw new Error("No classes found for this school");
      }

      // Get all active students
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select(
          `
          id, first_name, last_name, student_number, parent_email, parent_phone, class_id,
          classes (id, name, level)
        `,
        )
        .in("class_id", classIds)
        .eq("school_id", schoolId)
        .eq("status", "active");

      if (studentsError) {
        throw new Error(studentsError.message);
      }

      let generatedCount = 0;
      let emailedCount = 0;

      for (const student of students as any[]) {
        try {
          const studentClass = Array.isArray(student.classes)
            ? student.classes[0]
            : student.classes;

          if (!studentClass) continue;

          // Fetch grades
          const { data: grades } = await supabase
            .from("student_grades")
            .select(
              `
              id, subject_id, ca1, ca2, ca3, ca4, project, exam_score,
              subjects (name)
            `,
            )
            .eq("student_id", student.id)
            .eq("academic_year", year)
            .eq("term", term);

          if (!grades || grades.length === 0) continue;

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
            division = computeUCEDivision(
              subjectResults.map((r: any) => r.grade),
            );
          } else if (level.startsWith("S") && level.includes("6")) {
            const uaceResult = computeUACEResult(
              subjectScores.slice(0, 3),
              subjectScores.slice(3),
            );
            division = uaceResult.division;
            aggregate = uaceResult.points;
          }

          // Insert report card
          const { data: newCard } = await supabase
            .from("report_cards")
            .insert({
              school_id: schoolId,
              student_id: student.id,
              class_id: student.class_id,
              academic_year: year,
              term,
              subjects: subjectResults,
              aggregate,
              division,
              best4,
              generated_at: new Date().toISOString(),
              generated_by: "system",
            })
            .select("id")
            .single();

          if (newCard) {
            generatedCount++;

            // Send email if parent email exists
            if (student.parent_email) {
              try {
                await sendReportCardEmail(
                  student.parent_email,
                  `${student.first_name} ${student.last_name}`,
                  studentClass.name,
                  year,
                  term,
                  subjectResults,
                  division,
                );
                emailedCount++;
              } catch (_) {
                // Email failure is non-fatal
              }
            }
          }
        } catch (_) {
          // Individual student failure is non-fatal
        }
      }

      steps[1] = {
        step: "generate_report_cards",
        status: "completed",
        details: { generated: generatedCount, emailed: emailedCount },
      };
    } catch (err) {
      steps[1] = {
        step: "generate_report_cards",
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      };
      overallSuccess = false;
    }

    // ==========================================
    // STEP 3: Archive term data
    // ==========================================
    try {
      const { data: classes, error: classesError } = await supabase
        .from("classes")
        .select("id, name, level, academic_year")
        .eq("school_id", schoolId);

      if (classesError) {
        throw new Error(classesError.message);
      }

      const { data: students } = await supabase
        .from("students")
        .select("id, first_name, last_name, class_id, status")
        .eq("school_id", schoolId);

      const { data: grades } = await supabase
        .from("student_grades")
        .select(
          "id, student_id, subject_id, ca1, ca2, ca3, ca4, project, exam_score, final_score",
        )
        .eq("academic_year", year)
        .eq("term", term);

      // Create term archive record
      const { data: archive, error: archiveError } = await supabase
        .from("term_archives")
        .insert({
          school_id: schoolId,
          academic_year: year,
          term,
          classes_count: classes?.length || 0,
          students_count: students?.length || 0,
          grades_count: grades?.length || 0,
          archived_at: new Date().toISOString(),
          archived_by: "system",
          data: {
            classes: classes || [],
            students: students || [],
            gradesCount: grades?.length || 0,
          },
        })
        .select("id")
        .single();

      if (archiveError) {
        throw new Error(archiveError.message);
      }

      steps[2] = {
        step: "archive_term_data",
        status: "completed",
        details: {
          archiveId: archive.id,
          classesArchived: classes?.length || 0,
          studentsArchived: students?.length || 0,
          gradesArchived: grades?.length || 0,
        },
      };
    } catch (err) {
      steps[2] = {
        step: "archive_term_data",
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      };
      overallSuccess = false;
    }

    // ==========================================
    // STEP 4: Send term-end notices to parents
    // ==========================================
    try {
      const { data: students } = await supabase
        .from("students")
        .select(
          "id, first_name, last_name, parent_email, parent_phone, class_id, classes (name)",
        )
        .eq("school_id", schoolId)
        .eq("status", "active");

      let noticesSent = 0;
      let noticeErrors = 0;

      for (const student of students as any[]) {
        const className = Array.isArray(student.classes)
          ? student.classes[0]?.name || "Unknown"
          : student.classes?.name || "Unknown";

        const studentName = `${student.first_name} ${student.last_name}`;

        // Email notice
        if (student.parent_email) {
          try {
            await sendTermEndNoticeEmail(
              student.parent_email,
              studentName,
              className,
              year,
              term,
            );
            noticesSent++;
          } catch (_) {
            noticeErrors++;
          }
        }

        // SMS notice
        if (student.parent_phone) {
          try {
            const smsMessage = `Dear parent, Term ${term} ${year} has ended for ${studentName} (${className}). Report cards are now available. Contact the school for any inquiries.`;
            await sendSMS(student.parent_phone, smsMessage);
            noticesSent++;
          } catch (_) {
            noticeErrors++;
          }
        }
      }

      steps[3] = {
        step: "send_term_end_notices",
        status: "completed",
        details: { noticesSent, noticeErrors },
      };
    } catch (err) {
      steps[3] = {
        step: "send_term_end_notices",
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      };
      overallSuccess = false;
    }

    // ==========================================
    // STEP 5: Prepare for next term
    // ==========================================
    try {
      const nextTerm = term < 3 ? term + 1 : 1;
      const nextYear = term === 3 ? String(Number(year) + 1) : year;

      // Get current classes and students
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name, level, academic_year")
        .eq("school_id", schoolId);

      const { data: students } = await supabase
        .from("students")
        .select("id, first_name, last_name, class_id, status")
        .eq("school_id", schoolId);

      // Build rollover preview
      const rolloverPreview = buildRolloverPreview({
        academicYear: year,
        currentTerm: term as 1 | 2 | 3,
        nextAcademicYear: nextYear,
        schoolType: "combined",
        students: (students || []).map((s: any) => ({
          id: s.id,
          class_id: s.class_id,
          status: s.status,
          classes: { name: "" },
        })),
        classes: (classes || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          level: c.level,
          academic_year: c.academic_year,
        })),
      });

      // Update academic year/term settings
      await supabase
        .from("school_settings")
        .update({
          current_term: nextTerm,
          academic_year: nextYear,
          updated_at: new Date().toISOString(),
        })
        .eq("school_id", schoolId);

      // Create next term record if it doesn't exist
      const { data: existingTerm } = await supabase
        .from("academic_terms")
        .select("id")
        .eq("school_id", schoolId)
        .eq("academic_year", nextYear)
        .eq("term", nextTerm)
        .limit(1);

      if (!existingTerm || existingTerm.length === 0) {
        await supabase.from("academic_terms").insert({
          school_id: schoolId,
          academic_year: nextYear,
          term: nextTerm,
          status: "upcoming",
          created_at: new Date().toISOString(),
        });
      }

      steps[4] = {
        step: "prepare_next_term",
        status: "completed",
        details: {
          nextTerm,
          nextYear,
          classesToClone: rolloverPreview.clonedClasses.length,
          entryClasses: rolloverPreview.entryClassNames,
          graduatingStudents: rolloverPreview.graduatingStudentIds.length,
        },
      };
    } catch (err) {
      steps[4] = {
        step: "prepare_next_term",
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      };
      overallSuccess = false;
    }

    return NextResponse.json({
      success: overallSuccess,
      summary: {
        schoolId,
        academicYear: year,
        term,
        stepsCompleted: steps.filter((s) => s.status === "completed").length,
        stepsFailed: steps.filter((s) => s.status === "failed").length,
        overallSuccess,
      },
      steps,
    });
  } catch (error) {
    console.error("Term end processing error:", error);
    return NextResponse.json(
      {
        error: "Term end processing failed",
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
) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.log(
      `[EMAIL] Report card for ${studentName} would be sent to ${email}`,
    );
    return { success: true, messageId: "dev-mode" };
  }

  const subjectTable = subjects
    .map(
      (s: any) =>
        `<tr><td>${s.subjectName}</td><td>${s.finalScore}</td><td>${s.grade}</td></tr>`,
    )
    .join("");

  const html = `
    <h2>Report Card - ${studentName}</h2>
    <p>Class: ${className} | ${academicYear} Term ${term}</p>
    <table border="1" cellpadding="5" cellspacing="0">
      <tr><th>Subject</th><th>Score</th><th>Grade</th></tr>
      ${subjectTable}
    </table>
    <p><strong>Division:</strong> ${division || "N/A"}</p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "noreply@schoolx.com",
      to: [email],
      subject: `Report Card - ${studentName} | ${academicYear} Term ${term}`,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email send failed: ${errorText}`);
  }

  return { success: true };
}

async function sendTermEndNoticeEmail(
  email: string,
  studentName: string,
  className: string,
  academicYear: string,
  term: number,
) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.log(
      `[EMAIL] Term-end notice for ${studentName} would be sent to ${email}`,
    );
    return { success: true, messageId: "dev-mode" };
  }

  const html = `
    <h2>Term End Notice</h2>
    <p>Dear Parent/Guardian,</p>
    <p>This is to inform you that <strong>Term ${term}, ${academicYear}</strong> has officially ended for <strong>${studentName}</strong> in <strong>${className}</strong>.</p>
    <p>Report cards are now available. Please contact the school office for any inquiries or to discuss your child's academic progress.</p>
    <p>Thank you for your continued support.</p>
    <p><em>School Management System</em></p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "noreply@schoolx.com",
      to: [email],
      subject: `Term ${term} ${academicYear} Ended - ${studentName}`,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email send failed: ${errorText}`);
  }

  return { success: true };
}

async function sendSMS(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const apiKey = process.env.SMS_API_KEY;
    const username = process.env.SMS_USERNAME || "sandbox";

    if (!apiKey) {
      console.log(`[SMS] To: ${phone}, Message: ${message}`);
      return { success: true, messageId: "dev-mode" };
    }

    const response = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apikey: apiKey,
        },
        body: new URLSearchParams({
          username,
          to: phone,
          message,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const data = await response.json();
    const messageId = data.SMSMessageData?.Recipients?.[0]?.messageId;

    return { success: true, messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
