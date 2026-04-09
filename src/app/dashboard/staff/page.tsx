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
import { Card, CardBody } from "@/components/ui/Card";
import { DEMO_STAFF, DEMO_SCHOOL_ID } from "@/lib/demo-data";
import { useStaffReviews } from "@/lib/hooks";
import { StaffReview } from "@/types";
import { PageGuidance } from "@/components/PageGuidance";
import SmartAdvisor from "@/components/dashboard/SmartAdvisor";

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

interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: string;
  substitute_suggestion: string | null;
  created_at: string;
  users?: { full_name: string };
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

const LEAVE_TYPES = [
  { value: "sick", label: "Sick Leave" },
  { value: "personal", label: "Personal" },
  { value: "bereavement", label: "Bereavement" },
  { value: "maternity", label: "Maternity" },
  { value: "study", label: "Study Leave" },
  { value: "other", label: "Other" },
];

export default function StaffHubPage() {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();
  const [activeMainTab, setActiveMainTab] = useState("directory");

  const mainTabs = [
    { id: "directory", label: "Directory", icon: "groups" },
    { id: "reviews", label: "Reviews", icon: "rate_review" },
    { id: "leave", label: "Leave", icon: "event_busy" },
  ];

  return (
    <div className="content">
      <div className="relative overflow-hidden rounded-[var(--r2)] p-6 bg-motif border border-[var(--border)] mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="ph-title truncate !text-3xl">Staff Hub</div>
            <div className="ph-sub truncate !text-sm">
              {school?.name} • Personnel Management & Academic Supervision
            </div>
          </div>
          <div className="ph-actions">
            <button
               onClick={() => setActiveMainTab("directory")}
               className="btn btn-ghost shadow-sm"
            >
              <MaterialIcon icon="groups" style={{ fontSize: "16px" }} />
              <span>Staff Directory</span>
            </button>
            <button
              onClick={() => setActiveMainTab("leave")}
              className="btn btn-primary shadow-md"
            >
              <MaterialIcon icon="event_busy" style={{ fontSize: "16px" }} />
              <span>Leave Requests</span>
            </button>
          </div>
        </div>
      </div>

      <SmartAdvisor stats={{}} collectionRate={0} attendanceRate={92} role="dean" />

      <Tabs
        tabs={mainTabs}
        activeTab={activeMainTab}
        onChange={setActiveMainTab}
        className="mb-6"
      />

      <TabPanel activeTab={activeMainTab} tabId="directory">
        <DirectoryTab school={school} isDemo={isDemo} toast={toast} />
      </TabPanel>
      <TabPanel activeTab={activeMainTab} tabId="reviews">
        <ReviewsTab school={school} user={user} toast={toast} />
      </TabPanel>
      <TabPanel activeTab={activeMainTab} tabId="leave">
        <LeaveTab school={school} user={user} toast={toast} />
      </TabPanel>
    </div>
  );
}

function DirectoryTab({
  school,
  isDemo,
  toast,
}: {
  school: { id: string } | null | undefined;
  isDemo: boolean;
  toast: ReturnType<typeof useToast>;
}) {
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--on-surface)]">
            Staff Directory
          </h2>
          <p className="text-sm text-[var(--t3)]">
            {staff.length} staff members
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <MaterialIcon icon="person_add" className="text-lg" />
          Add Staff
        </Button>
      </div>

      <PageGuidance
        title="How to Manage Staff"
        tips={[
          {
            icon: "person_add",
            text: "Add Staff: Register teachers and non-teaching staff",
          },
          {
            icon: "school",
            text: "Assign Subjects: Link teachers to subjects they teach",
          },
          {
            icon: "assignment_ind",
            text: "Class Teacher: Assign a teacher to lead each class",
          },
          {
            icon: "event_note",
            text: "Leave Requests: Staff can request time off here",
          },
          {
            icon: "rate_review",
            text: "Performance: Use Reviews tab to track teacher performance",
          },
        ]}
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

function ReviewsTab({
  school,
  user,
  toast,
}: {
  school: { id: string } | null | undefined;
  user: { id: string } | null | undefined;
  toast: ReturnType<typeof useToast>;
}) {
  const { reviews, loading, submitReview } = useStaffReviews(school?.id);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const handleReviewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const reviewData = {
      school_id: school!.id,
      staff_id: selectedStaffId,
      reviewer_id: user!.id,
      rating: Number(formData.get("rating")),
      strengths: formData.get("strengths") as string,
      areas_for_improvement: formData.get("areas_for_improvement") as string,
      goals: formData.get("goals") as string,
      comments: formData.get("comments") as string,
      status: "shared" as const,
      review_date: new Date().toISOString().split("T")[0],
    };

    const result = await submitReview(reviewData);
    if (result.success) {
      toast.success("Performance review submitted and shared with staff");
      setShowReviewModal(false);
    } else {
      toast.error("Failed to submit review");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--on-surface)]">
            Staff Performance
          </h2>
          <p className="text-sm text-[var(--t3)]">
            Conduct and manage staff performance reviews
          </p>
        </div>
        <Button onClick={() => setShowReviewModal(true)}>
          <MaterialIcon icon="add_notes" />
          New Review
        </Button>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="rate_review"
              title="No performance reviews"
              description="Start conducting performance reviews for your staff"
              action={{
                label: "New Review",
                onClick: () => setShowReviewModal(true),
              }}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review: StaffReview) => (
            <Card key={review.id} className="flex flex-col">
              <CardBody className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] flex items-center justify-center text-[var(--primary)] font-bold">
                      {review.staff?.full_name?.[0] || "S"}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--on-surface)]">
                        {review.staff?.full_name || "Demo Staff"}
                      </p>
                      <p className="text-xs text-[var(--t3)]">
                        {review.review_date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[var(--amber)]">
                    {[...Array(5)].map((_, i) => (
                      <MaterialIcon
                        key={i}
                        icon="star"
                        className={`text-lg ${i < review.rating ? "fill-current" : "opacity-20"}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4 flex-grow">
                  <div>
                    <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-1">
                      Strengths
                    </p>
                    <p className="text-sm text-[var(--t2)] line-clamp-2">
                      {review.strengths}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--navy)] uppercase tracking-wider mb-1">
                      Upcoming Goals
                    </p>
                    <p className="text-sm text-[var(--t2)] line-clamp-2">
                      {review.goals}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-full bg-[var(--green-soft)] text-[var(--green)] font-medium capitalize">
                    {review.status}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[var(--on-surface)]">
                  New Performance Review
                </h2>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">
                    Select Staff Member
                  </label>
                  <select
                    required
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  >
                    <option value="">Choose staff...</option>
                    <option value="1">John Doe (Teacher)</option>
                    <option value="2">Jane Smith (Head of Dept)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">
                    Overall Rating (1-5)
                  </label>
                  <div className="flex items-center gap-2 h-[48px]">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          const input = document.getElementById(
                            "rating-input",
                          ) as HTMLInputElement;
                          if (input) input.value = num.toString();
                        }}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <MaterialIcon
                          icon="star"
                          className="text-2xl text-[var(--amber)]"
                        />
                      </button>
                    ))}
                    <input
                      type="hidden"
                      name="rating"
                      id="rating-input"
                      defaultValue="5"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">
                    Key Strengths
                  </label>
                  <textarea
                    name="strengths"
                    required
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    placeholder="What is this staff member doing exceptionally well?"
                  ></textarea>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">
                    Areas for Improvement
                  </label>
                  <textarea
                    name="areas_for_improvement"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    placeholder="Where can they grow?"
                  ></textarea>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">
                    Development Goals
                  </label>
                  <textarea
                    name="goals"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    placeholder="Objectives for the next period..."
                  ></textarea>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-xl font-bold transition-all shadow-lg shadow-[var(--primary)]/20 mt-4"
              >
                Submit & Share Review
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaveTab({
  school,
  user,
  toast,
}: {
  school: { id: string } | null | undefined;
  user: { id: string; role?: string } | null | undefined;
  toast: ReturnType<typeof useToast>;
}) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<
    | "all"
    | "needs_approval"
    | "pending"
    | "dos_approved"
    | "approved"
    | "rejected"
  >("all");
  const [form, setForm] = useState({
    leave_type: "sick",
    start_date: "",
    end_date: "",
    reason: "",
    substitute_suggestion: "",
  });

  const isDOS = user?.role === "dean_of_studies";
  const isHM = user?.role === "headmaster" || user?.role === "school_admin";
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, users!staff_id(full_name)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch {
      console.error("Error fetching leave requests");
    } finally {
      setLoading(false);
    }
  }, [school?.id]);

  useEffect(() => {
    if (school?.id) fetchRequests();
  }, [school?.id, fetchRequests]);

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id || !user?.id) return;

    setSaving(true);
    try {
      const days = calcDays(form.start_date, form.end_date);

      const { data, error } = await supabase
        .from("leave_requests")
        .insert({
          school_id: school.id,
          staff_id: user.id,
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date,
          days_count: days,
          reason: form.reason,
          substitute_suggestion: form.substitute_suggestion || null,
          status: "pending",
        })
        .select("*, users!staff_id(full_name)")
        .single();

      if (error) throw error;

      setRequests((prev) => [data, ...prev]);
      toast.success("Leave request submitted");
      setShowModal(false);
      setForm({
        leave_type: "sick",
        start_date: "",
        end_date: "",
        reason: "",
        substitute_suggestion: "",
      });
    } catch {
      toast.error("Failed to submit leave request");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> =
      {
        pending: {
          bg: "bg-[var(--amber-soft)]",
          text: "text-[var(--amber)]",
          label: "Pending",
        },
        dos_approved: {
          bg: "bg-[var(--navy-soft)]",
          text: "text-[var(--navy)]",
          label: "DOS Approved",
        },
        approved: {
          bg: "bg-[var(--green-soft)]",
          text: "text-[var(--green)]",
          label: "HM Approved",
        },
        rejected: {
          bg: "bg-[var(--red-soft)]",
          text: "text-[var(--red)]",
          label: "Rejected",
        },
      };
    const s = styles[status] || styles.pending;
    return (
      <span
        className={`px-2 py-1 rounded-lg text-xs font-medium ${s.bg} ${s.text}`}
      >
        {s.label}
      </span>
    );
  };

  const getLeaveTypeLabel = (type: string) => {
    return LEAVE_TYPES.find((t) => t.value === type)?.label || type;
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const dosApprovedCount = requests.filter(
    (r) => r.status === "dos_approved",
  ).length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;
  const needsApprovalCount = isHM
    ? requests.filter(
        (r) => r.status === "pending" || r.status === "dos_approved",
      ).length
    : isDOS
      ? pendingCount
      : 0;

  const tabs = [
    { id: "all", label: "All", count: requests.length },
    ...(isHM || isDOS
      ? [
          {
            id: "needs_approval",
            label: "Needs Approval",
            count: needsApprovalCount,
          },
        ]
      : []),
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "dos_approved", label: "DOS Approved", count: dosApprovedCount },
    { id: "approved", label: "HM Approved", count: approvedCount },
    { id: "rejected", label: "Rejected", count: rejectedCount },
  ];

  const filteredRequests =
    filter === "all"
      ? requests
      : filter === "needs_approval"
        ? requests.filter((r) =>
            isHM
              ? r.status === "pending" || r.status === "dos_approved"
              : r.status === "pending",
          )
        : requests.filter((r) => r.status === filter);

  const handleApproval = async (
    requestId: string,
    action: "approved" | "rejected",
  ) => {
    if (!user?.id || !school?.id) return;
    setProcessing(requestId);
    try {
      const request = requests.find((r) => r.id === requestId);
      if (!request) return;

      let newStatus: string;
      if (action === "rejected") {
        newStatus = "rejected";
      } else if (isDOS) {
        if (request.days_count <= 3) {
          newStatus = "approved";
        } else {
          newStatus = "dos_approved";
        }
      } else {
        newStatus = "approved";
      }

      await supabase
        .from("leave_requests")
        .update({
          status: newStatus,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      await supabase.from("leave_approvals").insert({
        school_id: school.id,
        leave_request_id: requestId,
        approver_id: user.id,
        action: newStatus,
        comments: null,
      });

      toast.success(`Leave ${action === "approved" ? "approved" : "rejected"}`);
      await fetchRequests();
    } catch {
      toast.error("Failed to process leave request");
    } finally {
      setProcessing(null);
    }
  };

  const canApprove = (req: LeaveRequest) => {
    if (req.status === "approved" || req.status === "rejected") return false;
    if (isHM && (req.status === "pending" || req.status === "dos_approved"))
      return true;
    if (isDOS && req.status === "pending") return true;
    return false;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--on-surface)]">
            {isHM || isDOS ? "Leave Management" : "My Leave Requests"}
          </h2>
          <p className="text-sm text-[var(--t3)]">
            {isHM || isDOS
              ? "Manage staff leave requests and approvals"
              : "Submit and track your leave applications"}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <MaterialIcon icon="add" />
          Request Leave
        </Button>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={filter}
        onChange={(id) => setFilter(id as typeof filter)}
        className="mb-6"
      />

      {loading ? (
        <Card>
          <CardBody>
            <TableSkeleton rows={3} />
          </CardBody>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="event_busy"
              title="No leave requests"
              description="Submit a request when you need time off"
              action={{
                label: "Request Leave",
                onClick: () => setShowModal(true),
              }}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <Card key={req.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--on-surface)]">
                        {getLeaveTypeLabel(req.leave_type)}
                      </span>
                      {getStatusBadge(req.status)}
                    </div>
                    <div className="text-sm text-[var(--t3)] mt-1">
                      {new Date(req.start_date).toLocaleDateString()} –{" "}
                      {new Date(req.end_date).toLocaleDateString()} (
                      {req.days_count} day{req.days_count !== 1 ? "s" : ""})
                    </div>
                    {req.reason && (
                      <div className="text-sm text-[var(--t3)] mt-1">
                        {req.reason}
                      </div>
                    )}
                    {req.substitute_suggestion && (
                      <div className="text-sm text-[var(--t3)] mt-1">
                        <MaterialIcon
                          icon="person"
                          className="text-xs align-middle"
                        />{" "}
                        Suggested substitute: {req.substitute_suggestion}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[var(--t3)]">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>
                {req.status === "pending" && req.days_count > 3 && (
                  <div className="mt-2 text-xs text-[var(--t3)] bg-[var(--surface-container)] rounded-lg p-2">
                    Requires DOS approval → HM final approval
                  </div>
                )}
                {req.status === "pending" && req.days_count <= 3 && (
                  <div className="mt-2 text-xs text-[var(--t3)] bg-[var(--surface-container)] rounded-lg p-2">
                    DOS can approve directly (≤ 3 days)
                  </div>
                )}
                {req.status === "dos_approved" && (
                  <div className="mt-2 text-xs text-[var(--t3)] bg-[var(--navy-soft)] rounded-lg p-2">
                    Awaiting Headmaster final approval
                  </div>
                )}
                {canApprove(req) && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproval(req.id, "approved")}
                      disabled={processing === req.id}
                      className="bg-[var(--green)] text-white hover:bg-[var(--green)]/90"
                    >
                      <MaterialIcon icon="check" className="text-sm" />
                      {processing === req.id ? "Processing..." : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleApproval(req.id, "rejected")}
                      disabled={processing === req.id}
                      className="text-[var(--red)] border-[var(--red)]/30 hover:bg-[var(--red-soft)]"
                    >
                      <MaterialIcon icon="close" className="text-sm" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md"
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                  Request Leave
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </Button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Leave Type
                </label>
                <select
                  value={form.leave_type}
                  onChange={(e) =>
                    setForm({ ...form, leave_type: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  required
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    required
                  />
                </div>
              </div>

              {form.start_date && form.end_date && (
                <div className="text-sm text-[var(--t3)] bg-[var(--surface-container)] rounded-lg p-2">
                  {calcDays(form.start_date, form.end_date)} day
                  {calcDays(form.start_date, form.end_date) !== 1 ? "s" : ""}
                  {calcDays(form.start_date, form.end_date) > 3
                    ? " — Requires DOS → HM approval"
                    : " — DOS can approve directly"}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Reason
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 min-h-[80px]"
                  required
                  placeholder="Brief reason for your leave..."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Substitute Suggestion (Optional)
                </label>
                <input
                  type="text"
                  value={form.substitute_suggestion}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      substitute_suggestion: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  placeholder="Name of suggested substitute teacher"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  loading={saving}
                >
                  {saving ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
