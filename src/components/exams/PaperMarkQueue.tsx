"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { withTimeout } from "@/lib/hooks/utils";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/index";
import { syncMarkedPaperToExamScores, type PaperExamSummary } from "@/lib/exam/score-sync";

interface Submission {
  id: string;
  exam_id: string;
  student_id: string;
  student_name: string | null;
  exam_name: string | null;
  exam: PaperExamSummary | null;
  answers: Record<string, string>;
}

export function PaperMarkQueue({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const [result, counted] = await Promise.all([
      withTimeout(
        (async () =>
          supabase
            .from("exam_paper_submissions")
            .select(
              "id,exam_id,student_id,answers,marks_awarded,feedback,exams(id,name,exam_type,class_id,subject_id,term,academic_year,max_score),students(first_name,last_name)",
            )
            .eq("school_id", school.id)
            .is("marks_awarded", null)
            .order("submitted_at", { ascending: false })
            .limit(50))(),
        12000,
        { data: null, error: new Error("Loading waited too long — try again.") } as any,
      ),
      withTimeout(
        supabase
          .from("exam_paper_submissions")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id)
          .is("marks_awarded", null),
        12000,
        { count: null, error: null } as any,
      ).catch(() => ({ count: null, error: null })),
    ]);
    if (result.error) {
      logger.log("paper mark queue load failed", { error: result.error.message });
      toast.showToast("Could not load the marking list. Try again.");
      setSubmissions([]);
    } else {
      setSubmissions(
        (result.data as unknown as Submission[]).map((row) => {
          const exam = (row as Record<string, any>).exams as (PaperExamSummary & { name?: string }) | null;
          const student = (row as Record<string, any>).students as { first_name?: string; last_name?: string } | null;
          return {
            ...row,
            exam: exam
              ? {
                  id: exam.id,
                  exam_type: exam.exam_type,
                  class_id: exam.class_id ?? null,
                  subject_id: exam.subject_id ?? null,
                  term: exam.term ?? null,
                  academic_year: exam.academic_year ?? null,
                  max_score: exam.max_score ?? null,
                }
              : null,
            exam_name: exam?.name ?? null,
            student_name: student ? [student.first_name, student.last_name].filter(Boolean).join(" ") : null,
          };
        }),
      );
    }
    onCountChange?.(counted?.count ?? 0);
    setLoading(false);
  }, [school?.id, toast, onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const mark = async (row: Submission, marks: number, feedback: string) => {
    const maxScore = row.exam?.max_score ?? 100;
    if (!Number.isFinite(marks) || marks < 0 || marks > maxScore) {
      toast.showToast(`Marks must be between 0 and ${maxScore}.`);
      return;
    }
    setSavingId(row.id);
    const result = await withTimeout(
      supabase
        .from("exam_paper_submissions")
        .update({
          marks_awarded: marks,
          feedback: feedback || null,
          marked_by: user?.id ?? null,
          marked_at: new Date().toISOString(),
        })
        .eq("id", row.id),
      12000,
      { error: new Error("Saving took too long — try again.") } as any,
    );
    if (result.error) {
      toast.showToast("Could not save the mark. Your entry is still here.");
      logger.log("paper mark save failed", { error: result.error?.message });
      setSavingId(null);
      return;
    }

    // The paper is marked; now make the mark count. Demo sessions have no
    // writeable grades, so the record stays in the queue's own toast.
    if (!isDemo && row.exam) {
      const synced = await syncMarkedPaperToExamScores(supabase, {
        studentId: row.student_id,
        exam: row.exam,
        marks,
        recordedBy: user?.id ?? null,
      });
      if (!synced.ok) {
        logger.log("marked paper score sync failed", { error: synced.error });
        toast.showToast("Mark saved, but the exam score could not be updated.");
        setSavingId(null);
        await load();
        return;
      }
    }
    toast.showToast("Mark saved.");
    await load();
    setSavingId(null);
  };

  if (loading) {
    return <p className="text-sm text-neutral-600">Loading handed-in papers…</p>;
  }

  if (submissions.length === 0) {
    return <p className="text-sm text-neutral-600">Nothing waiting to be marked.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {submissions.map((row) => (
        <PaperMarkQueueItem
          key={row.id}
          row={row}
          saving={savingId === row.id}
          onSave={(marks, feedback) => void mark(row, marks, feedback)}
        />
      ))}
    </div>
  );
}

function PaperMarkQueueItem({
  row,
  saving,
  onSave,
}: {
  row: Submission;
  saving: boolean;
  onSave: (marks: number, feedback: string) => void;
}) {
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const entries = Object.entries(row.answers ?? {}).slice(0, 12);

  return (
    <div className="rounded-xl border p-4 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-semibold">{row.student_name ?? "Unknown pupil"}</p>
          <p className="text-sm text-neutral-600">{row.exam_name ?? "Paper"}</p>
        </div>
      </div>
      <ul className="mt-2 space-y-1 text-sm max-h-64 overflow-y-auto">
        {entries.map(([key, value]) => (
          <li key={key}>
            <span className="text-neutral-500">{key}</span>: <span>{value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <input
          aria-label="Marks"
          inputMode="numeric"
          className="w-24 rounded-lg border px-3 py-2 text-sm"
          placeholder="e.g. 72"
          value={marks}
          onChange={(event) => setMarks(event.target.value)}
        />
        <input
          aria-label="Feedback"
          type="text"
          className="flex-1 min-w-[10rem] rounded-lg border px-3 py-2 text-sm"
          placeholder="Feedback (optional)"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
        />
        <Button
          onClick={() => {
            if (!Number.isFinite(Number(marks))) return;
            onSave(Number(marks), feedback);
          }}
          disabled={saving || !Number.isFinite(Number(marks))}
        >
          {saving ? "Saving…" : "Save mark"}
        </Button>
      </div>
    </div>
  );
}
