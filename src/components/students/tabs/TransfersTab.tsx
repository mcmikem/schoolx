"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

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

const TRANSFER_REASONS = [
  "Family relocation",
  "School closure",
  "Better opportunity",
  "Fee constraints",
  "Disciplinary",
  "Academic reasons",
  "Other",
];

interface TransfersTabProps {
  school: any;
  user: any;
  isDemo: boolean;
  students: any[];
  classes: any[];
  createStudent: (data: any) => Promise<any>;
  updateStudent: (id: string, data: any) => Promise<any>;
}

export default function TransfersTab({
  school,
  user,
  isDemo,
  students,
  classes,
  createStudent,
  updateStudent,
}: TransfersTabProps) {
  const toast = useToast();
  const transferPrintRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"in" | "out">("in");
  const [showTransferInModal, setShowTransferInModal] = useState(false);
  const [showTransferOutModal, setShowTransferOutModal] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferOutRecord[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      if (isDemo) {
        const records: TransferOutRecord[] = students
          .filter((student) => student.status === "transferred")
          .map((student) => ({
            id: student.id,
            student_id: student.id,
            transfer_to: student.transfer_to || "Unknown",
            reason: student.transfer_reason || "",
            transfer_date: student.dropout_date || student.created_at?.split("T")[0] || "",
            student_name: `${student.first_name} ${student.last_name}`,
            class_name: student.classes?.name || "-",
            student_number: student.student_number || "",
            gender: student.gender || "",
            admission_date: student.admission_date || student.created_at?.split("T")[0] || "",
          }));
        setTransferHistory(records);
        return;
      }
      const { data, error } = await supabase
        .from("students")
        .select("*, classes(name)")
        .eq("school_id", school.id)
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
      setLoading(false);
    }
  }, [school?.id, students, isDemo]);

  useEffect(() => {
    fetchTransferHistory();
  }, [fetchTransferHistory]);

  const handleTransferIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferInForm.class_id) {
      toast.error("Please select a class");
      return;
    }
    setTransferSaving(true);
    try {
      const studentCount = students.length + 1;
      const studentNumber = `TRF${String(studentCount).padStart(5, "0")}`;
      await createStudent({
        ...transferInForm,
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
    } catch (err: any) {
      toast.error(err.message || "Failed to add transfer student");
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
        admission_date: student.admission_date || student.created_at?.split("T")[0] || "",
      };

      setPrintData(record);
      toast.success("Student transferred out successfully");
      setShowTransferOutModal(false);
      setTransferOutForm({
        student_id: "",
        transfer_to: "",
        reason: "",
        transfer_date: new Date().toISOString().split("T")[0],
      });
      fetchTransferHistory();
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
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
      </style>
      </head><body>${content}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const activeStudents = students.filter((s) => s.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex p-1 bg-[var(--surface-container)] rounded-xl">
          <button
            onClick={() => setActiveTab("in")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "in" ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--t3)] hover:text-[var(--t2)]"}`}
          >
            Transfer In
          </button>
          <button
            onClick={() => setActiveTab("out")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "out" ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--t3)] hover:text-[var(--t2)]"}`}
          >
            Transfer Out History
          </button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => setShowTransferInModal(true)}
          >
            <MaterialIcon icon="login" />
            New Transfer In
          </Button>
          <Button
            variant="ghost"
            className="flex-1 sm:flex-none"
            onClick={() => setShowTransferOutModal(true)}
          >
            <MaterialIcon icon="logout" />
            Transfer Out
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : activeTab === "in" ? (
        <Card className="p-8 text-center bg-[var(--surface-container-lowest)] border-dashed border-2">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <MaterialIcon className="text-3xl text-blue-600">login</MaterialIcon>
            </div>
            <h3 className="text-xl font-bold mb-2">Admit Transfer Student</h3>
            <p className="text-[var(--t3)] mb-6">
              Use this to register students joining from other schools. They will be added to your registry with "Transfer In" history.
            </p>
            <Button onClick={() => setShowTransferInModal(true)}>
              Get Started
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold">Recent Transfers Out</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Student</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Destination</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Reason</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Date</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[var(--t3)]">No transfer records found</td>
                  </tr>
                ) : (
                  transferHistory.map((record) => (
                    <tr key={record.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-container-low)]">
                      <td className="p-4">
                        <div className="font-bold">{record.student_name}</div>
                        <div className="text-xs text-[var(--t3)]">{record.class_name} • {record.student_number}</div>
                      </td>
                      <td className="p-4 text-sm">{record.transfer_to}</td>
                      <td className="p-4 text-sm">{record.reason}</td>
                      <td className="p-4 text-sm">{record.transfer_date ? new Date(record.transfer_date).toLocaleDateString() : "-"}</td>
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

      {/* Transfer In Modal */}
      {showTransferInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTransferInModal(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--surface)] z-10">
              <h2 className="text-lg font-bold">New Transfer In</h2>
              <button onClick={() => setShowTransferInModal(false)} className="p-1 hover:bg-[var(--surface-container)] rounded-lg">
                <MaterialIcon className="text-xl text-[var(--t3)]">close</MaterialIcon>
              </button>
            </div>
            <form onSubmit={handleTransferIn} className="p-5">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">First Name</label>
                  <input type="text" value={transferInForm.first_name} onChange={(e) => setTransferInForm({ ...transferInForm, first_name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Last Name</label>
                  <input type="text" value={transferInForm.last_name} onChange={(e) => setTransferInForm({ ...transferInForm, last_name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Gender</label>
                  <select value={transferInForm.gender} onChange={(e) => setTransferInForm({ ...transferInForm, gender: e.target.value as "M" | "F" })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Date of Birth</label>
                  <input type="date" value={transferInForm.date_of_birth} onChange={(e) => setTransferInForm({ ...transferInForm, date_of_birth: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Previous School</label>
                <input type="text" value={transferInForm.previous_school} onChange={(e) => setTransferInForm({ ...transferInForm, previous_school: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required placeholder="Name of previous school" />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Transfer Reason</label>
                <select value={transferInForm.reason} onChange={(e) => setTransferInForm({ ...transferInForm, reason: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required>
                  <option value="">Select reason</option>
                  {TRANSFER_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Assign to Class</label>
                <select value={transferInForm.class_id} onChange={(e) => setTransferInForm({ ...transferInForm, class_id: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required>
                  <option value="">Select class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Parent Name</label>
                <input type="text" value={transferInForm.parent_name} onChange={(e) => setTransferInForm({ ...transferInForm, parent_name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Parent Phone</label>
                  <input type="tel" value={transferInForm.parent_phone} onChange={(e) => setTransferInForm({ ...transferInForm, parent_phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required placeholder="0700000000" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Alt. Phone</label>
                  <input type="tel" value={transferInForm.parent_phone2} onChange={(e) => setTransferInForm({ ...transferInForm, parent_phone2: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" placeholder="0700000000" />
                </div>
              </div>
              <div className="flex gap-3 sticky bottom-0 bg-[var(--surface)] pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setShowTransferInModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={transferSaving}>{transferSaving ? "Adding..." : "Add Student"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Out Modal */}
      {showTransferOutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTransferOutModal(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold">Transfer Student Out</h2>
              <button onClick={() => setShowTransferOutModal(false)} className="p-1 hover:bg-[var(--surface-container)] rounded-lg">
                <MaterialIcon className="text-xl text-[var(--t3)]">close</MaterialIcon>
              </button>
            </div>
            <form onSubmit={handleTransferOut} className="p-5">
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Select Student</label>
                <select value={transferOutForm.student_id} onChange={(e) => setTransferOutForm({ ...transferOutForm, student_id: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required>
                  <option value="">Select student...</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} - {s.classes?.name || "No class"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Transferring To</label>
                <input type="text" value={transferOutForm.transfer_to} onChange={(e) => setTransferOutForm({ ...transferOutForm, transfer_to: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required placeholder="Name of new school" />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Reason</label>
                <select value={transferOutForm.reason} onChange={(e) => setTransferOutForm({ ...transferOutForm, reason: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required>
                  <option value="">Select reason</option>
                  {TRANSFER_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Transfer Date</label>
                <input type="date" value={transferOutForm.transfer_date} onChange={(e) => setTransferOutForm({ ...transferOutForm, transfer_date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setShowTransferOutModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={transferSaving}>{transferSaving ? "Processing..." : "Transfer Out"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Print Area */}
      <div className="hidden">
        <div ref={transferPrintRef}>
          <div className="letterhead">
            <h1>{school?.name || "School Name"}</h1>
            <p>{school?.district ? `${school.district} District` : ""} {school?.phone ? `| Tel: ${school.phone}` : ""}</p>
          </div>
          <div className="title">TRANSFER LETTER</div>
          <div className="content">
            <p>Date: <span className="field">{new Date().toLocaleDateString("en-UG", { year: "numeric", month: "long", day: "numeric" })}</span></p>
            <p>&nbsp;</p>
            <p>To Whom It May Concern,</p>
            <p>&nbsp;</p>
            <p>This is to certify that <span className="field">{printData?.student_name}</span> was a student at <span className="field">{school?.name || "our school"}</span>.</p>
            <p>&nbsp;</p>
            <p><strong>Student Details:</strong></p>
            <p>Student Number: <span className="field">{printData?.student_number || "N/A"}</span></p>
            <p>Class: <span className="field">{printData?.class_name}</span></p>
            <p>Reason for Transfer: <span className="field">{printData?.reason || "Not specified"}</span></p>
            <p>Transferring To: <span className="field">{printData?.transfer_to}</span></p>
            <p>&nbsp;</p>
            <p>We wish the student all the best in their future academic endeavors.</p>
            <p>&nbsp;</p>
            <p>Yours faithfully,</p>
          </div>
          <div className="signatures">
            <div className="sig-block"><div className="stamp-area">School Stamp</div></div>
            <div className="sig-block"><div className="sig-line">Head Teacher's Signature</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
