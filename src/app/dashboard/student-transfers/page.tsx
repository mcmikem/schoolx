"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStudents, useClasses } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { DEMO_CLASSES } from "@/lib/demo-data";

import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Tabs } from "@/components/ui/Tabs";

const TRANSFER_REASONS = [
  "Family relocation",
  "School closure",
  "Better opportunity",
  "Fee constraints",
  "Disciplinary",
  "Academic reasons",
  "Other",
];

type Tab = "in" | "out";

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

export default function StudentTransfersPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const { students, createStudent, updateStudent } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const printRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("in");
  const [showTransferInModal, setShowTransferInModal] = useState(false);
  const [showTransferOutModal, setShowTransferOutModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferOutRecord[]>(
    [],
  );
  const [loadingHistory, setLoadingHistory] = useState(true);
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

  const fetchTransferHistory = useCallback(async () => {
    if (!school?.id) return;
    setLoadingHistory(true);
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
              student.dropout_date ||
              (student as { updated_at?: string }).updated_at?.split("T")[0] ||
              "",
            student_name: `${student.first_name} ${student.last_name}`,
            class_name:
              student.classes?.name ||
              DEMO_CLASSES.find(
                (classItem) => classItem.id === student.class_id,
              )?.name ||
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
        .eq("school_id", school.id)
        .eq("status", "transferred")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const records: TransferOutRecord[] = (data || []).map((s: any) => ({
        id: s.id,
        student_id: s.id,
        transfer_to: s.transfer_to || "Unknown",
        reason: s.transfer_reason || "",
        transfer_date: s.dropout_date || s.updated_at?.split("T")[0] || "",
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
      setLoadingHistory(false);
    }
  }, [school?.id, students, isDemo]);

  useEffect(() => {
    if (school?.id) fetchTransferHistory();
  }, [school?.id, fetchTransferHistory]);

  const activeStudents = students.filter((s) => s.status === "active");

  const transferredIn = students.filter(
    (s) => s.status === "active" && s.transfer_from,
  );

  const handleTransferIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id) return;
    if (!transferInForm.class_id) {
      toast.error("Please assign a class");
      return;
    }

    setSaving(true);
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
      setSaving(false);
    }
  };

  const handleTransferOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferOutForm.student_id) {
      toast.error("Please select a student");
      return;
    }

    setSaving(true);
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
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const content = printRef.current.innerHTML;
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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Student Transfers"
        subtitle="Manage students transferring in and out of the school"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <MaterialIcon className="text-blue-600">group</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Active
            </span>
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {activeStudents.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <MaterialIcon className="text-green-600">login</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Transferred In
            </span>
          </div>
          <div className="text-3xl font-bold text-green-600">
            {transferredInCount}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <MaterialIcon className="text-red-600">logout</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Transferred Out
            </span>
          </div>
          <div className="text-3xl font-bold text-red-600">
            {transferredOutCount}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <MaterialIcon className="text-gray-500">swap_horiz</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Total Moves
            </span>
          </div>
          <div className="text-3xl font-bold text-[var(--on-surface)]">
            {transferredInCount + transferredOutCount}
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: "in", label: "Transfer In" },
          { id: "out", label: "Transfer Out" },
        ]}
        activeTab={activeTab}
        onChange={(v) => setActiveTab(v as Tab)}
        className="mb-6"
      />

      {activeTab === "in" && (
        <Card>
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--on-surface)]">
              Students Transferred In
            </h3>
            <Button onClick={() => setShowTransferInModal(true)}>
              <MaterialIcon icon="person_add" className="text-base" />
              New Transfer
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Student
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Student No.
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Class
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Previous School
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Reason
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Parent Phone
                  </th>
                </tr>
              </thead>
              <tbody>
                {transferredIn.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-8 text-[var(--t3)]"
                    >
                      No transfer-in students recorded yet
                    </td>
                  </tr>
                ) : (
                  transferredIn.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-[var(--border)]"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{
                              background:
                                student.gender === "M"
                                  ? "var(--navy)"
                                  : "var(--red)",
                            }}
                          >
                            {student.first_name?.charAt(0)}
                            {student.last_name?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">
                              {student.first_name} {student.last_name}
                            </div>
                            <div className="text-xs text-[var(--t3)]">
                              {student.gender === "M" ? "Male" : "Female"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-mono">
                        {student.student_number || "-"}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">
                          {student.classes?.name || "-"}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        {student.transfer_from || "-"}
                      </td>
                      <td className="p-4 text-sm">
                        {student.transfer_reason || "-"}
                      </td>
                      <td className="p-4 text-sm font-mono">
                        {student.parent_phone || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "out" && (
        <Card>
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--on-surface)]">
              Students Transferred Out
            </h3>
            <Button onClick={() => setShowTransferOutModal(true)}>
              <MaterialIcon icon="swap_horiz" className="text-base" />
              Transfer Out
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Student
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Student No.
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Former Class
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Transferred To
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Reason
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Date
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-8 text-[var(--t3)]"
                    >
                      No transfer-out records yet
                    </td>
                  </tr>
                ) : (
                  transferHistory.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-[var(--border)]"
                    >
                      <td className="p-4 font-semibold text-sm">
                        {record.student_name}
                      </td>
                      <td className="p-4 text-sm font-mono">
                        {record.student_number || "-"}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">
                          {record.class_name}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{record.transfer_to}</td>
                      <td className="p-4 text-sm">{record.reason || "-"}</td>
                      <td className="p-4 text-sm">
                        {record.transfer_date
                          ? new Date(record.transfer_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setPrintData(record);
                            setTimeout(handlePrint, 200);
                          }}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <MaterialIcon icon="print" className="text-sm" />
                          Letter
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showTransferInModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTransferInModal(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--on-surface)]">
                New Transfer In
              </h2>
              <button
                onClick={() => setShowTransferInModal(false)}
                className="p-1 hover:bg-[var(--surface-container)] rounded-lg"
              >
                <MaterialIcon className="text-xl text-[var(--t3)]">
                  close
                </MaterialIcon>
              </button>
            </div>
            <form onSubmit={handleTransferIn} className="p-5">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label
                    htmlFor="transfer-in-first-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                  >
                    First Name
                  </label>
                  <input
                    id="transfer-in-first-name"
                    type="text"
                    value={transferInForm.first_name}
                    onChange={(e) =>
                      setTransferInForm({
                        ...transferInForm,
                        first_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="transfer-in-last-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                  >
                    Last Name
                  </label>
                  <input
                    id="transfer-in-last-name"
                    type="text"
                    value={transferInForm.last_name}
                    onChange={(e) =>
                      setTransferInForm({
                        ...transferInForm,
                        last_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label
                    htmlFor="transfer-in-gender"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                  >
                    Gender
                  </label>
                  <select
                    id="transfer-in-gender"
                    value={transferInForm.gender}
                    onChange={(e) =>
                      setTransferInForm({
                        ...transferInForm,
                        gender: e.target.value as "M" | "F",
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="transfer-in-dob"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                  >
                    Date of Birth
                  </label>
                  <input
                    id="transfer-in-dob"
                    type="date"
                    value={transferInForm.date_of_birth}
                    onChange={(e) =>
                      setTransferInForm({
                        ...transferInForm,
                        date_of_birth: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label
                  htmlFor="transfer-in-previous-school"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                >
                  Previous School
                </label>
                <input
                  id="transfer-in-previous-school"
                  type="text"
                  value={transferInForm.previous_school}
                  onChange={(e) =>
                    setTransferInForm({
                      ...transferInForm,
                      previous_school: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                  placeholder="Name of previous school"
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="transfer-in-reason"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                >
                  Transfer Reason
                </label>
                <select
                  id="transfer-in-reason"
                  value={transferInForm.reason}
                  onChange={(e) =>
                    setTransferInForm({
                      ...transferInForm,
                      reason: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                >
                  <option value="">Select reason</option>
                  {TRANSFER_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label
                  htmlFor="transfer-in-class"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                >
                  Assign to Class
                </label>
                <select
                  id="transfer-in-class"
                  value={transferInForm.class_id}
                  onChange={(e) =>
                    setTransferInForm({
                      ...transferInForm,
                      class_id: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label
                  htmlFor="transfer-in-parent-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                >
                  Parent/Guardian Name
                </label>
                <input
                  id="transfer-in-parent-name"
                  type="text"
                  value={transferInForm.parent_name}
                  onChange={(e) =>
                    setTransferInForm({
                      ...transferInForm,
                      parent_name: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label
                    htmlFor="transfer-in-parent-phone"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                  >
                    Parent Phone
                  </label>
                  <input
                    id="transfer-in-parent-phone"
                    type="tel"
                    placeholder="0700000000"
                    value={transferInForm.parent_phone}
                    onChange={(e) =>
                      setTransferInForm({
                        ...transferInForm,
                        parent_phone: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="transfer-in-parent-phone-2"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                  >
                    Alt. Phone
                  </label>
                  <input
                    id="transfer-in-parent-phone-2"
                    type="tel"
                    placeholder="0700000000"
                    value={transferInForm.parent_phone2}
                    onChange={(e) =>
                      setTransferInForm({
                        ...transferInForm,
                        parent_phone2: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowTransferInModal(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" disabled={saving}>
                  {saving ? "Adding..." : "Add Transfer Student"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferOutModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTransferOutModal(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--on-surface)]">
                Transfer Student Out
              </h2>
              <button
                onClick={() => setShowTransferOutModal(false)}
                className="p-1 hover:bg-[var(--surface-container)] rounded-lg"
              >
                <MaterialIcon className="text-xl text-[var(--t3)]">
                  close
                </MaterialIcon>
              </button>
            </div>
            <form onSubmit={handleTransferOut} className="p-5">
              <div className="mb-4">
                <label
                  htmlFor="transfer-out-student"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                >
                  Select Student
                </label>
                {activeStudents.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                    No active students
                  </div>
                ) : (
                  <select
                    id="transfer-out-student"
                    value={transferOutForm.student_id}
                    onChange={(e) =>
                      setTransferOutForm({
                        ...transferOutForm,
                        student_id: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    required
                  >
                    <option value="">Select student...</option>
                    {activeStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} -{" "}
                        {s.classes?.name || "No class"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mb-4">
                <label
                  htmlFor="transfer-out-school"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                >
                  Transferring To (School Name)
                </label>
                <input
                  id="transfer-out-school"
                  type="text"
                  value={transferOutForm.transfer_to}
                  onChange={(e) =>
                    setTransferOutForm({
                      ...transferOutForm,
                      transfer_to: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                  placeholder="Name of new school"
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="transfer-out-reason"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                >
                  Reason
                </label>
                <select
                  id="transfer-out-reason"
                  value={transferOutForm.reason}
                  onChange={(e) =>
                    setTransferOutForm({
                      ...transferOutForm,
                      reason: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                >
                  <option value="">Select reason</option>
                  {TRANSFER_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-5">
                <label
                  htmlFor="transfer-out-date"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2"
                >
                  Transfer Date
                </label>
                <input
                  id="transfer-out-date"
                  type="date"
                  value={transferOutForm.transfer_date}
                  onChange={(e) =>
                    setTransferOutForm({
                      ...transferOutForm,
                      transfer_date: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowTransferOutModal(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" disabled={saving}>
                  {saving ? "Processing..." : "Transfer Out"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printData && (
        <div className="hidden">
          <div ref={printRef}>
            <div className="letterhead">
              <h1>{school?.name || "School Name"}</h1>
              <p>
                {school?.district ? `${school.district} District` : ""}{" "}
                {school?.phone ? `| Tel: ${school.phone}` : ""}
              </p>
              <p>{school?.email || ""}</p>
            </div>
            <div className="title">TRANSFER LETTER</div>
            <div className="content">
              <p>
                Date:{" "}
                <span className="field">
                  {new Date().toLocaleDateString("en-UG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
              <p>&nbsp;</p>
              <p>To Whom It May Concern,</p>
              <p>&nbsp;</p>
              <p>
                This is to certify that{" "}
                <span className="field">{printData.student_name}</span> (
                {printData.gender === "M" ? "Male" : "Female"}) was a student at{" "}
                <span className="field">{school?.name || "our school"}</span>.
              </p>
              <p>&nbsp;</p>
              <p>
                <strong>Student Details:</strong>
              </p>
              <p>
                Student Number:{" "}
                <span className="field">
                  {printData.student_number || "N/A"}
                </span>
              </p>
              <p>
                Class: <span className="field">{printData.class_name}</span>
              </p>
              <p>
                Period of Study:{" "}
                <span className="field">
                  {printData.admission_date
                    ? new Date(printData.admission_date).toLocaleDateString(
                        "en-UG",
                        { year: "numeric", month: "long" },
                      )
                    : "N/A"}{" "}
                  -{" "}
                  {new Date(printData.transfer_date).toLocaleDateString(
                    "en-UG",
                    { year: "numeric", month: "long", day: "numeric" },
                  )}
                </span>
              </p>
              <p>
                Reason for Transfer:{" "}
                <span className="field">
                  {printData.reason || "Not specified"}
                </span>
              </p>
              <p>
                Transferring To:{" "}
                <span className="field">{printData.transfer_to}</span>
              </p>
              <p>&nbsp;</p>
              <p>
                We wish the student all the best in their future academic
                endeavors.
              </p>
              <p>&nbsp;</p>
              <p>Yours faithfully,</p>
            </div>
            <div className="signatures">
              <div className="sig-block">
                <div className="stamp-area">School Stamp</div>
              </div>
              <div className="sig-block">
                <div className="sig-line">Head Teacher&apos;s Signature</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
