"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PdfSourceViewer from "@/components/exam/PdfSourceViewer";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import type { ExamPaper, ExamQuestion } from "@/lib/exam/exam-model";
import {
  displayQuestionSubTaskLabel,
  isQuestionAnswered,
  questionNeedsOriginalPage,
  questionStem,
  subTaskAnswerKey,
} from "@/lib/exam/student-practice";
import { withTimeout } from "@/lib/hooks/utils";
import { supabase } from "@/lib/supabase";

interface PracticeExam {
  id: string;
  name: string;
  exam_date: string;
  max_score: number;
  paper_model: ExamPaper & { assignment?: { published?: boolean; due_date?: string; source_path?: string } };
}

interface Submission {
  answers: Record<string, string>;
  marks_awarded: number | null;
  feedback: string | null;
  submitted_at: string;
}

const draftKey = (studentId: string, examId: string) => `skoolmate-exam-draft-${studentId}-${examId}`;

export default function StudentPractice({
  schoolId,
  classId,
  studentId,
  isDemo,
}: {
  schoolId?: string;
  classId?: string | null;
  studentId: string;
  isDemo: boolean;
}) {
  const [papers, setPapers] = useState<PracticeExam[]>([]);
  const [selected, setSelected] = useState<PracticeExam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [sourcePage, setSourcePage] = useState(1);
  const [showOriginal, setShowOriginal] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [confirmHandIn, setConfirmHandIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"saved" | "saving" | "error">("saved");
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadPapers = useCallback(async () => {
    if (!schoolId || !classId || isDemo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await withTimeout(
        supabase
          .from("exams")
          .select("id,name,exam_date,max_score,paper_model")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .order("exam_date", { ascending: true }),
        10000,
        { data: [], error: new Error("Practice papers took too long to load.") } as any,
      );
      if (result.error) throw result.error;
      const published = ((result.data || []) as PracticeExam[]).filter(
        (paper) => paper.paper_model?.assignment?.published === true,
      );
      setPapers(published);
      const ids = published.map((paper) => paper.id);
      if (ids.length) {
        const submitted = await withTimeout(
          supabase
            .from("exam_paper_submissions")
            .select("exam_id,answers,marks_awarded,feedback,submitted_at")
            .eq("student_id", studentId)
            .in("exam_id", ids),
          10000,
          { data: [], error: new Error("Your saved answers took too long to load.") } as any,
        );
        if (!submitted.error) {
          setSubmissions(Object.fromEntries((submitted.data || []).map((row: any) => [row.exam_id, row])));
        }
      }
    } catch {
      setMessage("Could not load practice papers. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId, studentId, isDemo]);

  useEffect(() => {
    void loadPapers();
  }, [loadPapers]);

  useEffect(() => {
    const updateNetwork = () => setOnline(navigator.onLine);
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  useEffect(() => {
    if (!selected || submissions[selected.id]) return;
    setDraftStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey(studentId, selected.id), JSON.stringify(answers));
        setDraftStatus("saved");
      } catch {
        setDraftStatus("error");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [answers, selected, studentId, submissions]);

  const flushDraft = useCallback(() => {
    if (!selected || submissions[selected.id]) return;
    try {
      localStorage.setItem(draftKey(studentId, selected.id), JSON.stringify(answers));
      setDraftStatus("saved");
    } catch {
      setDraftStatus("error");
    }
  }, [answers, selected, studentId, submissions]);

  const openPaper = async (paper: PracticeExam) => {
    setSelected(paper);
    setMessage(null);
    setActiveQuestionIndex(0);
    setReviewing(false);
    setShowOriginal(false);
    const submission = submissions[paper.id];
    let localDraft: Record<string, string> = {};
    try {
      localDraft = JSON.parse(localStorage.getItem(draftKey(studentId, paper.id)) || "{}");
    } catch {
      localDraft = {};
    }
    setAnswers(submission?.answers || localDraft);
    setSourceUrl(null);
    const path = paper.paper_model.assignment?.source_path;
    setSourceLoading(Boolean(path));
    setSourceError(false);
    if (path) {
      try {
        const result = await withTimeout(supabase.storage.from("exam-papers").createSignedUrl(path, 3600), 10000, {
          data: null,
          error: new Error("The original paper took too long to open."),
        } as any);
        if (result.error || !result.data?.signedUrl) setSourceError(true);
        else setSourceUrl(result.data.signedUrl);
      } catch {
        setSourceError(true);
      } finally {
        setSourceLoading(false);
      }
    }
  };

  const submit = async () => {
    if (!selected || !schoolId) return;
    flushDraft();
    if (!navigator.onLine) {
      setMessage("No internet yet. Your answers are saved on this phone. Hand in when you are connected.");
      setConfirmHandIn(false);
      return;
    }
    setSaving(true);
    setMessage(null);
    const response = await withTimeout(
      supabase.from("exam_paper_submissions").insert({
        school_id: schoolId,
        exam_id: selected.id,
        student_id: studentId,
        answers,
      }),
      15000,
      {
        error: new Error("Submitting took too long. Your answers are still on this phone; try again when connected."),
      } as any,
    );
    if (response.error) {
      setMessage(
        response.error.message.includes("duplicate")
          ? "This paper has already been handed in. Ask your teacher if you need to correct an answer."
          : "Could not hand in yet. Your answers are saved on this phone; please try again when connected.",
      );
    } else {
      localStorage.removeItem(draftKey(studentId, selected.id));
      setSubmissions((current) => ({
        ...current,
        [selected.id]: { answers, marks_awarded: null, feedback: null, submitted_at: new Date().toISOString() },
      }));
      setMessage("Handed in. Your teacher will check your answers.");
      setConfirmHandIn(false);
    }
    setSaving(false);
  };

  const currentPaperQuestions = selected?.paper_model.questions ?? [];
  const currentQuestion = currentPaperQuestions[activeQuestionIndex];
  const answeredCount = useMemo(
    () => currentPaperQuestions.filter((question) => isQuestionAnswered(question, answers)).length,
    [currentPaperQuestions, answers],
  );
  const alreadySubmitted = Boolean(selected && submissions[selected.id]);

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">Loading practice papers…</p>
      </Card>
    );
  }

  if (!selected) {
    return (
      <Card className="overflow-hidden">
        <div className="border-b border-gray-100 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MaterialIcon className="text-purple-600">assignment</MaterialIcon>Practice & holiday work
          </h2>
          <p className="mt-1 text-xs text-gray-500">Open a paper, answer when ready, and hand it in to your teacher.</p>
        </div>
        {message && (
          <div role="status" className="flex items-center justify-between gap-3 p-4 text-sm text-amber-800">
            <span>{message}</span>
            <button
              type="button"
              onClick={() => void loadPapers()}
              className="min-h-11 shrink-0 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}
        {papers.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No practice papers have been assigned to your class yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {papers.map((paper) => (
              <button
                key={paper.id}
                onClick={() => void openPaper(paper)}
                className="tap-44 flex w-full items-center gap-3 p-4 text-left hover:bg-gray-50"
              >
                <MaterialIcon className="text-xl text-purple-600">description</MaterialIcon>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">{paper.name}</span>
                  <span className="text-xs text-gray-500">
                    Due {paper.paper_model.assignment?.due_date || paper.exam_date} ·{" "}
                    {paper.paper_model.questions.length} questions
                  </span>
                </span>
                <span className="text-xs font-semibold text-purple-700">
                  {submissions[paper.id] ? "Handed in" : "Start paper"}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    );
  }

  const progress = currentPaperQuestions.length ? Math.round((answeredCount / currentPaperQuestions.length) * 100) : 0;
  const openOriginal = (page: number) => {
    flushDraft();
    setSourcePage(Math.max(1, page));
    setShowOriginal(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white text-gray-900" role="main" aria-label="Practice paper">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => {
              flushDraft();
              if (reviewing) setReviewing(false);
              else setSelected(null);
            }}
            aria-label={reviewing ? "Back to questions" : "Back to practice papers"}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-gray-200 text-gray-700"
          >
            <MaterialIcon>arrow_back</MaterialIcon>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold sm:text-base">{selected.name}</h2>
            <p className="text-xs text-gray-600">
              {alreadySubmitted
                ? "Handed in"
                : draftStatus === "saving"
                  ? "Saving your answers…"
                  : draftStatus === "error"
                    ? "Could not save on this phone"
                    : "Saved on this phone"}
              {!alreadySubmitted && !online ? " · Offline" : ""}
            </p>
          </div>
          {alreadySubmitted && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Handed in</span>
          )}
        </div>
      </header>

      {!alreadySubmitted && !reviewing && currentPaperQuestions.length > 0 && (
        <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-gray-600">
              <span>
                Question {activeQuestionIndex + 1} of {currentPaperQuestions.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  flushDraft();
                  setReviewing(true);
                }}
                className="min-h-8 text-purple-800 underline"
              >
                Review answers ({answeredCount}/{currentPaperQuestions.length})
              </button>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-gray-200"
              role="progressbar"
              aria-label="Paper progress"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-purple-700 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-3xl pb-8">
          {alreadySubmitted ? (
            <section className="rounded-2xl border border-green-200 bg-green-50 p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <MaterialIcon className="text-3xl text-green-700">task_alt</MaterialIcon>
                <div>
                  <h3 className="text-lg font-bold text-green-950">Paper handed in</h3>
                  <p className="mt-1 text-sm text-green-900">
                    {submissions[selected.id].marks_awarded !== null
                      ? `Mark: ${submissions[selected.id].marks_awarded}`
                      : "Your teacher will check your answers."}
                  </p>
                  <p className="mt-1 text-xs text-green-800">
                    Handed in {new Date(submissions[selected.id].submitted_at).toLocaleDateString("en-UG")}
                  </p>
                  {submissions[selected.id].feedback && (
                    <p className="mt-4 rounded-lg bg-white/70 p-3 text-sm text-green-950">
                      {submissions[selected.id].feedback}
                    </p>
                  )}
                </div>
              </div>
            </section>
          ) : reviewing ? (
            <section>
              <h3 className="text-xl font-bold">Check your answers</h3>
              <p className="mt-1 text-sm text-gray-600">
                Tap a question to check or change your answer before handing in.
              </p>
              <div className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
                {currentPaperQuestions.map((question, index) => {
                  const answered = isQuestionAnswered(question, answers);
                  return (
                    <button
                      type="button"
                      key={question.id}
                      onClick={() => {
                        flushDraft();
                        setActiveQuestionIndex(index);
                        setReviewing(false);
                      }}
                      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${answered ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}
                      >
                        {answered ? <MaterialIcon className="text-lg">check</MaterialIcon> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          Question {question.number ?? index + 1}
                        </span>
                        <span className={`text-xs ${answered ? "text-green-800" : "text-amber-800"}`}>
                          {answered ? "Answer saved" : "Not answered yet"}
                        </span>
                      </span>
                      <MaterialIcon className="text-gray-500">chevron_right</MaterialIcon>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-gray-600">
                {currentPaperQuestions.length - answeredCount} question
                {currentPaperQuestions.length - answeredCount === 1 ? "" : "s"} still unanswered.
              </p>
            </section>
          ) : currentQuestion ? (
            <QuestionScreen
              question={currentQuestion}
              questionIndex={activeQuestionIndex}
              value={answers}
              disabled={alreadySubmitted}
              sourceUrl={sourceUrl}
              sourceLoading={sourceLoading}
              sourceError={sourceError}
              showOriginal={showOriginal}
              sourcePage={sourcePage}
              onAnswer={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))}
              onOpenSource={openOriginal}
              onCloseSource={() => setShowOriginal(false)}
            />
          ) : (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              This paper has no questions to answer. Please ask your teacher for help.
            </p>
          )}
          {message && (
            <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {message}
            </p>
          )}
        </div>
      </main>

      {!alreadySubmitted && (
        <footer
          data-page-action-bar=""
          className="shrink-0 border-t border-gray-200 bg-white/95 px-4 pt-3 backdrop-blur sm:px-6"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            {reviewing ? (
              <>
                <Button variant="secondary" onClick={() => setReviewing(false)} className="min-h-12 flex-1">
                  Keep checking
                </Button>
                <Button
                  onClick={() => {
                    flushDraft();
                    setConfirmHandIn(true);
                  }}
                  disabled={saving}
                  className="min-h-12 flex-1"
                >
                  {saving ? "Handing in…" : "Hand in paper"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  disabled={activeQuestionIndex === 0}
                  onClick={() => {
                    flushDraft();
                    setActiveQuestionIndex((index) => Math.max(0, index - 1));
                  }}
                  className="min-h-12 min-w-28 flex-1"
                >
                  <MaterialIcon>arrow_back</MaterialIcon>
                  <span className="ml-1">Previous</span>
                </Button>
                {activeQuestionIndex < currentPaperQuestions.length - 1 ? (
                  <Button
                    onClick={() => {
                      flushDraft();
                      setActiveQuestionIndex((index) => Math.min(currentPaperQuestions.length - 1, index + 1));
                    }}
                    className="min-h-12 min-w-28 flex-1"
                  >
                    Next question<MaterialIcon className="ml-1">arrow_forward</MaterialIcon>
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      flushDraft();
                      setReviewing(true);
                    }}
                    className="min-h-12 min-w-28 flex-1"
                  >
                    Review answers<MaterialIcon className="ml-1">checklist</MaterialIcon>
                  </Button>
                )}
              </>
            )}
          </div>
        </footer>
      )}

      {confirmHandIn && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmHandIn(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="hand-in-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
          >
            <h3 id="hand-in-title" className="text-lg font-bold">
              Hand in this paper?
            </h3>
            <p className="mt-2 text-sm leading-6 text-gray-700">
              {currentPaperQuestions.length - answeredCount > 0
                ? `${currentPaperQuestions.length - answeredCount} question${currentPaperQuestions.length - answeredCount === 1 ? " is" : "s are"} still unanswered. You can go back and finish, or hand in what you have.`
                : "You have answered every question. After handing in, you cannot change your answers."}
            </p>
            {!online && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                There is no internet connection. Your answers will stay saved on this phone until you can hand in.
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" onClick={() => setConfirmHandIn(false)} className="min-h-12 flex-1">
                Keep checking
              </Button>
              <Button onClick={() => void submit()} disabled={saving} className="min-h-12 flex-1">
                {saving ? "Handing in…" : "Yes, hand in"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function QuestionScreen({
  question,
  questionIndex,
  value,
  disabled,
  sourceUrl,
  sourceLoading,
  sourceError,
  showOriginal,
  sourcePage,
  onAnswer,
  onOpenSource,
  onCloseSource,
}: {
  question: ExamQuestion;
  questionIndex: number;
  value: Record<string, string>;
  disabled: boolean;
  sourceUrl: string | null;
  sourceLoading: boolean;
  sourceError: boolean;
  showOriginal: boolean;
  sourcePage: number;
  onAnswer: (key: string, value: string) => void;
  onOpenSource: (page: number) => void;
  onCloseSource: () => void;
}) {
  const needsOriginal = questionNeedsOriginalPage(question);
  const sourcePages = question.sourcePages?.length ? question.sourcePages : [1];
  const prompt = questionStem(question);
  const renderTable = (tableIndex: number) => {
    const table = question.tables?.[tableIndex];
    if (!table) return null;
    return (
      <div
        key={`${question.id}-table-${tableIndex}`}
        className="mt-4 max-w-full overflow-x-auto rounded-lg border border-gray-200"
      >
        <table
          className="w-full border-collapse text-left text-sm"
          aria-label={`Question ${question.number ?? questionIndex + 1} data table ${tableIndex + 1}`}
        >
          {table.headerRows > 0 && (
            <thead className="bg-gray-100">
              {table.rows.slice(0, table.headerRows).map((row, rowIndex) => (
                <tr key={`head-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      scope="col"
                      className="border-b border-r border-gray-200 px-3 py-2 font-semibold last:border-r-0"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          )}
          <tbody>
            {table.rows.slice(table.headerRows).map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-gray-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-t border-r border-gray-200 px-3 py-2 align-top last:border-r-0">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 py-1 text-xs text-gray-500 sm:hidden">Swipe sideways to see all columns.</p>
      </div>
    );
  };

  return (
    <article>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-purple-800">
          Question {question.number ?? questionIndex + 1}
        </p>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
          {question.marks !== null ? `${question.marks} marks` : "Marks not stated"}
        </span>
      </div>
      {question.contentBlocks?.length ? (
        question.contentBlocks.map((block, blockIndex) =>
          block.type === "text" ? (
            <p
              key={`${question.id}-text-${blockIndex}`}
              className="mt-3 whitespace-pre-wrap text-lg font-semibold leading-7 text-gray-950 sm:text-xl"
            >
              {block.text}
            </p>
          ) : (
            renderTable(block.tableIndex)
          ),
        )
      ) : (
        <>
          {prompt && (
            <h3 className="mt-3 whitespace-pre-wrap text-lg font-semibold leading-7 text-gray-950 sm:text-xl">
              {prompt}
            </h3>
          )}
          {question.tables?.map((_, tableIndex) => renderTable(tableIndex))}
        </>
      )}

      {(needsOriginal || sourceUrl) && (
        <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-3">
            <MaterialIcon className="mt-0.5 text-blue-800">picture_as_pdf</MaterialIcon>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-blue-950">Original paper</h4>
              <p className="mt-0.5 text-xs leading-5 text-blue-900">
                {needsOriginal
                  ? "This question may use a picture, table or layout from the printed paper."
                  : "Open the printed paper if you want to check the original."}
              </p>
              {sourceUrl ? (
                <button
                  type="button"
                  onClick={() => (showOriginal ? onCloseSource() : onOpenSource(sourcePages[0]))}
                  className="mt-2 min-h-11 rounded-lg bg-white px-3 text-sm font-bold text-blue-900 ring-1 ring-blue-200"
                >
                  {showOriginal ? "Hide original page" : `View original page ${sourcePages[0]}`}
                </button>
              ) : sourceLoading ? (
                <p role="status" className="mt-2 text-xs text-blue-900">
                  Loading the original paper…
                </p>
              ) : sourceError ? (
                <p role="status" className="mt-2 text-xs text-amber-900">
                  Could not load the original paper. Check your connection and try again later.
                </p>
              ) : (
                <p className="mt-2 text-xs font-medium text-amber-900">
                  The teacher has not attached the original PDF. Ask your teacher if a picture or table is missing.
                </p>
              )}
            </div>
          </div>
          {sourceUrl && showOriginal && (
            <PdfSourceViewer key={`${question.id}-${sourcePage}`} url={sourceUrl} initialPage={sourcePage} />
          )}
        </section>
      )}

      {question.diagrams.map((diagram) =>
        diagram.imageDataUri ? (
          <figure key={diagram.label} className="my-4 rounded-xl border border-gray-200 bg-gray-50 p-2">
            <img
              src={diagram.imageDataUri}
              alt={diagram.label}
              className="mx-auto max-h-72 max-w-full object-contain"
            />
            <figcaption className="mt-1 text-center text-xs text-gray-600">{diagram.label}</figcaption>
          </figure>
        ) : null,
      )}

      {question.subTasks?.length ? (
        <div className="mt-5 space-y-4">
          {question.subTasks.map((part, partIndex) => {
            const key = subTaskAnswerKey(question, partIndex);
            return (
              <div key={key} className="rounded-xl border border-gray-200 p-3 sm:p-4">
                <label htmlFor={`answer-${key}`} className="block text-sm font-semibold leading-6 text-gray-900">
                  {displayQuestionSubTaskLabel(question.number ?? questionIndex + 1, question, partIndex)} {part.text}
                </label>
                <textarea
                  id={`answer-${key}`}
                  disabled={disabled}
                  value={value[key] || ""}
                  onChange={(event) => onAnswer(key, event.target.value)}
                  rows={3}
                  placeholder="Write your answer here"
                  className="mt-3 w-full rounded-xl border border-gray-300 bg-white p-3 text-base leading-6 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:bg-gray-100"
                />
              </div>
            );
          })}
        </div>
      ) : question.choices.length ? (
        <fieldset className="mt-5 space-y-2">
          <legend className="mb-2 text-sm font-semibold text-gray-700">Choose one answer</legend>
          {question.choices.map((choice) => (
            <label
              key={choice.label}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 text-base ${value[question.id] === choice.label ? "border-purple-700 bg-purple-50" : "border-gray-200 bg-white"}`}
            >
              <input
                disabled={disabled}
                type="radio"
                name={question.id}
                value={choice.label}
                checked={value[question.id] === choice.label}
                onChange={() => onAnswer(question.id, choice.label)}
                className="h-5 w-5 accent-purple-700"
              />
              <span className="font-semibold">{choice.label}.</span>
              <span>{choice.text}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="mt-5 block text-sm font-semibold text-gray-700" htmlFor={`answer-${question.id}`}>
          Your answer
          <textarea
            id={`answer-${question.id}`}
            disabled={disabled}
            value={value[question.id] || ""}
            onChange={(event) => onAnswer(question.id, event.target.value)}
            rows={question.kind === "long_answer" ? 6 : 4}
            placeholder="Write your answer here"
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-base font-normal leading-6 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:bg-gray-100"
          />
        </label>
      )}
    </article>
  );
}
