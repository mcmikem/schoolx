"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import Image from "next/image";
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
import { DEMO_STAFF, DEMO_CLASSES, DEMO_SCHOOL_ID } from "@/lib/demo-data";
import { useStaff, useStaffReviews, useDashboardStats } from "@/lib/hooks";
import { logger } from "@/lib/logger";
import { StaffReview, School } from "@/types";
import { PageGuidance } from "@/components/PageGuidance";
import SmartAdvisor from "@/components/dashboard/SmartAdvisor";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { compressStudentPhoto, validateStudentPhoto } from "@/lib/student-photos";
import { QRCodeSVG } from "qrcode.react";

interface StaffMember {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  role: string;
  subject?: string;
  avatar_url?: string | null;
  is_active: boolean;
  hire_date?: string;
  salary?: number;
}

interface ClassOption {
  id: string;
  name: string;
}

interface SubjectOption {
  id: string;
  name: string;
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
  const { stats } = useDashboardStats(school?.id);
  const [activeMainTab, setActiveMainTab] = useState("directory");
  const attendanceRate = stats?.totalStudents > 0 ? Math.round((stats.presentToday / stats.totalStudents) * 100) : 0;

  const mainTabs = [
    { id: "directory", label: "Directory", icon: "groups" },
    { id: "reviews", label: "Reviews", icon: "rate_review" },
    { id: "leave", label: "Leave", icon: "event_busy" },
  ];

  return (
    <PageErrorBoundary>
      <div className="content">
        <div className="relative overflow-hidden rounded-[var(--r2)] p-6 bg-motif border border-[var(--border)] mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="ph-title truncate !text-3xl">Staff Hub</h1>
              <div className="ph-sub truncate !text-sm">
                {school?.name} • Personnel Management & Academic Supervision
              </div>
            </div>
            <div className="ph-actions">
              <button
                onClick={() => setActiveMainTab("directory")}
                aria-pressed={activeMainTab === "directory"}
                className={`shadow-sm ${activeMainTab === "directory" ? "btn btn-primary" : "btn btn-ghost"}`}
              >
                <MaterialIcon icon="groups" style={{ fontSize: "16px" }} />
                <span>Staff Directory</span>
              </button>
              <button
                onClick={() => setActiveMainTab("leave")}
                aria-pressed={activeMainTab === "leave"}
                className={`shadow-md ${activeMainTab === "leave" ? "btn btn-primary" : "btn btn-ghost"}`}
              >
                <MaterialIcon icon="event_busy" style={{ fontSize: "16px" }} />
                <span>Leave Requests</span>
              </button>
            </div>
          </div>
        </div>

        <SmartAdvisor stats={stats || {}} collectionRate={0} attendanceRate={attendanceRate} role="dean" />

        <Tabs tabs={mainTabs} activeTab={activeMainTab} onChange={setActiveMainTab} className="mb-6" />

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
    </PageErrorBoundary>
  );
}

function DirectoryTab({
  school,
  isDemo,
  toast,
}: {
  school: School | null | undefined;
  isDemo: boolean;
  toast: ReturnType<typeof useToast>;
}) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [idCardPreviewStaff, setIdCardPreviewStaff] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    role: "teacher",
    subject: "",
    avatar_url: "",
    class_teacher_for: "",
    subject_ids: [] as string[],
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [newStaff, setNewStaff] = useState({
    full_name: "",
    phone: "",
    email: "",
    role: "teacher",
    password: "",
    subject: "",
    avatar_url: "",
    class_teacher_for: "",
    subject_ids: [] as string[],
  });
  const [activeTab, setActiveTab] = useState("all");
  const [staffSearch, setStaffSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);
  const offset = (currentPage - 1) * itemsPerPage;

  const fetchStaff = useCallback(async () => {
    if (isDemo) {
      setStaff(DEMO_STAFF as unknown as StaffMember[]);
      setTotalCount(DEMO_STAFF.length);
      setLoading(false);
      return;
    }
    if (!school?.id) return;
    try {
      setLoading(true);
      const countResult = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("school_id", school.id);
      if (countResult.count !== null) {
        setTotalCount(countResult.count);
      }
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("school_id", school.id)
        .order("full_name")
        .range(offset, offset + itemsPerPage - 1);
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      logger.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id, isDemo, offset, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    async function fetchClassSubjectOptions() {
      if (isDemo) {
        setClasses(
          DEMO_CLASSES.map((cls) => ({
            id: cls.id,
            name: cls.name,
          })),
        );
        setSubjects([
          { id: "eng", name: "English" },
          { id: "math", name: "Mathematics" },
          { id: "sci", name: "Science" },
          { id: "sst", name: "Social Studies" },
          { id: "re", name: "Religious Education" },
          { id: "art", name: "Creative Arts" },
          { id: "pe", name: "Physical Education" },
        ]);
        return;
      }

      if (!school?.id) return;

      try {
        const [classesRes, subjectsRes] = await Promise.all([
          supabase.from("classes").select("id, name").eq("school_id", school.id).order("name"),
          supabase.from("subjects").select("id, name").eq("school_id", school.id).order("name"),
        ]);

        if (classesRes.data) {
          setClasses(classesRes.data);
        }
        if (subjectsRes.data) {
          setSubjects(subjectsRes.data);
        }
      } catch (err) {
        logger.error("Failed to load class/subject options:", err);
      }
    }

    fetchClassSubjectOptions();
  }, [school?.id, isDemo]);

  const uploadStaffAvatar = useCallback(
    async (file: File, staffId: string) => {
      if (isDemo) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(file);
        });
      }

      if (!school?.id) {
        throw new Error("School context missing. Reload and try again.");
      }

      validateStudentPhoto(file);
      const compressed = await compressStudentPhoto(file);
      const filePath = `${school.id}/staff/${staffId}.jpg`;

      let uploadResult = await supabase.storage.from("student-photos").upload(filePath, compressed, {
        upsert: true,
        contentType: "image/jpeg",
      });

      if (uploadResult.error && uploadResult.error.message.includes("bucket")) {
        await supabase.storage.createBucket("student-photos", {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        });

        uploadResult = await supabase.storage.from("student-photos").upload(filePath, compressed, {
          upsert: true,
          contentType: "image/jpeg",
        });
      }

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("student-photos").getPublicUrl(filePath);

      return publicUrl;
    },
    [school?.id, isDemo],
  );

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isDemo) {
      const newId = `demo-staff-${Date.now()}`;
      const newMember = {
        id: newId,
        school_id: DEMO_SCHOOL_ID,
        full_name: newStaff.full_name,
        phone: newStaff.phone.replace(/[^0-9]/g, ""),
        email: newStaff.email || `${newStaff.full_name.toLowerCase().replace(/\s/g, ".")}@stmarys.edu.ug`,
        role: newStaff.role,
        subject: newStaff.subject || "General",
        gender: "M",
        status: "active",
        hire_date: new Date().toISOString().split("T")[0],
        salary: 500000,
        is_active: true,
      };
      setStaff((prev) => [newMember as unknown as StaffMember, ...prev]);
      setTotalCount((prev) => prev + 1);
      toast.success("Staff member added (Demo Mode)");
      setShowAddModal(false);
      setNewStaff({
        full_name: "",
        phone: "",
        email: "",
        role: "teacher",
        password: "",
        subject: "",
        avatar_url: "",
        class_teacher_for: "",
        subject_ids: [],
      });
      return;
    }

    if (!school?.id) return;

    // Validate before API call
    if (!newStaff.full_name.trim() || newStaff.full_name.trim().length < 2) {
      toast.error("Full name must be at least 2 characters");
      return;
    }
    if (!newStaff.phone || newStaff.phone.replace(/[^0-9]/g, "").length < 9) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!newStaff.password || newStaff.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newStaff.role === "teacher") {
      if (!newStaff.class_teacher_for) {
        toast.error("Select a class for this teacher");
        return;
      }
      if (newStaff.subject_ids.length === 0) {
        toast.error("Select at least one subject for this teacher");
        return;
      }
    }

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
          email: newStaff.email || null,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to add staff");
      }

      const createdUserId = result.data?.userId || result.userId;
      if (!createdUserId) {
        throw new Error("Staff account was created but user ID was not returned");
      }

      let avatarUrl = newStaff.avatar_url;
      if (newAvatarFile) {
        avatarUrl = await uploadStaffAvatar(newAvatarFile, createdUserId);
      }

      if (avatarUrl) {
        const { error: avatarError } = await supabase
          .from("users")
          .update({ avatar_url: avatarUrl })
          .eq("id", createdUserId);
        if (avatarError && (avatarError as { code?: string }).code !== "42501") {
          logger.warn("Failed to save avatar URL (non-fatal):", avatarError);
        }
      }

      if (newStaff.role === "teacher") {
        const { error: classAssignError } = await supabase
          .from("classes")
          .update({ class_teacher_id: createdUserId })
          .eq("id", newStaff.class_teacher_for);

        if (classAssignError) throw classAssignError;

        const teacherSubjectsPayload = newStaff.subject_ids.map((subjectId) => ({
          school_id: school.id,
          teacher_id: createdUserId,
          class_id: newStaff.class_teacher_for,
          subject_id: subjectId,
        }));

        if (teacherSubjectsPayload.length > 0) {
          const { error: subjectAssignError } = await supabase.from("teacher_subjects").insert(teacherSubjectsPayload);

          if (subjectAssignError) throw subjectAssignError;
        }
      }

      toast.success("Staff member added");
      setShowAddModal(false);
      fetchStaff();
      setNewAvatarFile(null);
      setNewStaff({
        full_name: "",
        phone: "",
        email: "",
        role: "teacher",
        password: "",
        subject: "",
        avatar_url: "",
        class_teacher_for: "",
        subject_ids: [],
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add staff";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from("users").update({ is_active: !currentStatus }).eq("id", id);
      if (error) throw error;
      setStaff(staff.map((s) => (s.id === id ? { ...s, is_active: !currentStatus } : s)));
      toast.success(currentStatus ? "Staff deactivated" : "Staff activated");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update";
      toast.error(errorMessage);
    }
  };

  const openEditModal = async (member: StaffMember) => {
    setEditingStaff(member);
    setLoadingAssignments(true);

    let classTeacherFor = "";
    let subjectIds: string[] = [];

    if (!isDemo && school?.id && member.role === "teacher") {
      try {
        const [classRes, subjectsRes] = await Promise.all([
          supabase
            .from("classes")
            .select("id")
            .eq("school_id", school.id)
            .eq("class_teacher_id", member.id)
            .maybeSingle(),
          supabase.from("teacher_subjects").select("subject_id").eq("school_id", school.id).eq("teacher_id", member.id),
        ]);

        classTeacherFor = classRes.data?.id || "";
        subjectIds = (subjectsRes.data || []).map((row) => row.subject_id);
      } catch (err) {
        logger.error("Failed to load teacher assignment data:", err);
      }
    }

    if (isDemo && member.role === "teacher") {
      const fallbackSubject = member.subject || "";
      subjectIds = subjects
        .filter((subject) =>
          fallbackSubject
            .toLowerCase()
            .split(",")
            .map((value) => value.trim())
            .includes(subject.name.toLowerCase()),
        )
        .map((subject) => subject.id);
    }

    setEditForm({
      full_name: member.full_name || "",
      phone: member.phone || "",
      email: member.email || "",
      role: member.role || "teacher",
      subject: member.subject || "",
      avatar_url: member.avatar_url || "",
      class_teacher_for: classTeacherFor,
      subject_ids: subjectIds,
    });
    setLoadingAssignments(false);
    setShowEditModal(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      setSaving(true);
      const updatePayload = {
        full_name: editForm.full_name,
        phone: editForm.phone.replace(/[^0-9]/g, ""),
        role: editForm.role,
        email: editForm.email || null,
        avatar_url: editForm.avatar_url || null,
        subject:
          editForm.subject_ids.length > 0
            ? subjects
                .filter((subject) => editForm.subject_ids.includes(subject.id))
                .map((subject) => subject.name)
                .join(", ")
            : editForm.subject || null,
      };

      let { error } = await supabase.from("users").update(updatePayload).eq("id", editingStaff.id);

      if ((error as { code?: string } | null)?.code === "42703") {
        const { subject: _ignored, ...fallbackPayload } = updatePayload;
        const retry = await supabase.from("users").update(fallbackPayload).eq("id", editingStaff.id);
        error = retry.error;
      }

      if (error) throw error;

      if (!isDemo && school?.id) {
        const { error: clearClassError } = await supabase
          .from("classes")
          .update({ class_teacher_id: null })
          .eq("school_id", school.id)
          .eq("class_teacher_id", editingStaff.id);

        if (clearClassError) throw clearClassError;

        const { error: clearSubjectsError } = await supabase
          .from("teacher_subjects")
          .delete()
          .eq("school_id", school.id)
          .eq("teacher_id", editingStaff.id);

        if (clearSubjectsError) throw clearSubjectsError;

        if (editForm.role === "teacher") {
          if (editForm.class_teacher_for) {
            const { error: assignClassError } = await supabase
              .from("classes")
              .update({ class_teacher_id: editingStaff.id })
              .eq("id", editForm.class_teacher_for)
              .eq("school_id", school.id);
            if (assignClassError) throw assignClassError;
          }

          if (editForm.class_teacher_for && editForm.subject_ids.length > 0) {
            const payload = editForm.subject_ids.map((subjectId) => ({
              school_id: school.id,
              teacher_id: editingStaff.id,
              class_id: editForm.class_teacher_for,
              subject_id: subjectId,
            }));

            const { error: assignSubjectsError } = await supabase.from("teacher_subjects").insert(payload);
            if (assignSubjectsError) throw assignSubjectsError;
          }
        }
      }

      setStaff(
        staff.map((s) =>
          s.id === editingStaff.id
            ? {
                ...s,
                ...editForm,
                subject:
                  editForm.subject_ids.length > 0
                    ? subjects
                        .filter((subject) => editForm.subject_ids.includes(subject.id))
                        .map((subject) => subject.name)
                        .join(", ")
                    : editForm.subject,
              }
            : s,
        ),
      );
      toast.success("Staff member updated");
      setShowEditModal(false);
      setEditingStaff(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update staff";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    setPendingAction(() => async () => {
      try {
        const { error } = await supabase.from("users").delete().eq("id", id);
        if (error) throw error;
        setStaff(staff.filter((s) => s.id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        toast.success("Staff member deleted");
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete staff";
        toast.error(errorMessage);
      }
    });
    setConfirmOpen(true);
  };

  const handleResetPassword = async (id: string, pass: string) => {
    if (pass.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      setSaving(true);
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: id,
          password: pass,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to reset password");
      toast.success("Password reset successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  const formatRoleLabel = (role: string) =>
    role
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const parseHexColor = (hex: string) => {
    const normalized = (hex || "#1e40af").replace("#", "");
    if (normalized.length === 3) {
      const expanded = normalized
        .split("")
        .map((char) => `${char}${char}`)
        .join("");
      return {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16),
      };
    }
    if (normalized.length === 6) {
      return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
      };
    }
    return { r: 30, g: 64, b: 175 };
  };

  const buildStaffIdCardHtml = (member: StaffMember) => {
    const schoolName = school?.name || "School";
    const schoolColor = school?.primary_color || "#1e40af";
    const schoolAccent = school?.accent_color || "#1d4ed8";
    const primaryRgb = parseHexColor(schoolColor);
    const accentRgb = parseHexColor(schoolAccent);
    const schoolLogo = school?.logo_url || "";
    const escapeHtml = (value: string) =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const initials =
      member.full_name
        ?.split(" ")
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "S";
    const roleLabel = formatRoleLabel(member.role);
    const cardId = `SM-${member.id.slice(0, 8).toUpperCase()}`;
    const issuedOn = new Date().toLocaleDateString();
    const verificationPayload = `SKOOLMATE_STAFF|school:${school?.id || "unknown"}|staff:${member.id}|card:${cardId}|status:${member.is_active ? "active" : "inactive"}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(verificationPayload)}`;

    const avatarHtml = member.avatar_url
      ? `<img src="${escapeHtml(member.avatar_url)}" alt="${escapeHtml(member.full_name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : escapeHtml(initials);

    const logoHtml = schoolLogo
      ? `<img src="${escapeHtml(schoolLogo)}" alt="${escapeHtml(schoolName)} logo" class="school-logo" />`
      : `<div class="school-logo-fallback">${escapeHtml((schoolName || "S").charAt(0).toUpperCase())}</div>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Staff ID Card - ${escapeHtml(member.full_name)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            background: #eef2ff;
            padding: 24px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .id-card {
            width: 360px;
            height: 228px;
            background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%);
            border-radius: 18px;
            overflow: hidden;
            box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
            border: 1px solid #dbe3f5;
            display: grid;
            grid-template-columns: 108px 1fr;
            position: relative;
          }
          .id-card::after {
            content: "";
            position: absolute;
            right: -42px;
            bottom: -48px;
            width: 165px;
            height: 165px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.18) 0%, rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0) 72%);
          }
          .left-section {
            background: linear-gradient(185deg, ${schoolColor} 0%, ${schoolAccent} 55%, ${schoolColor} 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 14px 11px;
            color: #fff;
          }
          .school-logo {
            width: 28px;
            height: 28px;
            object-fit: contain;
            border-radius: 8px;
            background: rgba(255,255,255,0.2);
            padding: 2px;
          }
          .school-logo-fallback {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            background: rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 13px;
          }
          .avatar {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            font-weight: bold;
            color: ${schoolColor};
            border: 3px solid white;
          }
          .school-name-small {
            color: white;
            font-size: 9px;
            line-height: 1.2;
            text-align: center;
            font-weight: 600;
          }
          .right-section {
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            position: relative;
            z-index: 1;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }
          .school-name {
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: .04em;
          }
          .card-type {
            font-size: 9px;
            color: ${schoolColor};
            background: rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.2);
            padding: 3px 8px;
            border-radius: 999px;
            font-weight: 700;
          }
          .staff-name {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 6px;
          }
          .staff-role {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            background: rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.12);
            color: ${schoolColor};
            border: 1px solid rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.25);
            border-radius: 999px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: .02em;
            padding: 3px 8px;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          .staff-info {
            font-size: 10px;
            color: #334155;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .footer {
            margin-top: auto;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: .04em;
          }
          .qr-block {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
          }
          .qr-block img {
            width: 54px;
            height: 54px;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
            background: #fff;
          }
          .qr-label {
            font-size: 8px;
            color: #475569;
            font-weight: 700;
            letter-spacing: .03em;
            text-transform: uppercase;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
            .id-card {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="id-card">
          <div class="left-section">
            ${logoHtml}
            <div class="school-name-small">${escapeHtml(schoolName)}</div>
            <div class="avatar">${avatarHtml}</div>
            <div class="school-name-small">${escapeHtml(cardId)}</div>
          </div>
          <div class="right-section">
            <div class="header">
              <span class="school-name">${escapeHtml(schoolName)}</span>
              <span class="card-type">STAFF</span>
            </div>
            <div class="staff-name">${escapeHtml(member.full_name)}</div>
            <div class="staff-role">${escapeHtml(roleLabel)}</div>
            <div class="staff-info">Phone: ${escapeHtml(member.phone)}</div>
            <div class="staff-info">Status: ${member.is_active ? "Active" : "Inactive"}</div>
            ${member.email ? `<div class="staff-info">Email: ${escapeHtml(member.email)}</div>` : ""}
            ${member.subject ? `<div class="staff-info">Subjects: ${escapeHtml(member.subject)}</div>` : ""}
            <div class="footer">
              <div>
                <div>Issued ${escapeHtml(issuedOn)}</div>
                <div>${escapeHtml(cardId)}</div>
              </div>
              <div class="qr-block">
                <img src="${escapeHtml(qrUrl)}" alt="Verification QR" />
                <span class="qr-label">Verify</span>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const printStaffIDCard = (member: StaffMember) => {
    const printWindow = window.open("", "_blank", "width=420,height=320,noopener,noreferrer");

    if (!printWindow) {
      toast.error("Unable to open print window. Please allow pop-ups and try again.");
      return;
    }

    const fullHtml = buildStaffIdCardHtml(member);
    const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const headStyles = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const bodyContent = bodyMatch ? bodyMatch[1].trim() : fullHtml;

    printWindow.document.open();
    printWindow.document.title = "Staff ID Card";
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
      printWindow.document.head.appendChild(el.cloneNode(true));
    });
    printWindow.document.head.insertAdjacentHTML("beforeend", headStyles.join(""));
    printWindow.document.body.innerHTML = bodyContent;
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
      }, 300);
    }, 250);
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
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
        {role === "dos"
          ? "Director of Studies"
          : role === "school_admin"
            ? "Administrator"
            : role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const filteredStaff = (
    activeTab === "all"
      ? staff
      : activeTab === "active"
        ? staff.filter((s) => s.is_active)
        : staff.filter((s) => !s.is_active)
  ).filter(
    (s) =>
      !staffSearch ||
      (s.full_name?.toLowerCase() ?? "").includes(staffSearch.toLowerCase()) ||
      (s.role?.toLowerCase() ?? "").includes(staffSearch.toLowerCase()) ||
      (s.email?.toLowerCase() ?? "").includes(staffSearch.toLowerCase()),
  );

  const staffCardPrimary = school?.primary_color || "#1e40af";
  const staffCardAccent = school?.accent_color || "#1d4ed8";

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
                  {member.avatar_url ? (
                    <Image
                      src={member.avatar_url}
                      alt={member.full_name}
                      width={48}
                      height={48}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-700 font-semibold">{member.full_name?.charAt(0) || "U"}</span>
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{member.full_name}</div>
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
                    {member.subject && <span className="ml-2">• {member.subject}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(member)}>
                  <MaterialIcon icon="edit" className="text-sm" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIdCardPreviewStaff(member)}>
                  <MaterialIcon icon="badge" className="text-sm" />
                  ID Card
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const pass = prompt("Enter new password (min 6 chars):");
                    if (pass) handleResetPassword(member.id, pass);
                  }}
                >
                  <MaterialIcon icon="lock_reset" className="text-sm" />
                  Reset
                </Button>
                <Button
                  variant={member.is_active ? "secondary" : "primary"}
                  size="sm"
                  onClick={() => toggleStatus(member.id, member.is_active)}
                >
                  {member.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteStaff(member.id)}>
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
          <h2 className="text-xl font-semibold text-[var(--on-surface)]">Staff Directory</h2>
          <p className="text-sm text-[var(--t3)]">{totalCount} staff members</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--t3)]">
            Page {currentPage} of {Math.max(1, Math.ceil(totalCount / itemsPerPage))}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <MaterialIcon icon="chevron_left" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalCount / itemsPerPage), p + 1))}
            disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
          >
            <MaterialIcon icon="chevron_right" />
          </Button>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <MaterialIcon icon="person_add" className="text-lg" />
          Add Staff
        </Button>
      </div>

      <details className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--t2)]">
          How to Manage Staff
        </summary>
        <div className="px-4 pb-4">
          <PageGuidance
            title=""
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
        </div>
      </details>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <MaterialIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
            placeholder="Search by name, role, or email…"
            className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-100 w-full"
          />
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

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
          className="fixed inset-0 bg-black/45 z-50 p-3 sm:p-4 flex items-start sm:items-center justify-center overflow-y-auto"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-hidden shadow-xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Add Staff Member</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form
              onSubmit={handleAddStaff}
              className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-11rem)]"
            >
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Profile Photo</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                    {newStaff.avatar_url ? (
                      <Image
                        src={newStaff.avatar_url}
                        alt="Staff avatar"
                        width={56}
                        height={56}
                        className="object-cover"
                      />
                    ) : (
                      <MaterialIcon icon="person" className="text-gray-500" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        validateStudentPhoto(file);
                        const preview = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result || ""));
                          reader.onerror = () => reject(new Error("Failed to read image"));
                          reader.readAsDataURL(file);
                        });
                        setNewAvatarFile(file);
                        setNewStaff((prev) => ({ ...prev, avatar_url: preview }));
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to process image");
                      }
                    }}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Full Name</label>
                <input
                  type="text"
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                  className="input"
                  required
                  maxLength={200}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Phone Number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="0700000000"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="input"
                  required
                  maxLength={15}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="input"
                >
                  <option value="teacher">Teacher</option>
                  <option value="dean_of_studies">Director of Studies (DOS)</option>
                  <option value="bursar">Bursar</option>
                  <option value="secretary">Secretary</option>
                  <option value="dorm_master">Dorm Master/Mistress</option>
                </select>
                <p className="text-xs text-[#5c6670] mt-1">{ROLE_DESCRIPTIONS[newStaff.role]?.desc}</p>
              </div>

              {newStaff.role === "teacher" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-[#191c1d] mb-2 block">Class Teacher For</label>
                    <select
                      value={newStaff.class_teacher_for}
                      onChange={(e) =>
                        setNewStaff({
                          ...newStaff,
                          class_teacher_for: e.target.value,
                        })
                      }
                      className="input"
                      required
                    >
                      <option value="">Select class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[#191c1d] mb-2 block">Subjects Taught</label>
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#e8eaed] p-3 max-h-36 overflow-y-auto">
                      {subjects.map((subject) => (
                        <label key={subject.id} className="flex items-center gap-2 text-sm text-[#191c1d]">
                          <input
                            type="checkbox"
                            checked={newStaff.subject_ids.includes(subject.id)}
                            onChange={(e) => {
                              setNewStaff((prev) => ({
                                ...prev,
                                subject_ids: e.target.checked
                                  ? [...prev.subject_ids, subject.id]
                                  : prev.subject_ids.filter((id) => id !== subject.id),
                              }));
                            }}
                          />
                          {subject.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Email (optional)</label>
                <input
                  type="email"
                  placeholder="teacher@school.edu.ug"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="input"
                  maxLength={254}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="input"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving} loading={saving} className="flex-1">
                  {saving ? "Adding..." : "Add Staff"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingStaff && (
        <div
          className="fixed inset-0 bg-black/45 z-50 p-3 sm:p-4 flex items-start sm:items-center justify-center overflow-y-auto"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-hidden shadow-xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Edit Staff Member</h2>
                <button onClick={() => setShowEditModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form
              onSubmit={handleUpdateStaff}
              className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-11rem)]"
            >
              {loadingAssignments ? <div className="text-sm text-[#5c6670]">Loading teacher assignments...</div> : null}

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Profile Photo</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                    {editForm.avatar_url ? (
                      <Image
                        src={editForm.avatar_url}
                        alt="Staff avatar"
                        width={56}
                        height={56}
                        className="object-cover"
                      />
                    ) : (
                      <MaterialIcon icon="person" className="text-gray-500" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !editingStaff) return;
                      try {
                        const uploadedUrl = await uploadStaffAvatar(file, editingStaff.id);
                        setEditForm((prev) => ({
                          ...prev,
                          avatar_url: uploadedUrl,
                        }));
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to upload image");
                      }
                    }}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="input"
                  required
                  maxLength={200}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Phone Number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="0700000000"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="input"
                  required
                  maxLength={15}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="input"
                >
                  <option value="teacher">Teacher</option>
                  <option value="school_admin">Administrator</option>
                  <option value="headmaster">Headmaster</option>
                  <option value="dean_of_studies">Director of Studies</option>
                  <option value="bursar">Bursar</option>
                  <option value="secretary">Secretary</option>
                  <option value="dorm_master">Dorm Master/Mistress</option>
                </select>
              </div>

              {editForm.role === "teacher" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-[#191c1d] mb-2 block">Class Teacher For</label>
                    <select
                      value={editForm.class_teacher_for}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          class_teacher_for: e.target.value,
                        })
                      }
                      className="input"
                    >
                      <option value="">Select class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[#191c1d] mb-2 block">Subjects Taught</label>
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#e8eaed] p-3 max-h-36 overflow-y-auto">
                      {subjects.map((subject) => (
                        <label key={subject.id} className="flex items-center gap-2 text-sm text-[#191c1d]">
                          <input
                            type="checkbox"
                            checked={editForm.subject_ids.includes(subject.id)}
                            onChange={(e) => {
                              setEditForm((prev) => ({
                                ...prev,
                                subject_ids: e.target.checked
                                  ? [...prev.subject_ids, subject.id]
                                  : prev.subject_ids.filter((id) => id !== subject.id),
                              }));
                            }}
                          />
                          {subject.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving} loading={saving} className="flex-1">
                  {saving ? "Updating..." : "Update Staff"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {idCardPreviewStaff && (
        <div
          className="fixed inset-0 bg-black/45 z-50 p-3 sm:p-4 flex items-start sm:items-center justify-center overflow-y-auto"
          onClick={() => setIdCardPreviewStaff(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-hidden shadow-xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Staff ID Card Preview</h2>
                <button onClick={() => setIdCardPreviewStaff(null)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-11rem)]">
              <div className="mx-auto w-full max-w-[430px] rounded-[22px] overflow-hidden border border-[#dbe3f5] shadow-[0_16px_30px_rgba(15,23,42,0.16)] bg-gradient-to-br from-[#ffffff] to-[#f7fbff] grid grid-cols-[110px_1fr] relative">
                <div
                  className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${staffCardPrimary}33 0%, ${staffCardPrimary}00 72%)`,
                  }}
                />
                <div
                  className="p-3 text-white flex flex-col items-center justify-between relative z-10"
                  style={{
                    background: `linear-gradient(180deg, ${staffCardPrimary} 0%, ${staffCardAccent} 55%, ${staffCardPrimary} 100%)`,
                  }}
                >
                  {school?.logo_url ? (
                    <Image
                      src={school.logo_url}
                      alt={`${school?.name || "School"} logo`}
                      width={28}
                      height={28}
                      className="rounded-lg bg-white/20 p-0.5 object-contain"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-extrabold text-[11px]">
                      {(school?.name || "S").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-[9px] leading-tight text-center font-semibold break-words">
                    {school?.name || "School"}
                  </div>
                  <div
                    className="w-[74px] h-[74px] rounded-full bg-white border-[3px] border-white overflow-hidden flex items-center justify-center font-bold text-xl"
                    style={{ color: staffCardPrimary }}
                  >
                    {idCardPreviewStaff.avatar_url ? (
                      <Image
                        src={idCardPreviewStaff.avatar_url}
                        alt={idCardPreviewStaff.full_name}
                        width={74}
                        height={74}
                        className="object-cover"
                      />
                    ) : (
                      idCardPreviewStaff.full_name
                        ?.split(" ")
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() || "")
                        .join("") || "S"
                    )}
                  </div>
                  <div className="text-[10px] tracking-[0.06em] font-semibold">
                    {`SM-${idCardPreviewStaff.id.slice(0, 8).toUpperCase()}`}
                  </div>
                </div>
                <div className="p-4 flex flex-col relative z-10">
                  <div className="flex items-center justify-between mb-2.5 gap-2">
                    <span className="text-[12px] font-extrabold text-[#0f172a] uppercase tracking-[0.04em] truncate">
                      {school?.name || "School"}
                    </span>
                    <span
                      className="text-[9px] px-2 py-1 rounded-full font-bold shrink-0"
                      style={{
                        backgroundColor: `${staffCardAccent}33`,
                        color: staffCardPrimary,
                      }}
                    >
                      STAFF
                    </span>
                  </div>
                  <div className="text-[16px] font-extrabold text-[#0f172a] mb-1.5">{idCardPreviewStaff.full_name}</div>
                  <div
                    className="inline-flex w-fit text-[10px] uppercase tracking-[0.03em] font-bold rounded-full px-2 py-1 border mb-2"
                    style={{
                      backgroundColor: `${staffCardAccent}22`,
                      color: staffCardPrimary,
                      borderColor: `${staffCardPrimary}40`,
                    }}
                  >
                    {formatRoleLabel(idCardPreviewStaff.role)}
                  </div>
                  <div className="text-[11px] text-[#334155] truncate">Phone: {idCardPreviewStaff.phone}</div>
                  <div className="text-[11px] text-[#334155]">
                    Status: {idCardPreviewStaff.is_active ? "Active" : "Inactive"}
                  </div>
                  {idCardPreviewStaff.email ? (
                    <div className="text-[11px] text-[#334155] truncate">Email: {idCardPreviewStaff.email}</div>
                  ) : null}
                  {idCardPreviewStaff.subject ? (
                    <div className="text-[11px] text-[#334155] truncate">Subjects: {idCardPreviewStaff.subject}</div>
                  ) : null}
                  <div className="mt-auto pt-2.5 border-t border-dashed border-[#cbd5e1] flex items-end justify-between text-[9px] text-[#64748b] uppercase tracking-[0.04em] gap-2">
                    <div>
                      <div>Issued {new Date().toLocaleDateString()}</div>
                      <div>{`SM-${idCardPreviewStaff.id.slice(0, 8).toUpperCase()}`}</div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="p-1 bg-white rounded-md border border-[#cbd5e1]">
                        <QRCodeSVG
                          value={`SKOOLMATE_STAFF|school:${school?.id || "unknown"}|staff:${idCardPreviewStaff.id}|card:SM-${idCardPreviewStaff.id.slice(0, 8).toUpperCase()}|status:${idCardPreviewStaff.is_active ? "active" : "inactive"}`}
                          size={50}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                      <span className="text-[8px] text-[#475569] font-bold tracking-[0.03em] uppercase">Verify</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-5">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setIdCardPreviewStaff(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  onClick={() => printStaffIDCard(idCardPreviewStaff)}
                >
                  <MaterialIcon icon="print" className="text-sm" />
                  Print ID Card
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          pendingAction?.();
        }}
        title="Delete Staff Member"
        message="Are you sure you want to delete this staff member?"
        variant="danger"
      />
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
  const { staff } = useStaff(school?.id);
  const hasStaff = staff.length > 0;
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const handleReviewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasStaff) {
      toast.error("No staff available for review yet. Add staff members first.");
      return;
    }
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
      toast.success("Performance review submitted");
      setShowReviewModal(false);
      setSelectedStaffId("");
    } else {
      toast.error(result.error || "Failed to submit review");
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
          <h2 className="text-xl font-semibold text-[var(--on-surface)]">Staff Performance</h2>
          <p className="text-sm text-[var(--t3)]">Conduct and manage staff performance reviews</p>
        </div>
        <Button
          onClick={() => setShowReviewModal(true)}
          disabled={!hasStaff}
          title={!hasStaff ? "Add staff members before creating reviews" : undefined}
        >
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
                      <p className="text-xs text-[var(--t3)]">{review.review_date}</p>
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
                    <p className="text-sm text-[var(--t2)] line-clamp-2">{review.strengths}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--navy)] uppercase tracking-wider mb-1">
                      Upcoming Goals
                    </p>
                    <p className="text-sm text-[var(--t2)] line-clamp-2">{review.goals}</p>
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
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[var(--on-surface)]">New Performance Review</h2>
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
                  <label className="text-sm font-medium text-[var(--on-surface)]">Select Staff Member</label>
                  <select
                    required
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    disabled={!hasStaff}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  >
                    <option value="">Choose staff...</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} ({member.role || "staff"})
                      </option>
                    ))}
                  </select>
                  {!hasStaff && (
                    <p className="text-xs text-[var(--t3)]">
                      No staff records found. Add staff in Directory first, then create reviews.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Overall Rating (1-5)</label>
                  <div className="flex items-center gap-2 h-[48px]">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("rating-input") as HTMLInputElement;
                          if (input) input.value = num.toString();
                        }}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <MaterialIcon icon="star" className="text-2xl text-[var(--amber)]" />
                      </button>
                    ))}
                    <input type="hidden" name="rating" id="rating-input" defaultValue="5" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Key Strengths</label>
                  <textarea
                    name="strengths"
                    required
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    placeholder="What is this staff member doing exceptionally well?"
                  ></textarea>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Areas for Improvement</label>
                  <textarea
                    name="areas_for_improvement"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    placeholder="Where can they grow?"
                  ></textarea>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Development Goals</label>
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
                disabled={!hasStaff}
                className="w-full py-4 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-xl font-bold transition-all shadow-lg shadow-[var(--primary)]/20 mt-4"
              >
                Submit Review
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
  const [filter, setFilter] = useState<"all" | "needs_approval" | "pending" | "dos_approved" | "approved" | "rejected">(
    "all",
  );
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
        .select("*")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });

      if (error) {
        // Table doesn't exist or RLS blocks — show empty gracefully
        if (error.code === "42P01" || error.code === "42501" || error.code === "PGRST116") {
          setRequests([]);
          return;
        }
        throw error;
      }
      setRequests(data || []);
    } catch (err) {
      logger.error("Error fetching leave requests:", err instanceof Error ? err.message : "unknown");
      setRequests([]);
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

  const leaveValidationError =
    !form.start_date || !form.end_date || !form.reason.trim()
      ? "Add start date, end date, and reason to submit."
      : new Date(form.end_date) < new Date(form.start_date)
        ? "End date must be on or after start date."
        : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id || !user?.id) return;
    if (leaveValidationError) {
      toast.error(leaveValidationError);
      return;
    }

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
    const styles: Record<string, { bg: string; text: string; label: string }> = {
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
    return <span className={`px-2 py-1 rounded-lg text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const getLeaveTypeLabel = (type: string) => {
    return LEAVE_TYPES.find((t) => t.value === type)?.label || type;
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const dosApprovedCount = requests.filter((r) => r.status === "dos_approved").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;
  const needsApprovalCount = isHM
    ? requests.filter((r) => r.status === "pending" || r.status === "dos_approved").length
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

  const leaveFilterHints: Record<string, string> = {
    all: "Review every leave request across the current school term.",
    needs_approval: "Prioritize requests waiting for your decision.",
    pending: "Track newly submitted requests awaiting DOS review.",
    dos_approved: "These requests are cleared by DOS and may need HM final action.",
    approved: "Confirmed requests with final headmaster approval.",
    rejected: "Requests declined after review.",
  };

  const filteredRequests =
    filter === "all"
      ? requests
      : filter === "needs_approval"
        ? requests.filter((r) =>
            isHM ? r.status === "pending" || r.status === "dos_approved" : r.status === "pending",
          )
        : requests.filter((r) => r.status === filter);

  const handleApproval = async (requestId: string, action: "approved" | "rejected") => {
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

      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          status: newStatus,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      const { error: approvalError } = await supabase.from("leave_approvals").insert({
        school_id: school.id,
        leave_request_id: requestId,
        approver_id: user.id,
        action: newStatus,
        comments: null,
      });

      if (approvalError) throw approvalError;

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
    if (isHM && (req.status === "pending" || req.status === "dos_approved")) return true;
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
            {isHM || isDOS ? "Manage staff leave requests and approvals" : "Submit and track your leave applications"}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <MaterialIcon icon="add" />
          Request Leave
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={filter} onChange={(id) => setFilter(id as typeof filter)} className="mb-6" />
      <p className="-mt-3 mb-6 text-sm text-[var(--t3)]">{leaveFilterHints[filter]}</p>

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
                      <span className="font-medium text-[var(--on-surface)]">{getLeaveTypeLabel(req.leave_type)}</span>
                      {getStatusBadge(req.status)}
                    </div>
                    <div className="text-sm text-[var(--t3)] mt-1">
                      {new Date(req.start_date).toLocaleDateString()} – {new Date(req.end_date).toLocaleDateString()} (
                      {req.days_count} day{req.days_count !== 1 ? "s" : ""})
                    </div>
                    {req.reason && <div className="text-sm text-[var(--t3)] mt-1">{req.reason}</div>}
                    {req.substitute_suggestion && (
                      <div className="text-sm text-[var(--t3)] mt-1">
                        <MaterialIcon icon="person" className="text-xs align-middle" /> Suggested substitute:{" "}
                        {req.substitute_suggestion}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[var(--t3)]">{new Date(req.created_at).toLocaleDateString()}</span>
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
          className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center overflow-y-auto z-50 p-3 sm:p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-hidden shadow-xl my-auto"
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">Request Leave</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  <MaterialIcon icon="close" className="text-xl" />
                </Button>
              </div>
            </div>
            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-11rem)]"
            >
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Leave Type</label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
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
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
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
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Reason</label>
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
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  loading={saving}
                  disabled={saving || Boolean(leaveValidationError)}
                >
                  {saving ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
              {leaveValidationError && <p className="text-sm text-[var(--t3)]">{leaveValidationError}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
