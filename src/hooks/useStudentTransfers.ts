import { useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { DEMO_CLASSES } from "@/lib/demo-data";
import { logger } from "@/lib/logger";
import type { StudentWithClass } from "@/lib/hooks/students";
import type { CreateStudentInput } from "@/types";

const TRANSFER_REASONS = [
  "Family relocation",
  "School closure",
  "Better opportunity",
  "Fee constraints",
  "Disciplinary",
  "Academic reasons",
  "Other",
];

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTransferStudentNumber(date = new Date()) {
  const stamp = getLocalDateString(date).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TRF-${stamp}-${suffix}`;
}

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
  students: StudentWithClass[],
  isDemo: boolean,
  createStudent: (data: CreateStudentInput) => Promise<unknown>,
  updateStudent: (id: string, data: Partial<CreateStudentInput>) => Promise<unknown>,
  toast: { success: (msg: string) => void; error: (msg: string) => void },
  school?: { name?: string | null; district?: string | null; phone?: string | null; email?: string | null } | null,
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
    transfer_date: getLocalDateString(),
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
              DEMO_CLASSES.find((c) => c.id === student.class_id)?.name ||
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
        .from("student_transfers")
        .select("*, students!student_id(first_name, last_name, student_number, gender, admission_date, created_at, classes(name))")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const records: TransferOutRecord[] = (data || []).map((t: any) => {
        const s = t.students || {} as any;
        return {
          id: t.id,
          student_id: t.student_id,
          transfer_to: t.next_school || t.previous_school || "Unknown",
          reason: t.reason || "",
          transfer_date: t.transfer_date || "",
          student_name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Unknown",
          class_name: s.classes?.name || "-",
          student_number: s.student_number || "",
          gender: s.gender || "",
          admission_date: s.admission_date || s.created_at?.split("T")[0] || "",
        };
      });
      setTransferHistory(records);
    } catch (err) {
      logger.error("Error fetching transfer history:", err);
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
      const studentNumber = buildTransferStudentNumber();
      const newStudentId = await createStudent({
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
      if (!isDemo) {
        await supabase.from("student_transfers").insert({
          student_id: typeof newStudentId === "object" && "id" in (newStudentId || {}) ? (newStudentId as any).id : newStudentId,
          school_id: schoolId,
          transfer_type: "in",
          previous_school: transferInForm.previous_school,
          reason: transferInForm.reason,
          transfer_date: new Date().toISOString().split("T")[0],
          status: "completed",
        });
      }
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
      if (!isDemo) {
        await supabase.from("student_transfers").insert({
          student_id: transferOutForm.student_id,
          school_id: schoolId,
          transfer_type: "out",
          next_school: transferOutForm.transfer_to,
          reason: transferOutForm.reason,
          transfer_date: transferOutForm.transfer_date,
          status: "completed",
        });
      }
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
        transfer_date: getLocalDateString(),
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
    if (!transferPrintRef.current || !printData) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Transfer Letter - ${printData.student_name}</title>
      <style>
        @page { margin: 20mm 15mm; }
        body { font-family: 'Georgia', 'Times New Roman', serif; padding: 0; margin: 0; color: #1a1a1a; background: #fff; }
        .letter-wrapper { max-width: 800px; margin: 0 auto; padding: 40px; }
        .letterhead { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; }
        .letterhead .school-logo { width: 80px; height: 80px; border: 2px solid #1e3a5f; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; font-size: 10px; color: #1e3a5f; }
        .letterhead h1 { margin: 0; font-size: 24px; color: #1e3a5f; letter-spacing: 1px; }
        .letterhead .sub { margin: 4px 0; font-size: 13px; color: #555; }
        .letterhead .motto { font-size: 12px; color: #888; font-style: italic; margin-top: 6px; }
        .ref-line { text-align: right; font-size: 12px; color: #666; margin: 16px 0; }
        .title { text-align: center; font-size: 18px; font-weight: 700; margin: 24px 0; text-transform: uppercase; letter-spacing: 3px; color: #1e3a5f; }
        .content { line-height: 1.9; font-size: 14px; }
        .content p { margin: 10px 0; }
        .field { font-weight: 700; color: #000; }
        .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .info-table td { padding: 6px 12px; border: 1px solid #ddd; font-size: 13px; }
        .info-table td:first-child { font-weight: 600; background: #f9f9f9; width: 180px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 60px; gap: 40px; }
        .sig-block { text-align: center; flex: 1; }
        .sig-line { border-top: 2px solid #333; margin-top: 60px; padding-top: 8px; font-size: 13px; font-weight: 600; }
        .stamp-area { width: 110px; height: 110px; border: 2px dashed #1e3a5f; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #1e3a5f; margin: 0 auto 8px; text-transform: uppercase; letter-spacing: 1px; }
        .footer { text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
        @media print { body { padding: 0; } .stamp-area { border: 2px dashed #1e3a5f; } }
      </style>
      </head><body>
      <div class="letter-wrapper">
        <div class="letterhead">
          <div class="school-logo">School<br/>Seal</div>
          <h1>${school?.name || "School Name"}</h1>
          <div class="sub">${school?.district ? `${school.district} District` : ""} ${school?.phone ? `| Tel: ${school.phone}` : ""}</div>
          <div class="sub">${school?.email || ""}</div>
          <div class="motto">"Education for Excellence"</div>
        </div>
        <div class="ref-line">Ref: TRF/${printData.student_number || "XXXX"}/${new Date().getFullYear()}</div>
        <div class="title">TRANSFER LETTER</div>
        <div class="content">
          <p>Date: <span class="field">${new Date().toLocaleDateString("en-UG", { year: "numeric", month: "long", day: "numeric" })}</span></p>
          <p>&nbsp;</p>
          <p>To Whom It May Concern,</p>
          <p>&nbsp;</p>
          <p>This is to certify that <span class="field">${printData.student_name}</span> (${printData.gender === "M" ? "Male" : "Female"}) was a bonafide student at <span class="field">${school?.name || "our school"}</span>.</p>
          <p>&nbsp;</p>
          <p><strong>Student Particulars:</strong></p>
          <table class="info-table">
            <tr><td>Full Name</td><td>${printData.student_name}</td></tr>
            <tr><td>Student Number</td><td>${printData.student_number || "N/A"}</td></tr>
            <tr><td>Gender</td><td>${printData.gender === "M" ? "Male" : "Female"}</td></tr>
            <tr><td>Class/Grade</td><td>${printData.class_name}</td></tr>
            <tr><td>Period of Study</td><td>${printData.admission_date ? new Date(printData.admission_date).toLocaleDateString("en-UG", { year: "numeric", month: "long" }) : "N/A"} - ${new Date(printData.transfer_date).toLocaleDateString("en-UG", { year: "numeric", month: "long", day: "numeric" })}</td></tr>
            <tr><td>Reason for Transfer</td><td>${printData.reason || "Not specified"}</td></tr>
            <tr><td>Transferring To</td><td>${printData.transfer_to}</td></tr>
          </table>
          <p>&nbsp;</p>
          <p>During their time with us, the student conducted themselves well and participated fully in school activities. We have no reservations about their character and wish them success in their future academic endeavors.</p>
          <p>&nbsp;</p>
          <p>Yours faithfully,</p>
        </div>
        <div class="signatures">
          <div class="sig-block">
            <div class="stamp-area">School<br/>Stamp</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">Head Teacher</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">Class Teacher</div>
          </div>
        </div>
        <div class="footer">
          ${school?.name || "School Name"} &mdash; Official Transfer Document
        </div>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
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
