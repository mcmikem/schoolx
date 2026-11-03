"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { VideoLessonButton } from "@/components/onboarding/VideoLesson";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useClasses, useSubjects } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { DEMO_HOMEWORK } from "@/lib/demo-data";
import { useFormDraft } from "@/lib/useAutoSave";
import { supabase } from "@/lib/supabase";
import { isTimeoutResult, withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { Button, Modal, StatStrip } from "@/components/ui/index";
import { PageHeader } from "@/components/ui/PageHeader";
import SearchField from "@/components/ui/SearchField";
import { logger } from "@/lib/logger";
import { EmptyState } from "@/components/EmptyState";
import { getErrorMessage } from "@/lib/validation";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { ConfirmDialog } from "@/components/ConfirmDialog";

import { duplicateHomeworkDraft, parseHomeworkDueDate, type Homework, type HomeworkDraft } from "@/lib/homework";

const EMPTY_DRAFT: HomeworkDraft = {
  title: "",
  description: "",
  subject_id: "",
  class_id: "",
  due_date: "",
  marks: 10,
};

/** Date-only fields must be read as local dates, never as UTC midnight. */
function formatDueDate(value: string) {
  return parseHomeworkDueDate(value).toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2 days late", "today", "in 3 days" — the teacher's real question. */
function dueHint(value: string) {
  const due = parseHomeworkDueDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < -1) return `${Math.abs(days)} days late`;
  if (days === -1) return "1 day late";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function dueTone(value: string) {
  const due = parseHomeworkDueDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "text-[var(--red-ink)]";
  if (days === 0) return "text-[var(--amber-ink)]";
  return "text-[var(--t3)]";
}

export default function HomeworkPage() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);

  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [homeworkError, setHomeworkError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  // Set while the form holds a copy of an existing test. Drives the modal's
  // heading and the "N days later" due date nudge.
  const [duplicateSource, setDuplicateSource] = useState<Homework | null>(null);

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

  const selectedClassName = classes.find((classItem) => classItem.id === selectedClass)?.name;

  // The class filter is applied by the query; the search only narrows what is
  // already on screen, so it stays instant and works offline.
  const visibleHomework = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return homework;
    return homework.filter((item) =>
      [item.title, item.description, item.subjects?.name, item.classes?.name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    );
  }, [homework, search]);

  // Auto-save for homework form
  const homeworkDraft = useFormDraft("homework_add_form");
  const [newHomework, setNewHomework] = useState<HomeworkDraft>(EMPTY_DRAFT);

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
  /** Opens the create form pre-filled from an existing test. The copy is a new
   *  draft, not an edit: saving it inserts a second row and leaves the original
   *  untouched. */
  const startDuplicate = (source: Homework) => {
    setDuplicateSource(source);
    const draft = duplicateHomeworkDraft(source, new Date());
    setNewHomework(draft);
    homeworkDraft.updateData(draft);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    if (duplicateSource) {
      // Abandoning a duplicate must not leave its contents behind: the next
      // "Add Class Test" would open already titled "…(copy)". An ordinary
      // in-progress form is left alone — that is what the draft autosave is for.
      setDuplicateSource(null);
      setNewHomework(EMPTY_DRAFT);
      homeworkDraft.clearSaved();
    }
  };

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
      if (isDemo) {
        // Demo mode: show the fixed class-test set without touching the DB.
        const rows = selectedClass ? DEMO_HOMEWORK.filter((h) => h.class_id === selectedClass) : DEMO_HOMEWORK;
        setHomework(rows as unknown as typeof homework);
        setLoading(false);
        return;
      }
      if (!isOnline) {
        // The last class-test list fetched on this phone. Without this branch
        // the page spent ten seconds on a doomed request and then showed the
        // "check your connection" error even though the rows were on disk.
        const cached = await offlineDB.getAllFromCache("homework", { school_id: school.id });
        const rows = (cached as unknown as Homework[]).filter(
          (hw) =>
            (!academicYear ||
              !("academic_year" in hw) ||
              (hw as { academic_year?: string }).academic_year === academicYear) &&
            (!("term" in hw) || (hw as { term?: number }).term === currentTerm) &&
            (!selectedClass || hw.class_id === selectedClass),
        );
        setHomework(rows);
        if (rows.length === 0) {
          setHomeworkError("No class tests saved on this device yet. They will appear once you are back online.");
        }
        return;
      }

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
      void offlineDB.cacheFromServer("homework", (data || []) as Record<string, unknown>[]).catch(() => {});
    } catch (err) {
      logger.error("Error:", err);
      setHomeworkError("Could not load class tests. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [school?.id, academicYear, currentTerm, selectedClass, isDemo, isOnline]);

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

    const payload = {
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
    };

    try {
      if (!isOnline) {
        const saved = (await offlineDB.save("homework", payload)) as unknown as Homework;
        const classRow = classes.find((c) => c.id === payload.class_id);
        const subjectRow = subjects.find((s) => s.id === payload.subject_id);
        setHomework((prev) => [
          {
            ...saved,
            subjects: subjectRow ? { name: subjectRow.name, code: subjectRow.code ?? "" } : undefined,
            classes: classRow ? { name: classRow.name } : undefined,
          },
          ...prev,
        ]);
        toast.success("Class test saved on this device. It will sync when you are back online.");
        closeModal();
        homeworkDraft.clearSaved();
        setNewHomework(EMPTY_DRAFT);
        return;
      }

      if (isDemo) {
        const classRow = classes.find((c) => c.id === payload.class_id);
        const subjectRow = subjects.find((s) => s.id === payload.subject_id);
        setHomework((prev) => [
          {
            ...(payload as unknown as Homework),
            id: `demo-hw-${Date.now()}`,
            subjects: subjectRow ? { name: subjectRow.name, code: subjectRow.code ?? "" } : undefined,
            classes: classRow ? { name: classRow.name } : undefined,
          },
          ...prev,
        ]);
        toast.success("Class test added");
        closeModal();
        homeworkDraft.clearSaved();
        setNewHomework(EMPTY_DRAFT);
        return;
      }

      const res = await withTimeout(supabase.from("homework").insert(payload), 15000, timeoutFallback());
      if (isTimeoutResult(res)) {
        throw new Error("Saving the class test timed out. Check your connection and try again.");
      }
      const error = res?.error;

      if (error) throw error;
      toast.success("Class test added");
      closeModal();
      homeworkDraft.clearSaved(); // Clear auto-save after success
      setNewHomework(EMPTY_DRAFT);
      fetchHomework();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create homework"));
    }
  };

  const handleDeleteHomework = async (id: string) => {
    setPendingAction(() => async () => {
      setDeletingId(id);
      try {
        if (isDemo) {
          setHomework((prev) => prev.filter((hw) => hw.id !== id));
          toast.success("Class test deleted");
          return;
        }
        if (!isOnline) {
          await offlineDB.delete("homework", id);
          setHomework((prev) => prev.filter((hw) => hw.id !== id));
          toast.success("Class test removed on this device. It will sync when you are back online.");
          return;
        }
        const delResult = await withTimeout(
          supabase.from("homework").delete().eq("id", id),
          15000,
          timeoutFallback(),
        );
        if (isTimeoutResult(delResult)) {
          throw new Error("Deleting the class test timed out. Check your connection and try again.");
        }
        const { error } = delResult ?? {};
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
    const tone = isOverdue
      ? "bg-[var(--red-soft)] text-[var(--red-ink)]"
      : isDueToday
        ? "bg-[var(--amber-soft)] text-[var(--amber-ink)]"
        : "bg-[var(--green-soft)] text-[var(--green-ink)]";

    return (
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
        {isOverdue ? "Overdue" : isDueToday ? "Due today" : "Active"}
      </span>
    );
  };

  const subtitle = loading
    ? "Loading this term's class tests"
    : [
        `${homework.length} class test${homework.length === 1 ? "" : "s"}`,
        selectedClassName || "All classes",
        `Term ${currentTerm}, ${academicYear}`,
      ].join(" · ");

  return (
    <PageErrorBoundary>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Class Tests"
          subtitle={subtitle}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <VideoLessonButton lesson="tests" label="Watch how" />
              <VideoLessonButton lesson="homework" label="Watch how to set" />
              <Button onClick={() => setShowModal(true)} icon={<MaterialIcon icon="add" />}>
                Add class test
              </Button>
            </div>
          }
        />

        <section aria-label="class tests overview" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--t2)]">This week at a glance</h2>
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--amber-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--amber-ink)]">
                <MaterialIcon icon="cloud_off" className="text-sm" />
                Offline — changes save on this device
              </span>
            )}
          </div>
          <StatStrip
            columns={3}
            items={[
              { label: "Assigned", value: homeworkOverview.assigned, hint: "this term", tone: "info" },
              { label: "Due soon", value: homeworkOverview.dueSoon, hint: "next 7 days", tone: "warning" },
              { label: "Overdue", value: homeworkOverview.overdue, hint: "past the due date", tone: "negative" },
            ]}
          />
        </section>

        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--sh1)] sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <SearchField
              label="Search class tests"
              value={search}
              onChange={setSearch}
              placeholder="Title, subject or class"
            />
            <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:pb-0">
              <button
                type="button"
                onClick={() => setSelectedClass("")}
                aria-pressed={selectedClass === ""}
                className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-medium transition-colors ${
                  selectedClass === ""
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "bg-[var(--surface-container-low)] text-[var(--t2)] hover:bg-[var(--surface-container)]"
                }`}
              >
                All classes
              </button>
              {classes.map((classItem) => (
                <button
                  key={classItem.id}
                  type="button"
                  onClick={() => setSelectedClass(classItem.id)}
                  aria-pressed={selectedClass === classItem.id}
                  className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-medium transition-colors ${
                    selectedClass === classItem.id
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "bg-[var(--surface-container-low)] text-[var(--t2)] hover:bg-[var(--surface-container)]"
                  }`}
                >
                  {classItem.name}
                </button>
              ))}
            </div>
          </div>
          {search.trim() && (
            <p className="text-xs text-[var(--t3)]">
              {visibleHomework.length} of {homework.length} match &ldquo;{search.trim()}&rdquo;
            </p>
          )}
        </div>

        {homeworkError && homework.length > 0 && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--amber)]/50 bg-[var(--amber-soft)] p-3 text-sm text-[var(--amber-ink)]"
          >
            <span>{homeworkError} Showing the last loaded class tests.</span>
            <Button size="sm" variant="outline" onClick={fetchHomework}>
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div
            role="status"
            aria-label="Loading class tests"
            aria-live="polite"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)]"
              >
                <div className="mb-4 h-4 w-24 animate-pulse rounded bg-[var(--surface-container)]" />
                <div className="mb-2 h-5 w-full animate-pulse rounded bg-[var(--surface-container)]" />
                <div className="mb-4 h-4 w-3/4 animate-pulse rounded bg-[var(--surface-container)]" />
                <div className="h-12 w-full animate-pulse rounded-xl bg-[var(--surface-container-low)]" />
              </div>
            ))}
          </div>
        ) : homeworkError && homework.length === 0 ? (
          <div
            role="alert"
            className="rounded-2xl border border-[var(--amber)]/50 bg-[var(--amber-soft)] p-6 text-center"
          >
            <MaterialIcon icon="wifi_off" className="text-3xl text-[var(--amber-ink)]" />
            <h2 className="mt-2 font-semibold text-[var(--amber-ink)]">Class tests unavailable</h2>
            <p className="mt-1 text-sm text-[var(--amber-ink)]">{homeworkError}</p>
            <Button variant="secondary" className="mt-4" onClick={fetchHomework}>
              Try again
            </Button>
          </div>
        ) : homework.length === 0 ? (
          <EmptyState
            icon="assignment"
            title="No class tests yet"
            description={
              selectedClassName
                ? `Nothing has been set for ${selectedClassName} this term.`
                : "Set a test with a due date and marks; it will appear here for the class and its teachers."
            }
            action={{ label: "Add your first class test", onClick: () => setShowModal(true) }}
            owlyQuestion="How do I set a class test and record the marks?"
          />
        ) : visibleHomework.length === 0 ? (
          <div
            role="status"
            className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center"
          >
            <MaterialIcon icon="search_off" className="text-3xl text-[var(--t3)]" />
            <h2 className="mt-2 font-semibold text-[var(--t1)]">No matching class tests</h2>
            <p className="mt-1 text-sm text-[var(--t3)]">Nothing matches &ldquo;{search.trim()}&rdquo;.</p>
            <Button variant="outline" className="mt-4" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleHomework.map((hw) => (
              <article
                key={hw.id}
                className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)] transition-shadow hover:shadow-[var(--sh2)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-50)] text-[var(--primary)]">
                      <MaterialIcon icon="menu_book" className="text-lg" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold uppercase tracking-[0.18em] text-[var(--t3)]">
                        {hw.subjects?.name || "Subject"}
                      </p>
                      <p className="truncate text-xs text-[var(--t3)]">{hw.classes?.name || "Class"}</p>
                    </div>
                  </div>
                  {getStatusBadge(hw)}
                </div>

                <h3 className="mt-3 text-base font-semibold text-[var(--t1)]">{hw.title}</h3>
                <p className="mt-1 line-clamp-3 text-sm text-[var(--t3)]">{hw.description}</p>

                <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] pt-3 text-xs">
                  <div className="flex items-center gap-1.5 text-[var(--t2)]">
                    <MaterialIcon icon="calendar_today" className="text-sm" />
                    <dt className="sr-only">Due date</dt>
                    <dd>
                      {formatDueDate(hw.due_date)}{" "}
                      <span className={dueTone(hw.due_date)}>· {dueHint(hw.due_date)}</span>
                    </dd>
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--t2)]">
                    <MaterialIcon icon="grade" className="text-sm" />
                    <dt className="sr-only">Marks</dt>
                    <dd>{hw.marks} marks</dd>
                  </div>
                </dl>

                <div className="mt-auto flex items-center gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => startDuplicate(hw)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--primary-200)] bg-[var(--primary-50)] px-2.5 py-1.5 text-xs font-semibold text-[var(--primary-700)] transition-colors hover:bg-[var(--primary-100)]"
                    title="Duplicate this class test"
                  >
                    <MaterialIcon icon="content_copy" className="text-sm" />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteHomework(hw.id)}
                    disabled={deletingId === hw.id}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--red-soft)] bg-[var(--red-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--red-ink)] transition-opacity hover:opacity-80 disabled:opacity-50"
                    title="Delete class test"
                  >
                    <MaterialIcon icon={deletingId === hw.id ? "hourglass_empty" : "delete"} className="text-sm" />
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title={duplicateSource ? "Duplicate Class Test" : "Add Class Test"}
        >
          {duplicateSource && (
            <p className="mb-4 text-xs text-[var(--t3)]">
              Copied from &ldquo;{duplicateSource.title}&rdquo;. Save to add it as a separate test.
            </p>
          )}
          <form onSubmit={handleCreateHomework} className="space-y-4">
            <div>
              <label htmlFor="homework-title" className="mb-2 block text-sm font-medium text-[var(--t2)]">
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
              <label htmlFor="homework-description" className="mb-2 block text-sm font-medium text-[var(--t2)]">
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
                <label htmlFor="homework-class" className="mb-2 block text-sm font-medium text-[var(--t2)]">
                  Class *
                </label>
                {classes.length === 0 ? (
                  <div className="rounded-xl border border-[var(--amber)]/50 bg-[var(--amber-soft)] p-3 text-sm text-[var(--amber-ink)]">
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
                <label htmlFor="homework-subject" className="mb-2 block text-sm font-medium text-[var(--t2)]">
                  Subject *
                </label>
                {subjects.length === 0 ? (
                  <div className="rounded-xl border border-[var(--amber)]/50 bg-[var(--amber-soft)] p-3 text-sm text-[var(--amber-ink)]">
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
                <label htmlFor="homework-due-date" className="mb-2 block text-sm font-medium text-[var(--t2)]">
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
                <label htmlFor="homework-marks" className="mb-2 block text-sm font-medium text-[var(--t2)]">
                  Marks *
                </label>
                <input
                  id="homework-marks"
                  type="number"
                  inputMode="numeric"
                  value={newHomework.marks}
                  onChange={(e) => handleNewHomeworkChange({ marks: parseInt(e.target.value) || 10 })}
                  className="input"
                  min={1}
                />
              </div>
            </div>
            {homeworkValidationError && <p className="text-sm text-[var(--t3)]">{homeworkValidationError}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" fullWidth onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" fullWidth disabled={Boolean(homeworkValidationError)}>
                Assign
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={homeworkDraft.showRestoreDialog}
          onClose={homeworkDraft.discardDraft}
          title="Restore Draft?"
          size="sm"
        >
          <p className="text-sm text-[var(--t3)]">
            You have an unsaved class test. Restore it and carry on where you stopped?
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" fullWidth onClick={homeworkDraft.discardDraft}>
              Discard
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setNewHomework(homeworkDraft.savedDraft as HomeworkDraft);
                homeworkDraft.restoreDraft();
              }}
            >
              Restore
            </Button>
          </div>
        </Modal>

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
