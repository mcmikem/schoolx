"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useClasses, useSubjects } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { useFormDraft } from "@/lib/useAutoSave";
import { supabase } from "@/lib/supabase";
import { isTimeoutResult, withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { logger } from "@/lib/logger";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { getErrorMessage } from "@/lib/validation";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Homework {
  id: string;
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
  due_date: string;
  marks: number;
  status: string;
  created_by: string;
  created_at: string;
  subjects?: { name: string; code: string };
  classes?: { name: string };
}

function parseHomeworkDueDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function HomeworkPage() {
  const { school, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);

  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [homeworkError, setHomeworkError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const homeworkOverview = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const assigned = homework.length;
    const dueSoon = homework.filter((item) => {
      const due = parseHomeworkDueDate(item.due_date);
      const diff = due.getTime() - today.getTime();
      return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 7;
    }).length;
    const overdue = homework.filter((item) => parseHomeworkDueDate(item.due_date) < today).length;
    return { assigned, dueSoon, overdue };
  }, [homework]);

  // Auto-save for homework form
  const homeworkDraft = useFormDraft("homework_add_form");
  const [newHomework, setNewHomework] = useState({
    title: "",
    description: "",
    subject_id: "",
    class_id: "",
    due_date: "",
    marks: 10,
  });

  const homeworkValidationError =
    !newHomework.title.trim() || !newHomework.description.trim()
      ? "Add both title and description to assign homework."
      : !newHomework.subject_id || !newHomework.class_id
        ? "Select both class and subject."
        : !newHomework.due_date
          ? "Choose a due date to continue."
          : newHomework.marks <= 0
            ? "Marks must be greater than zero."
            : "";

  // Update draft when form changes
  const handleNewHomeworkChange = (updates: Partial<typeof newHomework>) => {
    setNewHomework((prev) => {
      const newState = { ...prev, ...updates };
      homeworkDraft.updateData(newState);
      return newState;
    });
  };

  const fetchHomework = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    setHomeworkError(null);
    try {
      let query = supabase
        .from("homework")
        .select("*, subjects(name, code), classes(name)")
        .eq("school_id", school.id)
        .eq("academic_year", academicYear)
        .eq("term", currentTerm)
        .order("due_date", { ascending: false });

      if (selectedClass) {
        query = query.eq("class_id", selectedClass);
      }

      const result = await withTimeout(query, 10000, timeoutFallback());
      if (isTimeoutResult(result)) {
        setHomeworkError("Class tests are taking too long to load. Check your connection and try again.");
        return;
      }
      const { data, error } = result;
      if (error) throw error;
      setHomework(data || []);
    } catch (err) {
      logger.error("Error:", err);
      setHomeworkError("Could not load class tests. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [school?.id, academicYear, currentTerm, selectedClass]);

  useEffect(() => {
    if (school?.id) {
      fetchHomework();
    }
  }, [school?.id, fetchHomework]);

  const handleCreateHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id || !user?.id) return;
    if (homeworkValidationError) {
      toast.error(homeworkValidationError);
      return;
    }

    try {
      const res = await withTimeout(
        supabase.from("homework").insert({
          school_id: school.id,
          title: newHomework.title.trim(),
          description: newHomework.description.trim(),
          subject_id: newHomework.subject_id,
          class_id: newHomework.class_id,
          due_date: newHomework.due_date,
          marks: newHomework.marks,
          created_by: user.id,
          academic_year: academicYear,
          term: currentTerm,
        }),
        15000,
        timeoutFallback(),
      );
      const error = res?.error;

      if (error) throw error;
      toast.success("Class test added");
      setShowModal(false);
      homeworkDraft.clearSaved(); // Clear auto-save after success
      setNewHomework({
        title: "",
        description: "",
        subject_id: "",
        class_id: "",
        due_date: "",
        marks: 10,
      });
      fetchHomework();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create homework"));
    }
  };

  const handleDeleteHomework = async (id: string) => {
    setPendingAction(() => async () => {
      setDeletingId(id);
      try {
        const { error } = await supabase.from("homework").delete().eq("id", id);
        if (error) throw error;
        setHomework((prev) => prev.filter((hw) => hw.id !== id));
        toast.success("Class test deleted");
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to delete homework"));
      } finally {
        setDeletingId(null);
      }
    });
    setConfirmOpen(true);
  };

  const getStatusBadge = (homework: Homework) => {
    const dueDate = parseHomeworkDueDate(homework.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = dueDate < today;
    const isDueToday = dueDate.getTime() === today.getTime();

    if (isOverdue) {
      return <span className="px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-600">Overdue</span>;
    }
    if (isDueToday) {
      return <span className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700">Due today</span>;
    }
    return <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-600">Active</span>;
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Teacher workflow</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">Class Tests</h2>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <MaterialIcon icon="add" className="text-lg" />
            Add class test
          </button>
        </div>

        <div
          aria-label="class tests overview"
          className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                Quick class test summary
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">This week at a glance</h3>
            </div>
            <div className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Live
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Assigned", value: homeworkOverview.assigned },
              { label: "Due soon", value: homeworkOverview.dueSoon },
              { label: "Overdue", value: homeworkOverview.overdue },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                <div className="mt-2 text-lg font-bold text-slate-800">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedClass("")}
            aria-pressed={selectedClass === ""}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${selectedClass === "" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            All classes
          </button>
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedClass(c.id)}
              aria-pressed={selectedClass === c.id}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${selectedClass === c.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {homeworkError && homework.length > 0 && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <span>{homeworkError} Showing the last loaded class tests.</span>
            <button
              type="button"
              onClick={fetchHomework}
              className="shrink-0 rounded-lg px-3 py-2 font-semibold hover:bg-amber-100"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div
            role="status"
            aria-label="Loading class tests"
            aria-live="polite"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="mb-2 h-5 w-full animate-pulse rounded bg-slate-200" />
                <div className="mb-4 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : homeworkError && homework.length === 0 ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <MaterialIcon icon="wifi_off" className="text-3xl text-amber-700" />
            <h3 className="mt-2 font-semibold text-amber-950">Class tests unavailable</h3>
            <p className="mt-1 text-sm text-amber-800">{homeworkError}</p>
            <button
              type="button"
              onClick={fetchHomework}
              className="mt-4 min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : homework.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MaterialIcon className="text-3xl text-gray-400">assignment</MaterialIcon>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">No Class Tests Yet</h3>
            <p className="text-gray-500 mb-4">Add your first class test to get started</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-semibold"
            >
              Add Class Test
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {homework.map((hw) => (
              <div
                key={hw.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <MaterialIcon className="text-lg">menu_book</MaterialIcon>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        {hw.subjects?.name || "Subject"}
                      </p>
                      <p className="text-xs text-slate-500">{hw.classes?.name}</p>
                    </div>
                  </div>
                  {getStatusBadge(hw)}
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-900">{hw.title}</h3>
                <p className="mt-2 text-sm text-slate-600 line-clamp-3">{hw.description}</p>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <MaterialIcon className="text-sm">calendar_today</MaterialIcon>
                    <span>
                      {parseHomeworkDueDate(hw.due_date).toLocaleDateString("en-UG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MaterialIcon className="text-sm">grade</MaterialIcon>
                    <span>{hw.marks} marks</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteHomework(hw.id)}
                  disabled={deletingId === hw.id}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
                  title="Delete class test"
                >
                  <MaterialIcon className="text-sm">{deletingId === hw.id ? "hourglass_empty" : "delete"}</MaterialIcon>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto p-6 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-xl text-gray-900 mb-4">Add Class Test</h3>
              <form onSubmit={handleCreateHomework} className="space-y-4">
                <div>
                  <label htmlFor="homework-title" className="text-sm font-medium text-gray-700 mb-2 block">
                    Title *
                  </label>
                  <input
                    id="homework-title"
                    type="text"
                    value={newHomework.title}
                    onChange={(e) => handleNewHomeworkChange({ title: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="homework-description" className="text-sm font-medium text-gray-700 mb-2 block">
                    Description *
                  </label>
                  <textarea
                    id="homework-description"
                    value={newHomework.description}
                    onChange={(e) => handleNewHomeworkChange({ description: e.target.value })}
                    className="input"
                    rows={3}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="homework-class" className="text-sm font-medium text-gray-700 mb-2 block">
                      Class *
                    </label>
                    {classes.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                        No classes available
                      </div>
                    ) : (
                      <select
                        id="homework-class"
                        value={newHomework.class_id}
                        onChange={(e) => handleNewHomeworkChange({ class_id: e.target.value })}
                        className="input"
                        required
                      >
                        <option value="">Select Class</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label htmlFor="homework-subject" className="text-sm font-medium text-gray-700 mb-2 block">
                      Subject *
                    </label>
                    {subjects.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                        No subjects available
                      </div>
                    ) : (
                      <select
                        id="homework-subject"
                        value={newHomework.subject_id}
                        onChange={(e) => handleNewHomeworkChange({ subject_id: e.target.value })}
                        className="input"
                        required
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="homework-due-date" className="text-sm font-medium text-gray-700 mb-2 block">
                      Due Date *
                    </label>
                    <input
                      id="homework-due-date"
                      type="date"
                      value={newHomework.due_date}
                      onChange={(e) => handleNewHomeworkChange({ due_date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="homework-marks" className="text-sm font-medium text-gray-700 mb-2 block">
                      Marks *
                    </label>
                    <input
                      id="homework-marks"
                      type="number"
                      inputMode="numeric"
                      value={newHomework.marks}
                      onChange={(e) =>
                        handleNewHomeworkChange({
                          marks: parseInt(e.target.value) || 10,
                        })
                      }
                      className="input"
                      min={1}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(homeworkValidationError)}
                    className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Assign
                  </button>
                </div>
                {homeworkValidationError && <p className="text-sm text-gray-500">{homeworkValidationError}</p>}
              </form>
            </div>
          </div>
        )}

        {/* Draft Restore Dialog */}
        {homeworkDraft.showRestoreDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-sm w-full max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto p-6 my-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <MaterialIcon icon="restore" className="text-gray-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Restore Draft?</h3>
                  <p className="text-sm text-gray-500">You have an unsaved homework form</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-6">Would you like to restore your previous draft?</p>
              <div className="flex gap-3">
                <button
                  onClick={homeworkDraft.discardDraft}
                  className="flex-1 py-3 bg-gray-100 font-semibold rounded-xl text-gray-600"
                >
                  Discard
                </button>
                <button
                  onClick={() => {
                    setNewHomework(homeworkDraft.savedDraft as typeof newHomework);
                    homeworkDraft.restoreDraft();
                  }}
                  className="flex-1 py-3 bg-gray-900 text-white font-semibold rounded-xl"
                >
                  Restore
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            pendingAction?.();
          }}
          title="Delete Class Test"
          message="Delete this homework assignment?"
          variant="danger"
        />
      </div>
    </PageErrorBoundary>
  );
}
