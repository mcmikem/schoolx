"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { useFormDraft } from "@/lib/useAutoSave";
import { SendSMSModal } from "@/components/SendSMSModal";
import MaterialIcon from "@/components/MaterialIcon";
import OnboardingTips from "@/components/OnboardingTips";
import { PageHeader, PageSection } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import BulkImport from "@/components/BulkImport";
import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { EmptyState, NoData, SearchEmpty } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { DEMO_CLASSES, DEMO_ATTENDANCE } from "@/lib/demo-data";
import { PageGuidance } from "@/components/PageGuidance";
import StudentSummaryPulse from "@/components/students/StudentSummaryPulse";

const STUDENT_TEMPLATE_COLUMNS = [
  "student_number",
  "first_name",
  "last_name",
  "gender",
  "class_name",
  "class_id",
  "ple_index_number",
  "parent_name",
  "parent_phone",
  "parent_phone2",
  "opening_balance",
];

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

interface PromotionStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  status: string;
  class_id: string;
  repeating?: boolean;
  classes?: { id: string; name: string; level: string };
}

interface ClassData {
  id: string;
  name: string;
  level: string;
}

type StudentAction = "promote" | "repeat" | "demote" | "skip";
interface StudentActionMap {
  [studentId: string]: {
    action: StudentAction;
    targetClassId?: string;
    reason?: string;
  };
}

export default function StudentHubPage() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const searchParams = useSearchParams();
  const { students, loading, createStudent, updateStudent, deleteStudent } =
    useStudents(school?.id);
  const { classes } = useClasses(school?.id);

  const [activeTab, setActiveTab] = useState("registry");

  // ===== REGISTRY STATE =====
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [houses, setHouses] = useState<any[]>([]);

  useEffect(() => {
    if (searchParams?.get("action") === "add") {
      setShowAddModal(true);
    }
  }, [searchParams]);

  // Filters
  const [filterGender, setFilterGender] = useState<"all" | "M" | "F">("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [filterDefaulters, setFilterDefaulters] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "number" | "class">("name");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const newStudentDraft: any = {
    showRestoreDialog: false,
    discardDraft: () => {},
    savedDraft: null,
    updateData: () => {},
    clearSaved: () => {},
  };
  const [newStudent, setNewStudent] = useState({
    first_name: "",
    last_name: "",
    gender: "M" as "M" | "F",
    date_of_birth: "",
    parent_name: "",
    parent_phone: "",
    parent_phone2: "",
    class_id: "",
    student_number: "",
    ple_index_number: "",
    opening_balance: "0",
    boarding_status: "day" as "day" | "boarding" | "weekly",
    house_id: "",
    previous_school: "",
    district_origin: "",
    sub_county: "",
    parish: "",
    village: "",
    is_class_monitor: false,
    prefect_role: "",
    student_council_role: "",
    games_house: "",
  });

  const handleNewStudentChange = (updates: Partial<typeof newStudent>) => {
    setNewStudent((prev) => ({ ...prev, ...updates }));
  };
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    gender: "M" as "M" | "F",
    date_of_birth: "",
    parent_name: "",
    parent_phone: "",
    parent_phone2: "",
    class_id: "",
    student_number: "",
    ple_index_number: "",
    opening_balance: "0",
  });
  const [smsTarget, setSmsTarget] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    parent_phone?: string;
  } | null>(null);
  const [templateRows, setTemplateRows] = useState<Record<string, string>[]>(
    [],
  );
  const [templatePreviewRows, setTemplatePreviewRows] = useState<
    Record<string, string>[]
  >([]);
  const [templateStatus, setTemplateStatus] = useState<
    "idle" | "parsing" | "ready"
  >("idle");
  const [templateErrors, setTemplateErrors] = useState<string | null>(null);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    success: number;
    failed: number;
    total: number;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    studentId: string | null;
  }>({ open: false, studentId: null });

  // ===== TRANSFERS STATE =====
  const transferPrintRef = useRef<HTMLDivElement>(null);
  const [transferActiveTab, setTransferActiveTab] = useState<TransferTab>("in");
  const [showTransferInModal, setShowTransferInModal] = useState(false);
  const [showTransferOutModal, setShowTransferOutModal] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferOutRecord[]>(
    [],
  );
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

  // ===== DROPOUT STATE =====
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [loadingAtRisk, setLoadingAtRisk] = useState(true);
  const [dropoutClassFilter, setDropoutClassFilter] = useState("all");
  const [showDropoutModal, setShowDropoutModal] = useState<string | null>(null);
  const [dropoutReason, setDropoutReason] = useState("");
  const [sendingSms, setSendingSms] = useState<string | null>(null);

  // ===== PROMOTION STATE =====
  const [promotionClasses, setPromotionClasses] = useState<ClassData[]>([]);
  const [fromClass, setFromClass] = useState("");
  const [toClass, setToClass] = useState("");
  const [promotionStudents, setPromotionStudents] = useState<
    PromotionStudent[]
  >([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    new Set(),
  );
  const [studentActions, setStudentActions] = useState<StudentActionMap>({});
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promotionHistory, setPromotionHistory] = useState<any[]>([]);
  const [showDemoteModal, setShowDemoteModal] = useState<string | null>(null);
  const [demoteReason, setDemoteReason] = useState("");
  const [demoteClass, setDemoteClass] = useState("");
  const [autoPromoting, setAutoPromoting] = useState(false);
  const [autoPromoteResult, setAutoPromoteResult] = useState<any>(null);

  // ===== EFFECTS =====
  useEffect(() => {
    if (!school?.id) return;
    supabase
      .from("houses")
      .select("*")
      .eq("school_id", school.id)
      .order("name")
      .then(({ data }) => {
        setHouses(data || []);
      });
  }, [school?.id]);

  const fetchTransferHistory = useCallback(async () => {
    if (!school?.id) return;
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
      setLoadingTransferHistory(false);
    }
  }, [school?.id, students, isDemo]);

  useEffect(() => {
    if (school?.id) fetchTransferHistory();
  }, [school?.id, fetchTransferHistory]);

  const fetchAtRiskStudents = useCallback(async () => {
    if (!school?.id) return;
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
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("student_id, date, status")
        .gte("date", thirtyDaysAgoStr)
        .lte("date", todayStr)
        .order("date", { ascending: false });
      if (error) throw error;
      const studentAtt: Record<string, { date: string; status: string }[]> = {};
      attendanceData?.forEach((record: any) => {
        if (!studentAtt[record.student_id]) studentAtt[record.student_id] = [];
        studentAtt[record.student_id].push({
          date: record.date,
          status: record.status,
        });
      });
      const activeStudents = students.filter((s) => s.status === "active");
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
  }, [school?.id, students, isDemo]);

  useEffect(() => {
    fetchAtRiskStudents();
  }, [fetchAtRiskStudents]);

  const fetchPromotionClasses = useCallback(async () => {
    if (!school?.id) return;
    if (isDemo) {
      setPromotionClasses(DEMO_CLASSES as any);
      return;
    }
    const { data } = await supabase
      .from("classes")
      .select("*")
      .eq("school_id", school?.id)
      .order("level", { ascending: true });
    setPromotionClasses(data || []);
  }, [school?.id, isDemo]);

  const fetchPromotionStudents = useCallback(async () => {
    if (!school?.id || !fromClass) return;
    setPromotionLoading(true);
    if (isDemo) {
      const classStudents = students.filter((s) => s.class_id === fromClass);
      setPromotionStudents(classStudents as any);
      setSelectedStudents(new Set(classStudents.map((s) => s.id)));
      const defaultActions: StudentActionMap = {};
      classStudents.forEach((s) => {
        defaultActions[s.id] = { action: "promote" };
      });
      setStudentActions(defaultActions);
      setPromotionLoading(false);
      return;
    }
    const { data } = await supabase
      .from("students")
      .select("*, classes(*)")
      .eq("school_id", school?.id)
      .eq("class_id", fromClass)
      .eq("status", "active")
      .order("first_name");
    setPromotionStudents(data || []);
    setSelectedStudents(new Set(data?.map((s) => s.id) || []));
    const defaultActions: StudentActionMap = {};
    data?.forEach((s) => {
      defaultActions[s.id] = { action: "promote" };
    });
    setStudentActions(defaultActions);
    setPromotionLoading(false);
  }, [school?.id, fromClass, isDemo, students]);

  const fetchPromotionHistory = useCallback(async () => {
    if (!school?.id) return;
    if (isDemo) {
      setPromotionHistory([
        {
          id: "demo-h1",
          from_classes: { name: "P.4" },
          to_classes: { name: "P.5" },
          academic_year: academicYear,
          promotion_type: "promoted",
          promoted_at: new Date().toISOString(),
          users: { full_name: user?.full_name || "Admin" },
          student_count: 32,
        },
      ]);
      return;
    }
    const { data } = await supabase
      .from("student_promotions")
      .select("*, from_classes(name), to_classes(name), users(full_name)")
      .eq("school_id", school?.id)
      .order("promoted_at", { ascending: false })
      .limit(20);
    setPromotionHistory(data || []);
  }, [school?.id, isDemo, academicYear, user?.full_name]);

  useEffect(() => {
    if (school?.id) fetchPromotionClasses();
  }, [school?.id, fetchPromotionClasses]);

  useEffect(() => {
    if (fromClass) fetchPromotionStudents();
  }, [fromClass, fetchPromotionStudents]);

  useEffect(() => {
    if (school?.id) fetchPromotionHistory();
  }, [school?.id, fetchPromotionHistory]);

  // ===== REGISTRY LOGIC =====
  const resolveClassId = (row: Record<string, string>) => {
    if (row.class_id) return row.class_id;
    if (!row.class_name) return "";
    const match = classes.find(
      (c) => c.name.toLowerCase() === row.class_name?.toLowerCase(),
    );
    return match?.id || "";
  };

  const filtered = useMemo(() => {
    let result = students.filter((s) => {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase();
      const matchesSearch =
        name.includes(searchTerm.toLowerCase()) ||
        s.parent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass =
        selectedClass === "all" || s.class_id === selectedClass;
      const sAny = s as any;
      const matchesGender = filterGender === "all" || s.gender === filterGender;
      const matchesPosition =
        filterPosition === "all" ||
        (filterPosition === "monitor" && sAny.is_class_monitor) ||
        (filterPosition === "prefect" &&
          (sAny.prefect_role || sAny.student_council_role));
      return matchesSearch && matchesClass && matchesGender && matchesPosition;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === "name") {
        return `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
        );
      }
      if (sortBy === "number") {
        return (a.student_number || "").localeCompare(b.student_number || "");
      }
      return (a.classes?.name || "").localeCompare(b.classes?.name || "");
    });

    return result;
  }, [
    students,
    searchTerm,
    selectedClass,
    filterGender,
    filterPosition,
    sortBy,
  ]);

  const handleStudentTemplateUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTemplateStatus("parsing");
    setTemplateErrors(null);
    setTemplateRows([]);
    setTemplatePreviewRows([]);
    setImportSummary(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const normalized: Record<string, string>[] = results.data.map(
          (row) => ({
            student_number: row.student_number?.trim() || "",
            first_name: row.first_name?.trim() || "",
            last_name: row.last_name?.trim() || "",
            gender: row.gender?.trim().toUpperCase() === "F" ? "F" : "M",
            class_name: row.class_name?.trim() || "",
            class_id: row.class_id?.trim() || "",
            ple_index_number: row.ple_index_number?.trim() || "",
            parent_name: row.parent_name?.trim() || "",
            parent_phone: row.parent_phone?.trim() || "",
            parent_phone2: row.parent_phone2?.trim() || "",
            opening_balance: row.opening_balance?.trim() || "0",
          }),
        );
        setTemplateRows(normalized);
        setTemplatePreviewRows(normalized.slice(0, 5));
        setTemplateStatus("ready");
      },
      error: (error) => {
        setTemplateErrors(error.message);
        setTemplateStatus("idle");
      },
    });
  };

  const handleSeedStudentsFromTemplate = async () => {
    if (!templateRows.length) {
      setTemplateErrors("Upload a template before seeding.");
      return;
    }
    setImportingTemplate(true);
    let success = 0;
    let failed = 0;
    for (const row of templateRows) {
      const classId = resolveClassId(row);
      if (!row.first_name || !row.last_name || !classId) {
        failed++;
        continue;
      }
      try {
        await createStudent({
          first_name: row.first_name,
          last_name: row.last_name,
          gender: row.gender === "F" ? "F" : "M",
          class_id: classId,
          student_number: row.student_number || undefined,
          ple_index_number: row.ple_index_number || undefined,
          parent_name: row.parent_name || "",
          parent_phone: row.parent_phone || "",
          parent_phone2: row.parent_phone2 || undefined,
          opening_balance: parseFloat(row.opening_balance || "0"),
          status: "active",
        });
        success++;
      } catch (error) {
        console.error("Bulk student import error:", error);
        failed++;
      }
    }
    setImportSummary({ success, failed, total: templateRows.length });
    setImportingTemplate(false);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id) return;
    if (!newStudent.first_name?.trim()) {
      toast.error("First name is required");
      return;
    }
    if (!newStudent.last_name?.trim()) {
      toast.error("Last name is required");
      return;
    }
    if (!newStudent.class_id) {
      toast.error("Please select a class");
      return;
    }
    if (!newStudent.parent_name?.trim()) {
      toast.error("Parent/Guardian name is required");
      return;
    }
    if (!newStudent.parent_phone?.trim()) {
      toast.error("Parent phone is required");
      return;
    }
    try {
      setSaving(true);
      const studentNumber =
        newStudent.student_number ||
        `STU${String(students.length + 1).padStart(5, "0")}`;
      await createStudent({
        first_name: newStudent.first_name.trim(),
        last_name: newStudent.last_name.trim(),
        gender: newStudent.gender,
        date_of_birth: newStudent.date_of_birth || undefined,
        parent_name: newStudent.parent_name.trim(),
        parent_phone: newStudent.parent_phone.trim(),
        parent_phone2: newStudent.parent_phone2?.trim() || undefined,
        class_id: newStudent.class_id,
        student_number: studentNumber,
        ple_index_number: newStudent.ple_index_number?.trim() || undefined,
        opening_balance: parseFloat(newStudent.opening_balance || "0"),
        status: "active",
      });
      toast.success("Student added successfully");
      setShowAddModal(false);
      newStudentDraft.clearSaved();
      setNewStudent({
        first_name: "",
        last_name: "",
        gender: "M",
        date_of_birth: "",
        parent_name: "",
        parent_phone: "",
        parent_phone2: "",
        class_id: "",
        student_number: "",
        ple_index_number: "",
        opening_balance: "0",
        boarding_status: "day",
        house_id: "",
        previous_school: "",
        district_origin: "",
        sub_county: "",
        parish: "",
        village: "",
        is_class_monitor: false,
        prefect_role: "",
        student_council_role: "",
        games_house: "",
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add student";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteConfirm.studentId) return;
    try {
      await deleteStudent(deleteConfirm.studentId);
      toast.success("Student removed");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove student";
      toast.error(errorMessage);
    } finally {
      setDeleteConfirm({ open: false, studentId: null });
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteConfirm({ open: true, studentId: id });
  };

  const openEditModal = (student: any) => {
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
      opening_balance: student.opening_balance?.toString() || "0",
    });
    window.scrollTo(0, 0);
    setShowEditModal(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      setSaving(true);
      const updateData = {
        ...editForm,
        opening_balance: parseFloat(editForm.opening_balance || "0"),
      };
      await updateStudent(editingStudent.id, updateData);
      toast.success("Student updated successfully");
      setShowEditModal(false);
      setEditingStudent(null);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update student";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (students.length === 0) {
      toast.error("No students to export");
      return;
    }
    const headers = [
      "Name",
      "Student Number",
      "Gender",
      "Parent Name",
      "Parent Phone",
      "Class",
    ];
    const rows = students.map((s) => [
      `${s.first_name} ${s.last_name}`,
      s.student_number || "",
      s.gender === "M" ? "Male" : "Female",
      s.parent_name || "",
      s.parent_phone || "",
      s.classes?.name || "",
      s.opening_balance || "0",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  };

  const boysCount = students.filter((s) => s.gender === "M").length;
  const girlsCount = students.filter((s) => s.gender === "F").length;

  const generatePLEIndexNumbers = async () => {
    const p7Students = students.filter(
      (s) => s.classes?.name?.startsWith("P.7") && !s.ple_index_number,
    );
    if (p7Students.length === 0) {
      toast.error("No P.7 students without index numbers");
      return;
    }
    try {
      const year = new Date().getFullYear();
      const schoolCode = school?.school_code || "SCHL";
      let startNum = 1;
      const existingNumbers = students.filter((s) =>
        s.ple_index_number?.startsWith(schoolCode + year),
      );
      if (existingNumbers.length > 0) {
        const nums = existingNumbers.map((s) =>
          parseInt(s.ple_index_number?.slice(-4) || "0"),
        );
        startNum = Math.max(...nums) + 1;
      }
      for (const student of p7Students) {
        const indexNum = `${schoolCode}${year}${String(startNum).padStart(4, "0")}`;
        await updateStudent(student.id, { ple_index_number: indexNum });
        startNum++;
      }
      toast.success(`Generated ${p7Students.length} PLE index numbers`);
    } catch (err) {
      toast.error("Failed to generate index numbers");
    }
  };

  // ===== TRANSFERS LOGIC =====
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

  // ===== DROPOUT LOGIC =====
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
        school_id: school?.id,
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

  // ===== PROMOTION LOGIC =====
  const toggleStudent = (id: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      setStudentActions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      newSelected.add(id);
      setStudentActions((prev) => ({ ...prev, [id]: { action: "promote" } }));
    }
    setSelectedStudents(newSelected);
  };

  const toggleAll = () => {
    if (selectedStudents.size === promotionStudents.length) {
      setSelectedStudents(new Set());
      setStudentActions({});
    } else {
      const newSet = new Set(promotionStudents.map((s) => s.id));
      const newActions: StudentActionMap = {};
      promotionStudents.forEach((s) => {
        newActions[s.id] = { action: "promote" };
      });
      setSelectedStudents(newSet);
      setStudentActions(newActions);
    }
  };

  const setAction = (studentId: string, action: StudentAction) => {
    if (action === "demote") {
      setShowDemoteModal(studentId);
      return;
    }
    setStudentActions((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        action,
        targetClassId: undefined,
        reason: undefined,
      },
    }));
  };

  const confirmDemote = () => {
    if (!showDemoteModal || !demoteClass) {
      toast.error("Please select a class to demote to");
      return;
    }
    setStudentActions((prev) => ({
      ...prev,
      [showDemoteModal]: {
        action: "demote",
        targetClassId: demoteClass,
        reason: demoteReason,
      },
    }));
    setShowDemoteModal(null);
    setDemoteReason("");
    setDemoteClass("");
  };

  const processPromotions = async () => {
    const selectedArray = Array.from(selectedStudents);
    if (selectedArray.length === 0) {
      toast.error("No students selected");
      return;
    }
    const promoteStudents = selectedArray.filter(
      (id) => studentActions[id]?.action === "promote",
    );
    if (promoteStudents.length > 0 && !toClass) {
      toast.error("Please select a target class for promoted students");
      return;
    }
    setPromoting(true);
    try {
      let user_id = "demo-user";
      if (!isDemo) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        user_id = user?.id || user_id;
      }

      let promoted = 0,
        repeating = 0,
        demoted = 0;

      for (const studentId of selectedArray) {
        const actionData = studentActions[studentId];
        if (!actionData) continue;
        const action = actionData.action;

        if (isDemo) {
          if (action === "promote") {
            await updateStudent(studentId, { class_id: toClass });
            promoted++;
          } else if (action === "repeat") {
            await updateStudent(studentId, { repeating: true });
            repeating++;
          } else if (action === "demote") {
            const targetClass = actionData.targetClassId || fromClass;
            await updateStudent(studentId, { class_id: targetClass });
            demoted++;
          }
          continue;
        }

        if (action === "promote") {
          await supabase
            .from("students")
            .update({ class_id: toClass, repeating: false })
            .eq("id", studentId);
          await supabase.from("student_promotions").insert({
            school_id: school?.id,
            student_id: studentId,
            from_class_id: fromClass,
            to_class_id: toClass,
            academic_year: academicYear,
            promotion_type: "promoted",
            promoted_by: user_id,
            promoted_at: new Date().toISOString(),
          });
          promoted++;
        } else if (action === "repeat") {
          await supabase
            .from("students")
            .update({ repeating: true })
            .eq("id", studentId);
          await supabase.from("student_promotions").insert({
            school_id: school?.id,
            student_id: studentId,
            from_class_id: fromClass,
            to_class_id: fromClass,
            academic_year: academicYear,
            promotion_type: "repeating",
            notes: "Repeating class",
            promoted_by: user_id,
            promoted_at: new Date().toISOString(),
          });
          repeating++;
        } else if (action === "demote") {
          const targetClass = actionData.targetClassId || fromClass;
          await supabase
            .from("students")
            .update({ class_id: targetClass, repeating: false })
            .eq("id", studentId);
          await supabase.from("student_promotions").insert({
            school_id: school?.id,
            student_id: studentId,
            from_class_id: fromClass,
            to_class_id: targetClass,
            academic_year: academicYear,
            promotion_type: "demoted",
            notes: actionData.reason || "Demoted",
            promoted_by: user_id,
            promoted_at: new Date().toISOString(),
          });
          demoted++;
        }
      }
      const summaryParts: string[] = [];
      if (promoted > 0) summaryParts.push(`${promoted} promoted`);
      if (repeating > 0) summaryParts.push(`${repeating} repeating`);
      if (demoted > 0) summaryParts.push(`${demoted} demoted`);
      toast.success(summaryParts.join(", ") + " successfully");
      fetchPromotionStudents();
      fetchPromotionHistory();
      setSelectedStudents(new Set());
      setStudentActions({});
    } catch (err: any) {
      toast.error(err.message || "Processing failed");
    } finally {
      setPromoting(false);
    }
  };

  const getNextClassOptions = () => {
    if (!fromClass) return [];
    const currentClass = promotionClasses.find((c) => c.id === fromClass);
    if (!currentClass) return [];
    const levelNum = parseInt(currentClass.level.replace(/\D/g, ""));
    if (currentClass.level === "P.7" || currentClass.level.includes("P7"))
      return promotionClasses.filter(
        (c) => c.level.includes("S.1") || c.level.includes("S1"),
      );
    if (currentClass.level === "S.4" || currentClass.level.includes("S4"))
      return promotionClasses.filter(
        (c) => c.level.includes("S.5") || c.level.includes("S5"),
      );
    const nextLevel = levelNum + 1;
    return promotionClasses.filter(
      (c) => parseInt(c.level.replace(/\D/g, "")) === nextLevel,
    );
  };

  const getPrevClassOptions = () => {
    if (!fromClass) return [];
    const currentClass = promotionClasses.find((c) => c.id === fromClass);
    if (!currentClass) return [];
    const levelNum = parseInt(currentClass.level.replace(/\D/g, ""));
    if (levelNum <= 1) return [];
    const prevLevel = levelNum - 1;
    return promotionClasses.filter(
      (c) => parseInt(c.level.replace(/\D/g, "")) === prevLevel,
    );
  };

  const actionCounts = {
    promote: Object.values(studentActions).filter((a) => a.action === "promote")
      .length,
    repeat: Object.values(studentActions).filter((a) => a.action === "repeat")
      .length,
    demote: Object.values(studentActions).filter((a) => a.action === "demote")
      .length,
  };

  const handleAutoPromote = async () => {
    if (!school?.id) {
      toast.error("No school selected");
      return;
    }
    const year = academicYear || new Date().getFullYear().toString();
    setAutoPromoting(true);
    setAutoPromoteResult(null);
    try {
      const res = await fetch("/api/automation/auto-promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, academicYear: year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auto-promotion failed");
      setAutoPromoteResult(data);
      toast.success(
        `Auto-promotion complete: ${data.summary.promoted} promoted, ${data.summary.retained} retained`,
      );
      fetchPromotionHistory();
    } catch (err: any) {
      toast.error(err.message || "Auto-promotion failed");
    } finally {
      setAutoPromoting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Student Hub"
        subtitle={`${students.length} students enrolled in ${academicYear} (${students.filter((s) => s.gender === "M").length} Boys / ${students.filter((s) => s.gender === "F").length} Girls)`}
        variant="premium"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkImportModal(true)}
              className="btn btn-navy btn-sm"
            >
              <MaterialIcon icon="cloud_upload" />
              Import
            </button>
            <Link
              href="/dashboard/students/add"
              className="btn btn-primary btn-sm"
            >
              <MaterialIcon icon="add" />
              New Student
            </Link>
          </div>
        }
      />

      <StudentSummaryPulse
        totalStudents={students.length}
        boysCount={students.filter((s) => s.gender === "M").length}
        girlsCount={students.filter((s) => s.gender === "F").length}
        atRiskCount={atRiskStudents.length}
      />

      <PageGuidance
        title="How to Manage Students"
        tips={[
          {
            icon: "person_add",
            text: "Add Student: Click 'Add Student' to register new students",
          },
          {
            icon: "upload",
            text: "Bulk Import: Use CSV import for multiple students at once",
          },
          {
            icon: "search",
            text: "Search: Use filters to find students by name, class, or status",
          },
          {
            icon: "edit",
            text: "Edit: Click a student row to view/edit details, marks, attendance",
          },
          {
            icon: "trending_up",
            text: "Promote: Use Promotion tab to move students to next class",
          },
        ]}
      />

      <Tabs
        tabs={[
          { id: "registry", label: "Registry", count: students.length },
          {
            id: "transfers",
            label: "Transfers",
            count: transferredInCount + transferredOutCount,
          },
          {
            id: "dropouts",
            label: "Dropouts",
            count: atRiskCount + likelyDropoutCount,
          },
          { id: "promotion", label: "Promotion" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {/* ===== REGISTRY TAB ===== */}
      <TabPanel activeTab={activeTab} tabId="registry">
        <div className="page-header mb-6">
          <div>
            <div className="ph-title">Student Registry</div>
            <div className="ph-sub">{students.length} students enrolled</div>
          </div>
          <div className="ph-actions">
            <button onClick={generatePLEIndexNumbers} className="btn btn-ghost">
              <MaterialIcon icon="tag" style={{ fontSize: "16px" }} />
              Generate PLE Index
            </button>
            <button onClick={handleExport} className="btn btn-ghost">
              <MaterialIcon icon="download" style={{ fontSize: "16px" }} />
              Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
            >
              <MaterialIcon icon="person_add" style={{ fontSize: "16px" }} />
              Add Student
            </button>
          </div>
        </div>

        {students.length === 0 && <OnboardingTips schoolId={school?.id} />}

        <div
          className="card"
          style={{
            padding: "22px",
            borderRadius: "24px",
            marginBottom: "20px",
          }}
        >
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--navy)] mb-2">
            Quick import
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-[var(--t3)]">
            <p className="flex-1 min-w-[220px]">
              Download the structured templates, drop your data, and we&apos;ll
              auto-map columns to fields. Preview before confirming.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/templates/classes-template.csv"
                download
                target="_blank"
                className="btn btn-ghost btn-sm"
              >
                Class template
              </a>
              <a
                href="/templates/staff-template.csv"
                download
                target="_blank"
                className="btn btn-ghost btn-sm"
              >
                Staff template
              </a>
              <a
                href="/templates/students-template.csv"
                download
                target="_blank"
                className="btn btn-ghost btn-sm"
              >
                Student template
              </a>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <div className="space-y-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)]/60 p-4">
              <div className="text-sm font-semibold text-[var(--t1)]">
                Upload student list
              </div>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleStudentTemplateUpload}
                className="w-full text-sm text-slate-600"
                disabled={templateStatus === "parsing"}
              />
              <p className="text-xs text-[var(--t3)]">
                We auto-map Excel columns using simple heuristics; add headers
                exactly as shown.
              </p>
              {templateStatus === "parsing" && (
                <p className="text-xs text-[var(--green)]">Parsing file...</p>
              )}
              {templateErrors && (
                <p className="text-xs text-[var(--amber)]">{templateErrors}</p>
              )}
              {templateStatus === "ready" && (
                <button
                  onClick={handleSeedStudentsFromTemplate}
                  className="btn btn-primary btn-sm"
                  disabled={importingTemplate}
                >
                  {importingTemplate ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Seeding {templateRows.length} students...
                    </span>
                  ) : (
                    "Seed students from template"
                  )}
                </button>
              )}
              {importingTemplate && (
                <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[var(--primary)] h-full transition-all duration-300"
                    style={{
                      width: `${((importSummary?.success || 0) / templateRows.length) * 100}%`,
                    }}
                  />
                </div>
              )}
              {importSummary && (
                <p className="text-xs text-[var(--navy)]">
                  Imported {importSummary.success}/{importSummary.total}{" "}
                  students ({importSummary.failed} failed).
                </p>
              )}
            </div>
            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--navy-soft)] p-4 space-y-3">
              <div className="text-sm font-semibold text-[var(--t1)]">
                Preview & AI hints
              </div>
              {templatePreviewRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {Object.keys(templatePreviewRows[0]).map((col) => (
                          <th
                            key={col}
                            className="px-2 py-1 text-left text-[11px] uppercase tracking-[0.2em] text-[var(--t3)]"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {templatePreviewRows.map((row, index) => (
                        <tr
                          key={index}
                          className="border-t border-[var(--border)]"
                        >
                          {Object.values(row).map((value, idx) => (
                            <td
                              key={`${index}-${idx}`}
                              className="px-2 py-1 truncate max-w-[120px]"
                            >
                              {value || "\u2014"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[var(--t3)]">
                  Upload a file to preview the parsed rows.
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
          style={{ marginBottom: 20 }}
        >
          <div
            className="card"
            style={{
              padding: 16,
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--navy-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcon style={{ fontSize: 18, color: "var(--navy)" }}>
                  group
                </MaterialIcon>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".7px",
                  textTransform: "uppercase",
                  color: "var(--t3)",
                }}
              >
                Total
              </span>
            </div>
            <div
              style={{
                fontFamily: "Sora",
                fontSize: 28,
                fontWeight: 800,
                color: "var(--navy)",
              }}
            >
              {students.length}
            </div>
          </div>
          <div
            className="card"
            style={{
              padding: 16,
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "rgba(23,50,95,.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcon style={{ fontSize: 18, color: "var(--navy)" }}>
                  male
                </MaterialIcon>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".7px",
                  textTransform: "uppercase",
                  color: "var(--t3)",
                }}
              >
                Boys
              </span>
            </div>
            <div
              style={{
                fontFamily: "Sora",
                fontSize: 28,
                fontWeight: 800,
                color: "var(--navy)",
              }}
            >
              {boysCount}
            </div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "rgba(192,57,43,.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcon style={{ fontSize: 18, color: "var(--red)" }}>
                  female
                </MaterialIcon>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".7px",
                  textTransform: "uppercase",
                  color: "var(--t3)",
                }}
              >
                Girls
              </span>
            </div>
            <div
              style={{
                fontFamily: "Sora",
                fontSize: 28,
                fontWeight: 800,
                color: "var(--navy)",
              }}
            >
              {girlsCount}
            </div>
          </div>
          <div
            className="card"
            style={{
              padding: 16,
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--green-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcon style={{ fontSize: 18, color: "var(--green)" }}>
                  school
                </MaterialIcon>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".7px",
                  textTransform: "uppercase",
                  color: "var(--t3)",
                }}
              >
                Classes
              </span>
            </div>
            <div
              style={{
                fontFamily: "Sora",
                fontSize: 28,
                fontWeight: 800,
                color: "var(--navy)",
              }}
            >
              {classes.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, marginBottom: 20 }}>
          <div
            style={{
              padding: 14,
              borderBottom: "1px solid var(--border)",
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
              <MaterialIcon
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 16,
                  color: "var(--t3)",
                }}
              >
                search
              </MaterialIcon>
              <input
                type="text"
                placeholder="Search by name, parent, or student number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  background: "var(--bg)",
                  color: "var(--t1)",
                }}
              />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: "var(--surface)",
                color: "var(--t1)",
                minWidth: 140,
                cursor: "pointer",
              }}
            >
              <option value="all">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.stream ? ` ${c.stream}` : ""}
                </option>
              ))}
            </select>
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value as any)}
              style={{
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: "var(--surface)",
                color: "var(--t1)",
                cursor: "pointer",
              }}
            >
              <option value="all">All Genders</option>
              <option value="M">Boys only</option>
              <option value="F">Girls only</option>
            </select>
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              style={{
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: "var(--surface)",
                color: "var(--t1)",
                cursor: "pointer",
              }}
            >
              <option value="all">All Positions</option>
              <option value="monitor">Class Monitors</option>
              <option value="prefect">Prefects</option>
            </select>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--t1)",
              }}
            >
              <input
                type="checkbox"
                checked={filterDefaulters}
                onChange={(e) => setFilterDefaulters(e.target.checked)}
              />
              Defaulters
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: "var(--surface)",
                color: "var(--t1)",
                cursor: "pointer",
              }}
            >
              <option value="name">Sort by Name</option>
              <option value="number">Sort by Number</option>
              <option value="class">Sort by Class</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    padding: 16,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="skeleton"
                    style={{ height: 40, width: "100%" }}
                  ></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "var(--bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <MaterialIcon style={{ fontSize: 24, color: "var(--t3)" }}>
                  group
                </MaterialIcon>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--t1)",
                  marginBottom: 4,
                }}
              >
                No students found
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)" }}>
                {searchTerm
                  ? "Try a different search term"
                  : "Add your first student to get started"}
              </div>
              {!searchTerm && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn btn-primary"
                  style={{ marginTop: 16 }}
                >
                  <MaterialIcon
                    icon="person_add"
                    style={{ fontSize: "16px" }}
                  />
                  Add Student
                </button>
              )}
            </div>
          ) : (
            <div className="tbl-wrap table-responsive">
              <table>
                <thead>
                  <tr>
                    <th data-label="Student">Student</th>
                    <th data-label="Number">Number</th>
                    <th data-label="Class">Class</th>
                    <th data-label="Parent">Parent</th>
                    <th data-label="Phone">Phone</th>
                    <th data-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <tr key={student.id}>
                      <td data-label="Student">
                        <Link
                          href={`/dashboard/students/${student.id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textDecoration: "none",
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#fff",
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
                            <div
                              style={{ fontWeight: 600, color: "var(--t1)" }}
                            >
                              {student.first_name} {student.last_name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--t3)" }}>
                              {student.gender === "M" ? "Male" : "Female"}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td
                        data-label="Number"
                        style={{ fontFamily: "DM Mono", fontSize: 12 }}
                      >
                        {student.student_number || "-"}
                      </td>
                      <td data-label="Class">
                        <span
                          style={{
                            padding: "4px 10px",
                            background: "var(--bg)",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {student.classes?.name}
                          {student.classes?.stream
                            ? ` ${student.classes.stream}`
                            : ""}
                          {(student as any).boarding_status &&
                            (student as any).boarding_status !== "day" && (
                              <span
                                style={{
                                  marginLeft: 4,
                                  fontSize: 9,
                                  padding: "1px 5px",
                                  background: "rgba(155,89,182,0.15)",
                                  color: "#0d9488",
                                  borderRadius: 8,
                                  fontWeight: 600,
                                }}
                              >
                                {(student as any).boarding_status}
                              </span>
                            )}
                        </span>
                      </td>
                      <td data-label="Parent" style={{ fontSize: 13 }}>
                        {student.parent_name || "-"}
                      </td>
                      <td
                        data-label="Phone"
                        style={{ fontSize: 13, fontFamily: "DM Mono" }}
                      >
                        {student.parent_phone || "-"}
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => setSmsTarget(student)}
                            title="SMS Parent"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 6,
                              borderRadius: 6,
                            }}
                          >
                            <MaterialIcon
                              style={{ fontSize: 16, color: "var(--t3)" }}
                            >
                              sms
                            </MaterialIcon>
                          </button>
                          <button
                            onClick={() => openEditModal(student)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 6,
                              borderRadius: 6,
                            }}
                          >
                            <MaterialIcon
                              style={{ fontSize: 16, color: "var(--t3)" }}
                            >
                              edit
                            </MaterialIcon>
                          </button>
                          <button
                            onClick={() => confirmDelete(student.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 6,
                              borderRadius: 6,
                            }}
                          >
                            <MaterialIcon
                              style={{ fontSize: 16, color: "var(--t3)" }}
                            >
                              delete
                            </MaterialIcon>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="bg-[var(--surface)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] p-4 flex items-center justify-between">
                <div
                  style={{ fontFamily: "Sora", fontSize: 16, fontWeight: 700 }}
                >
                  Add New Student
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <MaterialIcon style={{ fontSize: 18, color: "var(--t3)" }}>
                    close
                  </MaterialIcon>
                </button>
              </div>
              <form onSubmit={handleCreateStudent} style={{ padding: 20 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      First Name
                    </label>
                    <input
                      type="text"
                      value={newStudent.first_name}
                      onChange={(e) =>
                        handleNewStudentChange({ first_name: e.target.value })
                      }
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={newStudent.last_name}
                      onChange={(e) =>
                        handleNewStudentChange({ last_name: e.target.value })
                      }
                      className="input"
                      required
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Gender
                    </label>
                    <select
                      value={newStudent.gender}
                      onChange={(e) =>
                        handleNewStudentChange({
                          gender: e.target.value as "M" | "F",
                        })
                      }
                      className="input"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={newStudent.date_of_birth}
                      onChange={(e) =>
                        handleNewStudentChange({
                          date_of_birth: e.target.value,
                        })
                      }
                      className="input"
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".5px",
                      textTransform: "uppercase",
                      color: "var(--t3)",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Class
                  </label>
                  {classes.length === 0 ? (
                    <div
                      style={{
                        background: "var(--amber-soft)",
                        border: "1px solid var(--amber)",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <p
                        style={{
                          color: "var(--t1)",
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        No classes found
                      </p>
                      <p
                        style={{
                          color: "var(--amber)",
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        Contact support if this persists.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={newStudent.class_id}
                      onChange={(e) =>
                        handleNewStudentChange({ class_id: e.target.value })
                      }
                      className="input"
                      required
                    >
                      <option value="">Select class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".5px",
                      textTransform: "uppercase",
                      color: "var(--t3)",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Parent Name
                  </label>
                  <input
                    type="text"
                    value={newStudent.parent_name}
                    onChange={(e) =>
                      handleNewStudentChange({ parent_name: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Parent Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="0700000000"
                      value={newStudent.parent_phone}
                      onChange={(e) =>
                        handleNewStudentChange({ parent_phone: e.target.value })
                      }
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Alt. Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="0700000000"
                      value={newStudent.parent_phone2}
                      onChange={(e) =>
                        handleNewStudentChange({
                          parent_phone2: e.target.value,
                        })
                      }
                      className="input"
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".5px",
                      textTransform: "uppercase",
                      color: "var(--t3)",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Opening Balance (Previous Debt/Credit)
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 14,
                        color: "var(--t3)",
                      }}
                    >
                      UGX
                    </span>
                    <input
                      type="number"
                      value={newStudent.opening_balance}
                      onChange={(e) =>
                        handleNewStudentChange({
                          opening_balance: e.target.value,
                        })
                      }
                      className="input"
                      style={{ paddingLeft: 45 }}
                    />
                  </div>
                  <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 4 }}>
                    Positive for debt (arrears), negative for credit/advance.
                  </p>
                </div>
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: 16,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--t1)",
                      marginBottom: 12,
                    }}
                  >
                    Additional Details
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Boarding Status
                      </label>
                      <select
                        value={newStudent.boarding_status}
                        onChange={(e) =>
                          handleNewStudentChange({
                            boarding_status: e.target.value as
                              | "day"
                              | "boarding"
                              | "weekly",
                          })
                        }
                        className="input"
                      >
                        <option value="day">Day Scholar</option>
                        <option value="boarding">Boarding</option>
                        <option value="weekly">Weekly Boarder</option>
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Previous School
                      </label>
                      <input
                        type="text"
                        value={newStudent.previous_school}
                        onChange={(e) =>
                          handleNewStudentChange({
                            previous_school: e.target.value,
                          })
                        }
                        className="input"
                        placeholder="e.g., St. Peter's PS"
                      />
                    </div>
                  </div>
                  {houses.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: ".5px",
                            textTransform: "uppercase",
                            color: "var(--t3)",
                            marginBottom: 6,
                            display: "block",
                          }}
                        >
                          House
                        </label>
                        <select
                          value={newStudent.house_id}
                          onChange={(e) =>
                            handleNewStudentChange({ house_id: e.target.value })
                          }
                          className="input"
                        >
                          <option value="">No house</option>
                          {houses.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: ".5px",
                            textTransform: "uppercase",
                            color: "var(--t3)",
                            marginBottom: 6,
                            display: "block",
                          }}
                        >
                          Games House
                        </label>
                        <select
                          value={newStudent.games_house}
                          onChange={(e) =>
                            handleNewStudentChange({
                              games_house: e.target.value,
                            })
                          }
                          className="input"
                        >
                          <option value="">Same as house</option>
                          {houses.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        District of Origin
                      </label>
                      <input
                        type="text"
                        value={newStudent.district_origin}
                        onChange={(e) =>
                          handleNewStudentChange({
                            district_origin: e.target.value,
                          })
                        }
                        className="input"
                        placeholder="e.g., Kampala"
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Sub-County
                      </label>
                      <input
                        type="text"
                        value={newStudent.sub_county}
                        onChange={(e) =>
                          handleNewStudentChange({ sub_county: e.target.value })
                        }
                        className="input"
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Parish
                      </label>
                      <input
                        type="text"
                        value={newStudent.parish}
                        onChange={(e) =>
                          handleNewStudentChange({ parish: e.target.value })
                        }
                        className="input"
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Village
                      </label>
                      <input
                        type="text"
                        value={newStudent.village}
                        onChange={(e) =>
                          handleNewStudentChange({ village: e.target.value })
                        }
                        className="input"
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Leadership Position
                      </label>
                      <select
                        value={
                          newStudent.prefect_role ||
                          newStudent.student_council_role ||
                          ""
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (
                            [
                              "head_boy",
                              "head_girl",
                              "sports_prefect",
                              "dining_prefect",
                              "library_prefect",
                              "health_prefect",
                            ].includes(val)
                          ) {
                            handleNewStudentChange({
                              prefect_role: val,
                              student_council_role: "",
                            });
                          } else if (
                            [
                              "president",
                              "vice_president",
                              "secretary",
                              "treasurer",
                            ].includes(val)
                          ) {
                            handleNewStudentChange({
                              student_council_role: val,
                              prefect_role: "",
                            });
                          } else {
                            handleNewStudentChange({
                              prefect_role: "",
                              student_council_role: "",
                            });
                          }
                        }}
                        className="input"
                      >
                        <option value="">None</option>
                        <optgroup label="Prefects">
                          <option value="head_boy">Head Boy</option>
                          <option value="head_girl">Head Girl</option>
                          <option value="sports_prefect">Sports Prefect</option>
                          <option value="dining_prefect">Dining Prefect</option>
                          <option value="library_prefect">
                            Library Prefect
                          </option>
                          <option value="health_prefect">Health Prefect</option>
                        </optgroup>
                        <optgroup label="Student Council">
                          <option value="president">President</option>
                          <option value="vice_president">Vice President</option>
                          <option value="secretary">Secretary</option>
                          <option value="treasurer">Treasurer</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Class Monitor
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          checked={newStudent.is_class_monitor}
                          onChange={(e) =>
                            handleNewStudentChange({
                              is_class_monitor: e.target.checked,
                            })
                          }
                          className="w-5 h-5 rounded"
                        />
                        <span className="text-sm">
                          Yes, this student is a class monitor
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {saving ? "Adding..." : "Add Student"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingStudent && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <div
              className="bg-[var(--surface)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] p-4 flex items-center justify-between">
                <div
                  style={{ fontFamily: "Sora", fontSize: 16, fontWeight: 700 }}
                >
                  Edit Student
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <MaterialIcon style={{ fontSize: 18, color: "var(--t3)" }}>
                    close
                  </MaterialIcon>
                </button>
              </div>
              <form onSubmit={handleUpdateStudent} style={{ padding: 20 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 20,
                    paddingBottom: 16,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      background: "var(--bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      border: "2px dashed var(--border)",
                      cursor: "pointer",
                    }}
                    title="Click to upload photo"
                  >
                    {(editingStudent as any)?.photo_url ? (
                      <img
                        src={(editingStudent as any).photo_url}
                        alt="Student"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <MaterialIcon
                        style={{ fontSize: 32, color: "var(--t3)" }}
                      >
                        person
                      </MaterialIcon>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                        cursor: "pointer",
                      }}
                    >
                      Student Photo
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingPhoto}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingPhoto(true);
                          // In demo mode, just simulate upload
                          if (isDemo) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              const updatedStudent = {
                                ...editingStudent,
                                photo_url: reader.result,
                              };
                              setEditingStudent(updatedStudent);
                              setEditForm((prev: any) => ({
                                ...prev,
                                photo_url: reader.result,
                              }));
                              setUploadingPhoto(false);
                            };
                            reader.readAsDataURL(file);
                          } else {
                            // Real upload would go to Supabase storage
                            setUploadingPhoto(false);
                          }
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                    <p style={{ fontSize: 11, color: "var(--t3)" }}>
                      {uploadingPhoto
                        ? "Uploading..."
                        : "Click to upload new photo"}
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      First Name
                    </label>
                    <input
                      type="text"
                      value={editForm.first_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, first_name: e.target.value })
                      }
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={editForm.last_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, last_name: e.target.value })
                      }
                      className="input"
                      required
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Gender
                    </label>
                    <select
                      value={editForm.gender}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          gender: e.target.value as "M" | "F",
                        })
                      }
                      className="input"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={editForm.date_of_birth}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          date_of_birth: e.target.value,
                        })
                      }
                      className="input"
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".5px",
                      textTransform: "uppercase",
                      color: "var(--t3)",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Class
                  </label>
                  <select
                    value={editForm.class_id}
                    onChange={(e) =>
                      setEditForm({ ...editForm, class_id: e.target.value })
                    }
                    className="input"
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
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".5px",
                      textTransform: "uppercase",
                      color: "var(--t3)",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Parent Name
                  </label>
                  <input
                    type="text"
                    value={editForm.parent_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, parent_name: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Parent Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="0700000000"
                      value={editForm.parent_phone}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          parent_phone: e.target.value,
                        })
                      }
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        color: "var(--t3)",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Alt. Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="0700000000"
                      value={editForm.parent_phone2}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          parent_phone2: e.target.value,
                        })
                      }
                      className="input"
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".5px",
                      textTransform: "uppercase",
                      color: "var(--t3)",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Opening Balance
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 14,
                        color: "var(--t3)",
                      }}
                    >
                      UGX
                    </span>
                    <input
                      type="number"
                      value={editForm.opening_balance}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          opening_balance: e.target.value,
                        })
                      }
                      className="input"
                      style={{ paddingLeft: 45 }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {saving ? "Updating..." : "Update Student"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {smsTarget && (
          <SendSMSModal
            student={smsTarget}
            isOpen={!!smsTarget}
            onClose={() => setSmsTarget(null)}
          />
        )}
      </TabPanel>

      {/* ===== TRANSFERS TAB ===== */}
      <TabPanel activeTab={activeTab} tabId="transfers">
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
                <MaterialIcon className="text-gray-500">
                  swap_horiz
                </MaterialIcon>
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
          activeTab={transferActiveTab}
          onChange={(v) => setTransferActiveTab(v as TransferTab)}
          className="mb-6"
        />

        {transferActiveTab === "in" && (
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

        {transferActiveTab === "out" && (
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
                            ? new Date(
                                record.transfer_date,
                              ).toLocaleDateString()
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

        {/* Transfer In Modal */}
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                      First Name
                    </label>
                    <input
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                      Last Name
                    </label>
                    <input
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                      Gender
                    </label>
                    <select
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                      Date of Birth
                    </label>
                    <input
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                    Previous School
                  </label>
                  <input
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                    Transfer Reason
                  </label>
                  <select
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                    Assign to Class
                  </label>
                  <select
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                    Parent/Guardian Name
                  </label>
                  <input
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                      Parent Phone
                    </label>
                    <input
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                      Alt. Phone
                    </label>
                    <input
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
                  <Button className="flex-1" disabled={transferSaving}>
                    {transferSaving ? "Adding..." : "Add Transfer Student"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transfer Out Modal */}
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                    Select Student
                  </label>
                  {activeStudents.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                      No active students
                    </div>
                  ) : (
                    <select
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                    Transferring To (School Name)
                  </label>
                  <input
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                    Reason
                  </label>
                  <select
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                    Transfer Date
                  </label>
                  <input
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
                  <Button className="flex-1" disabled={transferSaving}>
                    {transferSaving ? "Processing..." : "Transfer Out"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {printData && (
          <div className="hidden">
            <div ref={transferPrintRef}>
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
                  {printData.gender === "M" ? "Male" : "Female"}) was a student
                  at{" "}
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
      </TabPanel>

      {/* ===== DROPOUTS TAB ===== */}
      <TabPanel activeTab={activeTab} tabId="dropouts">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <MaterialIcon className="text-amber-600">warning</MaterialIcon>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
                At Risk
              </span>
            </div>
            <div className="text-3xl font-bold text-amber-600">
              {atRiskCount}
            </div>
            <div className="text-xs text-[var(--t3)]">14-29 days absent</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                <MaterialIcon className="text-red-600">error</MaterialIcon>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
                Likely Dropout
              </span>
            </div>
            <div className="text-3xl font-bold text-red-600">
              {likelyDropoutCount}
            </div>
            <div className="text-xs text-[var(--t3)]">30+ days absent</div>
          </Card>
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
              {students.filter((s) => s.status === "active").length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <MaterialIcon className="text-gray-500">
                  person_off
                </MaterialIcon>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
                Dropouts
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-600">
              {students.filter((s) => s.status === "dropped").length}
            </div>
          </Card>
        </div>

        <div className="flex gap-4 mb-4 items-center">
          <select
            aria-label="Class filter"
            value={dropoutClassFilter}
            onChange={(e) => setDropoutClassFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
          >
            <option value="all">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={fetchAtRiskStudents}>
            <MaterialIcon icon="refresh" className="text-base" />
            Refresh
          </Button>
        </div>

        <Card>
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--on-surface)]">
              {atRiskCount + likelyDropoutCount > 0
                ? `${filteredAtRisk.length} student${filteredAtRisk.length !== 1 ? "s" : ""} at risk of dropout`
                : "No at-risk students found"}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Student
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Class
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Days Absent
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Last Attendance
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Risk Level
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Parent Phone
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingAtRisk ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-8 text-[var(--t3)]"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : filteredAtRisk.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-8 text-[var(--t3)]"
                    >
                      No at-risk students found
                    </td>
                  </tr>
                ) : (
                  filteredAtRisk.map((student) => (
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
                              {student.student_number || "-"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">
                          {student.class_name}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className="font-bold"
                          style={{
                            color:
                              student.consecutive_absent >= 30
                                ? "#e74c3c"
                                : "#f39c12",
                          }}
                        >
                          {student.consecutive_absent} days
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        {student.last_attendance_date
                          ? new Date(
                              student.last_attendance_date,
                            ).toLocaleDateString()
                          : "No record"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${student.risk_level === "likely_dropout" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                        >
                          {student.risk_level === "likely_dropout"
                            ? "Likely Dropout"
                            : "At Risk"}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-mono">
                        {student.parent_phone || "-"}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleContactParent(student)}
                            disabled={
                              sendingSms === student.id || !student.parent_phone
                            }
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-40"
                            title="Send SMS to parent"
                          >
                            <MaterialIcon
                              icon="sms"
                              className="text-sm mr-0.5"
                            />
                            {sendingSms === student.id
                              ? "Sending..."
                              : "Contact"}
                          </button>
                          <button
                            onClick={() => setShowDropoutModal(student.id)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                            title="Mark as dropout"
                          >
                            <MaterialIcon
                              icon="person_remove"
                              className="text-sm mr-0.5"
                            />
                            Dropout
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {showDropoutModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDropoutModal(null)}
          >
            <div
              className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="text-lg font-bold text-[var(--on-surface)]">
                  Mark as Dropout
                </h2>
                <button
                  onClick={() => setShowDropoutModal(null)}
                  className="p-1 hover:bg-[var(--surface-container)] rounded-lg"
                >
                  <MaterialIcon className="text-xl text-[var(--t3)]">
                    close
                  </MaterialIcon>
                </button>
              </div>
              <div className="p-5">
                <p className="text-sm text-[var(--t3)] mb-4">
                  This will set the student status to &quot;dropped&quot;.
                  Please provide a reason.
                </p>
                <div className="mb-5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                    Reason for Dropout
                  </label>
                  <select
                    value={dropoutReason}
                    onChange={(e) => setDropoutReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    required
                  >
                    <option value="">Select reason...</option>
                    <option value="Financial difficulties">
                      Financial difficulties
                    </option>
                    <option value="Family relocation">Family relocation</option>
                    <option value="Pregnancy">Pregnancy</option>
                    <option value="Early marriage">Early marriage</option>
                    <option value="Child labor">Child labor</option>
                    <option value="Illness/Disability">
                      Illness/Disability
                    </option>
                    <option value="Lost interest">Lost interest</option>
                    <option value="Death">Death</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setShowDropoutModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={handleMarkDropout}
                    disabled={!dropoutReason}
                  >
                    Mark as Dropout
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </TabPanel>

      {/* ===== PROMOTION TAB ===== */}
      <TabPanel activeTab={activeTab} tabId="promotion">
        <div className="flex gap-3 mb-6 flex-wrap">
          <Button
            onClick={handleAutoPromote}
            disabled={autoPromoting}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
          >
            <MaterialIcon icon="auto_fix_high" style={{ fontSize: 18 }} />
            {autoPromoting ? "Auto-Promoting..." : "Auto-Promote All Students"}
          </Button>
        </div>

        {autoPromoteResult && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Auto-Promotion Results</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 rounded-xl bg-green-50">
                  <div className="text-2xl font-bold text-green-600">
                    {autoPromoteResult.summary.promoted}
                  </div>
                  <div className="text-xs text-green-700">Promoted</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-yellow-50">
                  <div className="text-2xl font-bold text-yellow-600">
                    {autoPromoteResult.summary.retained}
                  </div>
                  <div className="text-xs text-yellow-700">Retained</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-red-50">
                  <div className="text-2xl font-bold text-red-600">
                    {autoPromoteResult.summary.errors}
                  </div>
                  <div className="text-xs text-red-700">Errors</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-blue-50">
                  <div className="text-2xl font-bold text-blue-600">
                    {autoPromoteResult.summary.total}
                  </div>
                  <div className="text-xs text-blue-700">Total Processed</div>
                </div>
              </div>
              {autoPromoteResult.results.promoted.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-green-700 mb-2">
                    Promoted Students
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {autoPromoteResult.results.promoted.map(
                      (p: any, i: number) => (
                        <div
                          key={i}
                          className="text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg"
                        >
                          {p.name}: {p.fromClass} &rarr; {p.toClass}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
              {autoPromoteResult.results.retained.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-yellow-700 mb-2">
                    Retained Students
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {autoPromoteResult.results.retained.map(
                      (r: any, i: number) => (
                        <div
                          key={i}
                          className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-lg"
                        >
                          {r.name}: {r.reason}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {selectedStudents.size > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {actionCounts.promote > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                {actionCounts.promote} to promote
              </span>
            )}
            {actionCounts.repeat > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                {actionCounts.repeat} repeating
              </span>
            )}
            {actionCounts.demote > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                {actionCounts.demote} to demote
              </span>
            )}
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Students</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--on-surface)]">
                  From Class
                </label>
                {promotionClasses.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                    No classes available
                  </div>
                ) : (
                  <select
                    value={fromClass}
                    onChange={(e) => setFromClass(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  >
                    <option value="">Select class...</option>
                    {promotionClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--on-surface)]">
                  Promote To Class
                </label>
                {promotionClasses.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                    No classes available
                  </div>
                ) : (
                  <select
                    value={toClass}
                    onChange={(e) => setToClass(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  >
                    <option value="">Select target class...</option>
                    {getNextClassOptions().map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--on-surface)]">
                  &nbsp;
                </label>
                <Button
                  onClick={processPromotions}
                  disabled={promoting || selectedStudents.size === 0}
                  loading={promoting}
                  className="w-full"
                >
                  <MaterialIcon icon="upgrade" style={{ fontSize: 18 }} />
                  {promoting
                    ? "Processing..."
                    : `Process ${selectedStudents.size} Students`}
                </Button>
              </div>
            </div>

            {fromClass && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedStudents.size === promotionStudents.length &&
                        promotionStudents.length > 0
                      }
                      onChange={toggleAll}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">
                      Select All ({promotionStudents.length} students)
                    </span>
                  </label>
                  <span className="text-sm text-[var(--t3)]">
                    {selectedStudents.size} selected
                  </span>
                </div>

                {promotionLoading ? (
                  <TableSkeleton rows={5} />
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          <th>Name</th>
                          <th>Gender</th>
                          <th>Current Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promotionStudents.map((student) => {
                          const action =
                            studentActions[student.id]?.action || "promote";
                          return (
                            <tr key={student.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedStudents.has(student.id)}
                                  onChange={() => toggleStudent(student.id)}
                                  className="w-4 h-4"
                                />
                              </td>
                              <td className="font-medium text-sm">
                                {student.first_name} {student.last_name}
                              </td>
                              <td className="text-sm">{student.gender}</td>
                              <td>
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${student.repeating ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}
                                >
                                  {student.repeating ? "Repeating" : "Active"}
                                </span>
                              </td>
                              <td>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() =>
                                      setAction(student.id, "promote")
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${action === "promote" ? "bg-green-100 border-green-300 text-green-800" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}
                                  >
                                    Promote
                                  </button>
                                  <button
                                    onClick={() =>
                                      setAction(student.id, "repeat")
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${action === "repeat" ? "bg-yellow-100 border-yellow-300 text-yellow-800" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}
                                  >
                                    Repeat
                                  </button>
                                  <button
                                    onClick={() =>
                                      setAction(student.id, "demote")
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${action === "demote" ? "bg-red-100 border-red-300 text-red-800" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}
                                  >
                                    Demote
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {promotionStudents.length === 0 && (
                          <tr>
                            <td colSpan={5}>
                              <EmptyState
                                icon="group"
                                title="No active students in this class"
                                description="Select a class with active students to proceed"
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Promotion History</CardTitle>
          </CardHeader>
          <CardBody>
            {promotionHistory.length === 0 ? (
              <EmptyState
                icon="history"
                title="No promotion history"
                description="Promotions will appear here once processed"
              />
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Student</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Type</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promotionHistory.map((p, idx) => (
                      <tr key={idx}>
                        <td className="text-sm">
                          {new Date(p.promoted_at).toLocaleDateString()}
                        </td>
                        <td className="text-sm">
                          {p.student_id?.substring(0, 8)}...
                        </td>
                        <td className="text-sm">{p.from_classes?.name}</td>
                        <td className="text-sm">{p.to_classes?.name}</td>
                        <td>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.promotion_type === "repeating" ? "bg-yellow-100 text-yellow-800" : p.promotion_type === "demoted" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
                          >
                            {p.promotion_type || "promoted"}
                          </span>
                        </td>
                        <td className="text-sm">
                          {p.users?.full_name || "System"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {showDemoteModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDemoteModal(null)}
          >
            <div
              className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                <div className="font-semibold text-[var(--t1)]">
                  Demote Student
                </div>
                <button
                  onClick={() => setShowDemoteModal(null)}
                  className="p-1 hover:bg-[var(--surface-container)] rounded-lg"
                >
                  <MaterialIcon className="text-xl text-[var(--t3)]">
                    close
                  </MaterialIcon>
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">
                    Demote to Class
                  </label>
                  <select
                    value={demoteClass}
                    onChange={(e) => setDemoteClass(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    required
                  >
                    <option value="">Select class...</option>
                    {getPrevClassOptions().map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">
                    Reason
                  </label>
                  <textarea
                    value={demoteReason}
                    onChange={(e) => setDemoteReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] resize-none"
                    rows={3}
                    placeholder="Reason for demotion..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setShowDemoteModal(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmDemote}
                    disabled={!demoteClass}
                    className="flex-1"
                  >
                    Confirm Demote
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showBulkImportModal && (
          <Modal
            isOpen={showBulkImportModal}
            onClose={() => setShowBulkImportModal(false)}
            title="Bulk Import Students"
            size="xl"
          >
            <BulkImport onComplete={() => setShowBulkImportModal(false)} />
          </Modal>
        )}
        {deleteConfirm.open && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteConfirm({ open: false, studentId: null })}
          >
            <div
              className="bg-[var(--surface)] rounded-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <MaterialIcon
                  style={{
                    fontSize: 48,
                    color: "var(--error)",
                    marginBottom: 16,
                  }}
                >
                  warning
                </MaterialIcon>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  Remove Student?
                </h3>
                <p style={{ color: "var(--t3)", fontSize: 14 }}>
                  This action cannot be undone. All records for this student
                  will be permanently deleted.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setDeleteConfirm({ open: false, studentId: null })
                  }
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteStudent}
                  className="flex-1"
                  style={{ background: "var(--error)" }}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}
      </TabPanel>
    </div>
  );
}
