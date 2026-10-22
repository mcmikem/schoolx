"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { useAuth } from "@/lib/auth-context";
import { withTimeout } from "@/lib/hooks/utils";
import { supabase } from "@/lib/supabase";

interface PaperSubmission {
  id: string;
  exam_id: string;
  answers: Record<string, string>;
  submitted_at: string;
  marks_awarded: number | null;
  feedback: string | null;
  student: { first_name: string; last_name: string; student_number: string | null } | null;
  exam: { name: string; max_score: number; paper_model: any } | null;
}

export default function ExamPaperSubmissionsPage() {
  const { school, user, isDemo } = useAuth();
  const [rows, setRows] = useState<PaperSubmission[]>([]);
  const [selected, setSelected] = useState<PaperSubmission | null>(null);
  const [mark, setMark] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!school?.id || isDemo) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const response = await withTimeout(
      supabase
        .from("exam_paper_submissions")
        .select(
          "id,exam_id,answers,submitted_at,marks_awarded,feedback,students(first_name,last_name,student_number),exams(name,max_score,paper_model)",
        )
        .eq("school_id", school.id)
        .order("submitted_at", { ascending: false }),
      12000,
      { data: [], error: new Error("Submissions took too long to load.") } as any,
    );
    if (!response.error) {
      const mapped = (response.data || []).map((row: any) => ({
        ...row,
        student: row.students,
        exam: row.exams,
      })) as PaperSubmission[];
      setRows(mapped);
      setSelected((current) => (current ? mapped.find((row) => row.id === current.id) || null : null));
    } else {
      setMessage("Could not load submissions. Check that the Exam Lab database migration is installed and try again.");
    }
    setLoading(false);
  }, [school?.id, isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectSubmission = async (row: PaperSubmission) => {
    setSelected(row);
    setMark(row.marks_awarded === null ? "" : String(row.marks_awarded));
    setFeedback(row.feedback || "");
    setMessage(null);
    setSourceUrl(null);
    const sourcePath = row.exam?.paper_model?.assignment?.source_path;
    if (sourcePath) {
      const { data } = await supabase.storage.from("exam-papers").createSignedUrl(sourcePath, 3600);
      setSourceUrl(data?.signedUrl || null);
    }
  };

  const saveMark = async () => {
    if (!selected || !user?.id) return;
    const value = Number(mark);
    const max = selected.exam?.max_score || 0;
    if (!Number.isFinite(value) || value < 0 || value > max) {
      setMessage(`Enter a mark from 0 to ${max}.`);
      return;
    }
    setSaving(true);
    const response = await withTimeout(
      supabase
        .from("exam_paper_submissions")
        .update({
          marks_awarded: value,
          feedback: feedback.trim() || null,
          marked_by: user.id,
          marked_at: new Date().toISOString(),
        })
        .eq("id", selected.id),
      12000,
      { error: new Error("Saving the mark took too long. Please retry.") } as any,
    );
    if (response.error) setMessage(response.error.message || "Could not save the mark.");
    else {
      setMessage("Mark saved. The student can now see it in their portal.");
      await load();
    }
    setSaving(false);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <Link
        href="/dashboard/exam-lab/"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700"
      >
        <MaterialIcon>arrow_back</MaterialIcon>Back to Exam Lab
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Paper submissions</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review pupils’ answers, award the mark, and leave feedback. Long and written answers are not marked
          automatically.
        </p>
      </header>
      {message && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {message}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.5fr)]">
        <Card className="overflow-hidden p-0">
          <h2 className="border-b border-gray-100 p-4 text-sm font-semibold">Handed-in papers ({rows.length})</h2>
          {loading ? (
            <p className="p-4 text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No student answers have been handed in yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => selectSubmission(row)}
                  className={`tap-44 block w-full p-4 text-left hover:bg-gray-50 ${selected?.id === row.id ? "bg-blue-50" : ""}`}
                >
                  <span className="block text-sm font-semibold text-gray-900">
                    {row.student?.first_name} {row.student?.last_name}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-600">{row.exam?.name || "Practice paper"}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {row.marks_awarded === null
                      ? "Needs marking"
                      : `Marked: ${row.marks_awarded}/${row.exam?.max_score ?? "—"}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          {!selected ? (
            <div className="py-10 text-center text-sm text-gray-500">Choose a pupil’s submission to review.</div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900">
                {selected.student?.first_name} {selected.student?.last_name}
              </h2>
              <p className="text-sm text-gray-600">
                {selected.exam?.name} · handed in {new Date(selected.submitted_at).toLocaleString("en-UG")}
              </p>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-semibold"
                >
                  <MaterialIcon>picture_as_pdf</MaterialIcon>Check original paper
                </a>
              )}
              <div className="mt-4 space-y-3">
                {(selected.exam?.paper_model?.questions || []).map((question: any) => (
                  <section key={question.id} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500">
                      Question {question.number ?? "—"} {question.marks !== null ? `· ${question.marks} marks` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-900">{question.text}</p>
                    <p className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-800">
                      {selected.answers?.[question.id] || "No answer entered"}
                    </p>
                  </section>
                ))}
              </div>
              <label className="mt-4 block text-sm font-semibold">
                Final mark (out of {selected.exam?.max_score ?? "—"})
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  max={selected.exam?.max_score}
                  step="0.5"
                  value={mark}
                  onChange={(event) => setMark(event.target.value)}
                  className="mt-1 min-h-12 w-full rounded-lg border border-gray-300 px-3 text-base sm:max-w-xs"
                />
              </label>
              <label className="mt-3 block text-sm font-semibold">
                Feedback for the pupil
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-base"
                  placeholder="What went well? What should they revise?"
                />
              </label>
              <Button onClick={() => void saveMark()} disabled={saving} className="mt-4 min-h-12 w-full sm:w-auto">
                {saving ? "Saving…" : "Save mark and feedback"}
              </Button>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
