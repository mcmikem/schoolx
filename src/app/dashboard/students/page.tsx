"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { SendSMSModal } from "@/components/SendSMSModal";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabPanel } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/index";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import BulkImport from "@/components/BulkImport";
import StudentWorkspaceShell from "@/components/students/StudentWorkspaceShell";
import StudentRegistryPanel from "@/components/students/StudentRegistryPanel";
import StudentTransfersPanel from "@/components/students/StudentTransfersPanel";
import StudentRetentionPanel from "@/components/students/StudentRetentionPanel";
import StudentPromotionPanel from "@/components/students/StudentPromotionPanel";
import StudentDetailPanel from "@/components/students/StudentDetailPanel";
import { useStudentImport } from "@/components/students/StudentImportModal";
import { useTablePreferences } from "@/lib/useTablePreferences";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useStudentTransfers } from "@/hooks/useStudentTransfers";
import { useStudentDropouts } from "@/hooks/useStudentDropouts";
import { useStudentPromotion } from "@/hooks/useStudentPromotion";
import { supabase } from "@/lib/supabase";
import { DEMO_ATTENDANCE } from "@/lib/demo-data";

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

interface ClassData {
  id: string;
  name: string;
  level: string;
}

interface HouseMeta {
  id: string;
  name: string;
  color?: string | null;
}

interface SmsTarget {
  id: string;
  first_name: string;
  last_name: string;
  parent_phone?: string | null;
  parent_name?: string | null;
}

interface EditingStudent {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_phone2?: string | null;
  class_id?: string | null;
  student_number?: string | null;
  ple_index_number?: string | null;
  opening_balance?: string | number | null;
  photo_url?: string | null;
  blood_type?: string | null;
  boarding_status?: string | null;
  house_id?: string | null;
  previous_school?: string | null;
  district_origin?: string | null;
  sub_county?: string | null;
  parish?: string | null;
  village?: string | null;
  is_class_monitor?: boolean | null;
  prefect_role?: string | null;
  student_council_role?: string | null;
  games_house?: string | null;
}

interface AttendanceStatusMeta {
  status: "present" | "absent" | "sick" | "late" | "excused";
  label: string;
}

export default function StudentHubPage() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { preferences: tablePrefs, updatePreferences: updateTablePrefs } =
    useTablePreferences("students-registry");

  const [currentPage, setCurrentPage] = useState(1);
  const [isConstrainedNetwork, setIsConstrainedNetwork] = useState(false);
  const [attendanceStatusMap, setAttendanceStatusMap] = useState<
    Record<string, AttendanceStatusMeta>
  >({});
  const preferredPageSize = tablePrefs.pageSize || (isConstrainedNetwork ? 20 : 50);
  const itemsPerPage = preferredPageSize;
  const registryFetchLimit = isConstrainedNetwork ? 500 : 5000;

  const {
    students,
    loading,
    createStudent,
    updateStudent,
    deleteStudent,
    totalCount,
  } = useStudents(school?.id, { limit: registryFetchLimit, offset: 0 });
  const { classes } = useClasses(school?.id);

  const [activeTab, setActiveTab] = useState<StudentWorkspaceTab>("registry");

  const handleTabChange = useCallback((tab: StudentWorkspaceTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (tab === "registry") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const transfers = useStudentTransfers(
    school?.id, students, isDemo, createStudent, updateStudent, toast, school,
  );
  const dropouts = useStudentDropouts(
    school?.id, students, isDemo, updateStudent, toast, user,
  );
  const promotion = useStudentPromotion(
    school?.id, students, isDemo, updateStudent, toast, academicYear, user,
  );
  const fetchTransferHistory = transfers.fetchTransferHistory;
  const fetchAtRiskStudents = dropouts.fetchAtRiskStudents;
  const fetchPromotionClasses = promotion.fetchPromotionClasses;
  const fetchPromotionHistory = promotion.fetchPromotionHistory;
  const fetchPromotionStudents = promotion.fetchPromotionStudents;
  const promotionFromClass = promotion.fromClass;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<EditingStudent | null>(
    null,
  );
  const [filterGender, setFilterGender] = useState<"all" | "M" | "F">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [filterDefaulters, setFilterDefaulters] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "number" | "class">("name");
  const [houseMap, setHouseMap] = useState<Record<string, HouseMeta>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [smsTarget, setSmsTarget] = useState<SmsTarget | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    studentId: string | null;
  }>({ open: false, studentId: null });

  const templateImport = useStudentImport(classes, createStudent, toast);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const nav = navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        saveData?: boolean;
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    };

    const connection = nav.connection;
    if (!connection) return;

    const evaluateConnection = () => {
      const type = (connection.effectiveType || "").toLowerCase();
      const constrained = !!connection.saveData || type.includes("2g") || type.includes("3g");
      setIsConstrainedNetwork(constrained);
    };

    evaluateConnection();
    connection.addEventListener?.("change", evaluateConnection);
    return () => connection.removeEventListener?.("change", evaluateConnection);
  }, []);

  useEffect(() => {
    if (searchParams?.get("action") === "add") setShowAddModal(true);
  }, [searchParams]);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "registry" || tab === "transfers" || tab === "dropouts" || tab === "promotion") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== "transfers") return;
    void fetchTransferHistory();
  }, [activeTab, fetchTransferHistory]);

  useEffect(() => {
    if (activeTab !== "dropouts") return;
    void fetchAtRiskStudents();
  }, [activeTab, fetchAtRiskStudents]);

  useEffect(() => {
    if (activeTab !== "promotion") return;
    void fetchPromotionClasses();
    void fetchPromotionHistory();
  }, [
    activeTab,
    fetchPromotionClasses,
    fetchPromotionHistory,
  ]);

  useEffect(() => {
    if (activeTab !== "promotion" || !promotionFromClass) return;
    void fetchPromotionStudents();
  }, [activeTab, promotionFromClass, fetchPromotionStudents]);

  useEffect(() => {
    if (!school?.id) {
      setHouseMap({});
      return;
    }

    const loadHouses = async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("id, name, color")
        .eq("school_id", school.id);

      if (error) {
        return;
      }

      const mapped = (data || []).reduce<Record<string, HouseMeta>>((acc, house) => {
        acc[house.id] = house;
        return acc;
      }, {});
      setHouseMap(mapped);
    };

    void loadHouses();
  }, [school?.id]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    const deriveAttendanceMeta = (
      status: string | null | undefined,
      remarks: string | null | undefined,
    ): AttendanceStatusMeta | null => {
      const normalizedStatus = (status || "").toLowerCase();
      const normalizedRemarks = (remarks || "").toLowerCase();

      if (!normalizedStatus) return null;
      if (normalizedRemarks.includes("sick")) {
        return { status: "sick", label: "Sick today" };
      }
      if (normalizedStatus === "present") {
        return { status: "present", label: "Present today" };
      }
      if (normalizedStatus === "late") {
        return { status: "late", label: "Late today" };
      }
      if (normalizedStatus === "excused") {
        return { status: "excused", label: "Excused today" };
      }
      return { status: "absent", label: "Absent today" };
    };

    const loadAttendanceStatuses = async () => {
      if (students.length === 0) {
        setAttendanceStatusMap({});
        return;
      }

      if (isDemo) {
        const latestByStudent = new Map<string, AttendanceStatusMeta>();
        const rankedRecords = [...DEMO_ATTENDANCE]
          .filter((record) => record.date <= today)
          .sort((left, right) => right.date.localeCompare(left.date));

        for (const record of rankedRecords) {
          if (latestByStudent.has(record.student_id)) continue;
          const meta = deriveAttendanceMeta(record.status, record.remarks);
          if (meta) {
            latestByStudent.set(record.student_id, meta);
          }
        }

        setAttendanceStatusMap(Object.fromEntries(latestByStudent.entries()));
        return;
      }

      if (!school?.id) {
        setAttendanceStatusMap({});
        return;
      }

      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status, remarks")
        .eq("school_id", school.id)
        .eq("date", today);

      if (error) {
        setAttendanceStatusMap({});
        return;
      }

      const nextMap = (data || []).reduce<Record<string, AttendanceStatusMeta>>(
        (acc, record) => {
          const meta = deriveAttendanceMeta(record.status, record.remarks);
          if (meta) {
            acc[record.student_id] = meta;
          }
          return acc;
        },
        {},
      );

      setAttendanceStatusMap(nextMap);
    };

    void loadAttendanceStatuses();
  }, [isDemo, school?.id, students]);

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

  const filtered = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let result = students.filter((s) => {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        normalizedSearch.split(" ").every((word) =>
          name.includes(word) ||
          s.parent_name?.toLowerCase().includes(word) ||
          s.student_number?.toLowerCase().includes(word)
        );
      const matchesClass =
        selectedClass === "all" || s.class_id === selectedClass;
      const matchesGender =
        filterGender === "all" || s.gender === filterGender;
      const matchesStatus =
        filterStatus === "all" || s.status === filterStatus;
      const matchesPosition =
        filterPosition === "all" ||
        (filterPosition === "monitor" && s.is_class_monitor) ||
        (filterPosition === "prefect" &&
          (s.prefect_role || s.student_council_role));
      const matchesDefaulters =
        !filterDefaulters || Number(s.opening_balance || 0) > 0;
      return (
        matchesSearch &&
        matchesClass &&
        matchesGender &&
        matchesStatus &&
        matchesPosition &&
        matchesDefaulters
      );
    });
    result.sort((a, b) => {
      if (sortBy === "name") {
        return `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
        );
      }
      if (sortBy === "number") {
        return (a.student_number || "").localeCompare(
          b.student_number || "",
        );
      }
      return (a.classes?.name || "").localeCompare(
        b.classes?.name || "",
      );
    });
    return result;
  }, [
    students,
    searchTerm,
    selectedClass,
    filterGender,
    filterStatus,
    filterPosition,
    filterDefaulters,
    sortBy,
  ]);

  const pageSize = itemsPerPage;
  const paginatedStudents =
    pageSize === -1
      ? filtered
      : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages =
    pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedClass,
    filterGender,
    filterStatus,
    filterPosition,
    filterDefaulters,
    sortBy,
    pageSize,
    school?.id,
  ]);

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
    } catch {
      toast.error("Failed to generate index numbers");
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteConfirm.studentId) return;
    try {
      await deleteStudent(deleteConfirm.studentId);
      toast.success("Student removed");
    } catch {
      toast.error("Failed to remove student");
    } finally {
      setDeleteConfirm({ open: false, studentId: null });
    }
  };

  return (
    <PageErrorBoundary>
      <div className="space-y-6 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
        <PageHeader
          title="Student Hub"
          subtitle={
            loading ? (
              <span className="inline-block w-48 h-4 rounded bg-gray-200 animate-pulse" />
            ) : (
              `${students.length} students enrolled in ${academicYear} (${boysCount} Boys / ${girlsCount} Girls)`
            )
          }
          variant="premium"
        />

        <StudentWorkspaceShell
          lowBandwidthMode={isConstrainedNetwork}
          totalStudents={students.length}
          boysCount={boysCount}
          girlsCount={girlsCount}
          activeStudents={students.filter((s) => s.status === "active").length}
          classesCount={classes.length}
          currentTerm={currentTerm}
          academicYear={academicYear}
          transferredCount={
            (transfers.transferredInCount || 0) +
            (transfers.transferredOutCount || 0)
          }
          atRiskCount={dropouts.atRiskCount}
          likelyDropoutCount={dropouts.likelyDropoutCount}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onImport={() => setShowBulkImportModal(true)}
          onAddStudent={() => setShowAddModal(true)}
          onGeneratePle={generatePLEIndexNumbers}
          onExport={handleExport}
        />

        <TabPanel activeTab={activeTab} tabId="registry">
          <StudentRegistryPanel
            schoolId={school?.id}
            totalStudents={students.length}
            boysCount={boysCount}
            girlsCount={girlsCount}
            classesCount={classes.length}
            classes={classes}
            houseMap={houseMap}
            lowBandwidthMode={isConstrainedNetwork}
            {...templateImport}
            searchInputRef={searchInputRef}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            selectedClass={selectedClass}
            onSelectedClassChange={setSelectedClass}
            filterGender={filterGender}
            onFilterGenderChange={setFilterGender}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
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
            filteredTotal={filtered.length}
            paginatedStudents={paginatedStudents}
            currentPage={currentPage}
            totalPages={totalPages}
            attendanceStatusMap={attendanceStatusMap}
            onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNextPage={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
            onAddStudent={() => setShowAddModal(true)}
            onSmsParent={(student) => setSmsTarget(student as SmsTarget)}
            onEditStudent={(student) => {
              setEditingStudent(student as EditingStudent);
              setShowEditModal(true);
            }}
            onDeleteStudent={(id) =>
              setDeleteConfirm({ open: true, studentId: id })
            }
          />

          <StudentDetailPanel
            mode="add"
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            schoolId={school?.id}
            classes={classes}
            isDemo={!!isDemo}
            toast={toast}
            createStudent={createStudent}
          />

          <StudentDetailPanel
            mode="edit"
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingStudent(null);
            }}
            schoolId={school?.id}
            classes={classes}
            isDemo={!!isDemo}
            toast={toast}
            updateStudent={updateStudent}
            student={editingStudent}
          />

          {smsTarget && (
            <SendSMSModal
              student={smsTarget}
              isOpen={!!smsTarget}
              onClose={() => setSmsTarget(null)}
            />
          )}
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="transfers">
          <StudentTransfersPanel
            lowBandwidthMode={isConstrainedNetwork}
            activeStudents={transfers.activeStudents}
            transferredIn={transfers.transferredIn}
            transferredInCount={transfers.transferredInCount}
            transferredOutCount={transfers.transferredOutCount}
            transferHistory={transfers.transferHistory}
            transferActiveTab={transfers.transferActiveTab}
            onTransferTabChange={transfers.setTransferActiveTab}
            showTransferInModal={transfers.showTransferInModal}
            onShowTransferInModal={transfers.setShowTransferInModal}
            showTransferOutModal={transfers.showTransferOutModal}
            onShowTransferOutModal={transfers.setShowTransferOutModal}
            transferSaving={transfers.transferSaving}
            transferInForm={transfers.transferInForm}
            setTransferInForm={transfers.setTransferInForm}
            transferOutForm={transfers.transferOutForm}
            setTransferOutForm={transfers.setTransferOutForm}
            classes={classes}
            transferReasons={transfers.TRANSFER_REASONS}
            onTransferIn={transfers.handleTransferIn}
            onTransferOut={transfers.handleTransferOut}
            printData={transfers.printData}
            onPreparePrint={(record: TransferOutRecord) => {
              transfers.setPrintData(record);
              setTimeout(transfers.handlePrint, 200);
            }}
            onPrint={transfers.handlePrint}
            transferPrintRef={transfers.transferPrintRef}
            school={school}
          />
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="dropouts">
          <StudentRetentionPanel
            lowBandwidthMode={isConstrainedNetwork}
            atRiskCount={dropouts.atRiskCount}
            likelyDropoutCount={dropouts.likelyDropoutCount}
            activeStudentsCount={
              students.filter((s) => s.status === "active").length
            }
            droppedStudentsCount={
              students.filter((s) => s.status === "dropped").length
            }
            dropoutClassFilter={dropouts.dropoutClassFilter}
            setDropoutClassFilter={dropouts.setDropoutClassFilter}
            classes={classes}
            onRefresh={dropouts.fetchAtRiskStudents}
            filteredAtRisk={dropouts.filteredAtRisk}
            loadingAtRisk={dropouts.loadingAtRisk}
            sendingSms={dropouts.sendingSms}
            onContactParent={dropouts.handleContactParent}
            showDropoutModal={dropouts.showDropoutModal}
            setShowDropoutModal={dropouts.setShowDropoutModal}
            dropoutReason={dropouts.dropoutReason}
            setDropoutReason={dropouts.setDropoutReason}
            onMarkDropout={dropouts.handleMarkDropout}
          />
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="promotion">
          <StudentPromotionPanel
            lowBandwidthMode={isConstrainedNetwork}
            onAutoPromote={promotion.handleAutoPromote}
            autoPromoting={promotion.autoPromoting}
            autoPromoteResult={promotion.autoPromoteResult}
            selectedStudents={promotion.selectedStudents}
            actionCounts={promotion.actionCounts}
            promotionClasses={promotion.promotionClasses}
            fromClass={promotion.fromClass}
            setFromClass={(value) => {
              promotion.setFromClass(value);
              promotion.setToClass("");
            }}
            toClass={promotion.toClass}
            setToClass={promotion.setToClass}
            processPromotions={promotion.processPromotions}
            promoting={promotion.promoting}
            getNextClassOptions={promotion.getNextClassOptions}
            getPrevClassOptions={promotion.getPrevClassOptions}
            toggleAll={promotion.toggleAll}
            promotionStudents={promotion.promotionStudents}
            promotionLoading={promotion.promotionLoading}
            toggleStudent={promotion.toggleStudent}
            studentActions={promotion.studentActions}
            setAction={promotion.setAction}
            promotionHistory={promotion.promotionHistory}
            showDemoteModal={promotion.showDemoteModal}
            setShowDemoteModal={promotion.setShowDemoteModal}
            demoteClass={promotion.demoteClass}
            setDemoteClass={promotion.setDemoteClass}
            demoteReason={promotion.demoteReason}
            setDemoteReason={promotion.setDemoteReason}
            confirmDemote={promotion.confirmDemote}
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
            className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto"
            onClick={() =>
              setDeleteConfirm({ open: false, studentId: null })
            }
          >
            <div
              className="bg-[var(--surface)] rounded-2xl w-full max-w-md p-6 max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto"
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
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
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
      </div>
    </PageErrorBoundary>
  );
}
