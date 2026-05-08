"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { SendSMSModal } from "@/components/SendSMSModal";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import BulkImport from "@/components/BulkImport";
import { Button } from "@/components/ui/index";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import StudentSummaryPulse from "@/components/students/StudentSummaryPulse";
import Image from "next/image";

// Extracted Tabs
import RegistryTab from "@/components/students/tabs/RegistryTab";
import TransfersTab from "@/components/students/tabs/TransfersTab";
import DropoutsTab from "@/components/students/tabs/DropoutsTab";
import PromotionsTab from "@/components/students/tabs/PromotionsTab";

export default function StudentHubPage() {
  const { school, user, isDemo } = useAuth();
  const { academicYear } = useAcademic();
  const toast = useToast();
  const { students, loading, updateStudent, deleteStudent, createStudent } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);

  const [activeTab, setActiveTab] = useState("registry");
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [houses, setHouses] = useState<any[]>([]);
  const [smsTarget, setSmsTarget] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; studentId: string | null }>({ open: false, studentId: null });
  
  // Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!school?.id) return;
    supabase.from("houses").select("*").eq("school_id", school.id).order("name").then(({ data }) => setHouses(data || []));
  }, [school?.id]);

  const handleEdit = (student: any) => {
    setEditingStudent(student);
    setEditForm({
      first_name: student.first_name || "",
      last_name: student.last_name || "",
      gender: student.gender || "M",
      date_of_birth: student.date_of_birth || "",
      parent_name: student.parent_name || "",
      parent_phone: student.parent_phone || "",
      parent_phone2: student.parent_phone2 || "",
      class_id: student.class_id || "",
      student_number: student.student_number || "",
      ple_index_number: student.ple_index_number || "",
      opening_balance: student.opening_balance || "0",
      photo_url: student.photo_url || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSaving(true);
    try {
      await updateStudent(editingStudent.id, editForm);
      toast.success("Student updated successfully");
      setShowEditModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update student");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteConfirm.studentId) return;
    try {
      await deleteStudent(deleteConfirm.studentId);
      toast.success("Student removed successfully");
      setDeleteConfirm({ open: false, studentId: null });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete student");
    }
  };

  return (
    <PageErrorBoundary>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Student Hub"
          subtitle={`${students.length} students enrolled in ${academicYear}`}
          variant="premium"
          actions={
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowBulkImportModal(true)}>
                <MaterialIcon icon="cloud_upload" /> Import
              </Button>
              <Link href="/dashboard/students/add">
                <Button size="sm">
                  <MaterialIcon icon="add" /> New Student
                </Button>
              </Link>
            </div>
          }
        />

        <StudentSummaryPulse
          totalStudents={students.length}
          boysCount={students.filter((s) => s.gender === "M").length}
          girlsCount={students.filter((s) => s.gender === "F").length}
          atRiskCount={0}
        />

        <Tabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={[
            { id: "registry", label: "Registry", icon: "badge" },
            { id: "transfers", label: "Transfers", icon: "swap_horiz" },
            { id: "dropouts", label: "Risk & Dropouts", icon: "person_off" },
            { id: "promotion", label: "Promotions", icon: "upgrade" },
          ]}
        />

        <div className="mt-6">
          <TabPanel activeTab={activeTab} tabId="registry">
            <RegistryTab
              students={students}
              classes={classes}
              loading={loading}
              houses={houses}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteConfirm({ open: true, studentId: id })}
              onSendSMS={(s) => setSmsTarget(s)}
            />
          </TabPanel>

          <TabPanel activeTab={activeTab} tabId="transfers">
            <TransfersTab
              school={school}
              user={user}
              isDemo={isDemo}
              students={students}
              classes={classes}
              createStudent={createStudent}
              updateStudent={updateStudent}
            />
          </TabPanel>

          <TabPanel activeTab={activeTab} tabId="dropouts">
            <DropoutsTab
              school={school}
              user={user}
              isDemo={isDemo}
              students={students}
              classes={classes}
              updateStudent={updateStudent}
            />
          </TabPanel>

          <TabPanel activeTab={activeTab} tabId="promotion">
            <PromotionsTab
              school={school}
              user={user}
              isDemo={isDemo}
              students={students}
              classes={classes}
              academicYear={academicYear}
              updateStudent={updateStudent}
            />
          </TabPanel>
        </div>

        {/* Shared Modals */}
        {showEditModal && (
          <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Student" size="lg">
            <form onSubmit={handleUpdateStudent} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[var(--t3)]">First Name</label>
                  <input type="text" value={editForm.first_name} onChange={(e) => setEditForm({...editForm, first_name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[var(--t3)]">Last Name</label>
                  <input type="text" value={editForm.last_name} onChange={(e) => setEditForm({...editForm, last_name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[var(--t3)]">Gender</label>
                  <select value={editForm.gender} onChange={(e) => setEditForm({...editForm, gender: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[var(--t3)]">Class</label>
                  <select value={editForm.class_id} onChange={(e) => setEditForm({...editForm, class_id: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" required>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-[var(--t3)]">Parent Phone</label>
                <input type="tel" value={editForm.parent_phone} onChange={(e) => setEditForm({...editForm, parent_phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="ghost" className="flex-1" onClick={() => setShowEditModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={saving}>Save Changes</Button>
              </div>
            </form>
          </Modal>
        )}

        {showBulkImportModal && (
          <Modal isOpen={showBulkImportModal} onClose={() => setShowBulkImportModal(false)} title="Bulk Import Students" size="xl">
            <BulkImport onComplete={() => setShowBulkImportModal(false)} />
          </Modal>
        )}

        {smsTarget && (
          <SendSMSModal
            isOpen={!!smsTarget}
            onClose={() => setSmsTarget(null)}
            recipientType="individual"
            initialRecipient={smsTarget.parent_phone}
            studentName={`${smsTarget.first_name} ${smsTarget.last_name}`}
          />
        )}

        <ConfirmDialog
          isOpen={deleteConfirm.open}
          onClose={() => setDeleteConfirm({ open: false, studentId: null })}
          onConfirm={handleDeleteStudent}
          title="Delete Student?"
          message="This action cannot be undone. All records for this student will be permanently deleted."
          confirmText="Delete Student"
          variant="danger"
        />
      </div>
    </PageErrorBoundary>
  );
}
