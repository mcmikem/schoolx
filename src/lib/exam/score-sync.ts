import type { SupabaseClient } from "@supabase/supabase-js";
import { mapExamScoreToGrade } from "@/lib/grading";

export interface PaperExamSummary {
  id: string;
  exam_type: string;
  class_id: string | null;
  subject_id: string | null;
  term: number | null;
  academic_year: string | null;
  max_score: number | null;
}

export interface MarkSyncResult {
  ok: boolean;
  error?: string;
}

/**
 * Finds the exam_scores row that represents this (pupil, exam) pair: the exam
 * id when the row was written from the paper, otherwise the composite key the
 * Exams page upserts on. Nullable columns cannot use `onConflict` (Postgres
 * treats NULLs as distinct), so the match is a query rather than an upsert.
 */
async function findScoreRow(client: SupabaseClient, studentId: string, exam: PaperExamSummary): Promise<string | null> {
  const byExam = await client
    .from("exam_scores")
    .select("id")
    .eq("student_id", studentId)
    .eq("exam_id", exam.id)
    .maybeSingle();
  if (byExam.error) throw new Error(byExam.error.message);
  if (byExam.data) return (byExam.data as { id: string }).id;

  let query = client.from("exam_scores").select("id").eq("student_id", studentId).eq("exam_type", exam.exam_type);
  query = exam.subject_id ? query.eq("subject_id", exam.subject_id) : query.is("subject_id", null);
  query = exam.term === null || exam.term === undefined ? query.is("term", null) : query.eq("term", exam.term);
  query = exam.academic_year ? query.eq("academic_year", exam.academic_year) : query.is("academic_year", null);
  const composite = await query.limit(1);
  if (composite.error) throw new Error(composite.error.message);
  const rows = (composite.data ?? []) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

/**
 * Records a teacher's mark for a paper against the exam itself, so the mark
 * appears in the Exams grid and (for the terminal exam) in the report-card
 * grades slot — the same two writes the Exams page performs when a score is
 * typed there. Re-marking a paper overwrites the previous mark instead of
 * adding a duplicate row.
 */
export async function syncMarkedPaperToExamScores(
  client: SupabaseClient,
  input: { studentId: string; exam: PaperExamSummary; marks: number; recordedBy: string | null },
): Promise<MarkSyncResult> {
  const { studentId, exam, marks, recordedBy } = input;
  const maxScore = exam.max_score ?? 100;
  if (!Number.isFinite(marks) || marks < 0 || marks > maxScore) {
    return { ok: false, error: `Marks must be between 0 and ${maxScore}` };
  }

  const row = {
    student_id: studentId,
    subject_id: exam.subject_id,
    class_id: exam.class_id,
    exam_type: exam.exam_type,
    exam_id: exam.id,
    score: marks,
    max_score: maxScore,
    term: exam.term,
    academic_year: exam.academic_year,
    recorded_by: recordedBy,
  };

  try {
    const existingId = await findScoreRow(client, studentId, exam);
    if (existingId) {
      const updated = await client.from("exam_scores").update(row).eq("id", existingId);
      if (updated.error) throw new Error(updated.error.message);
    } else {
      const inserted = await client.from("exam_scores").insert(row);
      if (inserted.error) throw new Error(inserted.error.message);
    }

    // Only the terminal exam feeds the grades 'exam' slot used by report
    // cards; interim types live in exam_scores keyed by exam_type. The grades
    // key needs a year — an exam without one stays exam_scores-only.
    if (exam.exam_type === "eot" && exam.subject_id && exam.class_id && exam.academic_year) {
      const payload = mapExamScoreToGrade({
        student_id: studentId,
        subject_id: exam.subject_id,
        class_id: exam.class_id,
        score: marks,
        term: exam.term ?? 1,
        academic_year: exam.academic_year,
        recorded_by: recordedBy ?? undefined,
      });
      const graded = await client.from("grades").upsert(payload, {
        onConflict: "student_id,subject_id,assessment_type,term,academic_year",
      });
      if (graded.error) throw new Error(graded.error.message);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
