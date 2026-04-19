import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { DEMO_CLASSES } from "@/lib/demo-data";

type StudentAction = "promote" | "repeat" | "demote" | "skip";
interface StudentActionMap {
  [studentId: string]: {
    action: StudentAction;
    targetClassId?: string;
    reason?: string;
  };
}

interface ClassData {
  id: string;
  name: string;
  level: string;
}

interface PromotionStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  status: string;
  class_id: string;
  repeating?: boolean;
  classes?: { id: string; name: string; level: string };
}

export function useStudentPromotion(
  schoolId: string | undefined,
  students: any[],
  isDemo: boolean,
  updateStudent: (id: string, data: any) => Promise<any>,
  toast: { success: (msg: string) => void; error: (msg: string) => void },
  academicYear: string,
  user?: { id?: string; full_name?: string } | null,
) {
  const [promotionClasses, setPromotionClasses] = useState<ClassData[]>([]);
  const [fromClass, setFromClass] = useState("");
  const [toClass, setToClass] = useState("");
  const [promotionStudents, setPromotionStudents] = useState<PromotionStudent[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [studentActions, setStudentActions] = useState<StudentActionMap>({});
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promotionHistory, setPromotionHistory] = useState<any[]>([]);
  const [showDemoteModal, setShowDemoteModal] = useState<string | null>(null);
  const [demoteReason, setDemoteReason] = useState("");
  const [demoteClass, setDemoteClass] = useState("");
  const [autoPromoting, setAutoPromoting] = useState(false);
  const [autoPromoteResult, setAutoPromoteResult] = useState<any>(null);

  const fetchPromotionClasses = useCallback(async () => {
    if (!schoolId) return;
    if (isDemo) {
      setPromotionClasses(DEMO_CLASSES as any);
      return;
    }
    const { data } = await supabase
      .from("classes")
      .select("*")
      .eq("school_id", schoolId)
      .order("level", { ascending: true });
    setPromotionClasses(data || []);
  }, [schoolId, isDemo]);

  const fetchPromotionStudents = useCallback(async () => {
    if (!schoolId || !fromClass) return;
    setPromotionLoading(true);
    if (isDemo) {
      const classStudents = students.filter((s) => s.class_id === fromClass);
      setPromotionStudents(classStudents as any);
      setSelectedStudents(new Set(classStudents.map((s) => s.id)));
      const defaultActions: StudentActionMap = {};
      classStudents.forEach((s) => {
        defaultActions[s.id] = { action: "promote" };
      });
      setStudentActions(defaultActions);
      setPromotionLoading(false);
      return;
    }
    const { data } = await supabase
      .from("students")
      .select("*, classes(*)")
      .eq("school_id", schoolId)
      .eq("class_id", fromClass)
      .eq("status", "active")
      .order("first_name");
    setPromotionStudents(data || []);
    setSelectedStudents(new Set(data?.map((s) => s.id) || []));
    const defaultActions: StudentActionMap = {};
    data?.forEach((s) => {
      defaultActions[s.id] = { action: "promote" };
    });
    setStudentActions(defaultActions);
    setPromotionLoading(false);
  }, [schoolId, fromClass, isDemo, students]);

  const fetchPromotionHistory = useCallback(async () => {
    if (!schoolId) return;
    if (isDemo) {
      setPromotionHistory([
        {
          id: "demo-h1",
          from_classes: { name: "P.4" },
          to_classes: { name: "P.5" },
          academic_year: academicYear,
          promotion_type: "promoted",
          promoted_at: new Date().toISOString(),
          users: { full_name: user?.full_name || "Admin" },
          student_count: 32,
        },
      ]);
      return;
    }
    const { data } = await supabase
      .from("student_promotions")
      .select("*, from_classes(name), to_classes(name), users(full_name)")
      .eq("school_id", schoolId)
      .order("promoted_at", { ascending: false })
      .limit(20);
    setPromotionHistory(data || []);
  }, [schoolId, isDemo, academicYear, user?.full_name]);

  const toggleStudent = (id: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      setStudentActions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      newSelected.add(id);
      setStudentActions((prev) => ({ ...prev, [id]: { action: "promote" } }));
    }
    setSelectedStudents(newSelected);
  };

  const toggleAll = () => {
    if (selectedStudents.size === promotionStudents.length) {
      setSelectedStudents(new Set());
      setStudentActions({});
    } else {
      const newSet = new Set(promotionStudents.map((s) => s.id));
      const newActions: StudentActionMap = {};
      promotionStudents.forEach((s) => {
        newActions[s.id] = { action: "promote" };
      });
      setSelectedStudents(newSet);
      setStudentActions(newActions);
    }
  };

  const setAction = (studentId: string, action: StudentAction) => {
    if (action === "demote") {
      setShowDemoteModal(studentId);
      return;
    }
    setStudentActions((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        action,
        targetClassId: undefined,
        reason: undefined,
      },
    }));
  };

  const confirmDemote = () => {
    if (!showDemoteModal || !demoteClass) {
      toast.error("Please select a class to demote to");
      return;
    }
    setStudentActions((prev) => ({
      ...prev,
      [showDemoteModal]: {
        action: "demote",
        targetClassId: demoteClass,
        reason: demoteReason,
      },
    }));
    setShowDemoteModal(null);
    setDemoteReason("");
    setDemoteClass("");
  };

  const processPromotions = async () => {
    const selectedArray = Array.from(selectedStudents);
    if (selectedArray.length === 0) {
      toast.error("No students selected");
      return;
    }
    const promoteStudents = selectedArray.filter(
      (id) => studentActions[id]?.action === "promote",
    );
    if (promoteStudents.length > 0 && !toClass) {
      toast.error("Please select a target class for promoted students");
      return;
    }
    setPromoting(true);
    try {
      let user_id = "demo-user";
      if (!isDemo) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        user_id = authUser?.id || user_id;
      }

      let promoted = 0,
        repeating = 0,
        demoted = 0;

      for (const studentId of selectedArray) {
        const actionData = studentActions[studentId];
        if (!actionData) continue;
        const action = actionData.action;

        if (isDemo) {
          if (action === "promote") {
            await updateStudent(studentId, { class_id: toClass });
            promoted++;
          } else if (action === "repeat") {
            await updateStudent(studentId, { repeating: true });
            repeating++;
          } else if (action === "demote") {
            const targetClass = actionData.targetClassId || fromClass;
            await updateStudent(studentId, { class_id: targetClass });
            demoted++;
          }
          continue;
        }

        if (action === "promote") {
          await supabase
            .from("students")
            .update({ class_id: toClass, repeating: false })
            .eq("id", studentId);
          await supabase.from("student_promotions").insert({
            school_id: schoolId,
            student_id: studentId,
            from_class_id: fromClass,
            to_class_id: toClass,
            academic_year: academicYear,
            promotion_type: "promoted",
            promoted_by: user_id,
            promoted_at: new Date().toISOString(),
          });
          promoted++;
        } else if (action === "repeat") {
          await supabase
            .from("students")
            .update({ repeating: true })
            .eq("id", studentId);
          await supabase.from("student_promotions").insert({
            school_id: schoolId,
            student_id: studentId,
            from_class_id: fromClass,
            to_class_id: fromClass,
            academic_year: academicYear,
            promotion_type: "repeating",
            notes: "Repeating class",
            promoted_by: user_id,
            promoted_at: new Date().toISOString(),
          });
          repeating++;
        } else if (action === "demote") {
          const targetClass = actionData.targetClassId || fromClass;
          await supabase
            .from("students")
            .update({ class_id: targetClass, repeating: false })
            .eq("id", studentId);
          await supabase.from("student_promotions").insert({
            school_id: schoolId,
            student_id: studentId,
            from_class_id: fromClass,
            to_class_id: targetClass,
            academic_year: academicYear,
            promotion_type: "demoted",
            notes: actionData.reason || "Demoted",
            promoted_by: user_id,
            promoted_at: new Date().toISOString(),
          });
          demoted++;
        }
      }
      const summaryParts: string[] = [];
      if (promoted > 0) summaryParts.push(`${promoted} promoted`);
      if (repeating > 0) summaryParts.push(`${repeating} repeating`);
      if (demoted > 0) summaryParts.push(`${demoted} demoted`);
      toast.success(summaryParts.join(", ") + " successfully");
      fetchPromotionStudents();
      fetchPromotionHistory();
      setSelectedStudents(new Set());
      setStudentActions({});
    } catch (err: any) {
      toast.error(err.message || "Processing failed");
    } finally {
      setPromoting(false);
    }
  };

  const getNextClassOptions = () => {
    if (!fromClass) return [];
    const currentClass = promotionClasses.find((c) => c.id === fromClass);
    if (!currentClass) return [];
    const levelNum = parseInt(currentClass.level.replace(/\D/g, ""));
    if (currentClass.level === "P.7" || currentClass.level.includes("P7"))
      return promotionClasses.filter(
        (c) => c.level.includes("S.1") || c.level.includes("S1"),
      );
    if (currentClass.level === "S.4" || currentClass.level.includes("S4"))
      return promotionClasses.filter(
        (c) => c.level.includes("S.5") || c.level.includes("S5"),
      );
    const nextLevel = levelNum + 1;
    return promotionClasses.filter(
      (c) => parseInt(c.level.replace(/\D/g, "")) === nextLevel,
    );
  };

  const getPrevClassOptions = () => {
    if (!fromClass) return [];
    const currentClass = promotionClasses.find((c) => c.id === fromClass);
    if (!currentClass) return [];
    const levelNum = parseInt(currentClass.level.replace(/\D/g, ""));
    if (levelNum <= 1) return [];
    const prevLevel = levelNum - 1;
    return promotionClasses.filter(
      (c) => parseInt(c.level.replace(/\D/g, "")) === prevLevel,
    );
  };

  const actionCounts = {
    promote: Object.values(studentActions).filter((a) => a.action === "promote").length,
    repeat: Object.values(studentActions).filter((a) => a.action === "repeat").length,
    demote: Object.values(studentActions).filter((a) => a.action === "demote").length,
  };

  const handleAutoPromote = async () => {
    if (!schoolId) {
      toast.error("No school selected");
      return;
    }
    const year = academicYear || new Date().getFullYear().toString();
    setAutoPromoting(true);
    setAutoPromoteResult(null);
    try {
      const res = await fetch("/api/automation/auto-promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, academicYear: year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auto-promotion failed");
      setAutoPromoteResult(data);
      toast.success(
        `Auto-promotion complete: ${data.summary.promoted} promoted, ${data.summary.retained} retained`,
      );
      fetchPromotionHistory();
    } catch (err: any) {
      toast.error(err.message || "Auto-promotion failed");
    } finally {
      setAutoPromoting(false);
    }
  };

  return {
    promotionClasses,
    fromClass,
    setFromClass,
    toClass,
    setToClass,
    promotionStudents,
    selectedStudents,
    studentActions,
    promotionLoading,
    promoting,
    promotionHistory,
    showDemoteModal,
    setShowDemoteModal,
    demoteReason,
    setDemoteReason,
    demoteClass,
    setDemoteClass,
    autoPromoting,
    autoPromoteResult,
    fetchPromotionClasses,
    fetchPromotionStudents,
    fetchPromotionHistory,
    toggleStudent,
    toggleAll,
    setAction,
    confirmDemote,
    processPromotions,
    getNextClassOptions,
    getPrevClassOptions,
    actionCounts,
    handleAutoPromote,
  };
}
