"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import {
  useOfflineHomework,
  useOfflineHomeworkSubmissions,
  useOfflineClasses,
  useOfflineClassStudentsFull,
} from "@/lib/offline-hooks";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface HomeworkSubmission {
  id: string;
  homework_id: string;
  student_id: string;
  submitted_at?: string;
  marks?: number;
  marks_obtained?: number;
  feedback?: string;
  status: "pending" | "submitted" | "graded";
  students?: { first_name: string; last_name: string; classes: { name: string }[] };
}

export default function HomeworkSubmissionsPage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();

  const [selectedHomework, setSelectedHomework] = useState<any>(null);
  const [classFilter, setClassFilter] = useState("");

  // Offline-aware hooks
  const { data: classes = [], loading: loadingClasses } = useOfflineClasses(school?.id);

  const {
    data: homeworks = [],
    loading: loadingHomeworks,
    refetch: refetchHomeworks,
  } = useOfflineHomework(school?.id, academicYear, currentTerm ? String(currentTerm) : undefined, classFilter);

  const {
    data: submissionsData = [],
    loading: loadingSubmissions,
    refetch: refetchSubmissions,
  } = useOfflineHomeworkSubmissions(selectedHomework?.id, school?.id, selectedHomework?.class_id);

  const { data: allStudents = [], loading: loadingStudents } = useOfflineClassStudentsFull(
    school?.id,
    selectedHomework?.class_id,
  );

  // Compose full submissions list
  const submissions = (allStudents || []).map((student) => {
    const existingSubmission = submissionsData?.find((item) => item.student_id === student.id);
    return {
      id: existingSubmission?.id || null,
      student_id: student.id,
      homework_id: selectedHomework?.id,
      status: existingSubmission?.status === "graded" ? "graded" : existingSubmission ? "submitted" : "pending",
      submitted_at: existingSubmission?.submitted_at,
      marks: existingSubmission?.marks ?? existingSubmission?.marks_obtained,
      feedback: existingSubmission?.feedback,
      students: student,
    };
  });

  const markSubmission = async (submission: any, marks: number, feedback: string) => {
    const { withTimeout, timeoutFallback } = await import("@/lib/hooks/utils");
    if (!submission.id) {
      const hwResult = await withTimeout(
        supabase.from("homework_submissions").insert({
          school_id: school?.id,
          homework_id: selectedHomework.id,
          student_id: submission.student_id,
          submitted_at: new Date().toISOString(),
          marks_obtained: marks,
          feedback,
          status: "graded",
        }),
        15000,
        timeoutFallback(),
      );
      const error = hwResult?.error;
      if (error) throw error;
    } else {
      const hwResult = await withTimeout(
        supabase
          .from("homework_submissions")
          .update({ marks_obtained: marks, feedback, status: "graded" })
          .eq("id", submission.id),
        15000,
        timeoutFallback(),
      );
      const error = hwResult?.error;
      if (error) throw error;
    }
    toast.success("Submission graded");
    refetchSubmissions();
  };

  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const submittedCount = submissions.filter((s) => s.status === "submitted").length;
  const gradedCount = submissions.filter((s) => s.status === "graded").length;

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader title="Homework & Submissions" subtitle="Track homework and student submissions" />

        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Filter by Class</label>
              {classes.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                  No classes available
                </div>
              ) : (
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">&nbsp;</label>
              <Button onClick={refetchHomeworks}>Filter</Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={`lg:col-span-1 ${selectedHomework ? "hidden lg:block" : "block"}`}>
            <Card>
              <div className="p-4 border-b border-[var(--border)]">
                <h3 className="font-semibold text-[var(--t1)]">Homework List</h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {homeworks.length === 0 && !loadingHomeworks ? (
                  <div className="p-4 text-center text-[var(--t3)]">No homework found</div>
                ) : (
                  homeworks.map((hw) => (
                    <button
                      key={hw.id}
                      type="button"
                      onClick={() => setSelectedHomework(hw)}
                      className={`w-full p-4 border-b border-[var(--border)] text-left transition-colors ${
                        selectedHomework?.id === hw.id
                          ? "bg-[var(--primary)]/10"
                          : "hover:bg-[var(--surface-container)]"
                      }`}
                    >
                      <div className="font-semibold text-sm text-[var(--t1)]">{hw.subjects?.name}</div>
                      <div className="text-xs text-[var(--t3)]">
                        {hw.classes?.name} - Due {new Date(hw.due_date).toLocaleDateString()}
                      </div>
                      <div className="text-xs mt-1 text-[var(--primary)]">{hw.marks} marks</div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className={`lg:col-span-2 ${selectedHomework ? "block" : "hidden lg:block"}`}>
            {selectedHomework ? (
              <Card>
                <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-[var(--t1)]">
                      {selectedHomework.subjects?.name} - Submissions
                    </h3>
                    <p className="text-sm text-[var(--t3)]">{selectedHomework.classes?.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedHomework(null)}
                    className="min-h-10 self-start rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--t1)] lg:hidden"
                    aria-label="Change homework"
                  >
                    Change homework
                  </button>
                  <div aria-label="submission overview" className="grid grid-cols-3 gap-2 sm:min-w-[280px]">
                    {[
                      { label: "Pending", value: pendingCount, tone: "text-red-600" },
                      { label: "Submitted", value: submittedCount, tone: "text-blue-600" },
                      { label: "Graded", value: gradedCount, tone: "text-green-600" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl bg-[var(--surface-container-low)] px-2 py-2 text-center"
                      >
                        <p className={`text-lg font-bold leading-none ${item.tone}`}>{item.value}</p>
                        <p className="mt-1 text-[10px] font-semibold text-[var(--t3)]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 p-3 md:hidden">
                  {submissions.map((sub) => (
                    <div
                      key={sub.student_id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--t1)]">
                            {sub.students?.first_name} {sub.students?.last_name}
                          </p>
                          <p className="mt-1 text-xs text-[var(--t3)]">
                            {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "Not submitted"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                            sub.status === "graded"
                              ? "bg-green-100 text-green-800"
                              : sub.status === "submitted"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                        <p className="text-sm font-semibold text-[var(--t1)]">
                          {sub.marks != null
                            ? `${sub.marks}/${selectedHomework.marks || selectedHomework.total_marks || 0} marks`
                            : "No marks yet"}
                        </p>
                        <GradingModal
                          submission={sub}
                          maxMarks={selectedHomework.marks || selectedHomework.total_marks || 0}
                          idPrefix="mobile"
                          onSave={(marks, feedback) => markSubmission(sub, marks, feedback)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--surface-container)]">
                        <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Student</th>
                        <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Status</th>
                        <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Submitted</th>
                        <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Marks</th>
                        <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => (
                        <tr key={sub.student_id} className="border-b border-[var(--border)]">
                          <td className="p-4 text-[var(--t1)]">
                            {sub.students?.first_name} {sub.students?.last_name}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                sub.status === "graded"
                                  ? "bg-green-100 text-green-800"
                                  : sub.status === "submitted"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-[var(--t3)]">
                            {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "-"}
                          </td>
                          <td className="p-4 text-sm">
                            {sub.marks != null
                              ? `${sub.marks}/${selectedHomework.marks || selectedHomework.total_marks || 0}`
                              : "-"}
                          </td>
                          <td className="p-4">
                            <GradingModal
                              submission={sub}
                              maxMarks={selectedHomework.marks || selectedHomework.total_marks || 0}
                              idPrefix="desktop"
                              onSave={(marks, feedback) => markSubmission(sub, marks, feedback)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">assignment</MaterialIcon>
                <p className="mt-2 text-[var(--t3)]">Select homework to view submissions</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}

function GradingModal({
  submission,
  maxMarks,
  idPrefix,
  onSave,
}: {
  submission: any;
  maxMarks: number;
  idPrefix: string;
  onSave: (marks: number, feedback: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState(submission.marks || 0);
  const [feedback, setFeedback] = useState(submission.feedback || "");
  const marksInputId = `${idPrefix}-submission-marks-${submission.student_id}`;
  const feedbackInputId = `${idPrefix}-submission-feedback-${submission.student_id}`;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Grade
      </Button>
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-[var(--surface)] p-4 sm:max-h-[calc(100vh-2rem)] sm:p-6">
            <h3 className="text-lg font-bold text-[var(--t1)] mb-4">Grade Submission</h3>
            <p className="text-sm text-[var(--t3)] mb-4">
              {submission.students?.first_name} {submission.students?.last_name}
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor={marksInputId} className="block text-sm font-medium mb-1">
                  Marks (out of {maxMarks})
                </label>
                <input
                  id={marksInputId}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={maxMarks}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                />
              </div>
              <div>
                <label htmlFor={feedbackInputId} className="block text-sm font-medium mb-1">
                  Feedback
                </label>
                <textarea
                  id={feedbackInputId}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  rows={3}
                  placeholder="Give feedback to student..."
                />
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  onSave(marks, feedback);
                  setOpen(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
