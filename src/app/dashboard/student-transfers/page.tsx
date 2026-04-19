"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { useStudents, useClasses } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface Transfer {
  id: string;
  student_id: string;
  transfer_type: "in" | "out";
  previous_school?: string;
  next_school?: string;
  transfer_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "completed";
  created_at: string;
  students?: { first_name: string; last_name: string; classes?: { name: string } };
}

export default function StudentTransfersPage() {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const [activeTab, setActiveTab] = useState<"in" | "out">("in");
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTransferOutModal, setShowTransferOutModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [formIn, setFormIn] = useState({
    firstName: "",
    lastName: "",
    gender: "M" as "M" | "F",
    previousSchool: "",
    reason: "Family relocation",
    classId: "",
    parentName: "",
    parentPhone: "",
  });

  const [formOut, setFormOut] = useState({
    studentId: "",
    nextSchool: "",
    reason: "Better opportunity",
  });

  const fetchTransfers = useCallback(async () => {
    if (!school?.id) { setLoading(false); return; }
    if (isDemo) {
      setTransfers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("student_transfers")
        .select("*, students(first_name, last_name, classes(name))")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTransfers((data as Transfer[]) || []);
    } catch {
      toastRef.current.error("Failed to load transfer records");
    } finally {
      setLoading(false);
    }
  }, [school?.id, isDemo]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleTransferIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIn.firstName || !formIn.lastName || !formIn.parentName || !formIn.parentPhone) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!formIn.classId) {
      toast.error("Please select a class");
      return;
    }
    setSubmitting(true);
    try {
      if (isDemo) {
        const transferRecord: Transfer = {
          id: `demo-transfer-in-${Date.now()}`,
          student_id: `demo-transfer-student-${Date.now()}`,
          transfer_type: "in",
          previous_school: formIn.previousSchool,
          transfer_date: new Date().toISOString().split("T")[0],
          reason: formIn.reason,
          status: "completed",
          created_at: new Date().toISOString(),
          students: {
            first_name: formIn.firstName,
            last_name: formIn.lastName,
            classes: {
              name: classes.find((classItem: any) => classItem.id === formIn.classId)?.name || "",
            },
          },
        };

        setTransfers((prev) => [transferRecord, ...prev]);
        toast.success("Transfer in recorded. Student added.");
        setShowModal(false);
        setFormIn({ firstName: "", lastName: "", gender: "M", previousSchool: "", reason: "Family relocation", classId: "", parentName: "", parentPhone: "" });
        return;
      }

      // 1. Generate a student number
      const studentNum = `TR-${Date.now().toString().slice(-6)}`;

      // 2. Create the student record
      const { data: newStudent, error: studentErr } = await supabase
        .from("students")
        .insert({
          school_id: school!.id,
          first_name: formIn.firstName,
          last_name: formIn.lastName,
          gender: formIn.gender,
          parent_name: formIn.parentName,
          parent_phone: formIn.parentPhone,
          class_id: formIn.classId,
          student_number: studentNum,
          status: "active",
        })
        .select("id")
        .single();
      if (studentErr) throw studentErr;

      // 3. Create the transfer record
      const { error: transferErr } = await supabase
        .from("student_transfers")
        .insert({
          school_id: school!.id,
          student_id: newStudent.id,
          transfer_type: "in",
          previous_school: formIn.previousSchool,
          transfer_date: new Date().toISOString().split("T")[0],
          reason: formIn.reason,
          status: "completed",
        });
      if (transferErr) throw transferErr;

      toast.success("Transfer in recorded. Student added.");
      setShowModal(false);
      setFormIn({ firstName: "", lastName: "", gender: "M", previousSchool: "", reason: "Family relocation", classId: "", parentName: "", parentPhone: "" });
      fetchTransfers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record transfer in");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOut.studentId || !formOut.nextSchool) {
      toast.error("Please select a student and enter destination school");
      return;
    }
    setSubmitting(true);
    try {
      if (isDemo) {
        const student = students.find((item: any) => item.id === formOut.studentId);
        const transferRecord: Transfer = {
          id: `demo-transfer-out-${Date.now()}`,
          student_id: formOut.studentId,
          transfer_type: "out",
          next_school: formOut.nextSchool,
          transfer_date: new Date().toISOString().split("T")[0],
          reason: formOut.reason,
          status: "completed",
          created_at: new Date().toISOString(),
          students: {
            first_name: student?.first_name || "",
            last_name: student?.last_name || "",
            classes: {
              name: (student as any)?.classes?.name || classes.find((classItem: any) => classItem.id === student?.class_id)?.name || "",
            },
          },
        };

        setTransfers((prev) => [transferRecord, ...prev]);
        toast.success("Student transferred out");
        setShowTransferOutModal(false);
        setFormOut({ studentId: "", nextSchool: "", reason: "Better opportunity" });
        return;
      }

      // Create transfer record
      const { error: transferErr } = await supabase
        .from("student_transfers")
        .insert({
          school_id: school!.id,
          student_id: formOut.studentId,
          transfer_type: "out",
          next_school: formOut.nextSchool,
          transfer_date: new Date().toISOString().split("T")[0],
          reason: formOut.reason,
          status: "completed",
        });
      if (transferErr) throw transferErr;

      // Mark student as transferred
      await supabase
        .from("students")
        .update({ status: "transferred" })
        .eq("id", formOut.studentId);

      toast.success("Student transferred out");
      setShowTransferOutModal(false);
      setFormOut({ studentId: "", nextSchool: "", reason: "Better opportunity" });
      fetchTransfers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record transfer out");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = transfers.filter((t) => t.transfer_type === activeTab);

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Student Transfers"
        subtitle="Manage student transfers in and out"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowModal(true)}>
              <MaterialIcon icon="login" />
              Transfer In
            </Button>
            <Button variant="secondary" onClick={() => setShowTransferOutModal(true)}>
              <MaterialIcon icon="logout" />
              Transfer Out
            </Button>
          </div>
        }
      />

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {(["in", "out"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Transfer {tab === "in" ? "In" : "Out"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MaterialIcon icon="swap_horiz" className="text-4xl mx-auto mb-2" />
          <p>No {activeTab === "in" ? "transfers in" : "transfers out"} recorded</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => (
            <Card key={t.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {t.students?.first_name} {t.students?.last_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t.students?.classes?.name}
                      {t.transfer_type === "in" && t.previous_school && ` • From: ${t.previous_school}`}
                      {t.transfer_type === "out" && t.next_school && ` • To: ${t.next_school}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t.reason} • {t.transfer_date}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    t.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                    t.status === "completed" ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {t.status}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Transfer In Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">New Transfer In</h2>
            <form onSubmit={handleTransferIn}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="transfer-in-first-name" className="text-sm font-medium mb-1 block">First Name *</label>
                    <input id="transfer-in-first-name" type="text" value={formIn.firstName} onChange={(e) => setFormIn({ ...formIn, firstName: e.target.value })} className="input w-full" required />
                  </div>
                  <div>
                    <label htmlFor="transfer-in-last-name" className="text-sm font-medium mb-1 block">Last Name *</label>
                    <input id="transfer-in-last-name" type="text" value={formIn.lastName} onChange={(e) => setFormIn({ ...formIn, lastName: e.target.value })} className="input w-full" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="transfer-in-gender" className="text-sm font-medium mb-1 block">Gender *</label>
                    <select id="transfer-in-gender" value={formIn.gender} onChange={(e) => setFormIn({ ...formIn, gender: e.target.value as "M" | "F" })} className="input w-full">
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="transfer-in-class" className="text-sm font-medium mb-1 block">Class *</label>
                    <select id="transfer-in-class" value={formIn.classId} onChange={(e) => setFormIn({ ...formIn, classId: e.target.value })} className="input w-full" required>
                      <option value="">Select class</option>
                      {classes.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="transfer-in-previous-school" className="text-sm font-medium mb-1 block">Previous School</label>
                  <input id="transfer-in-previous-school" type="text" value={formIn.previousSchool} onChange={(e) => setFormIn({ ...formIn, previousSchool: e.target.value })} className="input w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="transfer-in-parent-name" className="text-sm font-medium mb-1 block">Parent Name *</label>
                    <input id="transfer-in-parent-name" type="text" value={formIn.parentName} onChange={(e) => setFormIn({ ...formIn, parentName: e.target.value })} className="input w-full" required />
                  </div>
                  <div>
                    <label htmlFor="transfer-in-parent-phone" className="text-sm font-medium mb-1 block">Parent Phone *</label>
                    <input id="transfer-in-parent-phone" type="tel" value={formIn.parentPhone} onChange={(e) => setFormIn({ ...formIn, parentPhone: e.target.value })} className="input w-full" required />
                  </div>
                </div>
                <div>
                  <label htmlFor="transfer-in-reason" className="text-sm font-medium mb-1 block">Reason</label>
                  <select id="transfer-in-reason" value={formIn.reason} onChange={(e) => setFormIn({ ...formIn, reason: e.target.value })} className="input w-full">
                    <option>Family relocation</option>
                    <option>Better opportunity</option>
                    <option>Academic reasons</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Saving..." : "Record Transfer In"}</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Out Modal */}
      {showTransferOutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Transfer Out</h2>
            <form onSubmit={handleTransferOut}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="transfer-out-student" className="text-sm font-medium mb-1 block">Select Student *</label>
                  <select id="transfer-out-student" value={formOut.studentId} onChange={(e) => setFormOut({ ...formOut, studentId: e.target.value })} className="input w-full" required>
                    <option value="">Select a student</option>
                    {students.filter((s: any) => s.status === "active").map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} — {s.classes?.name || ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="transfer-out-school" className="text-sm font-medium mb-1 block">Transferring To *</label>
                  <input id="transfer-out-school" type="text" value={formOut.nextSchool} onChange={(e) => setFormOut({ ...formOut, nextSchool: e.target.value })} className="input w-full" required placeholder="Destination school name" />
                </div>
                <div>
                  <label htmlFor="transfer-out-reason" className="text-sm font-medium mb-1 block">Reason</label>
                  <select id="transfer-out-reason" value={formOut.reason} onChange={(e) => setFormOut({ ...formOut, reason: e.target.value })} className="input w-full">
                    <option>Better opportunity</option>
                    <option>Family relocation</option>
                    <option>Academic reasons</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShowTransferOutModal(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Saving..." : "Transfer Out"}</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
