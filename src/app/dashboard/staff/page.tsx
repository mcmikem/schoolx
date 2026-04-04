"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/Card";
import { DEMO_STAFF, DemoStaff } from "@/lib/demo-data";
import { DEMO_SCHOOL_ID } from "@/lib/demo-data";

interface StaffMember {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  role: string;
  subject?: string;
  is_active: boolean;
  hire_date?: string;
  salary?: number;
}

const ROLE_DESCRIPTIONS: Record<string, { desc: string; icon: string }> = {
  teacher: {
    desc: "Teach classes, enter grades, take attendance",
    icon: "menu_book",
  },
  dean_of_studies: {
    desc: "Manage academics, exams, timetables, reports",
    icon: "school",
  },
  bursar: {
    desc: "Collect fees, manage payments, financial reports",
    icon: "payments",
  },
  secretary: {
    desc: "Manage office, visitors, messages, notices",
    icon: "admin_panel_settings",
  },
  dorm_master: {
    desc: "Manage dormitories, night checks, student welfare",
    icon: "bed",
  },
  school_admin: {
    desc: "Full access to all school management features",
    icon: "admin_panel_settings",
  },
  headmaster: {
    desc: "Complete school management with all privileges",
    icon: "verified",
  },
};

export default function StaffPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    role: "teacher",
    subject: "",
  });
  const [newStaff, setNewStaff] = useState({
    full_name: "",
    phone: "",
    email: "",
    role: "teacher",
    password: "",
    subject: "",
  });
  const [activeTab, setActiveTab] = useState("all");

  const fetchStaff = useCallback(async () => {
    if (isDemo) {
      setStaff(DEMO_STAFF as unknown as StaffMember[]);
      setLoading(false);
      return;
    }
    if (!school?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("school_id", school.id)
        .order("full_name");
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id, isDemo]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isDemo) {
      const newId = `demo-staff-${Date.now()}`;
      const newMember = {
        id: newId,
        school_id: DEMO_SCHOOL_ID,
        full_name: newStaff.full_name,
        phone: newStaff.phone.replace(/[^0-9]/g, ""),
        email:
          newStaff.email ||
          `${newStaff.full_name.toLowerCase().replace(/\s/g, ".")}@stmarys.edu.ug`,
        role: newStaff.role,
        subject: newStaff.subject || "General",
        gender: "M",
        status: "active",
        hire_date: new Date().toISOString().split("T")[0],
        salary: 500000,
        is_active: true,
      };
      setStaff((prev) => [newMember as unknown as StaffMember, ...prev]);
      toast.success("Staff member added (Demo Mode)");
      setShowAddModal(false);
      setNewStaff({
        full_name: "",
        phone: "",
        email: "",
        role: "teacher",
        password: "",
        subject: "",
      });
      return;
    }

    if (!school?.id) return;

    try {
      setSaving(true);

      const normalizedPhone = newStaff.phone.replace(/[^0-9]/g, "");

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: school.id,
          fullName: newStaff.full_name,
          phone: normalizedPhone,
          password: newStaff.password,
          role: newStaff.role,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to add staff");
      }

      toast.success("Staff member added");
      setShowAddModal(false);
      setNewStaff({
        full_name: "",
        phone: "",
        email: "",
        role: "teacher",
        password: "",
        subject: "",
      });
      fetchStaff();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add staff";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      setStaff(
        staff.map((s) =>
          s.id === id ? { ...s, is_active: !currentStatus } : s,
        ),
      );
      toast.success(currentStatus ? "Staff deactivated" : "Staff activated");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update";
      toast.error(errorMessage);
    }
  };

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member);
    setEditForm({
      full_name: member.full_name || "",
      phone: member.phone || "",
      email: member.email || "",
      role: member.role || "teacher",
      subject: member.subject || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("users")
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone.replace(/[^0-9]/g, ""),
          role: editForm.role,
        })
        .eq("id", editingStaff.id);
      if (error) throw error;
      setStaff(
        staff.map((s) =>
          s.id === editingStaff.id ? { ...s, ...editForm } : s,
        ),
      );
      toast.success("Staff member updated");
      setShowEditModal(false);
      setEditingStaff(null);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update staff";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    try {
      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) throw error;
      setStaff(staff.filter((s) => s.id !== id));
      toast.success("Staff member deleted");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete staff";
      toast.error(errorMessage);
    }
  };

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { bg: string; text: string }> = {
      teacher: { bg: "bg-green-100", text: "text-green-700" },
      school_admin: { bg: "bg-blue-100", text: "text-blue-700" },
      dos: { bg: "bg-orange-100", text: "text-orange-700" },
      bursar: { bg: "bg-red-100", text: "text-red-700" },
    };
    const style = roles[role] || roles.teacher;
    return (
      <span
        className={`px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}
      >
        {role === "dos"
          ? "Director of Studies"
          : role === "school_admin"
            ? "Administrator"
            : role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const filteredStaff =
    activeTab === "all"
      ? staff
      : activeTab === "active"
        ? staff.filter((s) => s.is_active)
        : staff.filter((s) => !s.is_active);

  const tabs = [
    { id: "all", label: "All Staff", count: staff.length },
    {
      id: "active",
      label: "Active",
      count: staff.filter((s) => s.is_active).length,
    },
    {
      id: "inactive",
      label: "Inactive",
      count: staff.filter((s) => !s.is_active).length,
    },
  ];

  function renderContent() {
    if (loading) {
      return <TableSkeleton rows={5} />;
    }

    if (filteredStaff.length === 0) {
      return (
        <EmptyState
          icon="groups"
          title="No staff members"
          description="Add teachers and other staff to your school"
          action={{ label: "Add Staff", onClick: () => setShowAddModal(true) }}
        />
      );
    }

    return (
      <div className="space-y-3">
        {filteredStaff.map((member) => (
          <Card key={member.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-700 font-semibold">
                    {member.full_name?.charAt(0) || "U"}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {member.full_name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {getRoleBadge(member.role)}
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${member.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {member.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {member.phone}
                    {member.subject && (
                      <span className="ml-2">• {member.subject}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(member)}
                >
                  <MaterialIcon icon="edit" className="text-sm" />
                  Edit
                </Button>
                <Button
                  variant={member.is_active ? "secondary" : "primary"}
                  size="sm"
                  onClick={() => toggleStatus(member.id, member.is_active)}
                >
                  {member.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteStaff(member.id)}
                >
                  <MaterialIcon icon="delete" className="text-sm" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Staff Directory"
        subtitle={`${staff.length} staff members`}
        actions={
          <Button onClick={() => setShowAddModal(true)}>
            <MaterialIcon icon="person_add" className="text-lg" />
            Add Staff
          </Button>
        }
      />

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      <TabPanel activeTab={activeTab} tabId="all">
        {renderContent()}
      </TabPanel>
      <TabPanel activeTab={activeTab} tabId="active">
        {renderContent()}
      </TabPanel>
      <TabPanel activeTab={activeTab} tabId="inactive">
        {renderContent()}
      </TabPanel>

      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">
                  Add Staff Member
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 text-[#5c6670] hover:text-[#191c1d]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newStaff.full_name}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, full_name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="0700000000"
                  value={newStaff.phone}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, phone: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Role
                </label>
                <select
                  value={newStaff.role}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, role: e.target.value })
                  }
                  className="input"
                >
                  <option value="teacher">Teacher</option>
                  <option value="dean_of_studies">
                    Director of Studies (DOS)
                  </option>
                  <option value="bursar">Bursar</option>
                  <option value="secretary">Secretary</option>
                  <option value="dorm_master">Dorm Master/Mistress</option>
                </select>
                <p className="text-xs text-[#5c6670] mt-1">
                  {ROLE_DESCRIPTIONS[newStaff.role]?.desc}
                </p>
              </div>

              {newStaff.role === "teacher" && (
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                    Subject
                  </label>
                  <select
                    value={newStaff.subject}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, subject: e.target.value })
                    }
                    className="input"
                  >
                    <option value="">Select subject</option>
                    <option value="English">English</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">Science</option>
                    <option value="Social Studies">Social Studies</option>
                    <option value="Religious Education">
                      Religious Education
                    </option>
                    <option value="Creative Arts">Creative Arts</option>
                    <option value="Physical Education">
                      Physical Education
                    </option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Email (optional)
                </label>
                <input
                  type="email"
                  placeholder="teacher@school.edu.ug"
                  value={newStaff.email}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, email: e.target.value })
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={newStaff.password}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, password: e.target.value })
                  }
                  className="input"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary flex-1"
                >
                  {saving ? "Adding..." : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingStaff && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">
                  Edit Staff Member
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 text-[#5c6670] hover:text-[#191c1d]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateStaff} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, full_name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="0700000000"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                  className="input"
                >
                  <option value="teacher">Teacher</option>
                  <option value="school_admin">Administrator</option>
                  <option value="dos">Director of Studies</option>
                  <option value="bursar">Bursar</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary flex-1"
                >
                  {saving ? "Updating..." : "Update Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
