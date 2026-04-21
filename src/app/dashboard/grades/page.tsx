"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useClasses,
  useSubjects,
  useStudents,
  useGrades,
  useStaff,
} from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";

import { PageHeader, PageSection } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button, Input, Select, Badge } from "@/components/ui/index";
import { TableSkeleton, FullPageLoader } from "@/components/ui/Skeleton";
import { EmptyState, NoData } from "@/components/EmptyState";
import PersonInitials from "@/components/ui/PersonInitials";
import { logAuditEventWithOfflineSupport } from "@/lib/audit";
import { useOnlineStatus } from "@/lib/offline";
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

const STANDARD_TOPICS: Record<string, string[]> = {
  Mathematics: [
    "Number operations",
    "Fractions and decimals",
    "Percentages",
    "Ratio and proportion",
    "Algebra",
    "Geometry",
    "Statistics",
    "Probability",
  ],
  English: [
    "Grammar",
    "Comprehension",
    "Composition",
    "Poetry",
    "Drama",
    "Novel",
    "Literature",
    "Vocabulary",
  ],
  Science: [
    "Living things",
    "Materials",
    "Forces and energy",
    "Earth and space",
    "Human body",
    "Plants",
    "Animals",
  ],
};

const ASSESSMENT_TYPES = ["ca1", "ca2", "ca3", "exam"] as const;
const ASSESSMENT_MAX: Record<string, number> = {
  ca1: 10,
  ca2: 10,
  ca3: 10,
  exam: 70,
};

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
  const { school, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { staff } = useStaff(school?.id);

  const [tab, setTab] = useState<"marks" | "coverage">("marks");
  const tabLabels = { marks: "Enter Marks", coverage: "What we Taught" };
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [coverage, setCoverage] = useState<TopicCoverage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marks, setMarks] = useState<StudentMarks>({});
  const [gradeConfirm, setGradeConfirm] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: "", onConfirm: () => {} });
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
  const { students: classStudents, loading: studentsLoading } = useStudents(
    school?.id,
  );
  const { grades: existingGrades, saveGrade } = useGrades(
    selectedClass,
    selectedSubject,
    currentTerm,
    academicYear,
  );

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
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const assessmentLabels: Record<string, string> = {
    ca1: "Test 1",
    ca2: "Test 2",
    ca3: "Test 3",
    exam: "Final Exam",
  };
  const touchStartX = useRef(0);
  const mobileCardRef = useRef<HTMLDivElement>(null);

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return classStudents.filter((s) => s.class_id === selectedClass);
  }, [classStudents, selectedClass]);

  // Initialize marks from existing grades
  useEffect(() => {
    if (existingGrades.length > 0) {
      const marksMap: StudentMarks = {};
      const newMarksBy: Record<string, { name: string; type: string }> = {};
      let isCaLocked = false;
      let lockedBy = "";

      existingGrades.forEach((g: any) => {
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
      setMarks(marksMap);
      setMarksBy(newMarksBy);
      setCaLocked(isCaLocked);

      if (lockedBy) {
        const lockedByStaff = staff.find((s) => s.id === lockedBy);
        setLockedByName(lockedByStaff?.full_name || "Unknown");
      } else {
        setLockedByName("");
      }

      setSubmissionStatus(deriveGradeWorkflowStatus(existingGrades));
    } else {
      setMarks({});
      setMarksBy({});
      setCaLocked(false);
      setLockedByName("");
      setSubmissionStatus("draft");
    }
  }, [existingGrades, staff]);

  const handleLockCA = async () => {
    if (!selectedClass || !selectedSubject || !user?.id) return;

    if (
      !confirm(
        "Are you sure you want to lock CA marks? This will prevent further edits to CA1, CA2, and CA3 marks for this subject/class combination.",
      )
    )
      return;

    try {
      setSaving(true);
      await supabase
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
        .eq("academic_year", academicYear);

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
      console.error("Error locking tests:", err);
      toast.error("Failed to close tests for edits");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockCA = async () => {
    if (!selectedClass || !selectedSubject || !user?.id) return;

    if (!confirm("Are you sure you want to unlock CA marks?")) return;

    try {
      setSaving(true);
      await supabase
        .from("grades")
        .update({
          ca_locked: false,
          locked_by: null,
          locked_at: null,
        })
        .eq("class_id", selectedClass)
        .eq("subject_id", selectedSubject)
        .in("assessment_type", ["ca1", "ca2", "ca3"])
        .eq("term", currentTerm)
        .eq("academic_year", academicYear);

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
      console.error("Error opening tests:", err);
      toast.error("Failed to open tests");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkChange = (studentId: string, type: string, value: string) => {
    if (caLocked && type.startsWith("ca")) {
      toast.error("CA marks are locked. Contact DOS to unlock.");
      return;
    }
    if (value === "") {
      setMarks((prev) => ({ ...prev, [`${studentId}_${type}`]: null }));
    } else {
      const num = Math.min(
        ASSESSMENT_MAX[type] || 100,
        Math.max(0, Number(value)),
      );
      setMarks((prev) => ({ ...prev, [`${studentId}_${type}`]: num }));
    }
  };

  const getMark = (studentId: string, type: string): number | null => {
    return marks[`${studentId}_${type}`] ?? null;
  };

  const getStudentTotal = (studentId: string): number | null => {
    const parts = ASSESSMENT_TYPES.map((t) => marks[`${studentId}_${t}`]);
    if (parts.some((p) => p === null || p === undefined)) return null;
    return parts.reduce((sum, p) => (sum ?? 0) + (p ?? 0), 0) ?? null;
  };

  const isStudentGraded = useCallback(
    (studentId: string): boolean => {
      return ASSESSMENT_TYPES.every(
        (t) =>
          marks[`${studentId}_${t}`] !== null &&
          marks[`${studentId}_${t}`] !== undefined,
      );
    },
    [marks],
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
      saveGrade,
      selectedSubject,
      selectedClass,
      currentTerm,
      academicYear,
      user?.id,
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
    if (
      !confirm("Clear all marks for this class/subject? This cannot be undone.")
    )
      return;
    setMarks({});
    setSaveStatuses({});
    toast.success("All marks cleared");
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
        await saveGrade({
          student_id: studentId,
          subject_id: selectedSubject,
          class_id: selectedClass,
          assessment_type: assessmentType,
          score,
          term: currentTerm,
          academic_year: academicYear,
          recorded_by: user?.id,
          status,
        });
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
    } catch {
      toast.error("Failed to save grades");
    } finally {
      setSaving(false);
    }
  };

  const handleExportGrades = () => {
    if (!selectedClass || filteredStudents.length === 0) {
      toast.error("No grades to export");
      return;
    }
    const headers = [
      "Student Name",
      "Student Number",
      "CA1",
      "CA2",
      "CA3",
      "Exam",
      "Total",
      "Grade",
    ];
    const rows = filteredStudents.map((student) => {
      const ca1 = getMark(student.id, "ca1");
      const ca2 = getMark(student.id, "ca2");
      const ca3 = getMark(student.id, "ca3");
      const exam = getMark(student.id, "exam");
      const total = getStudentTotal(student.id);
      const gradeInfo = total !== null ? getGrade(total) : null;
      return [
        `${student.first_name} ${student.last_name}`,
        student.student_number || "",
        ca1 !== null ? String(ca1) : "",
        ca2 !== null ? String(ca2) : "",
        ca3 !== null ? String(ca3) : "",
        exam !== null ? String(exam) : "",
        total !== null ? String(total) : "",
        gradeInfo ? gradeInfo.grade : "",
      ];
    });
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
          const updatePayload: Record<string, string | null> = {
            status: nextStatus,
          };
          if (nextStatus === "submitted") {
            updatePayload.submitted_at = new Date().toISOString();
            updatePayload.submitted_by = user.id;
          }
          if (nextStatus === "approved") {
            updatePayload.approved_at = new Date().toISOString();
            updatePayload.approved_by = user.id;
          }
          if (nextStatus === "published") {
            updatePayload.published_at = new Date().toISOString();
            updatePayload.published_by = user.id;
          }

          const { error } = await supabase
            .from("grades")
            .update(updatePayload)
            .eq("class_id", selectedClass)
            .eq("subject_id", selectedSubject)
            .eq("term", currentTerm)
            .eq("academic_year", academicYear)
            .is("deleted_at", null);

          if (error) throw error;

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
              updatePayload,
            );
          }

          setSubmissionStatus(nextStatus);
          toast.success(`Grades ${nextStatus}`);
        } catch (err) {
          console.error("Error updating grade workflow:", err);
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
      const { data, error } = await supabase
        .from("topic_coverage")
        .select("id, syllabus_id, class_id, teacher_id, status, syllabus!inner(topic, subject_id, term, academic_year)")
        .eq("class_id", selectedClass)
        .eq("syllabus.subject_id", selectedSubject)
        .eq("syllabus.term", currentTerm)
        .eq("syllabus.academic_year", academicYear);

      if (error) throw error;

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        syllabus_id: row.syllabus_id,
        class_id: row.class_id,
        teacher_id: row.teacher_id,
        status: row.status,
        topic_name: row.syllabus?.topic || "",
      }));
      setCoverage(mapped);
    } catch (err) {
      console.error("Error fetching coverage:", err);
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
        await supabase
          .from("topic_coverage")
          .update({
            status,
            teacher_id: user?.id,
            completed_date:
              status === "completed" ? new Date().toISOString().split("T")[0] : null,
          })
          .eq("id", existing.id);
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

        await supabase.from("topic_coverage").insert({
          syllabus_id: syllabusRow.id,
          class_id: selectedClass,
          teacher_id: user?.id,
          status,
          completed_date:
            status === "completed" ? new Date().toISOString().split("T")[0] : null,
        });
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
    () =>
      STANDARD_TOPICS[selectedSubjectName] || [
        "Topic 1",
        "Topic 2",
        "Topic 3",
        "Topic 4",
        "Topic 5",
      ],
    [selectedSubjectName],
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
              icon={<MaterialIcon icon="cloud_download" className="text-lg" />}
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

      {/* Marks Entry Info */}
      {selectedClass && selectedSubject && Object.keys(marksBy).length > 0 && (
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
                <div className="relative group">
                  <button
                    className="px-3 py-2 rounded-xl text-sm font-medium bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5"
                    onClick={() =>
                      setQuickFillModal({ open: true, type: "ca1", value: "" })
                    }
                  >
                    <MaterialIcon icon="playlist_add" className="text-base" />
                    Quick Fill
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-64 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/10 p-4 hidden group-hover:block z-30">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
                      Set All Students
                    </p>
                    {(["ca1", "ca2", "ca3", "exam"] as const).map((type) => (
                      <div key={type} className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-on-surface-variant w-10">
                          {type.toUpperCase()}
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
                      {completionStats.graded}/{completionStats.total} students
                      graded
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
                    {Object.keys(marks).filter((k) => marks[k] !== null).length}{" "}
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
                        <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                          CA1 (10)
                        </th>
                        <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                          CA2 (10)
                        </th>
                        <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                          CA3 (10)
                        </th>
                        <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                          Exam (70)
                        </th>
                        <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                          Total (100)
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
                      ) : filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-8 py-12">
                            <NoData title="No students in this class" />
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student) => {
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
                                  <PersonInitials name={`${student.first_name} ${student.last_name}`} size={40} />
                                  <div>
                                    <p className="font-bold text-primary">
                                      {student.first_name} {student.last_name}
                                    </p>
                                    <p className="text-xs text-on-surface-variant">
                                      {student.student_number || "-"}
                                    </p>
                                  </div>
                                  {graded && (
                                    <MaterialIcon
                                      icon="check_circle"
                                      className="text-green-500 text-lg"
                                    />
                                  )}
                                </div>
                              </td>
                              {["ca1", "ca2", "ca3", "exam"].map((type) => (
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
                                    {getSaveStatusForInput(student.id, type) ===
                                      "saved" && (
                                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                                    )}
                                  </div>
                                </td>
                              ))}
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
                        name={`${filteredStudents[mobileStudentIndex]?.first_name || ''} ${filteredStudents[mobileStudentIndex]?.last_name || ''}`}
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
                      </div>
                    </div>
                    <span className="text-sm font-medium text-on-surface-variant">
                      {mobileStudentIndex + 1} / {filteredStudents.length}
                    </span>
                  </div>

                  {/* Score Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    {(["ca1", "ca2", "ca3", "exam"] as const).map((type) => {
                      const studentId =
                        filteredStudents[mobileStudentIndex]?.id;
                      if (!studentId) return null;
                      const val = getMark(studentId, type);
                      const total = getStudentTotal(studentId);
                      const gradeInfo = total !== null ? getGrade(total) : null;
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
                            onChange={(e) =>
                              handleMarkChange(studentId, type, e.target.value)
                            }
                            onBlur={() => handleInlineBlur(studentId, type)}
                            disabled={
                              isSubmitted || (caLocked && type.startsWith("ca"))
                            }
                            inputMode="numeric"
                          />
                        </div>
                      );
                    })}
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
                        <MaterialIcon icon="chevron_left" className="text-xl" />
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
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
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
              <div className="text-2xl font-bold text-secondary">
                {coverageStats.completed}
              </div>
              <div className="text-sm text-on-surface-variant">Completed</div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl text-center">
              <div className="text-2xl font-bold text-tertiary">
                {coverageStats.inProgress}
              </div>
              <div className="text-sm text-on-surface-variant">In Progress</div>
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

      {!selectedClass && (
        <EmptyState
          icon="menu_book"
          title="Select a class"
          description="Choose a class to view curriculum data"
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
          disabled={isSubmitted || saving || !selectedClass || !selectedSubject}
          className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--surface-container)] rounded-full transition-colors font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MaterialIcon>drafts</MaterialIcon>
          Save Draft
        </button>
        <button
          onClick={handleSubmitToDean}
          disabled={isSubmitted || saving || !selectedClass || !selectedSubject}
          className="bg-primary text-white px-8 py-2.5 rounded-full font-bold text-sm hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitted ? "Submitted" : "Submit to Dean"}
        </button>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
