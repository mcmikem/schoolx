"use client";
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NoData } from "@/components/EmptyState";
import { ClassAverageRow } from "@/components/grades/ClassAverageRow";
import { GradeStatusBadge } from "@/components/grades/GradeStatusBadge";
import SubmittedSheetsPanel, { type SubmittedSheet } from "@/components/grades/SubmittedSheetsPanel";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { OwlyTrigger } from "@/components/owly/OwlyTrigger";
import { VideoLessonButton } from "@/components/onboarding/VideoLesson";
import { useToast } from "@/components/Toast";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import PersonInitials from "@/components/ui/PersonInitials";
import { FullPageLoader, TableSkeleton } from "@/components/ui/Skeleton";
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
  getGrade,
  getStudentTotal as computeStudentTotal,
  isStudentGraded as computeIsStudentGraded,
  ASSESSMENT_MAX_SCORES_KEY,
  parseAssessmentMaxScores,
  parseMarkKey,
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
  canUnlockGradeSheet,
} from "@/lib/operations";
import { isClassScopedRole } from "@/lib/roles";
import { canAccess, type UserRole } from "@/lib/roles";
import { TERM_GRADE_BASIS_KEY, parseTermGradeBasis } from "@/lib/report-rows";
import { gradeBasisAvg } from "@/lib/uganda-report";
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
  "holiday_package",
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
    .select("assessment_type, score, max_score")
    .eq("student_id", params.student_id)
    .eq("subject_id", params.subject_id)
    .eq("term", params.term)
    .eq("academic_year", params.academic_year);

  if (!allGrades || allGrades.length === 0) return;

  const scoreAsPercent = (type: string) => {
    const grade = allGrades.find((item: any) => item.assessment_type === type);
    if (!grade) return 0;
    const score = Number(grade.score) || 0;
    const maximum = Number(grade.max_score) > 0 ? Number(grade.max_score) : ASSESSMENT_MAX[type] || 100;
    return (score / maximum) * 100;
  };
  const ca1 = scoreAsPercent("ca1");
  const ca2 = scoreAsPercent("ca2");
  const ca3 = scoreAsPercent("ca3");
  const ca4 = scoreAsPercent("ca4");
  const project = scoreAsPercent("project");
  const exam_score = scoreAsPercent("exam");
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
  // Exporting takes the marks or register out of the app, so it follows the
  // same "export" permission the daily register already used.
  const canExport = canAccess((user?.role as UserRole) || "teacher", "export");
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
  const gradeBasis = useMemo(() => parseTermGradeBasis(schoolSettings[TERM_GRADE_BASIS_KEY]), [schoolSettings]);
  const assessmentMaximums = useMemo(
    () => parseAssessmentMaxScores(schoolSettings[ASSESSMENT_MAX_SCORES_KEY]),
    [schoolSettings],
  );
  const getAssessmentMaximum = (type: string) =>
    type === "competency" ? 3 : (assessmentMaximums[type] ?? ASSESSMENT_MAX[type] ?? 100);
  const additionalAssessmentTypes = useMemo(
    () => (track.startsWith("secondary") && gradeBasis?.types.includes("holiday_package") ? ["holiday_package"] : []),
    [track, gradeBasis],
  );
  // A school that does not run a beginning-of-term test gets no BOT column at
  // all. Showing an empty one invites a stray mark, and BOT is weighed into
  // MID, so one accidental entry shifts every average for that pupil.
  const useBotEnabled = resolveUseBot(schoolSettings);

  const columnLabels = useMemo(() => {
    const labels: Record<string, { label: string; explain: string }> = {
      bot: { label: "BOT", explain: `Beginning of Term · /${getAssessmentMaximum("bot")}` },
      mid_term: { label: "MOT", explain: `Mid Term · /${getAssessmentMaximum("mid_term")}` },
      eot: { label: "EOT", explain: `End of Term · /${getAssessmentMaximum("eot")}` },
      holiday_package: { label: "HPG", explain: `Holiday package · /${getAssessmentMaximum("holiday_package")}` },
    };
    for (const column of GRADING_TRACKS[track].columns) {
      for (const key of column.keys)
        labels[key] = {
          label: column.label === "MID" ? key.toUpperCase() : column.label,
          explain: column.explain,
        };
    }
    return labels;
  }, [track, assessmentMaximums]);
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
  const subjectOptions = !selectedClass
    ? []
    : teacherScoped
      ? subjects.filter((s) => teacherSubjects.some((ts) => ts.class_id === selectedClass && ts.subject_id === s.id))
      : subjects;

  // When switching classes, if the previously selected subject is not taught in
  // the new class, clear it so the teacher never grades an invalid class/subject pair.
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    if (!subjectOptions.some((s) => s.id === selectedSubject)) {
      setSelectedSubject("");
    }
  }, [selectedClass, selectedSubject, subjectOptions]);

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
  const [markMaxScores, setMarkMaxScores] = useState<Record<string, number>>({});
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
  const [entryAssessment, setEntryAssessment] = useState<string>("bot");
  const [showAllAssessmentColumns, setShowAllAssessmentColumns] = useState(false);

  useEffect(() => {
    // Use the focused pupil card on narrow phones and the full register on
    // laptops. Teachers can switch views at any time.
    setInlineEntryMode(!window.matchMedia("(max-width: 767px)").matches);
  }, []);
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const [mobileStudentIndex, setMobileStudentIndex] = useState(0);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  // Set-All popover: click-toggle (not hover-only) so it's touch/keyboard reachable.
  const [setAllOpen, setSetAllOpen] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirtyCellsRef = useRef<
    Map<string, { subjectId: string; classId: string; studentId: string; assessmentType: string }>
  >(new Map());
  const sheetMarksCacheRef = useRef<Record<string, StudentMarks>>({});
  const sheetMarkMaxCacheRef = useRef<Record<string, Record<string, number>>>({});
  const activeSheetKey =
    selectedClass && selectedSubject ? `${selectedClass}:${selectedSubject}:${currentTerm}:${academicYear}` : "";

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
    beforeMaxScores: Record<string, number>;
    describe: string;
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushUndo = (before: Record<string, number | null>, describe: string) => {
    setUndoMark({ before, beforeMaxScores: { ...markMaxScores }, describe });
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
    setMarks((prev) => {
      const next = { ...prev, ...undoMark.before };
      if (activeSheetKey) {
        sheetMarksCacheRef.current[activeSheetKey] = next;
        sheetMarkMaxCacheRef.current[activeSheetKey] = undoMark.beforeMaxScores;
      }
      return next;
    });
    setMarkMaxScores(undoMark.beforeMaxScores);
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

  // Scope existingGrades to the currently active class + subject + term + year.
  // Rows in unit tests that omit class_id/subject_id still pass through so
  // mocked status/workflow tests continue to work without boilerplate.
  const sheetGrades = useMemo(() => {
    if (!existingGrades?.length) return [];
    return existingGrades.filter((g: any) => {
      if (g.class_id && selectedClass && g.class_id !== selectedClass) return false;
      if (g.subject_id && selectedSubject && g.subject_id !== selectedSubject) return false;
      if (g.term != null && currentTerm != null && Number(g.term) !== Number(currentTerm)) return false;
      if (g.academic_year && academicYear && String(g.academic_year) !== String(academicYear)) return false;
      return true;
    });
  }, [existingGrades, selectedClass, selectedSubject, currentTerm, academicYear]);

  const studentStatusMap = useMemo(() => {
    const map: Record<string, GradeWorkflowStatus> = {};
    if (!sheetGrades.length) return map;
    const studentIds = [...new Set(sheetGrades.map((g: any) => g.student_id).filter(Boolean))];
    studentIds.forEach((sid: string) => {
      const studentGrades = sheetGrades.filter((g: any) => g.student_id === sid);
      map[sid] = deriveGradeWorkflowStatus(studentGrades as Array<{ status?: string | null }>);
    });
    return map;
  }, [sheetGrades]);

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
    (studentId: string): boolean =>
      computeIsStudentGraded(
        marks,
        studentId,
        competencyMode,
        useBotEnabled,
        competencyMode ? [] : additionalAssessmentTypes,
      ),
    [marks, competencyMode, useBotEnabled, additionalAssessmentTypes],
  );
  const gradedCount = useMemo(
    () => filteredStudents.filter((student) => isStudentGraded(student.id)).length,
    [filteredStudents, isStudentGraded],
  );
  const pendingCount = Math.max(filteredStudents.length - gradedCount, 0);

  useEffect(() => {
    setGradePage(1);
    setMobileStudentIndex(0);
    setSaveStatuses({});
    setUndoMark(null);
  }, [selectedClass, selectedSubject]);

  useEffect(() => {
    if (displayStudents.length > 0 && gradePage > Math.ceil(displayStudents.length / gradesPerPage)) {
      setGradePage(1);
    }
  }, [displayStudents.length, gradePage, gradesPerPage]);

  const paginatedStudents = displayStudents.slice(gradeOffset, gradeOffset + gradesPerPage);

  // Initialize marks from existing grades (offline-aware) and scope strictly
  // to the active class + subject + term + year so switching subjects never
  // carries the previous subject's marks into the new sheet.
  useEffect(() => {
    const hydrationSignature = `${activeSheetKey}:${existingGradesSignature}:${staffSignature}`;
    if (lastHydratedGradesSignature.current === hydrationSignature) return;
    lastHydratedGradesSignature.current = hydrationSignature;

    const cachedSheetMarks = activeSheetKey ? sheetMarksCacheRef.current[activeSheetKey] : undefined;
    const cachedSheetMaxScores = activeSheetKey ? sheetMarkMaxCacheRef.current[activeSheetKey] : undefined;

    if (sheetGrades.length > 0 || (cachedSheetMarks && Object.keys(cachedSheetMarks).length > 0)) {
      const marksMap: StudentMarks = {};
      const maxScoresMap: Record<string, number> = {};
      const newMarksBy: Record<string, { name: string; type: string }> = {};
      let isCaLocked = false;
      let lockedBy = "";

      const legacyExamMarks: Record<string, number | null> = {};
      const legacyExamMaxScores: Record<string, number> = {};
      sheetGrades.forEach((g: any) => {
        if (g.assessment_type === "exam") {
          legacyExamMarks[g.student_id] = g.score ?? null;
          if (Number.isFinite(Number(g.max_score)) && Number(g.max_score) > 0) {
            legacyExamMaxScores[`${g.student_id}_eot`] = Number(g.max_score);
          }
          if (g.recorded_by) {
            const staffMember = staff.find((s) => s.id === g.recorded_by);
            newMarksBy[g.recorded_by] = { name: staffMember?.full_name || "Unknown", type: "eot" };
          }
          return;
        }
        const markKey = `${g.student_id}_${g.assessment_type}`;
        marksMap[markKey] = g.score ?? null;
        if (Number.isFinite(Number(g.max_score)) && Number(g.max_score) > 0) {
          maxScoresMap[markKey] = Number(g.max_score);
        }
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
        if (maxScoresMap[eotKey] == null && legacyExamMaxScores[eotKey] != null) {
          maxScoresMap[eotKey] = legacyExamMaxScores[eotKey];
        }
      }

      const mergedMarks = cachedSheetMarks ? { ...marksMap, ...cachedSheetMarks } : marksMap;
      const mergedMaxScores = cachedSheetMaxScores ? { ...maxScoresMap, ...cachedSheetMaxScores } : maxScoresMap;
      if (activeSheetKey) {
        sheetMarksCacheRef.current[activeSheetKey] = mergedMarks;
        sheetMarkMaxCacheRef.current[activeSheetKey] = mergedMaxScores;
      }

      setMarks(mergedMarks);
      setMarkMaxScores(mergedMaxScores);
      setMarksBy(newMarksBy);
      setCaLocked(isCaLocked);

      if (lockedBy) {
        const lockedByStaff = staff.find((s) => s.id === lockedBy);
        setLockedByName(lockedByStaff?.full_name || "Unknown");
      } else {
        setLockedByName("");
      }

      setSubmissionStatus(
        sheetGrades.length > 0 ? deriveGradeWorkflowStatus(sheetGrades as Array<{ status?: string | null }>) : "draft",
      );
    } else {
      setMarks({});
      setMarkMaxScores({});
      setMarksBy({});
      setCaLocked(false);
      setLockedByName("");
      setSubmissionStatus("draft");
    }
  }, [activeSheetKey, sheetGrades, existingGradesSignature, staffSignature, toastSignature, staff]);

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
      setMarks((prev) => {
        const next = { ...prev, [`${studentId}_${type}`]: null };
        if (activeSheetKey) {
          sheetMarksCacheRef.current[activeSheetKey] = next;
        }
        return next;
      });
      setMarkMaxScores((prev) => {
        const next = { ...prev };
        delete next[`${studentId}_${type}`];
        if (activeSheetKey) sheetMarkMaxCacheRef.current[activeSheetKey] = next;
        return next;
      });
    } else {
      const maxVal = type === "competency" ? 3 : getAssessmentMaximum(type);
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
      setMarks((prev) => {
        const next = { ...prev, [`${studentId}_${type}`]: num };
        if (activeSheetKey) {
          sheetMarksCacheRef.current[activeSheetKey] = next;
        }
        return next;
      });
      setMarkMaxScores((prev) => {
        const next = { ...prev, [`${studentId}_${type}`]: getAssessmentMaximum(type) };
        if (activeSheetKey) sheetMarkMaxCacheRef.current[activeSheetKey] = next;
        return next;
      });
      dirtyCellsRef.current.set(`${activeSheetKey}:${studentId}_${type}`, {
        subjectId: selectedSubject,
        classId: selectedClass,
        studentId,
        assessmentType: type,
      });
    }
  };

  const getMark = (studentId: string, type: string): number | null => readMark(marks, studentId, type);

  // Columns shown on a fresh sheet. The list used to be derived from existing
  // marks, so a class/subject with nothing entered yet rendered a sheet with
  // no input boxes at all -- while the on-page guidance said "type the score in
  // the box under CA1". The guidance described a UI that did not exist on
  // first use, which is why teachers could not work out where to type.
  const activeAssessmentTypes = useMemo(
    () =>
      competencyMode
        ? [...assessmentTypesFor(true, useBotEnabled)]
        : [...assessmentTypesFor(false, useBotEnabled), ...additionalAssessmentTypes],
    [competencyMode, useBotEnabled, additionalAssessmentTypes],
  );
  const currentEntryAssessment = activeAssessmentTypes.includes(entryAssessment)
    ? entryAssessment
    : activeAssessmentTypes[0] || "mid_term";
  const visibleAssessmentTypes = showAllAssessmentColumns ? activeAssessmentTypes : [currentEntryAssessment];
  useEffect(() => {
    if (!activeAssessmentTypes.includes(entryAssessment) && activeAssessmentTypes[0]) {
      setEntryAssessment(activeAssessmentTypes[0]);
    }
  }, [activeAssessmentTypes, entryAssessment]);
  const entryAssessmentLabel = columnLabels[currentEntryAssessment]?.label || assessmentLabel(currentEntryAssessment);
  const entryAssessmentCount = useMemo(
    () =>
      displayStudents.reduce(
        (count, student) => count + (getMark(student.id, currentEntryAssessment) !== null ? 1 : 0),
        0,
      ),
    [displayStudents, currentEntryAssessment, marks],
  );

  // Live per-subject pupil counts for the selected class so subject tabs
  // reflect saved marks and in-session edits immediately. Count distinct
  // pupils, not `student_grades` rows, which can contain aggregate rows that
  // don't correspond to a pupil's current mark-entry sheet.
  const liveSubjectProgress = useMemo(() => {
    const result: Record<string, number> = {};
    if (!selectedClass) return result;
    const validStudentIds = new Set(filteredStudents.map((s) => s.id));
    for (const sub of subjectOptions) {
      const gradedStudentIds = new Set<string>();
      for (const g of (existingGrades ?? []) as Array<Record<string, any>>) {
        if (g.class_id && g.class_id !== selectedClass) continue;
        if (g.subject_id !== sub.id) continue;
        if (g.term != null && Number(g.term) !== Number(currentTerm)) continue;
        if (g.academic_year && String(g.academic_year) !== String(academicYear)) continue;
        if (g.score !== null && g.score !== undefined && (!validStudentIds.size || validStudentIds.has(g.student_id))) {
          gradedStudentIds.add(g.student_id);
        }
      }
      const sKey = `${selectedClass}:${sub.id}:${currentTerm}:${academicYear}`;
      const localMap = sub.id === selectedSubject ? marks : sheetMarksCacheRef.current[sKey];
      if (localMap) {
        for (const [k, v] of Object.entries(localMap)) {
          if (v === null || v === undefined) continue;
          const parsed = parseMarkKey(k);
          if (parsed && (!validStudentIds.size || validStudentIds.has(parsed.studentId))) {
            gradedStudentIds.add(parsed.studentId);
          }
        }
      }
      result[sub.id] = Math.max(result[sub.id] ?? 0, gradedStudentIds.size);
    }
    return result;
  }, [
    selectedClass,
    selectedSubject,
    filteredStudents,
    subjectOptions,
    existingGrades,
    currentTerm,
    academicYear,
    marks,
  ]);
  const getStudentTotal = (studentId: string): number | null => {
    if (competencyMode) return computeStudentTotal(marks, studentId, true);
    if (gradeBasis) {
      const rows = Object.entries(marks).flatMap(([key, score]) => {
        const parsed = parseMarkKey(key);
        if (!parsed || parsed.studentId !== studentId || score === null || score === undefined) return [];
        return [
          {
            assessment_type: parsed.assessmentType,
            score,
            max_score: markMaxScores[key] ?? getAssessmentMaximum(parsed.assessmentType),
          },
        ];
      });
      return gradeBasisAvg(rows, gradeBasis);
    }
    const scores = activeAssessmentTypes.flatMap((type) => {
      const key = `${studentId}_${type}`;
      const score = getMark(studentId, type);
      return score === null ? [] : [(score / (markMaxScores[key] ?? getAssessmentMaximum(type))) * 100];
    });
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  };

  // Identity + one column per assessment + average/status + grade. The empty and
  // loading rows were pinned at 7, which over-spans a two-column sheet.
  const markSheetColumnCount = competencyMode ? 4 : visibleAssessmentTypes.length + 3;

  const debouncedAutoSave = useCallback(
    (studentId: string, type: string, target?: { subjectId: string; classId: string }) => {
      const key = `${studentId}_${type}`;
      // A flush can fire after the teacher has switched class/subject. Writing
      // then would file the old sheet's mark under the new subject, so pin the
      // destination at the moment the cell went dirty.
      const subjectId = target?.subjectId ?? selectedSubject;
      const classId = target?.classId ?? selectedClass;
      const sheetKey = `${classId}:${subjectId}:${currentTerm}:${academicYear}`;
      const statusKey = `${sheetKey}:${key}`;
      if (debounceTimers.current[statusKey]) {
        clearTimeout(debounceTimers.current[statusKey]);
      }
      setSaveStatuses((prev) => ({ ...prev, [statusKey]: "dirty" }));
      debounceTimers.current[statusKey] = setTimeout(async () => {
        dirtyCellsRef.current.delete(`${sheetKey}:${key}`);
        const score = sheetMarksCacheRef.current[sheetKey]?.[key] ?? marks[key];
        if (score === null || score === undefined) {
          setSaveStatuses((prev) => ({ ...prev, [statusKey]: "idle" }));
          return;
        }
        const isAssigned = teacherSubjects.some((ts) => ts.subject_id === subjectId && ts.class_id === classId);
        if (!isAssigned && user?.role === "teacher") {
          toast.error("You are not assigned to teach this subject in this class.");
          setSaveStatuses((prev) => ({ ...prev, [statusKey]: "idle" }));
          return;
        }
        if (termLocked && ["exam", "bot", "mid_term", "eot"].includes(type)) {
          toast.error("This term is locked. Assessment marks can no longer be changed.");
          setSaveStatuses((prev) => ({ ...prev, [statusKey]: "idle" }));
          return;
        }

        setSaveStatuses((prev) => ({ ...prev, [statusKey]: "saving" }));
        try {
          const maxScore =
            sheetMarkMaxCacheRef.current[sheetKey]?.[key] ?? markMaxScores[key] ?? getAssessmentMaximum(type);
          await saveGrade({
            student_id: studentId,
            subject_id: subjectId,
            class_id: classId,
            assessment_type: type,
            score,
            max_score: maxScore,
            term: currentTerm,
            academic_year: academicYear,
            recorded_by: user?.id,
            status: "draft",
            isDemo,
            schoolId: school?.id,
          });
          setSaveStatuses((prev) => ({ ...prev, [statusKey]: "saved" }));
          setTimeout(() => {
            setSaveStatuses((prev) => {
              const next = { ...prev };
              if (next[statusKey] === "saved") next[statusKey] = "idle";
              return next;
            });
          }, 2000);
        } catch (err) {
          logger.warn("Failed to auto-save grade:", err);
          setSaveStatuses((prev) => ({ ...prev, [statusKey]: "idle" }));
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
      assessmentMaximums,
      markMaxScores,
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
      toSave.forEach(([, target]) => {
        debouncedAutoSave(target.studentId, target.assessmentType, target);
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

  /**
   * Spreadsheet-style completion: Enter drops to the next pupil in the same
   * column, arrows walk the sheet, every hop lands with the current value
   * selected so a teacher typing 70s straight down simply keeps pressing keys.
   * Scope is the enclosing table (or card grid), so desktop grid and mobile
   * cards share one behaviour without fighting over page-level focus.
   */
  const handleGridNav = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const dir = e.key === "ArrowDown" || e.key === "Enter" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const scope = el.closest("[data-grade-scope]") ?? el.closest("table");
    if (!scope) {
      if (e.key === "Enter") el.blur();
      return;
    }
    const inputs = Array.from(scope.querySelectorAll<HTMLInputElement>("input[data-grade-cell]"));
    const current = inputs.indexOf(el);
    if (current === -1) {
      if (e.key === "Enter") el.blur();
      return;
    }
    const columns = Number(scope.getAttribute("data-grade-columns")) || 1;
    const next = inputs[current + dir * columns];
    if (next) {
      next.focus();
      next.select();
    } else if (e.key === "Enter") {
      el.blur();
    }
  }, []);

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
          next[`${s.id}_${type}`] = Math.min(getAssessmentMaximum(type), Math.max(0, value));
        });
        if (activeSheetKey) {
          sheetMarksCacheRef.current[activeSheetKey] = next;
        }
        return next;
      });
      setMarkMaxScores((prev) => {
        const next = { ...prev };
        filteredStudents.forEach((student) => {
          next[`${student.id}_${type}`] = getAssessmentMaximum(type);
        });
        if (activeSheetKey) sheetMarkMaxCacheRef.current[activeSheetKey] = next;
        return next;
      });
      toast.success(`All ${type.toUpperCase()} set to ${value}`);
    },
    [filteredStudents, caLocked, toast, marks, markMaxScores, activeSheetKey, assessmentMaximums],
  );

  const handleClearAll = useCallback(() => {
    setPendingAction(() => () => {
      pushUndo({ ...marks }, "All marks cleared");
      setMarks({});
      setMarkMaxScores({});
      if (activeSheetKey) {
        sheetMarksCacheRef.current[activeSheetKey] = {};
        sheetMarkMaxCacheRef.current[activeSheetKey] = {};
      }
      setSaveStatuses({});
      toast.success("All marks cleared");
    });
    setConfirmOpen(true);
  }, [toast, marks, markMaxScores, activeSheetKey]);

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
      const nextMaxScores: Record<string, number> = {};
      prevGrades.forEach((g: any) => {
        const key = `${g.student_id}_${g.assessment_type}`;
        if (Number.isFinite(Number(g.max_score)) && Number(g.max_score) > 0) {
          nextMaxScores[key] = Number(g.max_score);
        } else if (ASSESSMENT_MAX[g.assessment_type]) {
          nextMaxScores[key] = ASSESSMENT_MAX[g.assessment_type];
        }
      });
      setMarks((prev) => {
        const next = { ...prev };
        prevGrades.forEach((g: any) => {
          next[`${g.student_id}_${g.assessment_type}`] = g.score ?? null;
        });
        if (activeSheetKey) sheetMarksCacheRef.current[activeSheetKey] = next;
        return next;
      });
      setMarkMaxScores(nextMaxScores);
      if (activeSheetKey) sheetMarkMaxCacheRef.current[activeSheetKey] = nextMaxScores;
      toast.success(`Copied ${prevGrades.length} grades from Term ${prevTerm}`);
    } catch (err) {
      logger.warn("Failed to copy grades from previous term:", err);
      toast.error("Failed to copy grades from previous term");
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedSubject, user?.id, currentTerm, academicYear, toast, activeSheetKey]);

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
      return saveStatuses[`${activeSheetKey}:${studentId}_${type}`] || "idle";
    },
    [saveStatuses, activeSheetKey],
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
        const parsed = parseMarkKey(key);
        if (!parsed) continue;
        const { studentId, assessmentType } = parsed;
        const gradePayload: any = {
          student_id: studentId,
          subject_id: selectedSubject,
          class_id: selectedClass,
          assessment_type: assessmentType,
          score,
          max_score: markMaxScores[key] ?? (assessmentType === "competency" ? 3 : getAssessmentMaximum(assessmentType)),
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
        const studentIds = [
          ...new Set(
            Object.keys(marks)
              .map((k) => parseMarkKey(k)?.studentId)
              .filter((sid): sid is string => Boolean(sid)),
          ),
        ];
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

  // The banner says "Contact DOS to unlock" -- so only the roles that can
  // actually approve a sheet get the unlock button, or the page contradicts
  // itself.
  const canUnlockCA = canUnlockGradeSheet(user?.role);
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
      <div className="content min-w-0 pb-40">
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
              {canExport ? (
                <Button
                  variant="secondary"
                  onClick={handleExportGrades}
                  icon={<MaterialIcon icon="cloud_download" className="text-lg" />}
                >
                  Export
                </Button>
              ) : null}
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
        {submittedSheets.length > 0 && (
          <SubmittedSheetsPanel
            sheets={submittedSheets}
            loading={gradesLoading}
            heading={isReviewer ? "Submitted for review" : "Your grade sheets"}
            emptyHint="No grade sheets are waiting for review."
            nextAction={sheetNextAction}
            onOpen={(sheet) => {
              setShowTargetPicker(true);
              setSelectedClass(sheet.classId);
              setSelectedSubject(sheet.subjectId);
            }}
            onAdvance={(sheet, status) => void handleAdvanceWorkflow(status, sheet.classId, sheet.subjectId)}
          />
        )}
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
          <div className="border-y border-[var(--border)] py-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center lg:gap-6">
              <div>
                <label
                  htmlFor="grade-target-class"
                  className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--t3)]"
                >
                  Class
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
                    className="input !h-10 !py-0 text-sm font-semibold"
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
              <section aria-labelledby="subject-picker-heading" className="min-w-0">
                {!selectedClass ? (
                  <div>
                    <h2 id="subject-picker-heading" className="text-sm font-semibold text-[var(--t1)]">
                      What do you teach?
                    </h2>
                    <p className="mt-1 text-xs text-[var(--t3)]">Choose a class to see its subjects.</p>
                  </div>
                ) : subjectOptions.length === 0 ? (
                  <div>
                    <h2 id="subject-picker-heading" className="text-sm font-semibold text-[var(--t1)]">
                      What do you teach in {selectedClassName}?
                    </h2>
                    <p className="mt-1 text-xs text-[var(--t3)]">
                      No subjects are assigned to this class yet. Ask an administrator to update the teaching
                      assignments.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                      <h2
                        id="subject-picker-heading"
                        className="shrink-0 text-xs font-bold uppercase tracking-wider text-[var(--t3)]"
                      >
                        Subjects
                      </h2>
                      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto border-b border-[var(--border)] sm:border-0">
                        {subjectOptions.map((subject) => {
                          const done = liveSubjectProgress[subject.id] ?? 0;
                          const total = filteredStudents.length;
                          const active = subject.id === selectedSubject;
                          const complete = total > 0 && done >= total;
                          return (
                            <button
                              key={subject.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setSelectedSubject(subject.id)}
                              className={`relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm transition-colors ${
                                active
                                  ? "border-[var(--primary)] font-bold text-[var(--primary)]"
                                  : "border-transparent font-medium text-[var(--t2)] hover:text-[var(--t1)]"
                              }`}
                            >
                              <span>{subject.name}</span>
                              <span
                                className={`text-xs tabular-nums ${complete ? "text-[var(--green)]" : "text-[var(--t3)]"}`}
                              >
                                {done}/{total}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <span className="hidden shrink-0 text-xs text-[var(--t3)] xl:inline">
                        {subjectOptions.filter((s) => (liveSubjectProgress[s.id] ?? 0) > 0).length} started
                      </span>
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        )}
        {/* Sticky context. Once marks are on screen, a teacher scrolling a
            long register needs to be able to answer "which subject is this?"
            without scrolling back up. */}
        {selectedClass && selectedSubjectName && (
          <div className="sticky top-0 z-20 -mx-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-3 py-2 backdrop-blur-xs">
            <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-bold text-[var(--t1)]">{selectedClassName}</span>
              <span className="text-[var(--t3)]" aria-hidden="true">
                /
              </span>
              <span className="text-sm font-semibold text-[var(--t2)]">{selectedSubjectName}</span>
              <span className="text-xs text-[var(--t3)]">
                Term {currentTerm} &middot; {academicYear}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusTone}`}>
                {statusLabels[submissionStatus]}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowTargetPicker((prev) => (singleTarget ? !prev : true));
                  const el = document.getElementById("grade-target-class");
                  if (el && typeof el.scrollIntoView === "function") {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                className="ml-auto min-h-11 text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                Change class or subject
              </button>
            </div>
          </div>
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
        {/* Everything below only appears once a class + subject are chosen */}
        {selectedClass && selectedSubject && (
          <>
            {!competencyMode && (
              <section aria-label="Choose assessment" className="border-b border-[var(--border)] pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Assessment</h2>
                  <div className="flex items-center gap-3">
                    {!competencyMode && (
                      <button
                        type="button"
                        onClick={() => setShowAllAssessmentColumns((value) => !value)}
                        aria-pressed={showAllAssessmentColumns}
                        className="hidden min-h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--t2)] hover:border-[var(--primary)] hover:text-[var(--primary)] md:inline-flex md:items-center"
                      >
                        {showAllAssessmentColumns ? "Focus on selected assessment" : "Show all assessment columns"}
                      </button>
                    )}
                    <details className="group text-xs text-[var(--t3)]">
                      <summary className="cursor-pointer list-none font-semibold hover:text-[var(--t1)]">
                        How totals work
                      </summary>
                      <p className="mt-2 max-w-lg text-[var(--t2)]">
                        {gradeBasis
                          ? "The average follows the assessment recipe set by your school; configured weights are used, or included marks count equally."
                          : "BOT, MOT and EOT count equally. EOT is the end-of-term exam; there is no separate final exam mark."}
                      </p>
                    </details>
                  </div>
                </div>
                <div
                  role="group"
                  aria-label="Assessment period"
                  className="mt-1 flex min-w-0 overflow-x-auto border-b border-[var(--border)]"
                >
                  {activeAssessmentTypes.map((type) => {
                    const label = columnLabels[type]?.label || assessmentLabel(type);
                    const selected = currentEntryAssessment === type;
                    const typeEnteredCount = filteredStudents.reduce(
                      (count, st) => count + (getMark(st.id, type) !== null ? 1 : 0),
                      0,
                    );
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setEntryAssessment(type)}
                        className={`min-h-11 shrink-0 border-b-2 px-3 text-sm transition-colors flex items-center justify-between gap-2 ${
                          selected
                            ? "border-[var(--primary)] font-bold text-[var(--primary)]"
                            : "border-transparent font-medium text-[var(--t2)] hover:text-[var(--t1)]"
                        }`}
                      >
                        <span>
                          {label}
                          <span className="ml-1 text-xs font-medium text-[var(--t3)]">
                            /{getAssessmentMaximum(type)}
                          </span>
                        </span>
                        {filteredStudents.length > 0 && (
                          <span
                            className={`text-[11px] font-bold tabular-nums ${
                              typeEnteredCount >= filteredStudents.length && filteredStudents.length > 0
                                ? "text-[var(--green)]"
                                : typeEnteredCount > 0
                                  ? "text-[var(--amber)]"
                                  : "text-[var(--t3)]"
                            }`}
                          >
                            {typeEnteredCount}/{filteredStudents.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
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
            <section aria-label="grades progress" className="px-1 md:hidden">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-semibold text-[var(--t2)]">
                  <span className="text-[var(--green)] font-bold">
                    {competencyMode ? gradedCount : entryAssessmentCount}
                  </span>
                  {" of "}
                  <span className="text-[var(--t1)] font-bold">{displayStudents.length}</span>{" "}
                  {competencyMode ? "assessed" : `${entryAssessmentLabel} marks entered`}
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
                aria-valuenow={competencyMode ? gradedCount : entryAssessmentCount}
                aria-valuemin={0}
                aria-valuemax={displayStudents.length}
                aria-label={competencyMode ? "Pupils assessed" : `${entryAssessmentLabel} marks entered`}
              >
                <div
                  className="h-full rounded-full bg-[var(--green)] transition-all"
                  style={{
                    width: `${displayStudents.length ? Math.round(((competencyMode ? gradedCount : entryAssessmentCount) / displayStudents.length) * 100) : 0}%`,
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
                CA marks are locked for this subject/class.{" "}
                {canUnlockCA ? 'Use "Open for Edits" to reopen them.' : "Contact DOS to unlock."}
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
              canUnlockCA ? (
                <Button
                  variant="secondary"
                  onClick={handleUnlockCA}
                  disabled={saving}
                  icon={<MaterialIcon icon="lock_open" className="text-lg" />}
                >
                  Open for Edits ({lockedByName})
                </Button>
              ) : null
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
          <div className="flex flex-wrap items-end gap-3 border-y border-[var(--border)] py-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="grade-student-search" className="mb-1 block text-xs font-semibold text-[var(--t3)]">
                Find a pupil
              </label>
              <input
                id="grade-student-search"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setGradePage(1);
                }}
                placeholder="Name or student number"
                className="input !h-10 !py-0 text-sm"
              />
            </div>
            <div role="group" aria-label="Grade status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {(["all", "draft", "submitted", "approved"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={statusFilter === f}
                  onClick={() => {
                    setStatusFilter(f);
                    setGradePage(1);
                  }}
                  className={`min-h-10 border-b-2 px-1 text-xs font-semibold transition-colors ${
                    statusFilter === f
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
                  }`}
                >
                  {f === "all" ? "All" : f === "draft" ? "Draft" : f === "submitted" ? "Submitted" : "Approved"}
                </button>
              ))}
            </div>
            <span role="status" className="ml-auto pb-2 text-xs text-[var(--t3)]">
              {displayStudents.length} of {filteredStudents.length} pupils
            </span>
          </div>
        )}
        {selectedClass && selectedSubject && (
          <div role="group" aria-label="Grade workspace" className="flex gap-5 border-b border-[var(--border)]">
            {(
              [
                ["marks", "Marks"],
                ["coverage", "Topic coverage"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
                className={`min-h-11 border-b-2 px-1 text-sm transition-colors ${
                  tab === id
                    ? "border-[var(--primary)] font-bold text-[var(--primary)]"
                    : "border-transparent font-medium text-[var(--t3)] hover:text-[var(--t1)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {/* Inline Entry Controls */}
        {tab === "marks" && selectedClass && selectedSubject && filteredStudents.length > 0 && (
          <div className="space-y-3">
            {/* The out-of-100 rule is in the Owly guide; repeating it above the
                table on every visit was one banner too many. */}
            {/* View Mode Toggle & Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInlineEntryMode(true)}
                  title="Show every pupil in a list"
                  className={`min-h-10 border-b-2 px-2 text-sm font-semibold transition-all ${
                    inlineEntryMode
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
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
                  className={`min-h-10 border-b-2 px-2 text-sm font-semibold transition-all md:hidden ${
                    !inlineEntryMode
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
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
                  className={`min-h-10 px-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
                    competencyMode ? "text-[var(--amber-ink)]" : "text-[var(--t3)] hover:text-[var(--t1)]"
                  }`}
                >
                  <MaterialIcon icon="psychology" className="text-base" />
                  Competency
                </button>
                <button
                  className="min-h-10 px-2 text-sm font-medium text-[var(--t3)] transition-colors hover:text-[var(--t1)] flex items-center gap-1.5"
                  onClick={() => setBulkImportOpen(true)}
                >
                  <MaterialIcon icon="upload" className="text-base" />
                  Import
                </button>
                <div className="relative">
                  <button
                    className={`min-h-10 px-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
                      setAllOpen ? "text-[var(--primary)]" : "text-[var(--t3)] hover:text-[var(--t1)]"
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
                              max={getAssessmentMaximum(type)}
                              placeholder={`Max ${getAssessmentMaximum(type)}`}
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

            {/* Desktop uses a full-width register; phones get pupil-focused cards. */}
            {inlineEntryMode && (
              <>
                <div className="hidden overflow-hidden border-y border-[var(--border)] md:block">
                  <div className="overflow-x-auto table-responsive">
                    <table
                      className="w-full min-w-max border-collapse"
                      data-grade-scope
                      data-grade-columns={competencyMode ? 1 : visibleAssessmentTypes.length}
                    >
                      <thead>
                        <tr className="sticky top-0 bg-[var(--bg)] text-left">
                          <th className="sticky left-0 z-10 min-w-[220px] border-b border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-xs font-bold text-[var(--t2)]">
                            Pupil
                          </th>
                          {competencyMode ? (
                            <th className="border-b border-[var(--border)] px-3 py-3 text-center text-xs font-bold text-[var(--t2)]">
                              Competency Level
                            </th>
                          ) : (
                            <>
                              {visibleAssessmentTypes.map((type) => {
                                const labelInfo = columnLabels[type] || {
                                  label: assessmentLabel(type),
                                  explain: "",
                                };
                                const entered = filteredStudents.reduce(
                                  (count, student) => count + (getMark(student.id, type) !== null ? 1 : 0),
                                  0,
                                );
                                return (
                                  <th
                                    key={type}
                                    scope="col"
                                    className={`min-w-20 border-b border-[var(--border)] px-2 py-3 text-center align-bottom text-xs font-bold ${
                                      type === currentEntryAssessment ? "text-[var(--primary)]" : "text-[var(--t2)]"
                                    }`}
                                  >
                                    <span className="block">{labelInfo.label}</span>
                                    <span className="mt-0.5 block text-[11px] font-medium text-[var(--t3)]">
                                      {entered}/{filteredStudents.length} · /{getAssessmentMaximum(type)}
                                    </span>
                                  </th>
                                );
                              })}
                            </>
                          )}
                          <th className="min-w-20 border-b border-[var(--border)] px-3 py-3 text-center text-xs font-bold text-[var(--t2)]">
                            Average
                          </th>
                          <th className="min-w-16 border-b border-[var(--border)] px-3 py-3 text-right text-xs font-bold text-[var(--t2)]">
                            Grade
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {studentsLoading ? (
                          <tr>
                            <td colSpan={markSheetColumnCount} className="px-3 py-10 text-sm text-[var(--t3)]">
                              <TableSkeleton rows={5} />
                            </td>
                          </tr>
                        ) : displayStudents.length === 0 ? (
                          <tr>
                            <td colSpan={markSheetColumnCount} className="px-3 py-10 text-sm text-[var(--t3)]">
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
                            <td colSpan={markSheetColumnCount} className="px-3 py-8">
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
                                <td className="sticky left-0 z-[1] bg-[var(--surface)] px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[var(--t1)]">
                                      {student.first_name} {student.last_name}
                                    </p>
                                    <p className="text-[11px] text-[var(--t3)]">
                                      {student.student_number || "-"}
                                      {studentStatusMap[student.id] && studentStatusMap[student.id] !== "draft"
                                        ? ` · ${statusLabels[studentStatusMap[student.id]]}`
                                        : ""}
                                    </p>
                                  </div>
                                </td>
                                {competencyMode ? (
                                  <td className="px-2 py-1.5">
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
                                  visibleAssessmentTypes.map((type) => (
                                    <td key={type} className="px-2 py-1.5">
                                      <div className="relative mx-auto w-16">
                                        <input
                                          className={`h-9 w-16 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1 text-center font-mono text-sm tabular-nums text-[var(--t1)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${getInputBorderClass(student.id, type)}`}
                                          type="number"
                                          inputMode="numeric"
                                          min={0}
                                          max={getAssessmentMaximum(type)}
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
                                          onKeyDown={handleGridNav}
                                          data-grade-cell
                                        />
                                        {getSaveStatusForInput(student.id, type) === "saved" && (
                                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                                        )}
                                      </div>
                                    </td>
                                  ))
                                )}
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={`font-mono text-sm font-bold tabular-nums ${total !== null ? "text-[var(--t1)]" : "text-[var(--t3)]"}`}
                                  >
                                    {total !== null ? total : "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span
                                    className={`font-mono text-sm font-bold ${gradeInfo ? gradeInfo.color : "text-[var(--t3)]"}`}
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
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--surface-container-low)]">
                          <tr>
                            <ClassAverageRow
                              marks={marks}
                              studentIds={displayStudents.map((s) => s.id)}
                              assessmentTypes={visibleAssessmentTypes}
                              competencyMode={competencyMode}
                              getStudentTotal={getStudentTotal}
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
                {/* Mobile all-pupils view — same students and handlers as the desktop table above. */}
                <div className="md:hidden space-y-3" data-grade-scope data-grade-columns="1">
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
                                {[currentEntryAssessment].map((type) => (
                                  <div key={type} className="space-y-1">
                                    <label
                                      htmlFor={`grade-card-${student.id}-${type}`}
                                      className="block text-xs font-semibold text-[var(--t3)] uppercase tracking-wider"
                                    >
                                      {assessmentLabels[type] ?? type.toUpperCase()} ({getAssessmentMaximum(type)})
                                    </label>
                                    <div className="relative">
                                      <input
                                        id={`grade-card-${student.id}-${type}`}
                                        onKeyDown={handleGridNav}
                                        data-grade-cell
                                        className={`w-full min-h-[44px] block text-center text-base font-bold py-2 px-1 rounded-lg border-none focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-surface-container-low text-[var(--on-surface)] ${getInputBorderClass(student.id, type)}`}
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        max={getAssessmentMaximum(type)}
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
                      return [currentEntryAssessment].map((type) => {
                        const val = getMark(studentId, type);
                        return (
                          <div key={type} className="space-y-2">
                            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                              {assessmentLabels[type] ?? type.toUpperCase()} ({getAssessmentMaximum(type)})
                            </label>
                            <input
                              className={`w-full text-center text-2xl font-bold py-4 rounded-xl border-none focus:outline-none transition-all ${getInputBorderClass(studentId, type)}`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={getAssessmentMaximum(type)}
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

                <details className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                  <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--t1)]">
                    Jump to a pupil ({filteredStudents.length})
                  </summary>
                  <div className="max-h-56 overflow-y-auto border-t border-[var(--border)] p-2">
                    {filteredStudents.map((student, idx) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setMobileStudentIndex(idx)}
                        className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${
                          idx === mobileStudentIndex
                            ? "bg-[var(--navy-soft)] font-bold text-[var(--primary)]"
                            : "text-[var(--t2)] hover:bg-[var(--surface-container)]"
                        }`}
                      >
                        <span className="w-8 text-xs text-[var(--t3)]">{idx + 1}.</span>
                        <span className="min-w-0 flex-1 truncate">
                          {student.first_name} {student.last_name}
                        </span>
                        {getMark(student.id, currentEntryAssessment) !== null && (
                          <MaterialIcon icon="check_circle" size={16} className="text-[var(--green)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
        {/* Topic Coverage */}
        {tab === "coverage" && selectedSubject && (
          <div>
            <dl className="grid grid-cols-3 divide-x divide-[var(--border)] border-y border-[var(--border)] py-3">
              <div className="px-3 first:pl-0">
                <dt className="text-xs text-[var(--t3)]">Completed</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-[var(--t1)]">{coverageStats.completed}</dd>
              </div>
              <div className="px-3">
                <dt className="text-xs text-[var(--t3)]">In progress</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-[var(--t1)]">{coverageStats.inProgress}</dd>
              </div>
              <div className="px-3 last:pr-0">
                <dt className="text-xs text-[var(--t3)]">Coverage</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-[var(--t1)]">{coverageStats.percentage}%</dd>
              </div>
            </dl>

            {/* Topics */}
            <div className="mt-4">
              <div className="flex items-baseline justify-between border-b border-[var(--border)] py-2">
                <h3 className="text-sm font-bold text-[var(--t1)]">Topic coverage</h3>
                <span className="text-xs text-[var(--t3)]">{topics.length} syllabus topics</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {topics.map((topic) => {
                  const status = getTopicStatus(topic);
                  return (
                    <div key={topic} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="text-sm font-medium text-[var(--t1)]">{topic}</span>
                      <div role="group" aria-label={`${topic} status`} className="flex items-center gap-1">
                        <button
                          onClick={() => updateTopicStatus(topic, "not_started")}
                          aria-pressed={status === "not_started"}
                          className={`min-h-9 px-2 text-xs font-medium ${status === "not_started" ? "text-[var(--primary)]" : "text-[var(--t3)] hover:text-[var(--t1)]"}`}
                        >
                          Not Started
                        </button>
                        <button
                          onClick={() => updateTopicStatus(topic, "in_progress")}
                          aria-pressed={status === "in_progress"}
                          className={`min-h-9 px-2 text-xs font-medium ${status === "in_progress" ? "text-[var(--primary)]" : "text-[var(--t3)] hover:text-[var(--t1)]"}`}
                        >
                          In Progress
                        </button>
                        <button
                          onClick={() => updateTopicStatus(topic, "completed")}
                          aria-pressed={status === "completed"}
                          className={`min-h-9 px-2 text-xs font-medium ${status === "completed" ? "text-[var(--green)]" : "text-[var(--t3)] hover:text-[var(--t1)]"}`}
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
          <p className="border-b border-[var(--border)] py-6 text-center text-sm text-[var(--t3)]">
            Select a class and subject to open the marks register.
          </p>
        )}
        {/* Sticky Action Bar */}
        <div
          data-page-action-bar=""
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] left-1/2 z-40 flex w-[calc(100%-24px)] max-w-2xl -translate-x-1/2 items-center justify-between gap-2 rounded-2xl border border-[var(--border)]/50 bg-[var(--surface)] px-3 py-3 shadow-2xl sm:w-auto sm:gap-4 sm:px-6 sm:py-4 sm:rounded-full md:bottom-0 md:left-0 md:w-full md:max-w-none md:translate-x-0 md:justify-end md:rounded-none md:border-x-0 md:border-b-0 md:border-t md:bg-[var(--bg)]/95 md:px-6 md:py-2 md:shadow-none"
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
            Save draft
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
                "Submit to HM"}
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
        assessmentMaximums={assessmentMaximums}
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
