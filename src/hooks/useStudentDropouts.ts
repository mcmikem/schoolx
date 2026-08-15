import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { DEMO_ATTENDANCE } from "@/lib/demo-data";
import { logger } from "@/lib/logger";
import type { StudentWithClass } from "@/lib/hooks/students";
import type { CreateStudentInput } from "@/types";

interface AtRiskStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  student_number: string;
  class_id: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  consecutive_absent: number;
  last_attendance_date: string | null;
  risk_level: "at_risk" | "likely_dropout";
}

export function useStudentDropouts(
  schoolId: string | undefined,
  students: StudentWithClass[],
  isDemo: boolean,
  updateStudent: (id: string, data: Partial<CreateStudentInput>) => Promise<unknown>,
  toast: { success: (msg: string) => void; error: (msg: string) => void },
  user?: { id?: string; full_name?: string } | null,
) {
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [loadingAtRisk, setLoadingAtRisk] = useState(true);
  const [dropoutClassFilter, setDropoutClassFilter] = useState("all");
  const [showDropoutModal, setShowDropoutModal] = useState<string | null>(null);
  const [dropoutReason, setDropoutReason] = useState("");
  const [dropoutActionTaken, setDropoutActionTaken] = useState("");
  const [interventionHistory, setInterventionHistory] = useState<any[]>([]);
  const [sendingSms, setSendingSms] = useState<string | null>(null);

  const daysBetween = (from: string | null | undefined, to = new Date()) => {
    if (!from) return null;
    const start = new Date(from);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    const begin = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    return Math.max(0, Math.floor((end.getTime() - begin.getTime()) / 86400000));
  };

  const fetchAtRiskStudents = useCallback(async () => {
    if (!schoolId) return;
    setLoadingAtRisk(true);
    try {
      if (isDemo) {
        const activeStudents = students.filter((s) => s.status === "active");
        const demoRiskList: AtRiskStudent[] = activeStudents.slice(0, 4).map((student, index) => ({
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          gender: student.gender,
          student_number: student.student_number || "",
          class_id: student.class_id,
          class_name: student.classes?.name || "-",
          parent_name: student.parent_name || "",
          parent_phone: student.parent_phone || "",
          consecutive_absent: index === 0 ? 32 : index === 1 ? 21 : index === 2 ? 16 : 14,
          last_attendance_date:
            index === 0
              ? null
              : DEMO_ATTENDANCE.find((r) => r.student_id === student.id && r.status !== "absent")?.date || null,
          risk_level: "at_risk",
        }));
        setAtRiskStudents(demoRiskList);
        return;
      }
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const todayStr = today.toISOString().split("T")[0];
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
      const activeStudents = students.filter((s) => s.status === "active");
      const activeIds = activeStudents.map((s) => s.id);
      if (activeIds.length === 0) {
        setAtRiskStudents([]);
        return;
      }
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("student_id, date, status")
        .in("student_id", activeIds)
        .gte("date", thirtyDaysAgoStr)
        .lte("date", todayStr)
        .order("date", { ascending: false })
        .limit(10000);
      if (error) throw error;
      const studentAtt: Record<string, { date: string; status: string }[]> = {};
      attendanceData?.forEach((record) => {
        if (!studentAtt[record.student_id]) studentAtt[record.student_id] = [];
        studentAtt[record.student_id].push({
          date: record.date,
          status: record.status,
        });
      });
      const atRiskList: AtRiskStudent[] = [];
      for (const student of activeStudents) {
        const records = studentAtt[student.id];
        if (!records || records.length === 0) {
          const ageInDays = daysBetween(student.admission_date);
          if (ageInDays !== null && ageInDays < 14) {
            continue;
          }
          atRiskList.push({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            gender: student.gender,
            student_number: student.student_number || "",
            class_id: student.class_id,
            class_name: student.classes?.name || "-",
            parent_name: student.parent_name || "",
            parent_phone: student.parent_phone || "",
            consecutive_absent: ageInDays !== null ? Math.min(ageInDays, 29) : 14,
            last_attendance_date: null,
            risk_level: "at_risk",
          });
          continue;
        }
        const sorted = records.sort((a, b) => b.date.localeCompare(a.date));
        let consecutiveAbsent = 0;
        let lastAttendanceDate: string | null = null;
        for (const rec of sorted) {
          if (rec.status === "absent") {
            consecutiveAbsent++;
          } else {
            lastAttendanceDate = rec.date;
            break;
          }
        }
        if (!lastAttendanceDate && sorted.length > 0) {
          consecutiveAbsent = sorted.length;
        }
        if (consecutiveAbsent >= 14) {
          atRiskList.push({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            gender: student.gender,
            student_number: student.student_number || "",
            class_id: student.class_id,
            class_name: student.classes?.name || "-",
            parent_name: student.parent_name || "",
            parent_phone: student.parent_phone || "",
            consecutive_absent: consecutiveAbsent,
            last_attendance_date: lastAttendanceDate,
            risk_level: consecutiveAbsent >= 30 ? "likely_dropout" : "at_risk",
          });
        }
      }
      setAtRiskStudents(atRiskList.sort((a, b) => b.consecutive_absent - a.consecutive_absent));
    } catch (err) {
      logger.error("Error computing at-risk students:", err);
    } finally {
      setLoadingAtRisk(false);
    }
  }, [schoolId, students, isDemo]);

  const handleContactParent = async (student: AtRiskStudent) => {
    if (!student.parent_phone) {
      toast.error("No parent phone number on file");
      return;
    }
    if (!schoolId) {
      toast.error("School context is missing. Please refresh and try again.");
      return;
    }
    setSendingSms(student.id);
    try {
      const message = `Dear ${student.parent_name || "Parent/Guardian"}, your child ${student.first_name} ${student.last_name} has been absent from school for ${student.consecutive_absent} consecutive days. Please contact the school urgently.`;
      if (isDemo) {
        toast.success(`Demo mode: SMS simulated for ${student.parent_phone}`);
        return;
      }

      const response = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: student.parent_phone,
          message,
          schoolId,
          studentId: student.id,
          type: "individual",
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || result.message || "Failed to send SMS");
      }

      const apiData = result.data || {};
      const smsSent = apiData.status === "sent";
      const usedFallback = apiData.status === "fallback";

      await withTimeout(
        supabase.from("messages").insert({
          school_id: schoolId,
          recipient_type: "individual",
          phone: student.parent_phone,
          message,
          status: smsSent ? "sent" : "failed",
          sent_by: user?.id,
          sent_at: new Date().toISOString(),
          recipient_id: student.id,
        }),
        15000,
        timeoutFallback(),
      );

      if (smsSent) {
        toast.success(`SMS sent to ${student.parent_phone}`);
      } else if (usedFallback) {
        if (typeof window !== "undefined" && typeof apiData.whatsappLink === "string" && apiData.whatsappLink) {
          window.open(apiData.whatsappLink, "_blank", "noopener,noreferrer");
        }
        toast.error(
          apiData.portalNotificationQueued
            ? `SMS failed for ${student.parent_phone}. Opened WhatsApp fallback and queued parent-portal message.`
            : `SMS failed for ${student.parent_phone}. Opened WhatsApp fallback for manual send.`,
        );
      } else {
        toast.error(`SMS failed for ${student.parent_phone}`);
      }
    } catch (err) {
      logger.error("Error contacting parent for dropout risk:", err);
      toast.error(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setSendingSms(null);
    }
  };

  const fetchInterventionHistory = useCallback(async () => {
    if (!schoolId) return;
    try {
      if (isDemo) {
        setInterventionHistory([]);
        return;
      }
      const { data, error } = await supabase
        .from("dropout_interventions")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInterventionHistory(data || []);
    } catch (err) {
      logger.error("Error fetching intervention history:", err);
    }
  }, [schoolId, isDemo]);

  const handleMarkDropout = async () => {
    if (!showDropoutModal || !dropoutReason) {
      toast.error("Please provide a reason");
      return;
    }
    const student = students.find((s) => s.id === showDropoutModal);
    try {
      await updateStudent(showDropoutModal, {
        status: "dropped",
        dropout_reason: dropoutReason,
        dropout_date: new Date().toISOString().split("T")[0],
      });
      if (!isDemo && student) {
        await withTimeout(
          supabase.from("dropout_interventions").insert({
            school_id: schoolId,
            student_id: showDropoutModal,
            student_name: `${student.first_name} ${student.last_name}`,
            reason: dropoutReason,
            action_taken: dropoutActionTaken || "Marked as dropout",
          }),
          15000,
          timeoutFallback(),
        );
      }
      toast.success("Student marked as dropout");
      setShowDropoutModal(null);
      setDropoutReason("");
      setDropoutActionTaken("");
      if (isDemo) {
        setAtRiskStudents((prev) => prev.filter((s) => s.id !== showDropoutModal));
      } else {
        fetchAtRiskStudents();
        fetchInterventionHistory();
      }
    } catch (err) {
      toast.error("Failed to update student");
    }
  };

  const filteredAtRisk =
    dropoutClassFilter === "all" ? atRiskStudents : atRiskStudents.filter((s) => s.class_id === dropoutClassFilter);

  const atRiskCount = atRiskStudents.filter((s) => s.risk_level === "at_risk").length;
  const likelyDropoutCount = atRiskStudents.filter((s) => s.risk_level === "likely_dropout").length;

  return {
    atRiskStudents,
    loadingAtRisk,
    dropoutClassFilter,
    setDropoutClassFilter,
    showDropoutModal,
    setShowDropoutModal,
    dropoutReason,
    setDropoutReason,
    dropoutActionTaken,
    setDropoutActionTaken,
    interventionHistory,
    fetchInterventionHistory,
    sendingSms,
    filteredAtRisk,
    atRiskCount,
    likelyDropoutCount,
    fetchAtRiskStudents,
    handleContactParent,
    handleMarkDropout,
  };
}
