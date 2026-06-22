"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useClasses,
  useSubjects,
  useStaff,
} from "@/lib/hooks";
import { useOfflineStudents, useOfflineGrades } from "@/lib/offline-hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { calculateSubjectTotal, isCompetencyScale, COMPETENCY_SCHEME, CompetencyValue, getCompetencyLabel } from "@/lib/grading";
import MaterialIcon from "@/components/MaterialIcon";
import { logger } from "@/lib/logger";

import { PageHeader, PageSection } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button, Input, Select, Badge } from "@/components/ui/index";
import { TableSkeleton, FullPageLoader } from "@/components/ui/Skeleton";
import { EmptyState, NoData } from "@/components/EmptyState";
import PersonInitials from "@/components/ui/PersonInitials";
import { logAuditEventWithOfflineSupport } from "@/lib/audit";
import { useOnlineStatus, offlineDB } from "@/lib/offline";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GradeImportModal } from "@/components/grades/GradeImportModal";
import {
  createRecord,
  updateRecord,
  upsertRecordReturning,
} from "@/lib/crud-service";
import {
  deriveGradeWorkflowStatus,
  getNextGradeWorkflowStatusActions,
  GradeWorkflowStatus,
} from "@/lib/operations";

interface TopicCoverage {
  id: string;
  syllabus_id?: string;
  class_id: string;
  topic_name: string;
  status: "not_started" | "in_progress" | "completed";
  teacher_id?: string;
}

const DEFAULT_TOPICS = [
  "Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5",
];

const ASSESSMENT_TYPES = ["ca1", "ca2", "ca3", "ca4", "project", "exam"] as const;
const COMPETENCY_ASSESSMENT_TYPES = ["competency"] as const;
const ASSESSMENT_MAX: Record<string, number> = {
  ca1: 10,
  ca2: 10,
  ca3: 10,
  ca4: 10,
  project: 20,
  exam: 50,
};

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
  const payload = { ...grade, max_score: maxScore };

  if (grade.isDemo) {
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

  // Sync student_grades for this student+subject+term
  await syncStudentGrades({
    student_id: grade.student_id,
    subject_id: grade.subject_id,
    class_id: grade.class_id,
    term: grade.term,
    academic_year: grade.academic_year,
    schoolId: grade.schoolId,
  });

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
    await supabase.from("student_grades").update(studentGradePayload).eq("id", existing.id);
  } else {
    await supabase.from("student_grades").insert(studentGradePayload);
  }
}

function getGrade(score: number) {
  if (score >= 80) return { grade: "D1", color: "text-secondary" };
  if (score >= 70) return { grade: "D2", color: "text-secondary" };
  if (score >= 65) return { grade: "C3", color: "text-primary" };
  if (score >= 60) return { grade: "C4", color: "text-primary" };
  if (score >= 55) return { grade: "C5", color: "text-tertiary" };
  if (score >= 50) return { grade: "C6", color: "text-tertiary" };
  if (score >= 45) return { grade: "P7", color: "text-yellow-600" };
  if (score >= 40) return { grade: "P8", color: "text-yellow-500" };
  return { grade: "F9", color: "text-error" };
}

type StudentMarks = Record<string, number | null>;

type SaveStatus = "idle" | "dirty" | "saving" | "saved";

export default function GradesPage() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { staff } = useStaff(school?.id);

  const [tab, setTab] = useState<"marks" | "coverage">("marks");
  const tabLabels = { marks: "Enter Marks", coverage: "What we Taught" };
  
  const [teacherSubjects, setTeacherSubjects] = useState<{ subject_id: string; class_id: string }[]>([]);

  useEffect(() => {
    if (!user?.id || isDemo) return;
    const fetchTeacherSubjects = async () => {
      const result = await withTimeout(supabase
        .from("teacher_subjects")
        .select("subject_id, class_id")
        .eq("teacher_id", user.id), 10000, timeoutFallback());
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
  const [selectedSubject, setSelectedSubject] = useState("");
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
  const [marksBy, setMarksBy] = useState<
    Record<string, { name: string; type: string }>
  >({});
  const [submissionStatus, setSubmissionStatus] =
    useState<GradeWorkflowStatus>("draft");
  const statusLabels: Record<GradeWorkflowStatus, string> = {
    draft: "Still Writing",
    submitted: "Sent to Boss",
    approved: "Boss Approved",
    published: "Ready for Parents",
  };
  // Offline-aware students and grades
  const {
    data: classStudents,
    loading: studentsLoading,
    error: studentsError,
  } = useOfflineStudents(school?.id);

  const {
    data: existingGrades,
    loading: gradesLoading,
    error: gradesError,
  } = useOfflineGrades(school?.id);

  const [inlineEntryMode, setInlineEntryMode] = useState(true);
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>(
    {},
  );
  const [mobileStudentIndex, setMobileStudentIndex] = useState(0);
  const [quickFillModal, setQuickFillModal] = useState<{
    open: boolean;
    type: string;
    value: string;
  }>({ open: false, type: "", value: "" });
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const assessmentLabels: Record<string, string> = {
    ca1: "CA1",

    ca2: "CA2",
    ca3: "CA3",
    ca4: "CA4",
    project: "Project",
    exam: "Final Exam",
  };
  const touchStartX = useRef(0);
  const mobileCardRef = useRef<HTMLDivElement>(null);

  const [gradePage, setGradePage] = useState(1);
  const gradesPerPage = 20;
  const [statusFilter, setStatusFilter] = useState<"all" | GradeWorkflowStatus>("all");

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return classStudents.filter((s) => s.class_id === selectedClass);
  }, [classStudents, selectedClass]);

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
    if (statusFilter === "all") return filteredStudents;
    return filteredStudents.filter((s) => {
      const sStatus = studentStatusMap[s.id] || "draft";
      return sStatus === statusFilter;
    });
  }, [filteredStudents, statusFilter, studentStatusMap]);

  const gradeOffset = (gradePage - 1) * gradesPerPage;
  const gradeTotalPages = Math.max(
    1,
    Math.ceil(displayStudents.length / gradesPerPage),
  );
  const isStudentGraded = useCallback(
    (studentId: string): boolean => {
      const types = competencyMode ? COMPETENCY_ASSESSMENT_TYPES : ASSESSMENT_TYPES;
      return types.every(
        (t) =>
          marks[`${studentId}_${t}`] !== null &&
          marks[`${studentId}_${t}`] !== undefined,
      );
    },
    [marks, competencyMode],
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
    if (
      displayStudents.length > 0 &&
      gradePage > Math.ceil(displayStudents.length / gradesPerPage)
    ) {
      setGradePage(1);
    }
  }, [displayStudents.length, gradePage, gradesPerPage]);

  const paginatedStudents = displayStudents.slice(
    gradeOffset,
    gradeOffset + gradesPerPage,
  );

  // Initialize marks from existing grades (offline-aware)
  useEffect(() => {
    if ((existingGrades?.length || 0) > 0) {
      const marksMap: StudentMarks = {};
      const newMarksBy: Record<string, { name: string; type: string }> = {};
      let isCaLocked = false;
      let lockedBy = "";

      (existingGrades || []).forEach((g: any) => {
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
      
      // Check for zero variance (Scenario 7)
      const scores = Object.values(marksMap).filter((v) => v !== null) as number[];
      if (scores.length >= 5) {
        const first = scores[0];
        const allIdentical = scores.every((v) => v === first);
        if (allIdentical) {
          toast.warning("Alert: All entered grades in this class are identical (Zero variance). This might indicate a lack of actual assessment.");
        }
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
  }, [existingGrades, staff, toast]);

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
              .in("assessment_type", ["ca1", "ca2", "ca3", "ca4"])
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
    if (value === "") {
      setMarks((prev) => ({ ...prev, [`${studentId}_${type}`]: null }));
    } else {
      const maxVal = type === "competency" ? 3 : ASSESSMENT_MAX[type] || 100;
      const num = Math.min(
        maxVal,
        Math.max(0, Number(value)),
      );
      setMarks((prev) => ({ ...prev, [`${studentId}_${type}`]: num }));
    }
  };

  const getMark = (studentId: string, type: string): number | null => {
    return marks[`${studentId}_${type}`] ?? null;
  };

  const getStudentTotal = (studentId: string): number | null => {
    if (competencyMode) {
      const score = marks[`${studentId}_competency`];
      if (score === null || score === undefined) return null;
      return score;
    }
    const parts = ASSESSMENT_TYPES.map((t) => marks[`${studentId}_${t}`]);
    if (parts.some((p) => p === null || p === undefined)) return null;
    return parts.reduce((sum, p) => (sum ?? 0) + (p ?? 0), 0) ?? null;
  };

  const activeAssessmentTypes = useMemo(
    () => ASSESSMENT_TYPES.filter((type) =>
      filteredStudents.some((s) => marks[`${s.id}_${type}`] !== null && marks[`${s.id}_${type}`] !== undefined)
    ),
    [marks, filteredStudents],
  );

  const debouncedAutoSave = useCallback(
    (studentId: string, type: string) => {
      const key = `${studentId}_${type}`;
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }
      setSaveStatuses((prev) => ({ ...prev, [key]: "dirty" }));
      debounceTimers.current[key] = setTimeout(async () => {
        const score = marks[key];
        if (score === null || score === undefined) {
          setSaveStatuses((prev) => ({ ...prev, [key]: "idle" }));
          return;
        }
        const isAssigned = teacherSubjects.some(
          (ts) => ts.subject_id === selectedSubject && ts.class_id === selectedClass
        );
        if (!isAssigned && user?.role === "teacher") {
          toast.error("You are not assigned to teach this subject in this class.");
          setSaveStatuses((prev) => ({ ...prev, [key]: "idle" }));
          return;
        }

        setSaveStatuses((prev) => ({ ...prev, [key]: "saving" }));
        try {
          await saveGrade({
            student_id: studentId,
            subject_id: selectedSubject,
            class_id: selectedClass,
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
        } catch {
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
      setMarks((prev) => {
        const next = { ...prev };
        filteredStudents.forEach((s) => {
          next[`${s.id}_${type}`] = Math.min(
            ASSESSMENT_MAX[type] || 100,
            Math.max(0, value),
          );
        });
        return next;
      });
      toast.success(`All ${type.toUpperCase()} set to ${value}`);
    },
    [filteredStudents, caLocked, toast],
  );

  const handleClearAll = useCallback(() => {
    setPendingAction(() => () => {
      setMarks({});
      setSaveStatuses({});
      toast.success("All marks cleared");
    });
    setConfirmOpen(true);
  }, [toast]);

  const handleCopyFromPreviousTerm = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !user?.id) return;
    const prevTerm = currentTerm > 1 ? currentTerm - 1 : 3;
    const prevYear =
      currentTerm === 1 ? String(Number(academicYear) - 1) : academicYear;
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
    } catch {
      toast.error("Failed to copy grades from previous term");
    } finally {
      setLoading(false);
    }
  }, [
    selectedClass,
    selectedSubject,
    user?.id,
    currentTerm,
    academicYear,
    toast,
  ]);

  const handleMobileTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleMobileTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          setMobileStudentIndex((prev) =>
            Math.min(prev + 1, filteredStudents.length - 1),
          );
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
      if (status === "saving")
        return "ring-2 ring-blue-400 bg-blue-50/30 animate-pulse";
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
        if (assessmentType === 'competency') {
          gradePayload.competency_level = getCompetencyLabel(score as CompetencyValue);
        }
        await saveGrade(gradePayload);
      }
      // Bulk-sync student_grades for all students in this subject
      if (!competencyMode) {
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
      headers = [
        "Student Name",
        "Student Number",
        "CA1",
        "CA2",
        "CA3",
        "CA4",
        "Project",
        "Exam",
        "Total",
        "Grade",
      ];
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
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
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

  const handleAdvanceWorkflow = async (nextStatus: GradeWorkflowStatus) => {
    if (
      !selectedClass ||
      !selectedSubject ||
      !user?.id ||
      existingGrades.length === 0
    ) {
      toast.error("Save grades first before changing workflow status");
      return;
    }

    const actorLabel =
      nextStatus === "approved"
        ? "approve"
        : nextStatus === "published"
          ? "make ready for parents"
          : "send to boss";

    setGradeConfirm({
      open: true,
      message: `Are you sure you want to ${actorLabel} these grades?`,
      onConfirm: async () => {
        try {
          setSaving(true);
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          const response = await fetch("/api/grades/workflow/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token || ""}`,
            },
            body: JSON.stringify({
              class_id: selectedClass,
              subject_id: selectedSubject,
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
              `Changed grade workflow to ${nextStatus} for class ${selectedClass} subject ${selectedSubject}`,
              `${selectedClass}:${selectedSubject}:${currentTerm}:${academicYear}`,
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
            .select("id, syllabus_id, class_id, teacher_id, status, syllabus!inner(topic, subject_id, term, academic_year)")
            .eq("class_id", selectedClass)
            .eq("syllabus.subject_id", selectedSubject)
            .eq("syllabus.term", currentTerm)
            .eq("syllabus.academic_year", academicYear),
          15000, timeoutFallback()
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
          10000, timeoutFallback()
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
      setSyllabusTopicNames(
        (sylData || []).map((s: any) => s.topic).filter(Boolean)
      );
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

  const updateTopicStatus = async (
    topicName: string,
    status: "not_started" | "in_progress" | "completed",
  ) => {
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
                completed_date:
                  status === "completed"
                    ? new Date().toISOString().split("T")[0]
                    : null,
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
              completed_date:
                status === "completed"
                  ? new Date().toISOString().split("T")[0]
                  : null,
            }),
          { timeoutMs: 10000, timeoutMessage: "Coverage insert timed out" },
        );
      }
      fetchCoverage();
      toast.success("Topic status updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const getTopicStatus = useCallback(
    (topicName: string): string => {
      return (
        coverage.find((c) => c.topic_name === topicName)?.status ||
        "not_started"
      );
    },
    [coverage],
  );

  const selectedSubjectName =
    subjects.find((s) => s.id === selectedSubject)?.name || "";
  const selectedClassObj = classes.find((c) => c.id === selectedClass);
  const selectedClassName = selectedClassObj
    ? `${selectedClassObj.name}${selectedClassObj.stream ? ` ${selectedClassObj.stream}` : ""}`
    : "";
  const topics = useMemo(
    () => (syllabusTopicNames.length > 0 ? syllabusTopicNames : DEFAULT_TOPICS),
    [syllabusTopicNames],
  );

  const coverageStats = useMemo(() => {
    const total = topics.length;
    const completed = topics.filter(
      (t) => getTopicStatus(t) === "completed",
    ).length;
    const inProgress = topics.filter(
      (t) => getTopicStatus(t) === "in_progress",
    ).length;
    return {
      total,
      completed,
      inProgress,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [topics, getTopicStatus]);

  const isSubmitted = submissionStatus !== "draft";
  const isPublished = submissionStatus === "published";
  const nextWorkflowActions = getNextGradeWorkflowStatusActions(
    submissionStatus,
    user?.role,
  );
  const statusTone =
    submissionStatus === "published"
      ? "bg-[var(--green-soft)] text-[var(--green)]"
      : submissionStatus === "approved"
        ? "bg-[var(--navy-soft)] text-[var(--navy)]"
        : submissionStatus === "submitted"
          ? "bg-[var(--amber-soft)] text-[var(--amber)]"
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
            .in("assessment_type", ["ca1", "ca2", "ca3"])
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
      <div className="space-y-6">
        {/* Grade workflow confirm modal */}
        <Modal
          isOpen={gradeConfirm.open}
          onClose={() => setGradeConfirm((s) => ({ ...s, open: false }))}
          title="Confirm Action"
        >
          <p className="text-sm text-gray-700 mb-4">{gradeConfirm.message}</p>
          <ModalFooter>
            <Button
              variant="ghost"
              onClick={() => setGradeConfirm((s) => ({ ...s, open: false }))}
            >
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
            <div className="flex gap-3">
              {selectedClass &&
                selectedSubject &&
                (caLocked ? (
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
                ))}
              <Button
                variant="secondary"
                onClick={handleExportGrades}
                icon={
                  <MaterialIcon icon="cloud_download" className="text-lg" />
                }
              >
                Export
              </Button>
              <Button
                onClick={() => handleSaveGrades()}
                disabled={
                  saving || !selectedClass || !selectedSubject || isPublished
                }
                loading={saving}
                icon={
                  <MaterialIcon
                    icon="save"
                    className="text-lg"
                    style={{ fontVariationSettings: "FILL 1" }}
                  />
                }
              >
                Save Grades
              </Button>
            </div>
          }
        />

        {/* Step Guide */}
        <div className="flex items-center gap-2 sm:gap-4 px-1 mb-2">
          {[
            { step: 1, label: "Choose class", done: !!selectedClass },
            { step: 2, label: "Choose subject", done: !!selectedSubject && !!selectedSubjectName },
            { step: 3, label: "Enter marks", done: Object.keys(marks).length > 0 },
          ].map((s, i) => (
            <div key={s.step} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                s.done ? "bg-[#1f8a70] text-white" : "bg-[#e5ecf4] text-[#7f91aa]"
              }`}>
                {s.done ? <span className="material-symbols-outlined text-sm">check</span> : s.step}
              </div>
              <span className={`text-xs font-semibold ${s.done ? "text-[#1f8a70]" : "text-[#7f91aa]"}`}>
                {s.label}
              </span>
              {i < 2 && <span className="text-[#d7e3f2] hidden sm:inline">&rarr;</span>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Selected class",
              value: selectedClass
                ? `${
                    classes.find((c) => c.id === selectedClass)?.name ||
                    selectedClass
                  }${
                    classes.find((c) => c.id === selectedClass)?.stream
                      ? ` ${classes.find((c) => c.id === selectedClass)?.stream}`
                      : ""
                  }`
                : "None",
              tone: "text-blue-700 bg-blue-50",
            },
            { label: "Selected subject", value: selectedSubjectName || "None", tone: "text-emerald-700 bg-emerald-50" },
            { label: "Graded", value: gradedCount, tone: "text-slate-700 bg-slate-50" },
            { label: "Pending", value: pendingCount, tone: "text-amber-700 bg-amber-50" },
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl border border-slate-100 p-3 ${item.tone}`}>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{item.label}</div>
              <div className="mt-1 text-sm font-bold truncate">{item.value as any}</div>
            </div>
          ))}
        </div>

        {/* Marks Entry Info */}
        {selectedClass &&
          selectedSubject &&
          Object.keys(marksBy).length > 0 && (
            <div className="flex gap-4 flex-wrap">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${statusTone}`}
              >
                <MaterialIcon icon="task_alt" className="text-sm" />
                <span>Work Status: {statusLabels[submissionStatus]}</span>
              </div>
              {Object.values(marksBy).some((m) =>
                ["ca1", "ca2", "ca3"].includes(m.type),
              ) && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full text-xs font-medium">
                  <MaterialIcon icon="person" className="text-sm" />
                  <span>
                    CA entered by:{" "}
                    {marksBy[
                      Object.keys(marksBy).find((k) =>
                        marksBy[k].type.startsWith("ca"),
                      ) || ""
                    ]?.name || "Unknown"}
                  </span>
                </div>
              )}
              {Object.values(marksBy).some((m) => m.type === "exam") && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full text-xs font-medium">
                  <MaterialIcon icon="supervisor_account" className="text-sm" />
                  <span>
                    Exam entered by (Supervisor):{" "}
                    {marksBy[
                      Object.keys(marksBy).find(
                        (k) => marksBy[k].type === "exam",
                      ) || ""
                    ]?.name || "Unknown"}
                  </span>
                </div>
              )}
            </div>
          )}

        {caLocked && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--red-soft)] border border-[var(--red)]/20 rounded-xl text-sm font-medium text-[var(--red)]">
            <MaterialIcon icon="lock" className="text-lg" />
            CA marks are locked for this subject/class. Contact DOS to unlock.
          </div>
        )}

        {selectedClass && selectedSubject && nextWorkflowActions.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {nextWorkflowActions.map((status) => (
              <Button
                key={status}
                variant={status === "published" ? "primary" : "secondary"}
                onClick={() => handleAdvanceWorkflow(status)}
                disabled={saving}
              >
                {status === "submitted"
                  ? "Submit to Dean"
                  : status === "approved"
                    ? "Approve Grades"
                    : "Publish Grades"}
              </Button>
            ))}
          </div>
        )}

        {/* Configuration Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 md:col-span-2 bg-surface-container-low p-6 rounded-3xl space-y-4">
            <p className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">
              Class & Subject Configuration
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Target Class
                </label>
                {classesLoading ? (
                  <div className="bg-[var(--navy-soft)] border border-[rgba(0,31,63,0.12)] rounded-xl p-4">
                    <p className="text-[var(--t1)] text-sm font-medium">
                      Loading classes...
                    </p>
                    <p className="text-[var(--t3)] text-xs mt-1">
                      The class list is still being fetched for this school.
                    </p>
                  </div>
                ) : classes.length === 0 ? (
                  <div className="bg-[var(--amber-soft)] border border-[var(--amber)]/20 rounded-xl p-4">
                    <p className="text-[var(--t1)] text-sm font-medium">
                      No classes found
                    </p>
                    <p className="text-[var(--amber)] text-xs mt-1">
                      Contact support if this persists.
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-medium"
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.stream ? ` ${c.stream}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Subject Area
                </label>
                {subjects.length === 0 ? (
                  <div className="bg-[var(--amber-soft)] border border-[var(--amber)]/20 rounded-xl p-4">
                    <p className="text-[var(--t1)] text-sm font-medium">
                      No subjects found
                    </p>
                    <p className="text-[var(--amber)] text-xs mt-1">
                      Contact support if this persists.
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-medium"
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
          </div>
          <div className="bg-primary text-on-primary p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <MaterialIcon icon="functions" className="text-6xl" />
            </div>
            <p className="text-xs uppercase tracking-widest font-bold opacity-70">
              Weightage
            </p>
            <div>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-bold font-headline">
                  10+10+10+70
                </span>
                <span className="text-xs font-medium">CA1+CA2+CA3 : Exam</span>
              </div>
              <div className="w-full bg-white/20 h-1.5 rounded-full mt-3">
                <div className="bg-secondary-fixed w-[30%] h-full rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Completion Tracker */}
        {tab === "marks" &&
          selectedClass &&
          selectedSubject &&
          filteredStudents.length > 0 && (
            <div
              className={`p-5 rounded-2xl border ${
                completionStats.percentage === 100
                  ? "bg-[var(--green-soft)] border-[var(--green)]/20"
                  : completionStats.percentage >= 50
                    ? "bg-[var(--amber-soft)] border-[var(--amber)]/20"
                    : "bg-[var(--red-soft)] border-[var(--red)]/20"
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                      completionStats.percentage === 100
                        ? "bg-[var(--green)] text-white"
                        : completionStats.percentage >= 50
                          ? "bg-[var(--amber)] text-white"
                          : "bg-[var(--red)] text-white"
                    }`}
                  >
                    {completionStats.percentage}%
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {completionStats.graded}/{completionStats.total} students
                      graded
                    </p>
                    {isSubmitted && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        <MaterialIcon icon="lock" className="text-xs" />
                        Submitted
                      </span>
                    )}
                  </div>
                </div>
                {completionStats.notGraded > 0 && (
                  <p className="text-xs font-medium text-[var(--red)]">
                    <MaterialIcon
                      icon="warning"
                      className="text-xs align-text-bottom mr-1"
                    />
                    {completionStats.notGraded} student
                    {completionStats.notGraded > 1 ? "s" : ""} not graded:{" "}
                    {completionStats.notGradedNames.join(", ")}
                  </p>
                )}
              </div>
              <div className="w-full bg-[var(--surface)]/60 h-2 rounded-full mt-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    completionStats.percentage === 100
                      ? "bg-[var(--green)]"
                      : completionStats.percentage >= 50
                        ? "bg-[var(--amber)]"
                        : "bg-[var(--red)]"
                  }`}
                  style={{ width: `${completionStats.percentage}%` }}
                ></div>
              </div>
            </div>
          )}

        {/* Workflow Status Filter */}
        {selectedClass && selectedSubject && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mr-1">
              Filter:
            </span>
            {(["all", "draft", "submitted", "approved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setStatusFilter(f);
                  setGradePage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  statusFilter === f
                    ? f === "all"
                      ? "bg-primary text-on-primary"
                      : f === "draft"
                        ? "bg-[var(--amber-soft)] text-[var(--amber)] border border-[var(--amber)]/30"
                        : f === "submitted"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-[var(--green-soft)] text-[var(--green)] border border-[var(--green)]/30"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {f === "all"
                  ? "All"
                  : f === "draft"
                    ? "Draft"
                    : f === "submitted"
                      ? "Submitted"
                      : "Approved"}
              </button>
            ))}
            <span className="text-xs text-on-surface-variant ml-auto">
              {displayStudents.length} of {filteredStudents.length} students
            </span>
          </div>
        )}

        <Tabs
          tabs={[
            { id: "marks", label: "Marks Entry" },
            { id: "coverage", label: "Topic Coverage" },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as "marks" | "coverage")}
        />

        {/* Inline Entry Controls */}
        {tab === "marks" &&
          selectedClass &&
          selectedSubject &&
          filteredStudents.length > 0 && (
            <div className="space-y-4">
              {/* View Mode Toggle & Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInlineEntryMode(true)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      inlineEntryMode
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <MaterialIcon icon="grid_view" className="text-lg" />
                      Table View
                    </span>
                  </button>
                  <button
                    onClick={() => setInlineEntryMode(false)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all md:hidden ${
                      !inlineEntryMode
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <MaterialIcon icon="smartphone" className="text-lg" />
                      Mobile View
                    </span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCompetencyMode(!competencyMode)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                      competencyMode
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    <MaterialIcon icon="psychology" className="text-base" />
                    Competency
                  </button>
                  <div className="relative group">
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
                    <div className="absolute right-0 top-full mt-1 w-64 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/10 p-4 hidden group-hover:block z-30">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
                        Set All Students
                      </p>
                      {activeAssessmentTypes.map((type) => (
                        <div
                          key={type}
                          className="flex items-center gap-2 mb-2"
                        >
                          <span className="text-xs font-semibold text-on-surface-variant w-10">
                            {type === "ca1" ? "CA1" : type === "ca2" ? "CA2" : type === "ca3" ? "CA3" : type === "ca4" ? "CA4" : type === "project" ? "Proj" : type.toUpperCase()}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={ASSESSMENT_MAX[type]}
                            placeholder={`Max ${ASSESSMENT_MAX[type]}`}
                            className="flex-1 bg-surface-container border-none rounded-lg text-sm py-1.5 px-2 focus:ring-2 focus:ring-primary"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = parseInt(
                                  (e.target as HTMLInputElement).value,
                                );
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
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleClearAll}
                          className="flex-1 text-xs"
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-surface-container-low rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                        completionStats.percentage === 100
                          ? "bg-[var(--green)] text-white"
                          : completionStats.percentage >= 50
                            ? "bg-[var(--amber)] text-white"
                            : "bg-[var(--red)] text-white"
                      }`}
                    >
                      {completionStats.percentage}%
                    </div>
                    <div>
                      <p className="font-bold text-sm">
                        {completionStats.graded}/{completionStats.total}{" "}
                        students graded
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {completionStats.notGraded > 0
                          ? `${completionStats.notGraded} student${completionStats.notGraded > 1 ? "s" : ""} remaining`
                          : "All students graded!"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-on-surface-variant">
                      {
                        Object.keys(marks).filter((k) => marks[k] !== null)
                          .length
                      }{" "}
                      scores entered
                    </span>
                  </div>
                </div>
                <div className="w-full bg-[var(--surface)]/60 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completionStats.percentage === 100
                        ? "bg-[var(--green)]"
                        : completionStats.percentage >= 50
                          ? "bg-[var(--amber)]"
                          : "bg-[var(--red)]"
                    }`}
                    style={{ width: `${completionStats.percentage}%` }}
                  />
                </div>
              </div>

              {/* Desktop: Inline Table View */}
              {inlineEntryMode && (
                <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
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
                              {activeAssessmentTypes.map((type) => (
                                <th key={type} className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                                  {type === "ca1" ? "CA1" : type === "ca2" ? "CA2" : type === "ca3" ? "CA3" : type === "ca4" ? "CA4" : type === "project" ? "Project" : "Exam"} ({ASSESSMENT_MAX[type]})
                                </th>
                              ))}
                            </>
                          )}
                          <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                            {competencyMode ? "Status" : "Total (100)"}
                          </th>
                          <th className="px-8 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-right">
                            Grade
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container">
                        {studentsLoading ? (
                          <tr>
                            <td colSpan={7} className="px-8 py-12">
                              <TableSkeleton rows={5} />
                            </td>
                          </tr>
                        ) : displayStudents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-8 py-12">
                              <NoData title={statusFilter !== "all" ? `No ${statusFilter} students in this class` : "No students in this class"} />
                            </td>
                          </tr>
                        ) : (
                          paginatedStudents.map((student) => {
                            const ca1 = getMark(student.id, "ca1");
                            const ca2 = getMark(student.id, "ca2");
                            const ca3 = getMark(student.id, "ca3");
                            const exam = getMark(student.id, "exam");
                            const total = getStudentTotal(student.id);
                            const gradeInfo =
                              total !== null ? getGrade(total) : null;
                            const graded = isStudentGraded(student.id);
                            return (
                              <tr
                                key={student.id}
                                className={`hover:bg-surface-bright transition-colors ${
                                  !graded &&
                                  completionStats.graded < completionStats.total
                                    ? "bg-orange-50/20 dark:bg-orange-900/5"
                                    : ""
                                }`}
                              >
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-4">
                                    <PersonInitials
                                      name={`${student.first_name} ${student.last_name}`}
                                      size={40}
                                    />
                                    <div>
                                      <p className="font-bold text-primary">
                                        {student.first_name} {student.last_name}
                                      </p>
                                      <p className="text-xs text-on-surface-variant">
                                        {student.student_number || "-"}
                                      </p>
                                      {(() => {
                                        const sStatus = studentStatusMap[student.id] || "draft";
                                        return (
                                          <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black mt-1 ${
                                              sStatus === "draft"
                                                ? "bg-[var(--amber-soft)] text-[var(--amber)]"
                                                : sStatus === "submitted"
                                                  ? "bg-blue-50 text-blue-700"
                                                  : sStatus === "approved"
                                                    ? "bg-[var(--green-soft)] text-[var(--green)]"
                                                    : "bg-surface-container text-on-surface-variant"
                                            }`}
                                          >
                                            {sStatus === "draft"
                                              ? "Draft"
                                              : sStatus === "submitted"
                                                ? "Submitted"
                                                : sStatus === "approved"
                                                  ? "Approved"
                                                  : "Published"}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                    {graded && (
                                      <MaterialIcon
                                        icon="check_circle"
                                        className="text-green-500 text-lg"
                                      />
                                    )}
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
                                        min={0}
                                        max={ASSESSMENT_MAX[type]}
                                        placeholder="—"
                                        value={
                                          marks[`${student.id}_${type}`] !==
                                            null &&
                                          marks[`${student.id}_${type}`] !==
                                            undefined
                                            ? String(
                                                marks[`${student.id}_${type}`],
                                              )
                                            : ""
                                        }
                                        onChange={(e) =>
                                          handleMarkChange(
                                            student.id,
                                            type,
                                            e.target.value,
                                          )
                                        }
                                        onBlur={() =>
                                          handleInlineBlur(student.id, type)
                                        }
                                        disabled={
                                          isSubmitted ||
                                          (caLocked && type.startsWith("ca"))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.currentTarget.blur();
                                          }
                                        }}
                                      />
                                      {getSaveStatusForInput(
                                        student.id,
                                        type,
                                      ) === "saved" && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                                      )}
                                    </div>
                                  </td>
                                  )))}
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
                          onClick={() =>
                            setGradePage((p) => Math.max(1, p - 1))
                          }
                          disabled={gradePage === 1}
                        >
                          <MaterialIcon icon="chevron_left" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setGradePage((p) =>
                              Math.min(gradeTotalPages, p + 1),
                            )
                          }
                          disabled={gradePage >= gradeTotalPages}
                        >
                          <MaterialIcon icon="chevron_right" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile: Card View with Swipe */}
              {!inlineEntryMode && filteredStudents.length > 0 && (
                <div className="md:hidden">
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
                            {filteredStudents[mobileStudentIndex]
                              ?.student_number || "-"}
                          </p>
                          {(() => {
                            const sid = filteredStudents[mobileStudentIndex]?.id;
                            if (!sid) return null;
                            const sStatus = studentStatusMap[sid] || "draft";
                            return (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black mt-1 ${
                                  sStatus === "draft"
                                    ? "bg-[var(--amber-soft)] text-[var(--amber)]"
                                    : sStatus === "submitted"
                                      ? "bg-blue-50 text-blue-700"
                                      : sStatus === "approved"
                                        ? "bg-[var(--green-soft)] text-[var(--green)]"
                                        : "bg-surface-container text-on-surface-variant"
                                }`}
                              >
                                {sStatus === "draft"
                                  ? "Draft"
                                  : sStatus === "submitted"
                                    ? "Submitted"
                                    : sStatus === "approved"
                                      ? "Approved"
                                      : "Published"}
                              </span>
                            );
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
                                {type.toUpperCase()} ({ASSESSMENT_MAX[type]})
                              </label>
                              <input
                                className={`w-full text-center text-2xl font-bold py-4 rounded-xl border-none focus:outline-none transition-all ${getInputBorderClass(studentId, type)}`}
                                type="number"
                                min={0}
                                max={ASSESSMENT_MAX[type]}
                                placeholder="—"
                                value={val !== null ? String(val) : ""}
                                onChange={(e) => handleMarkChange(studentId, type, e.target.value)}
                                onBlur={() => handleInlineBlur(studentId, type)}
                                disabled={isSubmitted || (caLocked && type.startsWith("ca"))}
                                inputMode="numeric"
                              />
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Total & Grade */}
                    {(() => {
                      const studentId =
                        filteredStudents[mobileStudentIndex]?.id;
                      if (!studentId) return null;
                      const total = getStudentTotal(studentId);
                      const gradeInfo = total !== null ? getGrade(total) : null;
                      return (
                        <div className="flex items-center justify-center gap-6 py-4 bg-surface-container rounded-2xl">
                          <div className="text-center">
                            <p className="text-xs text-on-surface-variant uppercase tracking-wider">
                              Total
                            </p>
                            <p className="text-3xl font-black text-primary">
                              {total !== null ? total : "—"}
                            </p>
                          </div>
                          <div className="w-px h-12 bg-outline-variant/20" />
                          <div className="text-center">
                            <p className="text-xs text-on-surface-variant uppercase tracking-wider">
                              Grade
                            </p>
                            <p
                              className={`text-3xl font-black ${gradeInfo?.color || "text-on-surface-variant"}`}
                            >
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
                        icon={
                          <MaterialIcon
                            icon="chevron_left"
                            className="text-xl"
                          />
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => navigateMobileStudent("next")}
                        disabled={
                          mobileStudentIndex === filteredStudents.length - 1
                        }
                        className="flex-1"
                      >
                        Next
                        <MaterialIcon
                          icon="chevron_right"
                          className="text-xl"
                        />
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
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            <PersonInitials
                              name={`${student.first_name} ${student.last_name}`}
                              size={28}
                            />
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
                <div className="text-2xl font-bold text-secondary">
                  {coverageStats.completed}
                </div>
                <div className="text-sm text-on-surface-variant">Completed</div>
              </div>
              <div className="bg-surface-container-low p-6 rounded-xl text-center">
                <div className="text-2xl font-bold text-tertiary">
                  {coverageStats.inProgress}
                </div>
                <div className="text-sm text-on-surface-variant">
                  In Progress
                </div>
              </div>
              <div className="bg-surface-container-low p-6 rounded-xl text-center">
                <div className="text-2xl font-bold text-primary">
                  {coverageStats.percentage}%
                </div>
                <div className="text-sm text-on-surface-variant">Coverage</div>
              </div>
            </div>

            {/* Topics */}
            <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
              <div className="p-6 border-b border-outline-variant/10">
                <h3 className="font-headline font-bold text-lg text-primary">
                  Topic Coverage
                </h3>
              </div>
              <div className="divide-y divide-outline-variant/5">
                {topics.map((topic) => {
                  const status = getTopicStatus(topic);
                  return (
                    <div
                      key={topic}
                      className="flex items-center justify-between p-4 hover:bg-surface-bright"
                    >
                      <span className="font-medium text-primary">{topic}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateTopicStatus(topic, "not_started")
                          }
                          className={`px-3 py-1 rounded-full text-xs font-bold ${status === "not_started" ? "bg-surface-container text-on-surface-variant" : "bg-surface-bright text-on-surface-variant hover:bg-surface-container"}`}
                        >
                          Not Started
                        </button>
                        <button
                          onClick={() =>
                            updateTopicStatus(topic, "in_progress")
                          }
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
            description="Choose a class and subject from the filters above to start entering grades."
          />
        )}

        {/* Sticky Action Bar */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[var(--surface)]/80 dark:bg-[var(--surface-container-lowest)]/80 backdrop-blur-2xl px-6 py-4 rounded-full shadow-2xl z-40 border border-[var(--border)]/50 hidden md:flex">
          <div className="flex items-center gap-2 text-secondary px-4 border-r border-[var(--border)]">
            <MaterialIcon
              className="text-xl"
              style={{ fontVariationSettings: "FILL 1" }}
            >
              cloud_done
            </MaterialIcon>
            <span className="text-xs font-bold uppercase tracking-wider">
              Sync Active
            </span>
          </div>
          <button
            onClick={handleSaveDraft}
            disabled={
              isSubmitted || saving || !selectedClass || !selectedSubject
            }
            className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--surface-container)] rounded-full transition-colors font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MaterialIcon>save</MaterialIcon>
            Save Grades
          </button>
          <button
            onClick={handleSubmitToDean}
            disabled={
              isSubmitted || saving || !selectedClass || !selectedSubject
            }
            className="bg-primary text-white px-8 py-2.5 rounded-full font-bold text-sm hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitted
              ? "Submitted ✓"
              : staff.some(
                    (s: any) =>
                      s.role === "dean_of_studies" || s.role === "dos",
                  )
                ? "Submit to Dean"
                : "Submit to HM"}
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
