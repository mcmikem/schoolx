"use client";
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, NoData } from "@/components/EmptyState";
import { ClassAverageRow } from "@/components/grades/ClassAverageRow";
import { GradeStatusBadge } from "@/components/grades/GradeStatusBadge";
import SubmittedSheetsPanel, { type SubmittedSheet } from "@/components/grades/SubmittedSheetsPanel";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { OwlyTrigger } from "@/components/owly/OwlyTrigger";
import { VideoLessonButton } from "@/components/onboarding/VideoLesson";
import { useToast } from "@/components/Toast";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { FilterBar } from "@/components/ui/FilterBar";
import { Badge, Button, Input, Select } from "@/components/ui/index";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { PageHeader, PageSection } from "@/components/ui/PageHeader";
import PersonInitials from "@/components/ui/PersonInitials";
import { FullPageLoader, TableSkeleton } from "@/components/ui/Skeleton";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { useAcademic } from "@/lib/academic-context";
import { logAuditEventWithOfflineSupport } from "@/lib/audit";
import { useAuth } from "@/lib/auth-context";
import { createRecord, updateRecord, upsertRecordReturning } from "@/lib/crud-service";
import {
  COMPETENCY_SCHEME,
  CompetencyValue,
  calculateSubjectTotal,
  getCompetencyLabel,
  isCompetencyScale,
} from "@/lib/grading";
import { GRADING_TRACKS, resolveTrackForClass, resolveUseBot } from "@/lib/grading-tracks";
import {
  ASSESSMENT_MAX,
  TRADITIONAL_ASSESSMENT_TYPES,
  assessmentLabel,
  assessmentTypesFor,
  averageOfTotals,
  columnAverage,
  getGrade,
  getStudentTotal as computeStudentTotal,
  isStudentGraded as computeIsStudentGraded,
  readMark,
  type SaveStatus,
  type StudentMarks,
} from "@/lib/grades/entry";
import { useClasses, useStaff, useSubjects } from "@/lib/hooks";
import { timeoutFallback, withTimeout } from "@/lib/hooks/utils";
import { lazyWithIdlePrefetch } from "@/lib/lazy-prefetch";
import { logger } from "@/lib/logger";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { useOfflineGrades, useOfflineStudents } from "@/lib/offline-hooks";
import {
  deriveGradeWorkflowStatus,
  GradeWorkflowStatus,
  getNextGradeWorkflowStatusActions,
  getPrevGradeWorkflowStatusActions,
  gradeWorkflowRank,
} from "@/lib/operations";
import { isClassScopedRole } from "@/lib/roles";
import { loadSchoolSettings } from "@/lib/school-settings";
import { supabase } from "@/lib/supabase";

// Split out of the first-load bundle, then warmed in idle time so the import
// dialog still opens offline after the page has been visited once.
type GradeImportModalProps = ComponentProps<typeof import("@/components/grades/GradeImportModal").GradeImportModal>;
const GradeImportModal = lazyWithIdlePrefetch<GradeImportModalProps>(() =>
  import("@/components/grades/GradeImportModal").then((m) => ({ default: m.GradeImportModal })),
);

interface TopicCoverage {
  id: string;
  syllabus_id?: string;
  class_id: string;
  topic_name: string;
  status: "not_started" | "in_progress" | "completed";
  teacher_id?: string;
}

const DEFAULT_TOPICS = ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"];

const ASSESSMENT_TYPES = [
  "bot",
  "mid_term",
  "eot",
  "ca1",
  "ca2",
  "ca3",
  "ca4",
  "project",
  "exam",
  "competency",
  "u1",
  "u2",
] as const;
/** The continuous-assessment subset, i.e. everything a CA lock is meant to cover.
 *  Lock and unlock must both derive from this: they previously hardcoded
 *  different lists (lock covered ca1-ca3, unlock ca1-ca4) so CA4 was never
 *  actually locked and stayed editable after "CA locked". */
const CA_ASSESSMENT_TYPES = ASSESSMENT_TYPES.filter((t) => t.startsWith("ca")) as readonly string[];

async function saveGrade(grade: {
  student_id: string;
  subject_id: string;
  class_id: string;
  assessment_type: string;
  score: number;
  max_score?: number;
  term: number;
  academic_year: string;
  recorded_by?: string;
  status?: string;
  isDemo?: boolean;
  schoolId?: string;
}) {
  const maxScore = grade.max_score || 100;
  if (grade.score < 0 || grade.score > maxScore) {
    throw new Error(`Score must be between 0 and ${maxScore}`);
  }

  // isDemo/schoolId are client-only flags — the grades table has no such
  // columns and PostgREST rejects unknown keys with PGRST204. Strip them
  // before any payload reaches the queue or the online upsert.
  const { isDemo, schoolId, ...rest } = grade;
  const payload = { ...rest, max_score: maxScore };

  if (isDemo) {
    return { ...payload, id: `demo-grade-${Date.now()}`, created_at: new Date().toISOString() };
  }

  if (!navigator.onLine) {
    await offlineDB.save("grades", payload as unknown as Record<string, unknown>);
    return { ...payload, id: `offline-grade-${Date.now()}`, created_at: new Date().toISOString() };
  }

  const data = await upsertRecordReturning<any>(
    () =>
      supabase
        .from("grades")
        .upsert(payload, {
          onConflict: "student_id,subject_id,assessment_type,term,academic_year",
        })
        .select()
        .single(),
    { timeoutMs: 15000, timeoutMessage: "Grade save timed out" },
  );

  if (!["bot", "mid_term", "eot"].includes(grade.assessment_type)) {
    await syncStudentGrades({
      student_id: grade.student_id,
      subject_id: grade.subject_id,
      class_id: grade.class_id,
      term: grade.term,
      academic_year: grade.academic_year,
      schoolId: grade.schoolId,
    });
  }

  return data;
}

async function syncStudentGrades(params: {
  student_id: string;
  subject_id: string;
  class_id: string;
  term: number;
  academic_year: string;
  schoolId?: string;
}) {
  const { data: allGrades } = await supabase
    .from("grades")
    .select("assessment_type, score")
    .eq("student_id", params.student_id)
    .eq("subject_id", params.subject_id)
    .eq("term", params.term)
    .eq("academic_year", params.academic_year);

  if (!allGrades || allGrades.length === 0) return;

  const ca1 = allGrades.find((g: any) => g.assessment_type === "ca1")?.score || 0;
  const ca2 = allGrades.find((g: any) => g.assessment_type === "ca2")?.score || 0;
  const ca3 = allGrades.find((g: any) => g.assessment_type === "ca3")?.score || 0;
  const ca4 = allGrades.find((g: any) => g.assessment_type === "ca4")?.score || 0;
  const project = allGrades.find((g: any) => g.assessment_type === "project")?.score || 0;
  const exam_score = allGrades.find((g: any) => g.assessment_type === "exam")?.score || 0;
  const final_score = calculateSubjectTotal(ca1, ca2, ca3, ca4, project, exam_score);

  const studentGradePayload = {
    school_id: params.schoolId,
    student_id: params.student_id,
    subject_id: params.subject_id,
    academic_year: params.academic_year,
    term: params.term,
    ca1,
    ca2,
    ca3,
    ca4,
    project,
    exam_score,
    final_score,
  };

  const { data: existing } = await supabase
    .from("student_grades")
    .select("id")
    .eq("student_id", params.student_id)
    .eq("subject_id", params.subject_id)
    .eq("academic_year", params.academic_year)
    .eq("term", params.term)
    .maybeSingle();

  if (existing) {
    await withTimeout(
      supabase.from("student_grades").update(studentGradePayload).eq("id", existing.id),
      15000,
      timeoutFallback(),
    );
  } else {
    await withTimeout(supabase.from("student_grades").insert(studentGradePayload), 15000, timeoutFallback());
  }
}

export default function GradesPage() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm, isTermLocked } = useAcademic();
  // The exams page already honours this; the grades page did not, so exam marks
  // stayed editable on a locked term. Only exam is gated -- CA is governed by
  // the separate CA lock, which is a different control.
  const termLocked = isTermLocked ? isTermLocked(academicYear, currentTerm) : false;
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { staff } = useStaff(school?.id);

  const [tab, setTab] = useState<"marks" | "coverage">("marks");
  const tabLabels = { marks: "Enter Marks", coverage: "What we Taught" };

  const [teacherSubjects, setTeacherSubjects] = useState<{ subject_id: string; class_id: string }[]>([]);

  useEffect(() => {
    if (isDemo) {
      // Demo teacher: a fixed assignment (P.7 A — English, Mathematics, Science)
      // so the class/subject pickers are not empty for a teacher session.
      setTeacherSubjects([
        { subject_id: "demo-sub-ENG-6", class_id: "13" },
        { subject_id: "demo-sub-MTC-7", class_id: "13" },
        { subject_id: "demo-sub-SCI-8", class_id: "13" },
      ]);
      return;
    }
    if (!user?.id) return;
    const fetchTeacherSubjects = async () => {
      const result = await withTimeout(
        supabase.from("teacher_subjects").select("subject_id, class_id").eq("teacher_id", user.id),
        10000,
        timeoutFallback(),
      );
      const { data, error } = result || { data: [], error: null };
      if (error) {
        logger.error("Error fetching teacher subjects:", error);
        return;
      }
      setTeacherSubjects(data || []);
    };
    fetchTeacherSubjects();
  }, [user?.id, isDemo]);

  const [selectedClass, setSelectedClass] = useState("");

  const [schoolSettings, setSchoolSettings] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    setSchoolSettings({});
    if (!school?.id) return;
    if (isDemo) {
      try {
        setSchoolSettings(JSON.parse(sessionStorage.getItem("demo-grading-settings") || "{}"));
      } catch {
        setSchoolSettings({});
      }
      return;
    }
    void withTimeout(loadSchoolSettings(school.id), 10000, {}).then((settings) => {
      if (!cancelled) setSchoolSettings(settings);
    });
    return () => {
      cancelled = true;
    };
  }, [school?.id, isDemo]);

  const track = resolveTrackForClass(classes.find((item) => item.id === selectedClass)?.name, schoolSettings);
  // A school that does not run a beginning-of-term test gets no BOT column at
  // all. Showing an empty one invites a stray mark, and BOT is weighed into
  // MID, so one accidental entry shifts every average for that pupil.
  const useBotEnabled = resolveUseBot(schoolSettings);

  // How many marks exist per subject for this class and term, so the subject
  // picker can say "12 of 40 done" instead of leaving the teacher to remember
  // which of the nine subjects they finished last week. One small column read,
  // re-run when the class or term changes.
  const [subjectProgress, setSubjectProgress] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!selectedClass || !school?.id) {
      setSubjectProgress({});
      return;
    }
    let cancelled = false;
    void withTimeout(
      supabase
        .from("student_grades")
        .select("subject_id")
        .eq("school_id", school.id)
        .eq("class_id", selectedClass)
        .eq("term", currentTerm)
        .eq("academic_year", academicYear),
      10000,
      timeoutFallback(),
    ).then((result) => {
      if (cancelled) return;
      const counts: Record<string, number> = {};
      for (const row of (result.data ?? []) as Array<{ subject_id: string }>) {
        counts[row.subject_id] = (counts[row.subject_id] ?? 0) + 1;
      }
      setSubjectProgress(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClass, currentTerm, academicYear, school?.id]);
  const columnLabels = useMemo(() => {
    const labels: Record<string, { label: string; explain: string }> = {
      bot: { label: "BOT", explain: "Beginning of Term · /100" },
      mid_term: { label: "MOT", explain: "Mid Term · /100" },
      eot: { label: "EOT", explain: "End of Term · /100" },
    };
    for (const column of GRADING_TRACKS[track].columns) {
      for (const key of column.keys)
        labels[key] = {
          label: column.label === "MID" ? key.toUpperCase() : column.label,
          explain: column.explain,
        };
    }
    return labels;
  }, [track]);
  const [selectedSubject, setSelectedSubject] = useState("");
  // A teacher who is assigned one class and one subject should land on the
  // marks, not on a form asking them to choose what they already chose.
  // The pickers are still there, one tap away, for the days they cover for
  // someone else.
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  // Scope the pickers to what this teacher actually teaches. Previously both
  // listed every class and subject in the school, and the assignment check ran
  // only inside the 500ms autosave -- so a teacher could fill a 40-cell grid
  // and then get "You are not assigned to teach this subject in this class"
  // per cell, with nothing persisted. Admins keep the full school list.
  const teacherScoped = isClassScopedRole(user?.role);
  const classOptions = teacherScoped
    ? classes.filter((c) => teacherSubjects.some((ts) => ts.class_id === c.id))
    : classes;
  const subjectOptions =
    teacherScoped && selectedClass
      ? subjects.filter((s) => teacherSubjects.some((ts) => ts.class_id === selectedClass && ts.subject_id === s.id))
      : subjects;

  /**
   * The one class and subject this teacher is assigned, when there is only
   * one of each.
   *
   * A rural teacher is usually given one class and one subject, and the page
   * made them pick both before they could type a single mark. The choice was
   * already made for them in the staff assignments; the page just did not
   * know it. When there is exactly one target, the marks open on it.
   */
  const teacherTargets = teacherScoped
    ? classOptions
        .map((cls) => ({
          cls,
          subjects: subjects.filter((s) =>
            teacherSubjects.some((ts) => ts.class_id === cls.id && ts.subject_id === s.id),
          ),
        }))
        .filter((t) => t.subjects.length > 0)
    : [];
  const singleTarget =
    teacherTargets.length === 1 && teacherTargets[0].subjects.length === 1 ? teacherTargets[0] : null;
  const [coverage, setCoverage] = useState<TopicCoverage[]>([]);
  const [syllabusTopicNames, setSyllabusTopicNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marks, setMarks] = useState<StudentMarks>({});
  const [gradeConfirm, setGradeConfirm] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: "", onConfirm: () => {} });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [competencyMode, setCompetencyMode] = useState(false);
  const [caLocked, setCaLocked] = useState(false);
  const [lockedByName, setLockedByName] = useState("");
  const [marksBy, setMarksBy] = useState<Record<string, { name: string; type: string }>>({});
  const [submissionStatus, setSubmissionStatus] = useState<GradeWorkflowStatus>("draft");
  const statusLabels: Record<GradeWorkflowStatus, string> = {
    draft: "Still Writing",
    submitted: "Sent to Boss",
    approved: "Boss Approved",
    published: "Ready for Parents",
  };
  // Offline-aware students and grades
  const { data: classStudents, loading: studentsLoading, error: studentsError } = useOfflineStudents(school?.id);

  const { data: existingGrades, loading: gradesLoading, error: gradesError } = useOfflineGrades(school?.id);

  /**
   * The sheets that have been handed in.
   *
   * A headmaster does not enter marks -- they are handed them, and the job
   * is to see what is waiting and to approve or publish it. The Grades page
   * opened on the mark-entry form for everyone, so the headmaster landed on a
   * class picker and a subject list (the teacher's job) with no way to see
   * what had been submitted to them.
   *
   * Grouped by class and subject, because that is what a sheet is: one
   * subject's marks for one class, in this term.
   */
  const submittedSheets = useMemo<SubmittedSheet[]>(() => {
    const bySheet = new Map<string, SubmittedSheet>();
    for (const grade of (existingGrades ?? []) as Array<Record<string, any>>) {
      if (grade.term !== currentTerm || grade.academic_year !== academicYear) continue;
      const classId = grade.class_id as string | undefined;
      const subjectId = grade.subject_id as string | undefined;
      if (!classId || !subjectId) continue;

      const key = `${classId}:${subjectId}`;
      const status = (grade.status || "draft") as GradeWorkflowStatus;
      const existing = bySheet.get(key);
      if (!existing) {
        const classRow = classes.find((c) => c.id === classId);
        bySheet.set(key, {
          classId,
          subjectId,
          className: classRow ? `${classRow.name}${classRow.stream ? ` ${classRow.stream}` : ""}` : "Class",
          subjectName:
            (grade.subjects as { name?: string } | undefined)?.name ||
            subjects.find((s) => s.id === subjectId)?.name ||
            "Subject",
          status,
          teacherName: staff.find((s) => s.id === grade.recorded_by)?.full_name || "Unknown",
          markedCount: 1,
        });
      } else {
        if (gradeWorkflowRank(status) > gradeWorkflowRank(existing.status)) existing.status = status;
        existing.markedCount += 1;
      }
    }
    // The waiting ones first: that is the list the headmaster came for.
    return [...bySheet.values()].sort((a, b) => {
      const rank = gradeWorkflowRank(b.status) - gradeWorkflowRank(a.status);
      if (rank !== 0) return rank;
      return a.className.localeCompare(b.className);
    });
  }, [existingGrades, classes, subjects, staff, currentTerm, academicYear]);

  /** The people who hand work on rather than do it. */
  const isReviewer = ["headmaster", "school_admin", "admin", "dean_of_studies"].includes(user?.role || "");

  const sheetNextAction = (sheet: SubmittedSheet) => {
    const next = getNextGradeWorkflowStatusActions(sheet.status, user?.role);
    const status = next[0];
    if (!status) return null;
    return {
      status,
      label: status === "approved" ? "Approve" : status === "published" ? "Publish" : "Send",
    };
  };

  const [inlineEntryMode, setInlineEntryMode] = useState(true);

  useEffect(() => {
    // Default to the full list on every screen size.
    //
    // Phones used to start in the one-pupil-at-a-time swipe deck, which meant
    // opening the page showed a single child out of forty-eight and required
    // swiping through every one of them to see the class. One-at-a-time is a
    // good way to mark; it is a bad way to arrive. The list is the default
    // everywhere and the focused deck is opt-in, which is also how the
    // attendance register works.
    setInlineEntryMode(true);
  }, []);
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const [mobileStudentIndex, setMobileStudentIndex] = useState(0);
  const [quickFillModal, setQuickFillModal] = useState<{
    open: boolean;
    type: string;
    value: string;
  }>({ open: false, type: "", value: "" });
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  // Set-All popover: click-toggle (not hover-only) so it's touch/keyboard reachable.
  const [setAllOpen, setSetAllOpen] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirtyCellsRef = useRef<Map<string, { subjectId: string; classId: string }>>(new Map());

  // Undo for marks.
  //
  // Attendance and fees both had undo; grades did not, and it is the page with
  // the most data at risk -- forty rows of numbers typed by hand, where a
  // transposition is only spotted at results time. One entry is kept at a time:
  // the previous value of the cell that changed, plus enough to describe it.
  // Set-All and bulk fill snapshot the whole map instead, since they touch
  // every pupil at once and reverting one cell would leave it half-applied.
  const [undoMark, setUndoMark] = useState<{
    before: Record<string, number | null>;
    describe: string;
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushUndo = (before: Record<string, number | null>, describe: string) => {
    setUndoMark({ before, describe });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoMark(null), 6000);
  };

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const undoLastMark = () => {
    if (!undoMark) return;
    setMarks(undoMark.before);
    setUndoMark(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    toast.info("Change undone.");
  };
  const assessmentLabels: Record<string, string> = {
    bot: "Beginning of Term (BOT)",
    mid_term: "Mid Term (MOT)",
    eot: "End of Term (EOT)",
    ca1: "CA1",

    ca2: "CA2",
    ca3: "CA3",
    ca4: "CA4",
    project: "Project",
    exam: "End of Term (legacy mark)",
  };
  const touchStartX = useRef(0);
  const mobileCardRef = useRef<HTMLDivElement>(null);
  const lastHydratedGradesSignature = useRef("");

  const [gradePage, setGradePage] = useState(1);
  const gradesPerPage = 20;
  const [statusFilter, setStatusFilter] = useState<"all" | GradeWorkflowStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const existingGradesSignature = useMemo(() => JSON.stringify(existingGrades ?? []), [existingGrades]);
  const staffSignature = useMemo(
    () => JSON.stringify((staff ?? []).map((member) => ({ id: member.id, full_name: member.full_name }))),
    [staff],
  );
  const toastSignature = useMemo(() => JSON.stringify(Object.keys(toast || {})), [toast]);

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return classStudents.filter((s) => s.class_id === selectedClass);
  }, [classStudents, selectedClass]);

  // classStudents is the whole school roster filtered by class_id, so a pupil
  // whose class_id is NULL or stale disappears from the mark sheet with no
  // trace -- and can silently drop an entire assessment column, since the
  // column list is derived from who is present. These are the pupils the
  // roster says exist but the selected class cannot show.
  const unassignedStudents = useMemo(() => classStudents.filter((s) => !s.class_id), [classStudents]);

  const studentStatusMap = useMemo(() => {
    const map: Record<string, GradeWorkflowStatus> = {};
    if (!existingGrades?.length) return map;
    const studentIds = [...new Set(existingGrades.map((g: any) => g.student_id))];
    studentIds.forEach((sid: string) => {
      const studentGrades = existingGrades.filter((g: any) => g.student_id === sid);
      map[sid] = deriveGradeWorkflowStatus(studentGrades as Array<{ status?: string | null }>);
    });
    return map;
  }, [existingGrades]);

  const displayStudents = useMemo(() => {
    let list = filteredStudents;
    if (statusFilter !== "all") {
      list = list.filter((s) => {
        const sStatus = studentStatusMap[s.id] || "draft";
        return sStatus === statusFilter;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((s) => `${s.first_name} ${s.last_name} ${s.student_number || ""}`.toLowerCase().includes(q));
    }
    return list;
  }, [filteredStudents, statusFilter, studentStatusMap, searchQuery]);

  const gradeOffset = (gradePage - 1) * gradesPerPage;
  const gradeTotalPages = Math.max(1, Math.ceil(displayStudents.length / gradesPerPage));
  const isStudentGraded = useCallback(
    (studentId: string): boolean => computeIsStudentGraded(marks, studentId, competencyMode, useBotEnabled),
    [marks, competencyMode, useBotEnabled],
  );
  const gradedCount = useMemo(
    () => filteredStudents.filter((student) => isStudentGraded(student.id)).length,
    [filteredStudents, isStudentGraded],
  );
  const pendingCount = Math.max(filteredStudents.length - gradedCount, 0);

  useEffect(() => {
    setGradePage(1);
  }, [selectedClass, selectedSubject]);

  useEffect(() => {
    if (displayStudents.length > 0 && gradePage > Math.ceil(displayStudents.length / gradesPerPage)) {
      setGradePage(1);
    }
  }, [displayStudents.length, gradePage, gradesPerPage]);

  const paginatedStudents = displayStudents.slice(gradeOffset, gradeOffset + gradesPerPage);

  // Initialize marks from existing grades (offline-aware)
  useEffect(() => {
    const hydrationSignature = `${existingGradesSignature}:${staffSignature}`;
    if (lastHydratedGradesSignature.current === hydrationSignature) return;
    lastHydratedGradesSignature.current = hydrationSignature;

    if ((existingGrades?.length || 0) > 0) {
      const marksMap: StudentMarks = {};
      const newMarksBy: Record<string, { name: string; type: string }> = {};
      let isCaLocked = false;
      let lockedBy = "";

      const legacyExamMarks: Record<string, number | null> = {};
      (existingGrades || []).forEach((g: any) => {
        if (g.assessment_type === "exam") {
          legacyExamMarks[g.student_id] = g.score ?? null;
          if (g.recorded_by) {
            const staffMember = staff.find((s) => s.id === g.recorded_by);
            newMarksBy[g.recorded_by] = { name: staffMember?.full_name || "Unknown", type: "eot" };
          }
          return;
        }
        marksMap[`${g.student_id}_${g.assessment_type}`] = g.score ?? null;
        if (g.recorded_by) {
          const staffMember = staff.find((s) => s.id === g.recorded_by);
          newMarksBy[g.recorded_by] = {
            name: staffMember?.full_name || "Unknown",
            type: g.assessment_type,
          };
        }
        if (g.ca_locked === true) {
          isCaLocked = true;
          lockedBy = g.locked_by;
        }
      });

      for (const [studentId, score] of Object.entries(legacyExamMarks)) {
        const eotKey = `${studentId}_eot`;
        if (marksMap[eotKey] == null && score != null) marksMap[eotKey] = score;
      }

      setMarks(marksMap);
      setMarksBy(newMarksBy);
      setCaLocked(isCaLocked);

      if (lockedBy) {
        const lockedByStaff = staff.find((s) => s.id === lockedBy);
        setLockedByName(lockedByStaff?.full_name || "Unknown");
      } else {
        setLockedByName("");
      }

      setSubmissionStatus(deriveGradeWorkflowStatus(existingGrades as Array<{ status?: string | null }>));
    } else {
      setMarks({});
      setMarksBy({});
      setCaLocked(false);
      setLockedByName("");
      setSubmissionStatus("draft");
    }
  }, [existingGradesSignature, staffSignature, toastSignature]);

  const handleLockCA = async () => {
    if (!selectedClass || !selectedSubject || !user?.id) return;
    setConfirmLockCA(true);
  };

  const handleUnlockCA = async () => {
    if (!selectedClass || !selectedSubject || !user?.id) return;

    setPendingAction(() => async () => {
      try {
        setSaving(true);
        await updateRecord(
          () =>
            supabase
              .from("grades")
              .update({
                ca_locked: false,
                locked_by: null,
                locked_at: null,
              })
              .eq("class_id", selectedClass)
              .eq("subject_id", selectedSubject)
              .in("assessment_type", [...CA_ASSESSMENT_TYPES])
              .eq("term", currentTerm)
              .eq("academic_year", academicYear),
          { timeoutMs: 10000, timeoutMessage: "Unlock CA timed out" },
        );

        if (school?.id && user?.id) {
          await logAuditEventWithOfflineSupport(
            isOnline,
            school.id,
            user.id,
            user.full_name,
            "update",
            "grades",
            `Unlocked CA marks for class ${selectedClass} subject ${selectedSubject}`,
            `${selectedClass}:${selectedSubject}:${currentTerm}:${academicYear}`,
            { ca_locked: true },
            { ca_locked: false, locked_by: null },
          );
        }

        setCaLocked(false);
        setLockedByName("");
        toast.success("Tests have been opened for edits again");
      } catch (err) {
        logger.error("Error opening tests:", err);
        toast.error("Failed to open tests");
      } finally {
        setSaving(false);
      }
    });
    setConfirmOpen(true);
  };

  const handleMarkChange = (studentId: string, type: string, value: string) => {
    if (caLocked && type.startsWith("ca")) {
      toast.error("CA marks are locked. Contact DOS to unlock.");
      return;
    }
    if (termLocked && ["exam", "bot", "mid_term", "eot"].includes(type)) {
      toast.error("This term is locked. Assessment marks can no longer be changed.");
      return;
    }
    if (value === "") {
      setMarks((prev) => ({ ...prev, [`${studentId}_${type}`]: null }));
    } else {
      const maxVal = type === "competency" ? 3 : ASSESSMENT_MAX[type] || 100;
      const num = Math.min(maxVal, Math.max(0, Number(value)));
      // The clamp itself is deliberate -- never store a mark the report cannot
      // render. What was missing was any signal that it had happened: a teacher
      // who transposed 18 as 80, or 50 as 15, watched the field snap to the
      // boundary value with no message and a green "saved" tick beside it, and
      // the discrepancy only surfaced months later at results time. Say what was
      // written, naming the pupil and the assessment.
      if (Number.isFinite(num) && Number(value) !== num) {
        const pupil = filteredStudents.find((s) => s.id === studentId);
        const who = pupil ? `${pupil.first_name} ${pupil.last_name}` : "this pupil";
        const label = assessmentLabels[type] ?? type.toUpperCase();
        toast.error(`${label} for ${who} is out of range (max ${maxVal}). Saved as ${num}.`);
      }
      const pupilForUndo = filteredStudents.find((st) => st.id === studentId);
      pushUndo(
        { [`${studentId}_${type}`]: marks[`${studentId}_${type}`] ?? null },
        `${pupilForUndo ? `${pupilForUndo.first_name} ${pupilForUndo.last_name}` : "Cell"} · ${assessmentLabels[type] ?? type.toUpperCase()} → ${num}`,
      );
      setMarks((prev) => ({ ...prev, [`${studentId}_${type}`]: num }));
      dirtyCellsRef.current.set(`${studentId}_${type}`, {
        subjectId: selectedSubject,
        classId: selectedClass,
      });
    }
  };

  const getMark = (studentId: string, type: string): number | null => readMark(marks, studentId, type);

  const getStudentTotal = (studentId: string): number | null => computeStudentTotal(marks, studentId, competencyMode);

  // Columns shown on a fresh sheet. The list used to be derived from existing
  // marks, so a class/subject with nothing entered yet rendered a sheet with
  // no input boxes at all -- while the on-page guidance said "type the score in
  // the box under CA1". The guidance described a UI that did not exist on
  // first use, which is why teachers could not work out where to type.
  const activeAssessmentTypes = useMemo(
    () => assessmentTypesFor(competencyMode, useBotEnabled),
    [competencyMode, useBotEnabled],
  );

  // Identity + one column per assessment + average/status + grade. The empty and
  // loading rows were pinned at 7, which over-spans a two-column sheet.
  const markSheetColumnCount = activeAssessmentTypes.length + 3;

  const debouncedAutoSave = useCallback(
    (studentId: string, type: string, target?: { subjectId: string; classId: string }) => {
      const key = `${studentId}_${type}`;
      // A flush can fire after the teacher has switched class/subject. Writing
      // then would file the old sheet's mark under the new subject, so pin the
      // destination at the moment the cell went dirty.
      const subjectId = target?.subjectId ?? selectedSubject;
      const classId = target?.classId ?? selectedClass;
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }
      setSaveStatuses((prev) => ({ ...prev, [key]: "dirty" }));
      debounceTimers.current[key] = setTimeout(async () => {
        dirtyCellsRef.current.delete(key);
        const score = marks[key];
        if (score === null || score === undefined) {
          setSaveStatuses((prev) => ({ ...prev, [key]: "idle" }));
          return;
        }
        const isAssigned = teacherSubjects.some((ts) => ts.subject_id === subjectId && ts.class_id === classId);
        if (!isAssigned && user?.role === "teacher") {
          toast.error("You are not assigned to teach this subject in this class.");
          setSaveStatuses((prev) => ({ ...prev, [key]: "idle" }));
          return;
        }
        if (termLocked && ["exam", "bot", "mid_term", "eot"].includes(type)) {
          toast.error("This term is locked. Assessment marks can no longer be changed.");
          setSaveStatuses((prev) => ({ ...prev, [key]: "idle" }));
          return;
        }

        setSaveStatuses((prev) => ({ ...prev, [key]: "saving" }));
        try {
          await saveGrade({
            student_id: studentId,
            subject_id: subjectId,
            class_id: classId,
            assessment_type: type,
            score,
            term: currentTerm,
            academic_year: academicYear,
            recorded_by: user?.id,
            status: "draft",
            isDemo,
            schoolId: school?.id,
          });
          setSaveStatuses((prev) => ({ ...prev, [key]: "saved" }));
          setTimeout(() => {
            setSaveStatuses((prev) => {
              const next = { ...prev };
              if (next[key] === "saved") next[key] = "idle";
              return next;
            });
          }, 2000);
        } catch (err) {
          logger.warn("Failed to auto-save grade:", err);
          setSaveStatuses((prev) => ({ ...prev, [key]: "idle" }));
          toast.error(`Failed to auto-save ${type.toUpperCase()} for student`);
        }
      }, 500);
    },
    [
      marks,
      teacherSubjects,
      selectedSubject,
      selectedClass,
      currentTerm,
      academicYear,
      user?.id,
      user?.role,
      isDemo,
      school?.id,
      toast,
    ],
  );

  useEffect(() => {
    const currentTimers = debounceTimers.current;
    return () => {
      Object.values(currentTimers).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (dirtyCellsRef.current.size === 0) return;
      const toSave = Array.from(dirtyCellsRef.current.entries());
      dirtyCellsRef.current.clear();
      toSave.forEach(([key, target]) => {
        const [studentId, type] = key.split("_");
        if (studentId && type) {
          debouncedAutoSave(studentId, type, target);
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [debouncedAutoSave]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyCellsRef.current.size > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleInlineBlur = useCallback(
    (studentId: string, type: string) => {
      debouncedAutoSave(studentId, type);
    },
    [debouncedAutoSave],
  );

  const handleQuickFill = useCallback(
    (type: string, value: number) => {
      if (caLocked && type.startsWith("ca")) {
        toast.error("CA marks are locked. Contact DOS to unlock.");
        return;
      }
      // Snapshot the whole sheet: this touches every pupil at once, so undoing
      // one cell would leave the rest of the fill applied.
      pushUndo({ ...marks }, `All ${assessmentLabels[type] ?? type.toUpperCase()} → ${value}`);
      setMarks((prev) => {
        const next = { ...prev };
        filteredStudents.forEach((s) => {
          next[`${s.id}_${type}`] = Math.min(ASSESSMENT_MAX[type] || 100, Math.max(0, value));
        });
        return next;
      });
      toast.success(`All ${type.toUpperCase()} set to ${value}`);
    },
    [filteredStudents, caLocked, toast, marks],
  );

  const handleClearAll = useCallback(() => {
    setPendingAction(() => () => {
      pushUndo({ ...marks }, "All marks cleared");
      setMarks({});
      setSaveStatuses({});
      toast.success("All marks cleared");
    });
    setConfirmOpen(true);
  }, [toast, marks]);

  const handleCopyFromPreviousTerm = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !user?.id) return;
    const prevTerm = currentTerm > 1 ? currentTerm - 1 : 3;
    const prevYear = currentTerm === 1 ? String(Number(academicYear) - 1) : academicYear;
    try {
      setLoading(true);
      const { data: prevGrades, error } = await supabase
        .from("grades")
        .select("*")
        .eq("class_id", selectedClass)
        .eq("subject_id", selectedSubject)
        .eq("term", prevTerm)
        .eq("academic_year", prevYear)
        .is("deleted_at", null);
      if (error) throw error;
      if (!prevGrades || prevGrades.length === 0) {
        toast.info("No grades found from previous term");
        return;
      }
      setMarks((prev) => {
        const next = { ...prev };
        prevGrades.forEach((g: any) => {
          next[`${g.student_id}_${g.assessment_type}`] = g.score ?? null;
        });
        return next;
      });
      toast.success(`Copied ${prevGrades.length} grades from Term ${prevTerm}`);
    } catch (err) {
      logger.warn("Failed to copy grades from previous term:", err);
      toast.error("Failed to copy grades from previous term");
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedSubject, user?.id, currentTerm, academicYear, toast]);

  const handleMobileTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleMobileTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          setMobileStudentIndex((prev) => Math.min(prev + 1, filteredStudents.length - 1));
        } else {
          setMobileStudentIndex((prev) => Math.max(prev - 1, 0));
        }
      }
    },
    [filteredStudents.length],
  );

  const navigateMobileStudent = useCallback(
    (direction: "prev" | "next") => {
      setMobileStudentIndex((prev) => {
        if (direction === "prev") return Math.max(prev - 1, 0);
        return Math.min(prev + 1, filteredStudents.length - 1);
      });
    },
    [filteredStudents.length],
  );

  const getSaveStatusForInput = useCallback(
    (studentId: string, type: string): SaveStatus => {
      return saveStatuses[`${studentId}_${type}`] || "idle";
    },
    [saveStatuses],
  );

  const getInputBorderClass = useCallback(
    (studentId: string, type: string): string => {
      const status = getSaveStatusForInput(studentId, type);
      if (status === "dirty") return "ring-2 ring-amber-400 bg-amber-50/30";
      if (status === "saving") return "ring-2 ring-blue-400 bg-blue-50/30 animate-pulse";
      if (status === "saved") return "ring-2 ring-green-400 bg-green-50/30";
      return "";
    },
    [getSaveStatusForInput],
  );

  // Completion stats
  const completionStats = useMemo(() => {
    const total = filteredStudents.length;
    const graded = filteredStudents.filter((s) => isStudentGraded(s.id)).length;
    const notGraded = total - graded;
    const notGradedNames = filteredStudents
      .filter((s) => !isStudentGraded(s.id))
      .map((s) => `${s.first_name} ${s.last_name}`);
    const percentage = total > 0 ? Math.round((graded / total) * 100) : 0;
    return { total, graded, notGraded, notGradedNames, percentage };
  }, [filteredStudents, isStudentGraded]);

  const handleSaveGrades = async (status: GradeWorkflowStatus = "draft") => {
    if (!selectedClass || !selectedSubject) return;
    // The per-cell autosave checks these; the bulk path did not, so it would
    // happily write an unassigned subject or a locked term's exam marks.
    if (user?.role === "teacher") {
      const isAssigned = teacherSubjects.some(
        (ts) => ts.subject_id === selectedSubject && ts.class_id === selectedClass,
      );
      if (!isAssigned) {
        toast.error("You are not assigned to teach this subject in this class.");
        return;
      }
    }
    if (termLocked) {
      const hasTermMarks = Object.keys(marks).some(
        (key) => TRADITIONAL_ASSESSMENT_TYPES.some((type) => key.endsWith(`_${type}`)) && marks[key] != null,
      );
      if (hasTermMarks) {
        toast.error("This term is locked. BOT, MOT, and EOT marks can no longer be changed.");
        return;
      }
    }
    try {
      setSaving(true);
      for (const [key, score] of Object.entries(marks)) {
        if (score === null || score === undefined) continue;
        const parts = key.split("_");
        const assessmentType = parts.pop()!;
        const studentId = parts.join("_");
        const gradePayload: any = {
          student_id: studentId,
          subject_id: selectedSubject,
          class_id: selectedClass,
          assessment_type: assessmentType,
          score,
          term: currentTerm,
          academic_year: academicYear,
          recorded_by: user?.id,
          status,
          isDemo,
          schoolId: school?.id,
        };
        if (assessmentType === "competency") {
          gradePayload.competency_level = getCompetencyLabel(score as CompetencyValue);
        }
        await saveGrade(gradePayload);
      }
      // Bulk-sync student_grades for all students in this subject
      const hasLegacyMarks = Object.keys(marks).some(
        (key) => !TRADITIONAL_ASSESSMENT_TYPES.some((type) => key.endsWith(`_${type}`)),
      );
      if (!competencyMode && hasLegacyMarks) {
        const studentIds = [...new Set(Object.keys(marks).map((k) => k.split("_").slice(0, -1).join("_")))];
        await Promise.allSettled(
          studentIds.map((sid) =>
            syncStudentGrades({
              student_id: sid,
              subject_id: selectedSubject,
              class_id: selectedClass,
              term: currentTerm,
              academic_year: academicYear,
              schoolId: school?.id,
            }),
          ),
        );
      }
      setSubmissionStatus(status);
      const successMessage =
        status === "submitted"
          ? "Grades sent to Boss for review"
          : status === "approved"
            ? "Grades approved by Boss"
            : status === "published"
              ? "Grades are now ready for Parents"
              : "Draft saved (Still Writing)";
      toast.success(successMessage);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as any)?.message ||
            (err as any)?.details ||
            (err as any)?.hint ||
            "Unknown error — check your connection";
      toast.error(`Failed to save grades: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExportGrades = () => {
    if (!selectedClass || filteredStudents.length === 0) {
      toast.error("No grades to export");
      return;
    }
    let headers: string[];
    let rows: string[][];
    if (competencyMode) {
      headers = ["Student Name", "Student Number", "Competency Level", "Status"];
      rows = filteredStudents.map((student) => {
        const comp = getMark(student.id, "competency");
        const label = comp !== null ? getCompetencyLabel(comp as CompetencyValue) : "";
        return [
          `${student.first_name} ${student.last_name}`,
          student.student_number || "",
          comp !== null ? String(comp) : "",
          label,
        ];
      });
    } else {
      headers = ["Student Name", "Student Number", "CA1", "CA2", "CA3", "CA4", "Project", "Exam", "Total", "Grade"];
      rows = filteredStudents.map((student) => {
        const ca1 = getMark(student.id, "ca1");
        const ca2 = getMark(student.id, "ca2");
        const ca3 = getMark(student.id, "ca3");
        const ca4 = getMark(student.id, "ca4");
        const project = getMark(student.id, "project");
        const exam = getMark(student.id, "exam");
        const total = getStudentTotal(student.id);
        const gradeInfo = total !== null ? getGrade(total) : null;
        return [
          `${student.first_name} ${student.last_name}`,
          student.student_number || "",
          ca1 !== null ? String(ca1) : "",
          ca2 !== null ? String(ca2) : "",
          ca3 !== null ? String(ca3) : "",
          ca4 !== null ? String(ca4) : "",
          project !== null ? String(project) : "",
          exam !== null ? String(exam) : "",
          total !== null ? String(total) : "",
          gradeInfo ? gradeInfo.grade : "",
        ];
      });
    }
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grades_${selectedClassName}_${selectedSubjectName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Grades exported");
  };

  const handleSubmitToDean = () => {
    if (!selectedClass || !selectedSubject) {
      toast.error("Please select a class and subject first");
      return;
    }
    if (submissionStatus !== "draft") {
      toast.info("Grades already submitted");
      return;
    }
    if (completionStats.notGraded > 0) {
      setGradeConfirm({
        open: true,
        message: `${completionStats.notGraded} student${completionStats.notGraded > 1 ? "s" : ""} not graded: ${completionStats.notGradedNames.slice(0, 3).join(", ")}${completionStats.notGradedNames.length > 3 ? "..." : ""}. Submit anyway?`,
        onConfirm: () => handleSaveGrades("submitted"),
      });
      return;
    }
    handleSaveGrades("submitted");
  };

  const handleAdvanceWorkflow = async (nextStatus: GradeWorkflowStatus, forClassId?: string, forSubjectId?: string) => {
    // The review list acts on a sheet the headmaster did not open, so the
    // sheet it is about can be named explicitly.
    const targetClass = forClassId ?? selectedClass;
    const targetSubject = forSubjectId ?? selectedSubject;
    if (!targetClass || !targetSubject || !user?.id) {
      toast.error("Save grades first before changing workflow status");
      return;
    }

    const actorLabel =
      nextStatus === "approved"
        ? "approve"
        : nextStatus === "published"
          ? "make ready for parents"
          : nextStatus === "draft"
            ? "pull back to draft for editing"
            : nextStatus === "submitted"
              ? "withdraw from review"
              : "send to boss";

    setGradeConfirm({
      open: true,
      message: `Are you sure you want to ${actorLabel} these grades?`,
      onConfirm: async () => {
        try {
          setSaving(true);
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const token = session?.access_token;

          const response = await fetch("/api/grades/workflow/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token || ""}`,
            },
            body: JSON.stringify({
              class_id: targetClass,
              subject_id: targetSubject,
              next_status: nextStatus,
              term: currentTerm,
              academic_year: academicYear,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update workflow status");
          }

          if (school?.id) {
            await logAuditEventWithOfflineSupport(
              isOnline,
              school.id,
              user.id,
              user.full_name,
              "update",
              "grades",
              `Changed grade workflow to ${nextStatus} for class ${targetClass} subject ${targetSubject}`,
              `${targetClass}:${targetSubject}:${currentTerm}:${academicYear}`,
              { status: submissionStatus },
              { status: nextStatus },
            );
          }

          setSubmissionStatus(nextStatus);
          toast.success(`Grades ${nextStatus}`);
        } catch (err) {
          logger.error("Error updating grade workflow:", err);
          toast.error("Failed to update workflow status");
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleSaveDraft = () => {
    if (!selectedClass || !selectedSubject) {
      toast.error("Please select a class and subject first");
      return;
    }
    handleSaveGrades("draft");
  };

  const fetchCoverage = useCallback(async () => {
    try {
      setLoading(true);
      const [coverageResult, syllabusResult] = await Promise.all([
        withTimeout(
          supabase
            .from("topic_coverage")
            .select(
              "id, syllabus_id, class_id, teacher_id, status, syllabus!inner(topic, subject_id, term, academic_year)",
            )
            .eq("class_id", selectedClass)
            .eq("syllabus.subject_id", selectedSubject)
            .eq("syllabus.term", currentTerm)
            .eq("syllabus.academic_year", academicYear),
          15000,
          timeoutFallback(),
        ),
        withTimeout(
          supabase
            .from("syllabus")
            .select("topic")
            .eq("class_id", selectedClass)
            .eq("subject_id", selectedSubject)
            .eq("term", currentTerm)
            .eq("academic_year", academicYear)
            .order("topic"),
          10000,
          timeoutFallback(),
        ),
      ]);

      const { data: covData, error: covError } = coverageResult || { data: [], error: null };
      if (covError) throw covError;

      const { data: sylData, error: sylError } = syllabusResult || { data: [], error: null };
      if (sylError) throw sylError;

      const mapped = (covData || []).map((row: any) => ({
        id: row.id,
        syllabus_id: row.syllabus_id,
        class_id: row.class_id,
        teacher_id: row.teacher_id,
        status: row.status,
        topic_name: row.syllabus?.topic || "",
      }));
      setCoverage(mapped);
      setSyllabusTopicNames((sylData || []).map((s: any) => s.topic).filter(Boolean));
    } catch (err) {
      logger.error("Error fetching coverage:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedSubject, currentTerm, academicYear]);

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchCoverage();
    }
  }, [selectedClass, selectedSubject, fetchCoverage]);

  const updateTopicStatus = async (topicName: string, status: "not_started" | "in_progress" | "completed") => {
    try {
      const existing = coverage.find((c) => c.topic_name === topicName);
      if (existing) {
        await updateRecord(
          () =>
            supabase
              .from("topic_coverage")
              .update({
                status,
                teacher_id: user?.id,
                completed_date: status === "completed" ? new Date().toISOString().split("T")[0] : null,
              })
              .eq("id", existing.id),
          { timeoutMs: 10000, timeoutMessage: "Coverage update timed out" },
        );
      } else {
        const { data: syllabusRow, error } = await supabase
          .from("syllabus")
          .select("id")
          .eq("school_id", school?.id)
          .eq("class_id", selectedClass)
          .eq("subject_id", selectedSubject)
          .eq("term", currentTerm)
          .eq("academic_year", academicYear)
          .eq("topic", topicName)
          .maybeSingle();

        if (error || !syllabusRow?.id) {
          toast.error("Add this topic in the syllabus page first");
          return;
        }

        await createRecord(
          () =>
            supabase.from("topic_coverage").insert({
              syllabus_id: syllabusRow.id,
              class_id: selectedClass,
              teacher_id: user?.id,
              status,
              completed_date: status === "completed" ? new Date().toISOString().split("T")[0] : null,
            }),
          { timeoutMs: 10000, timeoutMessage: "Coverage insert timed out" },
        );
      }
      fetchCoverage();
      toast.success("Topic status updated");
    } catch (err) {
      logger.warn("Failed to update topic status:", err);
      toast.error("Failed to update");
    }
  };

  const getTopicStatus = useCallback(
    (topicName: string): string => {
      return coverage.find((c) => c.topic_name === topicName)?.status || "not_started";
    },
    [coverage],
  );

  const selectedSubjectName = subjects.find((s) => s.id === selectedSubject)?.name || "";
  const selectedClassObj = classes.find((c) => c.id === selectedClass);
  const selectedClassName = selectedClassObj
    ? `${selectedClassObj.name}${selectedClassObj.stream ? ` ${selectedClassObj.stream}` : ""}`
    : "";

  // Open on the teacher's own class and subject when there is only one of
  // each. The pickers stay one tap away for the days they cover for someone
  // else.
  useEffect(() => {
    if (!singleTarget) return;
    if (selectedClass && selectedSubject) return;
    if (!selectedClass) setSelectedClass(singleTarget.cls.id);
    if (!selectedSubject) setSelectedSubject(singleTarget.subjects[0].id);
  }, [singleTarget, selectedClass, selectedSubject]);
  const topics = useMemo(
    () => (syllabusTopicNames.length > 0 ? syllabusTopicNames : DEFAULT_TOPICS),
    [syllabusTopicNames],
  );

  const coverageStats = useMemo(() => {
    const total = topics.length;
    const completed = topics.filter((t) => getTopicStatus(t) === "completed").length;
    const inProgress = topics.filter((t) => getTopicStatus(t) === "in_progress").length;
    return {
      total,
      completed,
      inProgress,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [topics, getTopicStatus]);

  const isSubmitted = submissionStatus !== "draft";
  const isPublished = submissionStatus === "published";
  const nextWorkflowActions = getNextGradeWorkflowStatusActions(submissionStatus, user?.role);
  // Scenario #19: there was no way back. A mis-keyed sheet that had been sent
  // to the DOS could only be corrected by an admin doing it by hand.
  const prevWorkflowActions = getPrevGradeWorkflowStatusActions(submissionStatus, user?.role);
  const statusTone =
    submissionStatus === "published"
      ? "bg-[var(--green-soft)] text-[var(--green-ink)]"
      : submissionStatus === "approved"
        ? "bg-[var(--navy-soft)] text-[var(--blue-ink)]"
        : submissionStatus === "submitted"
          ? "bg-[var(--amber-soft)] text-[var(--amber-ink)]"
          : "bg-[var(--surface-container)] text-[var(--t2)]";

  const [confirmLockCA, setConfirmLockCA] = useState(false);

  const executeLockCA = async () => {
    setConfirmLockCA(false);
    if (!selectedClass || !selectedSubject || !user?.id) return;
    try {
      setSaving(true);
      await updateRecord(
        () =>
          supabase
            .from("grades")
            .update({
              ca_locked: true,
              locked_by: user.id,
              locked_at: new Date().toISOString(),
            })
            .eq("class_id", selectedClass)
            .eq("subject_id", selectedSubject)
            .in("assessment_type", [...CA_ASSESSMENT_TYPES])
            .eq("term", currentTerm)
            .eq("academic_year", academicYear),
        { timeoutMs: 10000, timeoutMessage: "Lock CA timed out" },
      );

      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          isOnline,
          school.id,
          user.id,
          user.full_name,
          "update",
          "grades",
          `Locked CA marks for class ${selectedClass} subject ${selectedSubject}`,
          `${selectedClass}:${selectedSubject}:${currentTerm}:${academicYear}`,
          { ca_locked: false },
          { ca_locked: true, locked_by: user.id },
        );
      }

      setCaLocked(true);
      setLockedByName(staff.find((s) => s.id === user.id)?.full_name || "You");
      toast.success("Tests have been closed for edits");
    } catch (err) {
      logger.error("Error locking tests:", err);
      toast.error("Failed to close tests for edits");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="space-y-6 p-4 pb-52 sm:p-6 sm:pb-48">
        {/* Grade workflow confirm modal */}
        <Modal
          isOpen={gradeConfirm.open}
          onClose={() => setGradeConfirm((s) => ({ ...s, open: false }))}
          title="Confirm Action"
        >
          <p className="text-sm text-gray-700 mb-4">{gradeConfirm.message}</p>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setGradeConfirm((s) => ({ ...s, open: false }))}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setGradeConfirm((s) => ({ ...s, open: false }));
                gradeConfirm.onConfirm();
              }}
            >
              Confirm
            </Button>
          </ModalFooter>
        </Modal>
        <PageHeader
          title="Grades & Marks"
          subtitle={
            selectedClassName && selectedSubjectName
              ? `${selectedClassName} \u2022 ${selectedSubjectName}`
              : "Select a class and subject to begin"
          }
          actions={
            <div className="flex flex-wrap gap-2">
              {/*
                  The lock used to sit up here, in the page header, while the
                  pupils it locks were a long scroll further down. A control
                  that freezes the work belongs next to the work, so it moved
                  down to the marks list.
                */}
              <Button
                variant="secondary"
                onClick={handleExportGrades}
                icon={<MaterialIcon icon="cloud_download" className="text-lg" />}
              >
                Export
              </Button>
              {/*
                  Save used to live here as well as in the sticky bar, calling a
                  different handler -- handleSaveGrades here against
                  handleSaveDraft there -- so what "Save Grades" did depended on
                  which one you pressed. One action, in the one place that is
                  reachable without scrolling to the bottom of a 48-row table.
                */}
            </div>
          }
        />
        {/* What still needs grading.

            The teacher opens this page with one question: which subject am I
            here to do? That used to be answered by a dropdown of bare names
            with no indication of what was already finished, behind a passive
            three-step strip that described the workflow rather than performing
            it. Now every subject the teacher is assigned to is a tap target
            carrying its own count, so the next piece of work is visible rather
            than remembered, and choosing is one tap instead of opening a
            select and scanning it. */}
        {/*
            Order matters here, and it was backwards.

            The subject list is derived from the selected class, so reading
            subjects first and choosing the class underneath them asks the
            teacher to judge a list that is about to change. Class, then
            subject, then the marks table -- each screen answers the question
            the previous one raised.
          */}{" "}
        {/* What has been handed in.
            A headmaster opens this page to see the work that is waiting for
            them, not to choose a class. The entry form is still here -- some
            headmasters mark their own class -- but it is under its own
            heading, so the two are not confused. */}
        <SubmittedSheetsPanel
          sheets={submittedSheets}
          loading={gradesLoading}
          heading={isReviewer ? "Submitted for review" : "Your grade sheets"}
          emptyHint={
            isReviewer
              ? "No sheets have been submitted yet. When a teacher sends their marks they appear here, ready to approve."
              : "You have not entered any marks yet for this term."
          }
          nextAction={sheetNextAction}
          onOpen={(sheet) => {
            setShowTargetPicker(true);
            setSelectedClass(sheet.classId);
            setSelectedSubject(sheet.subjectId);
          }}
          onAdvance={(sheet, status) => void handleAdvanceWorkflow(status, sheet.classId, sheet.subjectId)}
        />
        {/* Class picker — the one thing that has to be right before the
            subject list below means anything.

            A teacher with exactly one class and one subject does not see
            this at all: the marks open on the target that was assigned to
            them, and the "change" link in the context bar brings the
            pickers back for the days they cover for someone else. */}
        {isReviewer && (
          <h2 className="mt-6 text-sm font-semibold text-[var(--t1)]">
            Enter marks
            <span className="ml-2 font-normal text-[var(--t3)]">for a class yourself</span>
          </h2>
        )}
        {!(singleTarget && !showTargetPicker) && (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="grade-target-class" className="block text-sm font-semibold mb-2 text-primary">
                Target Class
              </label>
              {classesLoading ? (
                <div className="bg-[var(--navy-soft)] border border-[rgba(0,31,63,0.12)] rounded-xl p-4">
                  <p className="text-[var(--t1)] text-sm font-medium">Loading classes...</p>
                  <p className="text-[var(--t3)] text-xs mt-1">
                    The class list is still being fetched for this school.
                  </p>
                </div>
              ) : classes.length === 0 ? (
                <div className="bg-[var(--amber-soft)] border border-[var(--amber)]/20 rounded-xl p-4">
                  {isClassScopedRole(user?.role) ? (
                    <>
                      <p className="text-[var(--t1)] text-sm font-medium">No classes assigned yet</p>
                      <p className="text-[var(--amber)] text-xs mt-1">
                        Your administrator hasn&apos;t assigned you to a class or subject yet.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[var(--t1)] text-sm font-medium">No classes found</p>
                      <p className="text-[var(--amber)] text-xs mt-1">Contact support if this persists.</p>
                    </>
                  )}
                </div>
              ) : (
                <select
                  id="grade-target-class"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-medium"
                >
                  <option value="">Select Class</option>
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.stream ? ` ${c.stream}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
        {/* Sticky context. Once marks are on screen, a teacher scrolling a
            long register needs to be able to answer "which subject is this?"
            without scrolling back up. Sits above the grid on phones, beside it
            on wide screens. */}
        {selectedClass && selectedSubjectName && (
          <div className="sticky top-0 z-20 mb-3 -mx-1 px-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-sm">
              <span className="text-sm font-bold text-[var(--t1)]">{selectedSubjectName}</span>
              <span className="text-xs text-[var(--t3)]">
                {selectedClassName} &middot; Term {currentTerm} &middot; {academicYear}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowTargetPicker(true);
                  setSelectedSubject("");
                }}
                className="ml-auto min-h-11 text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                Change class or subject
              </button>
            </div>
          </div>
        )}
        {subjectOptions.length > 0 && !(singleTarget && !showTargetPicker) && (
          <section aria-labelledby="subject-picker-heading" className="mb-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="subject-picker-heading" className="text-sm font-semibold text-[var(--t1)]">
                {selectedClassName ? `What are you grading in ${selectedClassName}?` : "What do you teach?"}
              </h2>
              <span className="text-xs text-[var(--t3)]">
                {selectedClass
                  ? `${subjectOptions.filter((s) => (subjectProgress[s.id] ?? 0) > 0).length} of ${subjectOptions.length} started`
                  : `${subjectOptions.length} to choose from`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {subjectOptions.map((subject) => {
                const done = subjectProgress[subject.id] ?? 0;
                const total = displayStudents.length;
                const active = subject.id === selectedSubject;
                const complete = total > 0 && done >= total;
                return (
                  <button
                    key={subject.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedSubject(active ? "" : subject.id)}
                    className={`min-h-16 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-[var(--primary)] bg-[var(--navy-soft)] ring-2 ring-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]"
                    }`}
                  >
                    <span className="block text-sm font-semibold leading-tight text-[var(--t1)]">{subject.name}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs">
                      {!selectedClass ? (
                        <span className="text-[var(--t3)]">Tap to choose</span>
                      ) : total === 0 ? (
                        <span className="text-[var(--t3)]">No pupils in this class</span>
                      ) : complete ? (
                        <>
                          <MaterialIcon icon="check_circle" size={14} className="text-[var(--green)]" />
                          <span className="font-semibold text-[var(--green)]">All {total} done</span>
                        </>
                      ) : done > 0 ? (
                        <>
                          <MaterialIcon icon="edit" size={14} className="text-[var(--amber)]" />
                          <span className="font-semibold text-[var(--amber)]">
                            {done} of {total}
                          </span>
                        </>
                      ) : (
                        <>
                          <MaterialIcon icon="radio_button_unchecked" size={14} className="text-[var(--t3)]" />
                          <span className="text-[var(--t3)]">Not started</span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {/* First-run guidance. Owly owns the steps now; the button only stays
            until the teacher has entered their first mark. */}
        {selectedClass && selectedSubject && Object.keys(marks).length === 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <OwlyTrigger guideId="grades" label="How do I enter marks?" />
            <VideoLessonButton lesson="marks" />
          </div>
        )}
        {/* The column meanings live in Owly now, so the table header stays a
            header instead of carrying a paragraph under every column. */}
        {selectedClass && selectedSubject && Object.keys(marks).length === 0 && (
          <OwlyTrigger guideId="grades-terms" label="What do BOT, MOT and EOT mean?" />
        )}
        {/* Everything below only appears once a class + subject are chosen */}
        {selectedClass && selectedSubject && (
          <>
            {/*
                One progress readout, not four.

                This page used to report the same fact in four places at once: "X
                of N entered" in the sticky context bar, "X graded · Y pending"
                here, a "0/48 graded 0%" panel under it, and "Still to grade:
                <four names> +44 more" beside the filter bar. A teacher marking
                a register should not have to work out which number is current.

                So: one bar, the two numbers that differ (done and left), and
                the next name to grade when there is one. The averaging rule
                moved into the explainer above, where it belongs.
              */}
            <section aria-label="grades progress" className="px-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-semibold text-[var(--t2)]">
                  <span className="text-[var(--green)] font-bold">{gradedCount}</span>
                  {" of "}
                  <span className="text-[var(--t1)] font-bold">{displayStudents.length}</span> graded
                </span>
                {pendingCount > 0 && completionStats.notGradedNames[0] && (
                  <span className="text-[var(--t3)]">
                    Next: <span className="font-semibold text-[var(--t2)]">{completionStats.notGradedNames[0]}</span>
                  </span>
                )}
              </div>
              <div
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container-high)]"
                role="progressbar"
                aria-valuenow={gradedCount}
                aria-valuemin={0}
                aria-valuemax={displayStudents.length}
                aria-label="Pupils graded"
              >
                <div
                  className="h-full rounded-full bg-[var(--green)] transition-all"
                  style={{
                    width: `${displayStudents.length ? Math.round((gradedCount / displayStudents.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </section>

            {/* Undo. Sits directly under the summary line so it appears next to
                the "N pending" count it relates to, rather than in a corner the
                teacher's eye never travels to while typing. */}
            {undoMark && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] px-4 py-2.5">
                <MaterialIcon icon="undo" className="text-lg text-[var(--primary)]" />
                <span className="text-sm text-[var(--t2)]">
                  Changed <span className="font-semibold text-[var(--t1)]">{undoMark.describe}</span>
                </span>
                <button
                  type="button"
                  onClick={undoLastMark}
                  className="ml-auto min-h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-bold text-white"
                >
                  Undo
                </button>
              </div>
            )}

            {/* Marks Entry Info */}
            {Object.keys(marksBy).length > 0 && (
              <div className="flex gap-4 flex-wrap">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${statusTone}`}>
                  <MaterialIcon icon="task_alt" className="text-sm" />
                  <span>Work Status: {statusLabels[submissionStatus]}</span>
                </div>
                {Object.values(marksBy).some((m) => ["ca1", "ca2", "ca3"].includes(m.type)) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full text-xs font-medium">
                    <MaterialIcon icon="person" className="text-sm" />
                    <span>
                      CA entered by:{" "}
                      {marksBy[Object.keys(marksBy).find((k) => marksBy[k].type.startsWith("ca")) || ""]?.name ||
                        "Unknown"}
                    </span>
                  </div>
                )}
                {Object.values(marksBy).some((m) => m.type === "eot") && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full text-xs font-medium">
                    <MaterialIcon icon="supervisor_account" className="text-sm" />
                    <span>
                      EOT mark entered by:{" "}
                      {marksBy[Object.keys(marksBy).find((k) => marksBy[k].type === "eot") || ""]?.name || "Unknown"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {caLocked && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--red-soft)] border border-[var(--red)]/20 rounded-xl text-sm font-medium text-[var(--red-ink)]">
                <MaterialIcon icon="lock" className="text-lg" />
                CA marks are locked for this subject/class. Contact DOS to unlock.
              </div>
            )}

            {/* Approve / Publish only — Submit lives exclusively in the sticky bar */}
            {nextWorkflowActions.filter((s) => s !== "submitted").length > 0 && (
              <div className="flex flex-wrap gap-3">
                {nextWorkflowActions
                  .filter((status) => status !== "submitted")
                  .map((status) => (
                    <Button
                      key={status}
                      variant={status === "published" ? "primary" : "secondary"}
                      onClick={() => handleAdvanceWorkflow(status)}
                      disabled={saving}
                    >
                      {status === "approved" ? "Approve Grades" : "Publish Grades"}
                    </Button>
                  ))}
              </div>
            )}

            {/* Retreat actions, kept visually separate from the forward ones so
                an un-publish never reads as an approval. */}
            {prevWorkflowActions.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-[var(--t3)]">Step back:</span>
                {prevWorkflowActions.map((status) => (
                  <Button
                    key={status}
                    variant="secondary"
                    onClick={() => handleAdvanceWorkflow(status)}
                    disabled={saving}
                  >
                    {status === "draft"
                      ? "Pull Back to Draft"
                      : status === "submitted"
                        ? "Withdraw from Review"
                        : "Un-publish"}
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
        {/* Completion Tracker — kept to one compact row. It used to be a tall
            card with a progress bar and a full wall of ungraded names, which
            pushed the mark-entry grid far below the fold. */}
        {tab === "marks" && selectedClass && selectedSubject && filteredStudents.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap px-1 text-xs">
            {isSubmitted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                <MaterialIcon icon="lock" className="text-xs" />
                Submitted
              </span>
            )}
            {/* The lock lives here, with the pupils it freezes.

                It used to sit in the page header, a screen away from the
                marks it locks: a teacher who wanted to close the register
                had to scroll up to find it, and a teacher halfway down a
                list of forty had no idea it existed. The control that ends
                the work belongs beside the work. */}
            {caLocked ? (
              <Button
                variant="secondary"
                onClick={handleUnlockCA}
                disabled={saving}
                icon={<MaterialIcon icon="lock_open" className="text-lg" />}
              >
                Open for Edits ({lockedByName})
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={handleLockCA}
                disabled={saving || !selectedClass || !selectedSubject}
                icon={<MaterialIcon icon="lock" className="text-lg" />}
              >
                Close for Edits (Lock)
              </Button>
            )}
          </div>
        )}
        {/* Workflow Status Filter */}
        {selectedClass && selectedSubject && (
          <FilterBar
            searchLabel="Search students"
            searchPlaceholder="Student name or number…"
            searchValue={searchQuery}
            onSearchChange={(value) => {
              setSearchQuery(value);
              setGradePage(1);
            }}
            chips={
              statusFilter === "all"
                ? []
                : [{ key: "status", label: "Status", value: statusFilter, display: statusFilter }]
            }
            onRemoveChip={() => {
              setStatusFilter("all");
              setGradePage(1);
            }}
            onClearAll={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setGradePage(1);
            }}
            resultCount={displayStudents.length}
            totalCount={filteredStudents.length}
          >
            <div role="group" aria-label="Grade status" className="flex flex-wrap gap-2">
              {(["all", "draft", "submitted", "approved"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={statusFilter === f}
                  onClick={() => {
                    setStatusFilter(f);
                    setGradePage(1);
                  }}
                  className={`min-h-11 px-3 py-2 rounded-full text-xs font-bold transition-colors ${
                    statusFilter === f
                      ? f === "all"
                        ? "bg-primary text-on-primary"
                        : f === "draft"
                          ? "bg-[var(--amber-soft)] text-[var(--amber-ink)] border border-[var(--amber)]/30"
                          : f === "submitted"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-[var(--green-soft)] text-[var(--green-ink)] border border-[var(--green)]/30"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {f === "all" ? "All" : f === "draft" ? "Draft" : f === "submitted" ? "Submitted" : "Approved"}
                </button>
              ))}
            </div>
          </FilterBar>
        )}
        {selectedClass && selectedSubject && (
          <Tabs
            tabs={[
              { id: "marks", label: "Marks Entry" },
              { id: "coverage", label: "Topic Coverage" },
            ]}
            activeTab={tab}
            onChange={(id) => setTab(id as "marks" | "coverage")}
          />
        )}
        {/* Inline Entry Controls */}
        {tab === "marks" && selectedClass && selectedSubject && filteredStudents.length > 0 && (
          <div className="space-y-4">
            {/* The out-of-100 rule is in the Owly guide; repeating it above the
                table on every visit was one banner too many. */}
            {/* View Mode Toggle & Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInlineEntryMode(true)}
                  title="Show every pupil in a list"
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    inlineEntryMode
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MaterialIcon icon="view_list" className="text-lg" />
                    All pupils
                  </span>
                </button>
                <button
                  onClick={() => setInlineEntryMode(false)}
                  title="Mark one pupil at a time"
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all md:hidden ${
                    !inlineEntryMode
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MaterialIcon icon="smartphone" className="text-lg" />
                    One at a time
                  </span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCompetencyMode(!competencyMode)}
                  title={competencyMode ? "Switch to marks-based grading" : "Switch to competency-based assessment"}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                    competencyMode
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  <MaterialIcon icon="psychology" className="text-base" />
                  Competency
                </button>
                <div className="relative">
                  <button
                    className="px-3 py-2 rounded-xl text-sm font-medium bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5"
                    onClick={() =>
                      setQuickFillModal({
                        open: true,
                        type: "ca1",
                        value: "",
                      })
                    }
                  >
                    <MaterialIcon icon="playlist_add" className="text-base" />
                    Quick Fill
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl text-sm font-medium bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5"
                    onClick={() => setBulkImportOpen(true)}
                  >
                    <MaterialIcon icon="upload" className="text-base" />
                    Import
                  </button>
                  <button
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                      setAllOpen
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                    onClick={() => setSetAllOpen((v) => !v)}
                    aria-expanded={setAllOpen}
                    aria-haspopup="dialog"
                  >
                    <MaterialIcon icon="done_all" className="text-base" />
                    Set All
                  </button>
                  {setAllOpen && (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-20 cursor-default"
                        aria-label="Close Set All"
                        onClick={() => setSetAllOpen(false)}
                      />
                      <div
                        role="dialog"
                        aria-label="Set All Students"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setSetAllOpen(false);
                        }}
                        className="absolute right-0 top-full mt-1 w-64 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/10 p-4 z-30"
                      >
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
                          Set All Students
                        </p>
                        {activeAssessmentTypes.map((type) => (
                          <div key={type} className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-on-surface-variant w-10">
                              {type === "bot"
                                ? "BOT"
                                : type === "mid_term"
                                  ? "MOT"
                                  : type === "eot"
                                    ? "EOT"
                                    : type === "ca1"
                                      ? "CA1"
                                      : type === "ca2"
                                        ? "CA2"
                                        : type === "ca3"
                                          ? "CA3"
                                          : type === "ca4"
                                            ? "CA4"
                                            : type === "project"
                                              ? "Proj"
                                              : type.toUpperCase()}
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={ASSESSMENT_MAX[type]}
                              placeholder={`Max ${ASSESSMENT_MAX[type]}`}
                              className="flex-1 bg-surface-container border-none rounded-lg text-sm py-1.5 px-2 focus:ring-2 focus:ring-primary"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const val = parseInt((e.target as HTMLInputElement).value);
                                  if (!isNaN(val)) handleQuickFill(type, val);
                                }
                              }}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) handleQuickFill(type, val);
                              }}
                            />
                          </div>
                        ))}
                        <div className="border-t border-outline-variant/10 mt-3 pt-3 flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCopyFromPreviousTerm}
                            loading={loading}
                            className="flex-1 text-xs"
                          >
                            Copy Prev Term
                          </Button>
                          <Button variant="danger" size="sm" onClick={handleClearAll} className="flex-1 text-xs">
                            Clear All
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop: Inline Table View (md and up) + mobile cards (<md) */}
            {inlineEntryMode && (
              <>
                <div className="hidden md:block bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto table-responsive">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low/50 text-left">
                          <th className="px-8 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                            Student Identity
                          </th>
                          {competencyMode ? (
                            <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                              Competency Level
                            </th>
                          ) : (
                            <>
                              {activeAssessmentTypes.map((type) => {
                                const labelInfo = columnLabels[type] || {
                                  label: assessmentLabel(type),
                                  explain: "",
                                };
                                return (
                                  <th
                                    key={type}
                                    scope="col"
                                    className="px-4 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center align-bottom"
                                  >
                                    <span className="block">{labelInfo.label}</span>
                                    {/*
                                      The out-of mark belongs here as "/100". It was a
                                      stray ")" that rendered every numeric header as
                                      ")100", and the long explanation was repeated
                                      under every column, turning the header row into a
                                      paragraph. Both live in the explainer below the
                                      table now.
                                    */}
                                    <span className="block text-xs font-semibold normal-case tracking-normal text-[var(--t3)]">
                                      /{ASSESSMENT_MAX[type]}
                                    </span>
                                  </th>
                                );
                              })}
                            </>
                          )}
                          <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                            {competencyMode ? "Status" : "Average /100"}
                          </th>
                          <th className="px-8 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-right">
                            Grade
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container">
                        {studentsLoading ? (
                          <tr>
                            <td colSpan={markSheetColumnCount} className="px-8 py-12">
                              <TableSkeleton rows={5} />
                            </td>
                          </tr>
                        ) : displayStudents.length === 0 ? (
                          <tr>
                            <td colSpan={markSheetColumnCount} className="px-8 py-12">
                              <NoData
                                title={
                                  statusFilter !== "all"
                                    ? `No ${statusFilter} students in this class`
                                    : "No students in this class"
                                }
                              />
                            </td>
                          </tr>
                        ) : unassignedStudents.length > 0 ? (
                          // A pupil with no class_id is invisible here, and their
                          // absence can erase a whole assessment column. Say so
                          // rather than let the sheet look complete.
                          <tr>
                            <td colSpan={markSheetColumnCount} className="px-8 py-10">
                              <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-4 py-3 text-sm text-[var(--t1)]">
                                <p className="font-semibold">
                                  {unassignedStudents.length} student
                                  {unassignedStudents.length === 1 ? " is" : "s are"} not assigned to any class
                                </p>
                                <p className="mt-1 text-xs text-[var(--t3)]">
                                  They will not appear on this mark sheet. Ask an administrator to assign them to a
                                  class.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedStudents.map((student) => {
                            const ca1 = getMark(student.id, "ca1");
                            const ca2 = getMark(student.id, "ca2");
                            const ca3 = getMark(student.id, "ca3");
                            const exam = getMark(student.id, "exam");
                            const total = getStudentTotal(student.id);
                            const gradeInfo = total !== null ? getGrade(total) : null;
                            const graded = isStudentGraded(student.id);
                            return (
                              <tr
                                key={student.id}
                                className={`hover:bg-surface-bright transition-colors ${
                                  !graded && completionStats.graded < completionStats.total
                                    ? "bg-orange-50/20 dark:bg-orange-900/5"
                                    : ""
                                }`}
                              >
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-4">
                                    <PersonInitials name={`${student.first_name} ${student.last_name}`} size={40} />
                                    <div>
                                      <p className="font-bold text-primary">
                                        {student.first_name} {student.last_name}
                                      </p>
                                      <p className="text-xs text-on-surface-variant">{student.student_number || "-"}</p>
                                      <GradeStatusBadge status={studentStatusMap[student.id]} />
                                    </div>
                                    {graded && <MaterialIcon icon="check_circle" className="text-green-500 text-lg" />}
                                  </div>
                                </td>
                                {competencyMode ? (
                                  <td className="px-4 py-5">
                                    <div className="relative">
                                      <select
                                        className="w-24 mx-auto block text-center font-bold py-2 px-1 rounded-lg border-none focus:outline-none transition-all bg-surface-container-low"
                                        value={marks[`${student.id}_competency`] ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          handleMarkChange(student.id, "competency", val ? val : "");
                                        }}
                                        disabled={isSubmitted}
                                      >
                                        <option value="">—</option>
                                        {COMPETENCY_SCHEME.values?.map((cv) => (
                                          <option key={cv.value} value={cv.value}>
                                            {cv.value} - {cv.label}
                                          </option>
                                        ))}
                                      </select>
                                      {getSaveStatusForInput(student.id, "competency") === "saved" && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                                      )}
                                    </div>
                                  </td>
                                ) : (
                                  activeAssessmentTypes.map((type) => (
                                    <td key={type} className="px-4 py-5">
                                      <div className="relative">
                                        <input
                                          className={`w-16 mx-auto block text-center font-bold py-2 px-1 rounded-lg border-none focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${getInputBorderClass(student.id, type)}`}
                                          type="number"
                                          inputMode="numeric"
                                          min={0}
                                          max={ASSESSMENT_MAX[type]}
                                          placeholder="—"
                                          value={
                                            marks[`${student.id}_${type}`] !== null &&
                                            marks[`${student.id}_${type}`] !== undefined
                                              ? String(marks[`${student.id}_${type}`])
                                              : ""
                                          }
                                          onChange={(e) => handleMarkChange(student.id, type, e.target.value)}
                                          onBlur={() => handleInlineBlur(student.id, type)}
                                          disabled={
                                            isSubmitted ||
                                            (caLocked && type.startsWith("ca")) ||
                                            (termLocked && ["exam", "bot", "mid_term", "eot"].includes(type))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.currentTarget.blur();
                                            }
                                          }}
                                        />
                                        {getSaveStatusForInput(student.id, type) === "saved" && (
                                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                                        )}
                                      </div>
                                    </td>
                                  ))
                                )}
                                <td className="px-4 py-5 text-center">
                                  <span
                                    className={`font-black text-xl ${total !== null ? "text-primary" : "text-on-surface-variant"}`}
                                  >
                                    {total !== null ? total : "—"}
                                  </span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <span
                                    className={`px-4 py-1.5 rounded-full text-xs font-black ${gradeInfo ? "bg-surface-container" : "bg-surface-bright text-on-surface-variant"} ${gradeInfo?.color || ""}`}
                                  >
                                    {gradeInfo ? gradeInfo.grade : "-"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {displayStudents.length > 0 && !competencyMode && (
                        <tfoot className="bg-surface-container-low/40">
                          <tr>
                            <ClassAverageRow
                              marks={marks}
                              studentIds={displayStudents.map((s) => s.id)}
                              assessmentTypes={activeAssessmentTypes}
                              competencyMode={competencyMode}
                            />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  {displayStudents.length > gradesPerPage && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-outline-variant/10">
                      <span className="text-sm text-on-surface-variant">
                        Page {gradePage} of {gradeTotalPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setGradePage((p) => Math.max(1, p - 1))}
                          disabled={gradePage === 1}
                        >
                          <MaterialIcon icon="chevron_left" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setGradePage((p) => Math.min(gradeTotalPages, p + 1))}
                          disabled={gradePage >= gradeTotalPages}
                        >
                          <MaterialIcon icon="chevron_right" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {/* Mobile: grade cards (<md) — same students + handlers as the desktop table above */}
                <div className="md:hidden space-y-3">
                  {studentsLoading ? (
                    <Card>
                      <CardBody>
                        <TableSkeleton rows={5} />
                      </CardBody>
                    </Card>
                  ) : displayStudents.length === 0 ? (
                    <Card>
                      <CardBody>
                        <NoData
                          title={
                            statusFilter !== "all"
                              ? `No ${statusFilter} students in this class`
                              : "No students in this class"
                          }
                        />
                      </CardBody>
                    </Card>
                  ) : (
                    paginatedStudents.map((student) => {
                      const total = getStudentTotal(student.id);
                      const gradeInfo = total !== null ? getGrade(total) : null;
                      const graded = isStudentGraded(student.id);
                      return (
                        <Card key={student.id}>
                          <CardBody className="space-y-4">
                            <div className="flex items-center gap-3">
                              <PersonInitials name={`${student.first_name} ${student.last_name}`} size={40} />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-primary truncate">
                                  {student.first_name} {student.last_name}
                                </p>
                                <p className="text-xs text-[var(--t3)]">{student.student_number || "-"}</p>
                                <GradeStatusBadge status={studentStatusMap[student.id]} />
                              </div>
                              {graded && <MaterialIcon icon="check_circle" className="text-green-500 text-lg" />}
                            </div>
                            {competencyMode ? (
                              <div className="space-y-2">
                                <label
                                  htmlFor={`grade-card-${student.id}-competency`}
                                  className="block text-xs font-semibold text-[var(--t3)] uppercase tracking-wider"
                                >
                                  Competency Level
                                </label>
                                <div className="relative">
                                  <select
                                    id={`grade-card-${student.id}-competency`}
                                    className="w-full min-h-[44px] text-center text-base font-bold py-2 px-1 rounded-lg border-none focus:outline-none transition-all bg-surface-container-low text-[var(--on-surface)]"
                                    value={marks[`${student.id}_competency`] ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleMarkChange(student.id, "competency", val ? val : "");
                                    }}
                                    onBlur={() => handleInlineBlur(student.id, "competency")}
                                    disabled={isSubmitted}
                                  >
                                    <option value="">—</option>
                                    {COMPETENCY_SCHEME.values?.map((cv) => (
                                      <option key={cv.value} value={cv.value}>
                                        {cv.value} - {cv.label}
                                      </option>
                                    ))}
                                  </select>
                                  {getSaveStatusForInput(student.id, "competency") === "saved" && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3">
                                {activeAssessmentTypes.map((type) => (
                                  <div key={type} className="space-y-1">
                                    <label
                                      htmlFor={`grade-card-${student.id}-${type}`}
                                      className="block text-xs font-semibold text-[var(--t3)] uppercase tracking-wider"
                                    >
                                      {assessmentLabels[type] ?? type.toUpperCase()} ({ASSESSMENT_MAX[type] ?? 100})
                                    </label>
                                    <div className="relative">
                                      <input
                                        id={`grade-card-${student.id}-${type}`}
                                        className={`w-full min-h-[44px] block text-center text-base font-bold py-2 px-1 rounded-lg border-none focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-surface-container-low text-[var(--on-surface)] ${getInputBorderClass(student.id, type)}`}
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        max={ASSESSMENT_MAX[type]}
                                        placeholder="—"
                                        value={
                                          marks[`${student.id}_${type}`] !== null &&
                                          marks[`${student.id}_${type}`] !== undefined
                                            ? String(marks[`${student.id}_${type}`])
                                            : ""
                                        }
                                        onChange={(e) => handleMarkChange(student.id, type, e.target.value)}
                                        onBlur={() => handleInlineBlur(student.id, type)}
                                        disabled={
                                          isSubmitted ||
                                          (caLocked && type.startsWith("ca")) ||
                                          (termLocked && ["exam", "bot", "mid_term", "eot"].includes(type))
                                        }
                                      />
                                      {getSaveStatusForInput(student.id, type) === "saved" && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                              <span className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
                                Average /100{" "}
                                <span className="text-base font-black text-[var(--on-surface)]">
                                  {total !== null ? total : "—"}
                                </span>
                              </span>
                              <span
                                className={`px-4 py-1.5 min-h-[44px] inline-flex items-center rounded-full text-xs font-black ${gradeInfo ? "bg-surface-container" : "bg-surface-bright text-[var(--t3)]"} ${gradeInfo?.color || ""}`}
                              >
                                {gradeInfo ? gradeInfo.grade : "-"}
                              </span>
                            </div>
                          </CardBody>
                        </Card>
                      );
                    })
                  )}
                  {displayStudents.length > gradesPerPage && (
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-sm text-[var(--t3)]">
                        Page {gradePage} of {gradeTotalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] min-w-[44px]"
                          onClick={() => setGradePage((p) => Math.max(1, p - 1))}
                          disabled={gradePage === 1}
                          aria-label="Previous grades page"
                        >
                          <MaterialIcon icon="chevron_left" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] min-w-[44px]"
                          onClick={() => setGradePage((p) => Math.min(gradeTotalPages, p + 1))}
                          disabled={gradePage >= gradeTotalPages}
                          aria-label="Next grades page"
                        >
                          <MaterialIcon icon="chevron_right" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Mobile: Card View with Swipe */}
            {!inlineEntryMode && filteredStudents.length > 0 && (
              <div className="md:hidden">
                {/* Where am I? A deck of forty-eight shows one pupil, so without
                    a position and a way back it is easy to believe you have
                    finished when you have seen four. */}
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <span className="text-sm font-bold text-[var(--t1)]">
                    Pupil {mobileStudentIndex + 1} of {filteredStudents.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInlineEntryMode(true)}
                    className="min-h-11 rounded-xl bg-[var(--surface-container)] px-3 text-sm font-semibold text-[var(--t2)]"
                  >
                    See all
                  </button>
                </div>
                <div
                  ref={mobileCardRef}
                  onTouchStart={handleMobileTouchStart}
                  onTouchEnd={handleMobileTouchEnd}
                  className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 space-y-6"
                >
                  {/* Student Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PersonInitials
                        name={`${filteredStudents[mobileStudentIndex]?.first_name || ""} ${filteredStudents[mobileStudentIndex]?.last_name || ""}`}
                        size={48}
                      />
                      <div>
                        <p className="font-bold text-primary text-lg">
                          {filteredStudents[mobileStudentIndex]?.first_name}{" "}
                          {filteredStudents[mobileStudentIndex]?.last_name}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {filteredStudents[mobileStudentIndex]?.student_number || "-"}
                        </p>
                        {(() => {
                          const sid = filteredStudents[mobileStudentIndex]?.id;
                          if (!sid) return null;
                          return <GradeStatusBadge status={studentStatusMap[sid]} />;
                        })()}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-on-surface-variant">
                      {mobileStudentIndex + 1} / {filteredStudents.length}
                    </span>
                  </div>

                  {/* Score Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    {(() => {
                      const studentId = filteredStudents[mobileStudentIndex]?.id;
                      if (!studentId) return null;
                      if (competencyMode) {
                        const val = getMark(studentId, "competency");
                        return (
                          <div className="col-span-2 space-y-2">
                            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                              COMPETENCY LEVEL
                            </label>
                            <select
                              className="w-full text-center text-2xl font-bold py-4 rounded-xl border-none focus:outline-none transition-all bg-surface-container-low"
                              value={val ?? ""}
                              onChange={(e) => handleMarkChange(studentId, "competency", e.target.value)}
                              disabled={isSubmitted}
                            >
                              <option value="">—</option>
                              {COMPETENCY_SCHEME.values?.map((cv) => (
                                <option key={cv.value} value={cv.value}>
                                  {cv.value} - {cv.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }
                      return activeAssessmentTypes.map((type) => {
                        const val = getMark(studentId, type);
                        return (
                          <div key={type} className="space-y-2">
                            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                              {assessmentLabels[type] ?? type.toUpperCase()} ({ASSESSMENT_MAX[type] ?? 100})
                            </label>
                            <input
                              className={`w-full text-center text-2xl font-bold py-4 rounded-xl border-none focus:outline-none transition-all ${getInputBorderClass(studentId, type)}`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={ASSESSMENT_MAX[type]}
                              placeholder="—"
                              value={val !== null ? String(val) : ""}
                              onChange={(e) => handleMarkChange(studentId, type, e.target.value)}
                              onBlur={() => handleInlineBlur(studentId, type)}
                              disabled={
                                isSubmitted ||
                                (caLocked && type.startsWith("ca")) ||
                                (termLocked && ["exam", "bot", "mid_term", "eot"].includes(type))
                              }
                            />
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Total & Grade */}
                  {(() => {
                    const studentId = filteredStudents[mobileStudentIndex]?.id;
                    if (!studentId) return null;
                    const total = getStudentTotal(studentId);
                    const gradeInfo = total !== null ? getGrade(total) : null;
                    return (
                      <div className="flex items-center justify-center gap-6 py-4 bg-surface-container rounded-2xl">
                        <div className="text-center">
                          <p className="text-xs text-on-surface-variant uppercase tracking-wider">Total</p>
                          <p className="text-3xl font-black text-primary">{total !== null ? total : "—"}</p>
                        </div>
                        <div className="w-px h-12 bg-outline-variant/20" />
                        <div className="text-center">
                          <p className="text-xs text-on-surface-variant uppercase tracking-wider">Grade</p>
                          <p className={`text-3xl font-black ${gradeInfo?.color || "text-on-surface-variant"}`}>
                            {gradeInfo ? gradeInfo.grade : "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Navigation */}
                  <div className="flex items-center justify-between gap-4">
                    <Button
                      variant="secondary"
                      onClick={() => navigateMobileStudent("prev")}
                      disabled={mobileStudentIndex === 0}
                      className="flex-1"
                      icon={<MaterialIcon icon="chevron_left" className="text-xl" />}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => navigateMobileStudent("next")}
                      disabled={mobileStudentIndex === filteredStudents.length - 1}
                      className="flex-1"
                    >
                      Next
                      <MaterialIcon icon="chevron_right" className="text-xl" />
                    </Button>
                  </div>
                </div>

                {/* Student List Quick Nav */}
                <div className="mt-4 bg-surface-container-lowest rounded-2xl p-4">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
                    All Students
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {filteredStudents.map((student, idx) => {
                      const graded = isStudentGraded(student.id);
                      return (
                        <button
                          key={student.id}
                          onClick={() => setMobileStudentIndex(idx)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            idx === mobileStudentIndex
                              ? "bg-primary text-on-primary"
                              : graded
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-700"
                                : "bg-surface-container text-on-surface-variant"
                          }`}
                        >
                          <PersonInitials name={`${student.first_name} ${student.last_name}`} size={28} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Topic Coverage */}
        {tab === "coverage" && selectedSubject && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-container-low p-6 rounded-xl text-center">
                <div className="text-2xl font-bold text-secondary">{coverageStats.completed}</div>
                <div className="text-sm text-on-surface-variant">Completed</div>
              </div>
              <div className="bg-surface-container-low p-6 rounded-xl text-center">
                <div className="text-2xl font-bold text-tertiary">{coverageStats.inProgress}</div>
                <div className="text-sm text-on-surface-variant">In Progress</div>
              </div>
              <div className="bg-surface-container-low p-6 rounded-xl text-center">
                <div className="text-2xl font-bold text-primary">{coverageStats.percentage}%</div>
                <div className="text-sm text-on-surface-variant">Coverage</div>
              </div>
            </div>

            {/* Topics */}
            <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
              <div className="p-6 border-b border-outline-variant/10">
                <h3 className="font-headline font-bold text-lg text-primary">Topic Coverage</h3>
              </div>
              <div className="divide-y divide-outline-variant/5">
                {topics.map((topic) => {
                  const status = getTopicStatus(topic);
                  return (
                    <div key={topic} className="flex items-center justify-between p-4 hover:bg-surface-bright">
                      <span className="font-medium text-primary">{topic}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateTopicStatus(topic, "not_started")}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${status === "not_started" ? "bg-surface-container text-on-surface-variant" : "bg-surface-bright text-on-surface-variant hover:bg-surface-container"}`}
                        >
                          Not Started
                        </button>
                        <button
                          onClick={() => updateTopicStatus(topic, "in_progress")}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${status === "in_progress" ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-surface-bright text-on-surface-variant hover:bg-surface-container"}`}
                        >
                          In Progress
                        </button>
                        <button
                          onClick={() => updateTopicStatus(topic, "completed")}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${status === "completed" ? "bg-secondary-container text-on-secondary-container" : "bg-surface-bright text-on-surface-variant hover:bg-surface-container"}`}
                        >
                          Completed
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {(!selectedClass || !selectedSubject) && (
          <EmptyState
            icon="edit_note"
            title="Select a class and subject"
            description="Choose a class and subject from the pickers above to start entering grades."
            owlyQuestion="How do I enter marks for a class?"
          />
        )}
        {/* Sticky Action Bar */}
        <div
          data-page-action-bar=""
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 flex w-[calc(100%-24px)] max-w-2xl items-center justify-between gap-2 bg-[var(--surface)] dark:bg-[var(--surface-container-lowest)] px-3 py-3 rounded-2xl shadow-2xl z-40 border border-[var(--border)]/50 sm:w-auto sm:gap-4 sm:px-6 sm:py-4 sm:rounded-full"
        >
          {/*
              "Sync Active" was a permanent green light that read the same whether
              or not anything had synced, and it was passing the icon as children
              instead of the `icon` prop, so it rendered the literal text
              "cloud_done". Removed: a status that cannot change is decoration.
            */}
          <button
            onClick={handleSaveDraft}
            disabled={isSubmitted || saving || !selectedClass || !selectedSubject}
            className="min-h-11 flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 py-2 hover:bg-[var(--surface-container)] rounded-full transition-colors font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MaterialIcon>save</MaterialIcon>
            Save Grades
          </button>
          <button
            onClick={handleSubmitToDean}
            disabled={isSubmitted || saving || !selectedClass || !selectedSubject}
            className="min-h-11 flex-1 sm:flex-none bg-primary text-white px-3 sm:px-8 py-2.5 rounded-full font-bold text-sm hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitted
              ? "Submitted ✓"
              : /* Not every school has a dean of studies, and plenty of them
                   call the role something else. The workflow knows where the
                   marks go; the button should just say what the teacher is
                   doing. */
                "Submit Grades"}
          </button>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          pendingAction?.();
        }}
        title="Confirm Action"
        message="Are you sure you want to proceed with this action?"
        variant="danger"
      />
      <GradeImportModal
        isOpen={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        classId={selectedClass}
        term={currentTerm}
        academicYear={academicYear}
        schoolId={school?.id}
        subjects={subjects}
        students={filteredStudents}
        userId={user?.id}
        isDemo={isDemo}
        toast={toast}
      />
      <ConfirmDialog
        isOpen={confirmLockCA}
        onClose={() => setConfirmLockCA(false)}
        onConfirm={executeLockCA}
        title="Lock CA Marks"
        message="Are you sure you want to lock CA marks? This will prevent further edits to CA1, CA2, and CA3 marks for this subject/class combination."
        confirmLabel="Lock CA Marks"
        variant="warning"
      />
    </PageErrorBoundary>
  );
}
