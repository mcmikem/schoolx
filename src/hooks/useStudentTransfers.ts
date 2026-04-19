import { useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { DEMO_CLASSES } from "@/lib/demo-data";

const TRANSFER_REASONS = [
  "Family relocation",
  "School closure",
  "Better opportunity",
  "Fee constraints",
  "Disciplinary",
  "Academic reasons",
  "Other",
];

type TransferTab = "in" | "out";

interface TransferOutRecord {
  id: string;
  student_id: string;
  transfer_to: string;
  reason: string;
  transfer_date: string;
  student_name: string;
  class_name: string;
  student_number: string;
  gender: string;
  admission_date: string;
}

export function useStudentTransfers(
  schoolId: string | undefined,
  students: any[],
  isDemo: boolean,
  createStudent: (data: any) => Promise<any>,
  updateStudent: (id: string, data: any) => Promise<any>,
  toast: { success: (msg: string) => void; error: (msg: string) => void },
) {
  const transferPrintRef = useRef<HTMLDivElement>(null);
  const [transferActiveTab, setTransferActiveTab] = useState<TransferTab>("in");
  const [showTransferInModal, setShowTransferInModal] = useState(false);
  const [showTransferOutModal, setShowTransferOutModal] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferOutRecord[]>([]);
  const [loadingTransferHistory, setLoadingTransferHistory] = useState(true);
  const [printData, setPrintData] = useState<TransferOutRecord | null>(null);

  const [transferInForm, setTransferInForm] = useState({
    first_name: "",
    last_name: "",
    gender: "M" as "M" | "F",
    date_of_birth: "",
    previous_school: "",
    reason: "",
    class_id: "",
    parent_name: "",
    parent_phone: "",
    parent_phone2: "",
  });

  const [transferOutForm, setTransferOutForm] = useState({
    student_id: "",
    transfer_to: "",
    reason: "",
    transfer_date: new Date().toISOString().split("T")[0],
  });

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === "active"),
    [students],
  );
  const transferredIn = useMemo(
    () => students.filter((s) => s.status === "active" && s.transfer_from),
    [students],
  );

  const fetchTransferHistory = useCallback(async () => {
    if (!schoolId) return;
    setLoadingTransferHistory(true);
    try {
      if (isDemo) {
        const records: TransferOutRecord[] = students
          .filter((student) => student.status === "transferred")
          .map((student) => ({
            id: student.id,
            student_id: student.id,
            transfer_to: student.transfer_to || "Unknown",
            reason: student.transfer_reason || "",
            transfer_date:
              student.dropout_date || student.created_at?.split("T")[0] || "",
            student_name: `${student.first_name} ${student.last_name}`,
            class_name:
              student.classes?.name ||
              DEMO_CLASSES.find((c: any) => c.id === student.class_id)?.name ||
              "-",
            student_number: student.student_number || "",
            gender: student.gender || "",
            admission_date:
              student.admission_date || student.created_at?.split("T")[0] || "",
          }));
        setTransferHistory(records);
        return;
      }
      const { data, error } = await supabase
        .from("students")
        .select("*, classes(name)")
        .eq("school_id", schoolId)
        .eq("status", "transferred")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const records: TransferOutRecord[] = (data || []).map((s: any) => ({
        id: s.id,
        student_id: s.id,
        transfer_to: s.transfer_to || "Unknown",
        reason: s.transfer_reason || "",
        transfer_date: s.dropout_date || s.created_at?.split("T")[0] || "",
        student_name: `${s.first_name} ${s.last_name}`,
        class_name: s.classes?.name || "-",
        student_number: s.student_number || "",
        gender: s.gender || "",
        admission_date: s.admission_date || s.created_at?.split("T")[0] || "",
      }));
      setTransferHistory(records);
    } catch (err) {
      console.error("Error fetching transfer history:", err);
    } finally {
      setLoadingTransferHistory(false);
    }
  }, [schoolId, students, isDemo]);

  const handleTransferIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    if (!transferInForm.class_id) {
      toast.error("Please assign a class");
      return;
    }
    setTransferSaving(true);
    try {
      const studentCount = students.length + 1;
      const studentNumber = `TRF${String(studentCount).padStart(5, "0")}`;
      await createStudent({
        first_name: transferInForm.first_name,
        last_name: transferInForm.last_name,
        gender: transferInForm.gender,
        date_of_birth: transferInForm.date_of_birth,
        parent_name: transferInForm.parent_name,
        parent_phone: transferInForm.parent_phone,
        parent_phone2: transferInForm.parent_phone2,
        class_id: transferInForm.class_id,
        student_number: studentNumber,
        status: "active",
        transfer_from: transferInForm.previous_school,
        transfer_reason: transferInForm.reason,
      });
      toast.success("Transfer-in student added successfully");
      setShowTransferInModal(false);
      setTransferInForm({
        first_name: "",
        last_name: "",
        gender: "M",
        date_of_birth: "",
        previous_school: "",
        reason: "",
        class_id: "",
        parent_name: "",
        parent_phone: "",
        parent_phone2: "",
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add transfer student";
      toast.error(errorMessage);
    } finally {
      setTransferSaving(false);
    }
  };

  const handleTransferOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferOutForm.student_id) {
      toast.error("Please select a student");
      return;
    }
    setTransferSaving(true);
    try {
      const student = students.find((s) => s.id === transferOutForm.student_id);
      if (!student) throw new Error("Student not found");
      await updateStudent(transferOutForm.student_id, {
        status: "transferred",
        transfer_to: transferOutForm.transfer_to,
        transfer_reason: transferOutForm.reason,
        dropout_date: transferOutForm.transfer_date,
      });
      const record: TransferOutRecord = {
        id: transferOutForm.student_id,
        student_id: transferOutForm.student_id,
        transfer_to: transferOutForm.transfer_to,
        reason: transferOutForm.reason,
        transfer_date: transferOutForm.transfer_date,
        student_name: `${student.first_name} ${student.last_name}`,
        class_name: student.classes?.name || "-",
        student_number: student.student_number || "",
        gender: student.gender || "",
        admission_date:
          student.admission_date || student.created_at?.split("T")[0] || "",
      };
      setPrintData(record);
      if (isDemo) {
        setTransferHistory((prev) => [
          record,
          ...prev.filter((entry) => entry.student_id !== record.student_id),
        ]);
      }
      toast.success("Student transferred out successfully");
      setShowTransferOutModal(false);
      setTransferOutForm({
        student_id: "",
        transfer_to: "",
        reason: "",
        transfer_date: new Date().toISOString().split("T")[0],
      });
      if (!isDemo) fetchTransferHistory();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Transfer failed";
      toast.error(errorMessage);
    } finally {
      setTransferSaving(false);
    }
  };

  const handlePrint = () => {
    if (!transferPrintRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const content = transferPrintRef.current.innerHTML;
    printWindow.document.write(`
      <html><head><title>Transfer Letter</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; }
        .letterhead { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; }
        .letterhead h1 { margin: 0; font-size: 22px; color: #1e3a5f; }
        .letterhead p { margin: 4px 0; font-size: 13px; color: #555; }
        .title { text-align: center; font-size: 18px; font-weight: 700; margin: 20px 0; text-decoration: underline; }
        .content { line-height: 1.8; font-size: 14px; }
        .content p { margin: 8px 0; }
        .field { font-weight: 600; }
        .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
        .sig-block { text-align: center; width: 200px; }
        .sig-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; font-size: 12px; }
        .stamp-area { width: 100px; height: 100px; border: 2px dashed #aaa; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; margin: 0 auto; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>${content}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const transferredOutCount = transferHistory.length;
  const transferredInCount = transferredIn.length;

  return {
    TRANSFER_REASONS,
    transferPrintRef,
    transferActiveTab,
    setTransferActiveTab,
    showTransferInModal,
    setShowTransferInModal,
    showTransferOutModal,
    setShowTransferOutModal,
    transferSaving,
    transferHistory,
    loadingTransferHistory,
    printData,
    setPrintData,
    transferInForm,
    setTransferInForm,
    transferOutForm,
    setTransferOutForm,
    activeStudents,
    transferredIn,
    transferredOutCount,
    transferredInCount,
    fetchTransferHistory,
    handleTransferIn,
    handleTransferOut,
    handlePrint,
  };
}
