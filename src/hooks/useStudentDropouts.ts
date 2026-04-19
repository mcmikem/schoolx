import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { DEMO_ATTENDANCE } from "@/lib/demo-data";

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
  students: any[],
  isDemo: boolean,
  updateStudent: (id: string, data: any) => Promise<any>,
  toast: { success: (msg: string) => void; error: (msg: string) => void },
  user?: { id?: string; full_name?: string } | null,
) {
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [loadingAtRisk, setLoadingAtRisk] = useState(true);
  const [dropoutClassFilter, setDropoutClassFilter] = useState("all");
  const [showDropoutModal, setShowDropoutModal] = useState<string | null>(null);
  const [dropoutReason, setDropoutReason] = useState("");
  const [sendingSms, setSendingSms] = useState<string | null>(null);

  const fetchAtRiskStudents = useCallback(async () => {
    if (!schoolId) return;
    setLoadingAtRisk(true);
    try {
      if (isDemo) {
        const activeStudents = students.filter((s) => s.status === "active");
        const demoRiskList: AtRiskStudent[] = activeStudents
          .slice(0, 4)
          .map((student, index) => ({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            gender: student.gender,
            student_number: student.student_number || "",
            class_id: student.class_id,
            class_name: student.classes?.name || "-",
            parent_name: student.parent_name || "",
            parent_phone: student.parent_phone || "",
            consecutive_absent:
              index === 0 ? 32 : index === 1 ? 21 : index === 2 ? 16 : 14,
            last_attendance_date:
              index === 0
                ? null
                : DEMO_ATTENDANCE.find(
                    (r) => r.student_id === student.id && r.status !== "absent",
                  )?.date || null,
            risk_level: index === 0 ? "likely_dropout" : "at_risk",
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
      attendanceData?.forEach((record: any) => {
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
            consecutive_absent: 30,
            last_attendance_date: null,
            risk_level: "likely_dropout",
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
      setAtRiskStudents(
        atRiskList.sort((a, b) => b.consecutive_absent - a.consecutive_absent),
      );
    } catch (err) {
      console.error("Error computing at-risk students:", err);
    } finally {
      setLoadingAtRisk(false);
    }
  }, [schoolId, students, isDemo]);

  const handleContactParent = async (student: AtRiskStudent) => {
    if (!student.parent_phone) {
      toast.error("No parent phone number on file");
      return;
    }
    setSendingSms(student.id);
    try {
      const message = `Dear ${student.parent_name || "Parent/Guardian"}, your child ${student.first_name} ${student.last_name} has been absent from school for ${student.consecutive_absent} consecutive days. Please contact the school urgently.`;
      if (isDemo) {
        toast.success(`SMS queued to ${student.parent_phone}`);
        return;
      }
      await supabase.from("messages").insert({
        school_id: schoolId,
        recipient_type: "individual",
        phone: student.parent_phone,
        message,
        status: "pending",
        sent_by: user?.id,
      });
      toast.success(`SMS queued to ${student.parent_phone}`);
    } catch (err) {
      toast.error("Failed to send SMS");
    } finally {
      setSendingSms(null);
    }
  };

  const handleMarkDropout = async () => {
    if (!showDropoutModal || !dropoutReason) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await updateStudent(showDropoutModal, {
        status: "dropped",
        dropout_reason: dropoutReason,
        dropout_date: new Date().toISOString().split("T")[0],
      });
      toast.success("Student marked as dropout");
      setShowDropoutModal(null);
      setDropoutReason("");
      if (isDemo) {
        setAtRiskStudents((prev) =>
          prev.filter((s) => s.id !== showDropoutModal),
        );
      } else {
        fetchAtRiskStudents();
      }
    } catch (err) {
      toast.error("Failed to update student");
    }
  };

  const filteredAtRisk =
    dropoutClassFilter === "all"
      ? atRiskStudents
      : atRiskStudents.filter((s) => s.class_id === dropoutClassFilter);

  const atRiskCount = atRiskStudents.filter(
    (s) => s.risk_level === "at_risk",
  ).length;
  const likelyDropoutCount = atRiskStudents.filter(
    (s) => s.risk_level === "likely_dropout",
  ).length;

  return {
    atRiskStudents,
    loadingAtRisk,
    dropoutClassFilter,
    setDropoutClassFilter,
    showDropoutModal,
    setShowDropoutModal,
    dropoutReason,
    setDropoutReason,
    sendingSms,
    filteredAtRisk,
    atRiskCount,
    likelyDropoutCount,
    fetchAtRiskStudents,
    handleContactParent,
    handleMarkDropout,
  };
}
