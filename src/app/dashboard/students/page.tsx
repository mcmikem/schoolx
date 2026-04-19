"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
import { PageHeader, PageSection } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import BulkImport from "@/components/BulkImport";
import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { EmptyState, NoData, SearchEmpty } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DEMO_CLASSES, DEMO_ATTENDANCE } from "@/lib/demo-data";
import StudentPhotoField from "@/components/students/StudentPhotoField";
import StudentRegistryPanel from "@/components/students/StudentRegistryPanel";
import StudentWorkspaceShell from "@/components/students/StudentWorkspaceShell";
import StudentTransfersPanel from "@/components/students/StudentTransfersPanel";
import StudentRetentionPanel from "@/components/students/StudentRetentionPanel";
import StudentPromotionPanel from "@/components/students/StudentPromotionPanel";
import { useTablePreferences } from "@/lib/useTablePreferences";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { uploadStudentPhoto } from "@/lib/student-photos";

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
type StudentWorkspaceTab = "registry" | "transfers" | "dropouts" | "promotion";

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
  const { classes, loading: classesLoading } = useClasses(school?.id);

  const { preferences: tablePrefs, updatePreferences: updateTablePrefs } =
    useTablePreferences("students-registry");

  const [activeTab, setActiveTab] = useState<StudentWorkspaceTab>("registry");

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

  useEffect(() => {
    if (!showAddModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      if (addStudentModalRef.current) {
        addStudentModalRef.current.scrollTop = 0;
      }
      addStudentFirstInputRef.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [showAddModal]);

  // Filters
  const [filterGender, setFilterGender] = useState<"all" | "M" | "F">("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [filterDefaulters, setFilterDefaulters] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "number" | "class">("name");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Keyboard shortcut refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addStudentFirstInputRef = useRef<HTMLInputElement>(null);
  const addStudentModalRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts: Ctrl+N = add student, Ctrl+F = focus search, Escape = close modals
  useKeyboardShortcuts([
    {
      key: "n",
      ctrl: true,
      action: () => setShowAddModal(true),
      description: "Add new student",
    },
    {
      key: "f",
      ctrl: true,
      action: () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      },
      description: "Focus search",
    },
    {
      key: "Escape",
      action: () => {
        setShowAddModal(false);
        setShowEditModal(false);
      },
      description: "Close modal",
    },
  ]);

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
    photo_url: "",
  });

  const handleNewStudentChange = (updates: Partial<typeof newStudent>) => {
    setNewStudent((prev) => ({ ...prev, ...updates }));
  };
  const resetNewStudentForm = useCallback(() => {
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
      photo_url: "",
    });
  }, []);

  const handleStudentPhotoUpload = useCallback(
    async (file: File, mode: "new" | "edit") => {
      if (isDemo) {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || "");
            if (mode === "new") {
              setNewStudent((prev) => ({ ...prev, photo_url: result }));
            } else {
              setEditForm((prev) => ({ ...prev, photo_url: result }));
              setEditingStudent((prev: any) =>
                prev ? { ...prev, photo_url: result } : prev,
              );
            }
            resolve();
          };
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(file);
        });
        return;
      }

      if (!school?.id) {
        throw new Error("School context missing. Reload and try again.");
      }

      const { publicUrl } = await uploadStudentPhoto({
        file,
        schoolId: school.id,
        studentId: mode === "edit" ? editingStudent?.id : undefined,
      });

      if (mode === "new") {
        setNewStudent((prev) => ({ ...prev, photo_url: publicUrl }));
      } else {
        setEditForm((prev) => ({ ...prev, photo_url: publicUrl }));
        setEditingStudent((prev: any) =>
          prev ? { ...prev, photo_url: publicUrl } : prev,
        );
      }
    },
    [editingStudent?.id, isDemo, school?.id],
  );
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
    photo_url: "",
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
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let result = students.filter((s) => {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        name.includes(normalizedSearch) ||
        s.parent_name?.toLowerCase().includes(normalizedSearch) ||
        s.student_number?.toLowerCase().includes(normalizedSearch);
      const matchesClass =
        selectedClass === "all" || s.class_id === selectedClass;
      const sAny = s as any;
      const matchesGender = filterGender === "all" || s.gender === filterGender;
      const matchesPosition =
        filterPosition === "all" ||
        (filterPosition === "monitor" && sAny.is_class_monitor) ||
        (filterPosition === "prefect" &&
          (sAny.prefect_role || sAny.student_council_role));
      const matchesDefaulters =
        !filterDefaulters || Number(s.opening_balance || 0) > 0;
      return (
        matchesSearch &&
        matchesClass &&
        matchesGender &&
        matchesPosition &&
        matchesDefaulters
      );
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
    filterDefaulters,
    sortBy,
  ]);

  // Pagination derived from table preferences
  const pageSize = tablePrefs.pageSize || 50;
  const [currentPage, setCurrentPage] = useState(1);
  // Reset to page 1 whenever filters or page size change
  const filteredTotal = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const paginatedStudents = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClass, filterGender, filterPosition, filterDefaulters, sortBy, pageSize, school?.id]);

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
      await createStudent({
        first_name: newStudent.first_name.trim(),
        last_name: newStudent.last_name.trim(),
        gender: newStudent.gender,
        date_of_birth: newStudent.date_of_birth || undefined,
        parent_name: newStudent.parent_name.trim(),
        parent_phone: newStudent.parent_phone.trim(),
        parent_phone2: newStudent.parent_phone2?.trim() || undefined,
        class_id: newStudent.class_id,
        student_number: newStudent.student_number?.trim() || undefined,
        ple_index_number: newStudent.ple_index_number?.trim() || undefined,
        opening_balance: parseFloat(newStudent.opening_balance || "0"),
        boarding_status: newStudent.boarding_status,
        house_id: newStudent.house_id || undefined,
        previous_school: newStudent.previous_school?.trim() || undefined,
        district_origin: newStudent.district_origin?.trim() || undefined,
        sub_county: newStudent.sub_county?.trim() || undefined,
        parish: newStudent.parish?.trim() || undefined,
        village: newStudent.village?.trim() || undefined,
        prefect_role: newStudent.prefect_role || undefined,
        student_council_role: newStudent.student_council_role || undefined,
        games_house: newStudent.games_house || undefined,
        is_class_monitor: newStudent.is_class_monitor,
        photo_url: newStudent.photo_url || undefined,
        status: "active",
      });
      toast.success("Student added successfully");
      setShowAddModal(false);
      newStudentDraft.clearSaved();
      resetNewStudentForm();
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
      photo_url: student.photo_url || "",
    });
    setShowEditModal(true);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
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
    <PageErrorBoundary>
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Student Hub"
        subtitle={`${students.length} students enrolled in ${academicYear} (${students.filter((s) => s.gender === "M").length} Boys / ${students.filter((s) => s.gender === "F").length} Girls)`}
        variant="premium"
      />

      <StudentWorkspaceShell
        totalStudents={students.length}
        boysCount={boysCount}
        girlsCount={girlsCount}
        activeStudents={activeStudents.length}
        classesCount={classes.length}
        currentTerm={currentTerm}
        academicYear={academicYear}
        transferredCount={transferredInCount + transferredOutCount}
        atRiskCount={atRiskCount}
        likelyDropoutCount={likelyDropoutCount}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onImport={() => setShowBulkImportModal(true)}
        onAddStudent={() => setShowAddModal(true)}
        onGeneratePle={generatePLEIndexNumbers}
        onExport={handleExport}
      />

      {/* ===== REGISTRY TAB ===== */}
      <TabPanel activeTab={activeTab} tabId="registry">
        <StudentRegistryPanel
          schoolId={school?.id}
          totalStudents={students.length}
          boysCount={boysCount}
          girlsCount={girlsCount}
          classesCount={classes.length}
          classes={classes as any}
          templateStatus={templateStatus}
          templateErrors={templateErrors}
          templateRowsCount={templateRows.length}
          templatePreviewRows={templatePreviewRows}
          importingTemplate={importingTemplate}
          importSummary={importSummary}
          onTemplateUpload={handleStudentTemplateUpload}
          onSeedTemplate={handleSeedStudentsFromTemplate}
          searchInputRef={searchInputRef}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          selectedClass={selectedClass}
          onSelectedClassChange={setSelectedClass}
          filterGender={filterGender}
          onFilterGenderChange={setFilterGender}
          filterPosition={filterPosition}
          onFilterPositionChange={setFilterPosition}
          filterDefaulters={filterDefaulters}
          onFilterDefaultersChange={setFilterDefaulters}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          pageSize={pageSize}
          onPageSizeChange={(value) => {
            updateTablePrefs({ pageSize: value });
            setCurrentPage(1);
          }}
          loading={loading}
          filteredCount={filtered.length}
          filteredTotal={filteredTotal}
          paginatedStudents={paginatedStudents as any}
          currentPage={currentPage}
          totalPages={totalPages}
          onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          onAddStudent={() => setShowAddModal(true)}
          onSmsParent={(student) => setSmsTarget(student as any)}
          onEditStudent={(student) => openEditModal(student)}
          onDeleteStudent={confirmDelete}
        />

        {/* Add Modal */}
        {showAddModal &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm overflow-y-auto"
              onClick={() => setShowAddModal(false)}
            >
              <div className="min-h-full flex items-start sm:items-center justify-center p-4">
                <div
                  ref={addStudentModalRef}
                  className="bg-[var(--surface)] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto my-2 shadow-2xl"
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
                <StudentPhotoField
                  photoUrl={newStudent.photo_url}
                  firstName={newStudent.first_name}
                  lastName={newStudent.last_name}
                  gender={newStudent.gender}
                  uploading={uploadingPhoto}
                  onUpload={async (file) => {
                    try {
                      setUploadingPhoto(true);
                      await handleStudentPhotoUpload(file, "new");
                      toast.success("Passport photo added");
                    } catch (error: unknown) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to upload passport photo",
                      );
                    } finally {
                      setUploadingPhoto(false);
                    }
                  }}
                />
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
                      ref={addStudentFirstInputRef}
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
                  {classesLoading ? (
                    <div
                      style={{
                        background: "var(--navy-soft)",
                        border: "1px solid rgba(0, 31, 63, 0.12)",
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
                        Loading classes...
                      </p>
                      <p
                        style={{
                          color: "var(--t3)",
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        The class list is still being fetched for this school.
                      </p>
                    </div>
                  ) : classes.length === 0 ? (
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
            </div>,
            document.body,
          )}

        {/* Edit Modal */}
        {showEditModal &&
          editingStudent &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm overflow-y-auto"
              onClick={() => setShowEditModal(false)}
            >
              <div className="min-h-full flex items-start sm:items-center justify-center p-4">
                <div
                  className="bg-[var(--surface)] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto my-2 shadow-2xl"
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
                <StudentPhotoField
                  photoUrl={editForm.photo_url}
                  firstName={editForm.first_name}
                  lastName={editForm.last_name}
                  gender={editForm.gender}
                  uploading={uploadingPhoto}
                  title="Student Photo"
                  onUpload={async (file) => {
                    try {
                      setUploadingPhoto(true);
                      await handleStudentPhotoUpload(file, "edit");
                      toast.success("Student photo updated");
                    } catch (error: unknown) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to upload student photo",
                      );
                    } finally {
                      setUploadingPhoto(false);
                    }
                  }}
                  size={80}
                />
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
            </div>,
            document.body,
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
          <StudentTransfersPanel
            activeStudents={activeStudents as any}
            transferredIn={transferredIn as any}
            transferredInCount={transferredInCount}
            transferredOutCount={transferredOutCount}
            transferHistory={transferHistory}
            transferActiveTab={transferActiveTab}
            onTransferTabChange={setTransferActiveTab}
            showTransferInModal={showTransferInModal}
            onShowTransferInModal={setShowTransferInModal}
            showTransferOutModal={showTransferOutModal}
            onShowTransferOutModal={setShowTransferOutModal}
            transferSaving={transferSaving}
            transferInForm={transferInForm}
            setTransferInForm={setTransferInForm}
            transferOutForm={transferOutForm}
            setTransferOutForm={setTransferOutForm}
            classes={classes}
            transferReasons={TRANSFER_REASONS}
            onTransferIn={handleTransferIn}
            onTransferOut={handleTransferOut}
            printData={printData}
            onPreparePrint={(record) => {
              setPrintData(record);
              setTimeout(handlePrint, 200);
            }}
            onPrint={handlePrint}
            transferPrintRef={transferPrintRef}
            school={school}
          />
      </TabPanel>

      {/* ===== DROPOUTS TAB ===== */}
      <TabPanel activeTab={activeTab} tabId="dropouts">
          <StudentRetentionPanel
            atRiskCount={atRiskCount}
            likelyDropoutCount={likelyDropoutCount}
            activeStudentsCount={students.filter((s) => s.status === "active").length}
            droppedStudentsCount={students.filter((s) => s.status === "dropped").length}
            dropoutClassFilter={dropoutClassFilter}
            setDropoutClassFilter={setDropoutClassFilter}
            classes={classes}
            onRefresh={fetchAtRiskStudents}
            filteredAtRisk={filteredAtRisk}
            loadingAtRisk={loadingAtRisk}
            sendingSms={sendingSms}
            onContactParent={handleContactParent as any}
            showDropoutModal={showDropoutModal}
            setShowDropoutModal={setShowDropoutModal}
            dropoutReason={dropoutReason}
            setDropoutReason={setDropoutReason}
            onMarkDropout={handleMarkDropout}
          />
      </TabPanel>

      {/* ===== PROMOTION TAB ===== */}
      <TabPanel activeTab={activeTab} tabId="promotion">
          <StudentPromotionPanel
            onAutoPromote={handleAutoPromote}
            autoPromoting={autoPromoting}
            autoPromoteResult={autoPromoteResult}
            selectedStudents={selectedStudents}
            actionCounts={actionCounts}
            promotionClasses={promotionClasses}
            fromClass={fromClass}
            setFromClass={setFromClass}
            toClass={toClass}
            setToClass={setToClass}
            processPromotions={processPromotions}
            promoting={promoting}
            getNextClassOptions={getNextClassOptions}
            getPrevClassOptions={getPrevClassOptions}
            toggleAll={toggleAll}
            promotionStudents={promotionStudents as any}
            promotionLoading={promotionLoading}
            toggleStudent={toggleStudent}
            studentActions={studentActions as any}
            setAction={setAction as any}
            promotionHistory={promotionHistory}
            showDemoteModal={showDemoteModal}
            setShowDemoteModal={setShowDemoteModal}
            demoteClass={demoteClass}
            setDemoteClass={setDemoteClass}
            demoteReason={demoteReason}
            setDemoteReason={setDemoteReason}
            confirmDemote={confirmDemote}
          />
      </TabPanel>

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
                  onClick={() => setDeleteConfirm({ open: false, studentId: null })}
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
    </div>
    </PageErrorBoundary>
  );
}
