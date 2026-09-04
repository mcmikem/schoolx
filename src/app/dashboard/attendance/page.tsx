"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useUrlSyncedFilters } from "@/lib/hooks/useUrlSyncedFilters";
import { useAuth } from "@/lib/auth-context";
import { useClasses } from "@/lib/hooks";
import { useOfflineStudents, useOfflineAttendance } from "@/lib/offline-hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { logAuditEventWithOfflineSupport } from "@/lib/audit";
import { DEMO_ATTENDANCE, DEMO_STUDENTS } from "@/lib/demo-data";
import MaterialIcon from "@/components/MaterialIcon";
import PersonInitials from "@/components/ui/PersonInitials";
import { PageHeader } from "@/components/ui/PageHeader";
import { logger } from "@/lib/logger";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageGuidance } from "@/components/PageGuidance";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { normalizeAttendanceInput, validateAttendanceInput } from "@/lib/validation";
import type { Student } from "@/types";
import { withTimeout, timeoutFallback, notifyDashboardStatsChanged, getLocalDateString } from "@/lib/hooks/utils";
import { getAutomationStatus, toggleAutomation } from "@/lib/sms-automation";

const STATUS_CYCLE = ["present", "absent", "late", "excused"] as const;
type AttendanceStatus = (typeof STATUS_CYCLE)[number];

const STATUS_CONFIG: Record<AttendanceStatus, { color: string; bg: string; label: string; icon: string }> = {
  absent: {
    color: "bg-error",
    bg: "bg-error-container",
    label: "Not In School",
    icon: "cancel",
  },
  present: {
    color: "bg-secondary",
    bg: "bg-secondary-container",
    label: "In School",
    icon: "check_circle",
  },
  late: {
    color: "bg-tertiary",
    bg: "bg-tertiary-container",
    label: "Late",
    icon: "schedule",
  },
  excused: {
    color: "bg-[#7c3aed]",
    bg: "bg-[#f3e8ff]",
    label: "Excused",
    icon: "verified",
  },
};

function cycleStatus(current: string | undefined): AttendanceStatus {
  // First tap on an unmarked student marks Away — the most common action.
  if (!current) return "absent";
  const idx = STATUS_CYCLE.indexOf(current as AttendanceStatus);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

export default function AttendancePage() {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const urlFilters = useUrlSyncedFilters();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedClass, setSelectedClass] = useState<string | null>(() => urlFilters.get("class"));
  const [date, setDate] = useState(
    () =>
      urlFilters.get("date") ||
      (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      })(),
  );
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [allMarked, setAllMarked] = useState(false);
  const [confirmMarkAll, setConfirmMarkAll] = useState(false);
  const [absenteeAlertEnabled, setAbsenteeAlertEnabled] = useState(false);
  const [loadingAutomation, setLoadingAutomation] = useState(true);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [rollCallMode, setRollCallMode] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [copyingYesterday, setCopyingYesterday] = useState(false);
  const [bulkDateFrom, setBulkDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return getLocalDateString(d);
  });
  const [bulkDateTo, setBulkDateTo] = useState(() => {
    return getLocalDateString();
  });
  const [bulkProgress, setBulkProgress] = useState<{
    running: boolean;
    total: number;
    current: number;
  } | null>(null);
  const [bulkSummary, setBulkSummary] = useState<{
    total_records: number;
    students_count: number;
    dates_count: number;
    status: string;
  } | null>(null);
  const [showQuickAbsentModal, setShowQuickAbsentModal] = useState(false);
  const [selectedAbsentIds, setSelectedAbsentIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<"all" | AttendanceStatus>(
    () => (urlFilters.get("status") as "all" | AttendanceStatus) || "all",
  );
  const [searchQuery, setSearchQuery] = useState(() => urlFilters.get("q") || "");
  const [attendPage, setAttendPage] = useState(() => {
    const p = urlFilters.get("page");
    return p ? Math.max(1, parseInt(p, 10) || 1) : 1;
  });
  const attendPerPage = 20;
  const attendOffset = (attendPage - 1) * attendPerPage;
  const attendTotalPages = Math.max(1, Math.ceil(students.length / attendPerPage));

  const isClassTeacher = user?.role === "teacher";
  const isAdmin =
    user?.role === "headmaster" ||
    user?.role === "dean_of_studies" ||
    user?.role === "school_admin" ||
    user?.role === "super_admin" ||
    user?.role === "bursar";

  const filteredClasses = isClassTeacher && !isAdmin ? classes.filter((c) => c.class_teacher_id === user?.id) : classes;

  useEffect(() => {
    setAttendPage(1);
  }, [selectedClass, date]);

  useEffect(() => {
    if (students.length > 0 && attendPage > Math.ceil(students.length / attendPerPage)) {
      setAttendPage(1);
    }
  }, [students.length, attendPage, attendPerPage]);

  // URL-synced filters
  useEffect(() => {
    urlFilters.setMany({
      class: selectedClass || null,
      date: date || null,
      q: searchQuery || null,
      status: filterStatus !== "all" ? filterStatus : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, date, searchQuery, filterStatus]);

  useEffect(() => {
    if (attendPage > 1) urlFilters.set("page", String(attendPage));
    else {
      const params = new URLSearchParams(urlFilters.searchParams?.toString() || "");
      if (params.has("page")) {
        params.delete("page");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendPage]);

  const paginatedStudents = students.slice(attendOffset, attendOffset + attendPerPage);

  const loadOfflineCount = useCallback(async () => {
    try {
      const pending = await offlineDB.getPendingSync();
      const attendancePending = pending.filter((p) => p.table === "attendance");
      setOfflineCount(attendancePending.length);
    } catch (err) {
      logger.warn("Failed to get offline count:", err);
      setOfflineCount(0);
    }
  }, []);

  useEffect(() => {
    loadOfflineCount();
  }, [loadOfflineCount]);

  useEffect(() => {
    const loadAutomationStatus = async () => {
      try {
        const status = await getAutomationStatus({ schoolId: school?.id, isDemo });
        setAbsenteeAlertEnabled(status.absentee_alert ?? false);
      } catch (err) {
        logger.warn("Failed to load automation status:", err);
        setAbsenteeAlertEnabled(false);
      } finally {
        setLoadingAutomation(false);
      }
    };
    loadAutomationStatus();
  }, [school?.id, isDemo]);

  const handleToggleAbsenteeAlert = async () => {
    const result = await toggleAutomation({
      schoolId: school?.id || "",
      automationType: "absentee_alert",
      isActive: !absenteeAlertEnabled,
      isDemo,
    });
    if (result.success) {
      setAbsenteeAlertEnabled(!absenteeAlertEnabled);
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const {
    data: offlineStudents,
    loading: studentsLoading,
    error: studentsError,
  } = useOfflineStudents(selectedClass && school?.id ? school.id : undefined);

  const {
    data: offlineAttendance,
    loading: attendanceLoading,
    error: attendanceError,
  } = useOfflineAttendance(selectedClass && school?.id ? school.id : undefined, date);

  useEffect(() => {
    if (!selectedClass || !school?.id) return;
    setAllMarked(false);
    setLoading(studentsLoading || attendanceLoading);
    setStudents(
      (offlineStudents || []).filter((student) => student.class_id === selectedClass && student.status === "active"),
    );
    const attendanceMap: Record<string, string> = {};
    (offlineAttendance || []).forEach((record: any) => {
      attendanceMap[record.student_id] = record.status;
    });
    if (rollCallMode) {
      const defaulted: Record<string, string> = {};
      (offlineStudents || []).forEach((s) => {
        defaulted[s.id] = attendanceMap[s.id] || "present";
      });
      setAttendance(defaulted);
    } else {
      setAttendance(attendanceMap);
    }
  }, [selectedClass, school?.id, offlineStudents, offlineAttendance, studentsLoading, attendanceLoading, rollCallMode]);

  const markAttendance = (studentId: string, status: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
    setAllMarked(false);
  };

  const handleTapStatus = (studentId: string) => {
    const current = attendance[studentId];
    const next = cycleStatus(current);
    markAttendance(studentId, next);
  };

  const markAll = (status: string) => {
    const newAttendance: Record<string, string> = {};
    students.forEach((s) => {
      newAttendance[s.id] = status;
    });
    setAttendance(newAttendance);
    setAllMarked(true);
  };

  const handleMarkAllPresent = () => {
    if (allMarked) {
      setAttendance({});
      setAllMarked(false);
      toast.info("Marks cleared");
    } else {
      setConfirmMarkAll(true);
    }
  };

  const handleQuickAbsentApply = () => {
    if (selectedAbsentIds.size === 0) {
      toast.warning("No students selected");
      return;
    }
    setAttendance((prev) => {
      const updated = { ...prev };
      selectedAbsentIds.forEach((id) => {
        updated[id] = "absent";
      });
      return updated;
    });
    toast.success(`${selectedAbsentIds.size} student(s) marked absent`);
    setSelectedAbsentIds(new Set());
    setAllMarked(false);
    setShowQuickAbsentModal(false);
  };

  const toggleAbsentSelection = (studentId: string) => {
    setSelectedAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const filteredStudents = useMemo(() => {
    let list = students;
    if (filterStatus !== "all") {
      list = list.filter((s) => attendance[s.id] === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q));
    }
    return list;
  }, [students, attendance, filterStatus, searchQuery]);

  const saveAttendance = async (attendanceOverride?: Record<string, string>) => {
    if (!selectedClass || !user?.id) return;

    const source = attendanceOverride ?? attendance;
    // Call Out Names promises "everyone starts as In School": unmarked
    // students are recorded present so a save is never silently partial.
    const effective: Record<string, string> =
      rollCallMode && !attendanceOverride
        ? Object.fromEntries(students.map((s) => [s.id, source[s.id] ?? "present"]))
        : source;

    const records = Object.entries(effective).map(([studentId, status]) =>
      normalizeAttendanceInput({
        student_id: studentId,
        class_id: selectedClass,
        date,
        status,
        recorded_by: user.id,
      }),
    );

    if (records.length === 0) {
      toast.warning("No attendance records to save");
      return;
    }

    const invalidRecord = records.find((record) => validateAttendanceInput(record).length > 0);
    if (invalidRecord) {
      const [message] = validateAttendanceInput(invalidRecord);
      toast.error(message);
      return;
    }

    setSaving(true);

    if (isOnline) {
      try {
        const attResult = await withTimeout(
          supabase
            .from("attendance")
            .upsert(records as any, { onConflict: "student_id,date,period_number" })
            .select("id"),
          15000,
          timeoutFallback(),
        );
        const timedOut = attResult?.status === 408 || attResult?.success === false || attResult?.data == null;
        const error = attResult?.error;
        if (error || timedOut) throw new Error(error?.message || "Attendance save timed out");
        await offlineDB.cacheFromServer("attendance", records as unknown as Record<string, unknown>[]);
        if (school?.id && user?.id) {
          await logAuditEventWithOfflineSupport(
            true,
            school.id,
            user.id,
            user.full_name,
            "update",
            "attendance",
            `Saved attendance batch for ${records.length} student(s)`,
            `${selectedClass}:${date}`,
            undefined,
            { count: records.length, class_id: selectedClass, date },
          );
        }
        toast.success("Attendance saved");
        notifyDashboardStatsChanged(school?.id);
        await loadOfflineCount();
      } catch (err) {
        logger.warn("Failed to save attendance, saving offline:", err);
        await saveOffline(records);
      } finally {
        setSaving(false);
      }
    } else {
      await saveOffline(records);
      setSaving(false);
    }
  };

  const saveOffline = async (records: Record<string, unknown>[]) => {
    try {
      for (const record of records) {
        await offlineDB.save("attendance", record as unknown as Record<string, unknown>);
      }
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          false,
          school.id,
          user.id,
          user.full_name,
          "update",
          "attendance",
          `Queued offline attendance batch for ${records.length} student(s)`,
          `${selectedClass}:${date}`,
          undefined,
          { count: records.length, class_id: selectedClass, date },
        );
      }
      toast.success(`Saved locally (${records.length} records)`);
      await loadOfflineCount();
    } catch (err) {
      logger.error("Offline save failed:", err);
      toast.error("Failed to save locally");
    }
  };

  const handleBulkMark = async (status: string) => {
    if (!selectedClass || !school?.id) return;
    setBulkProgress({ running: true, total: 0, current: 0 });
    setBulkSummary(null);
    try {
      const res = await fetch("/api/attendance/bulk/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: selectedClass,
          school_id: school.id,
          date_from: bulkDateFrom,
          date_to: bulkDateTo,
          status,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Bulk mark failed");
        return;
      }
      setBulkSummary(json.data);
      toast.success(`Marked ${json.data.students_count} students as ${status} over ${json.data.dates_count} day(s)`);
      notifyDashboardStatsChanged(school?.id);
      if (date >= bulkDateFrom && date <= bulkDateTo) {
        students.forEach((student) => markAttendance(student.id, status));
      }
    } catch (err) {
      logger.warn("Failed to bulk mark attendance:", err);
      toast.error("Failed to bulk mark attendance");
    } finally {
      setBulkProgress(null);
    }
  };

  const presentCount = Object.values(attendance).filter((s) => s === "present").length;
  const absentCount = Object.values(attendance).filter((s) => s === "absent").length;
  const lateCount = Object.values(attendance).filter((s) => s === "late").length;
  const excusedCount = Object.values(attendance).filter((s) => s === "excused").length;
  // In Call Out Names mode unmarked students save as present — reflect that in the UI.
  const unmarkedCount = students.filter((s) => !(s.id in attendance)).length;
  const effectivePresentCount = rollCallMode ? presentCount + unmarkedCount : presentCount;
  const hasAttendanceRecords = rollCallMode ? students.length > 0 : Object.keys(attendance).length > 0;
  const saveDisabledReason = !selectedClass
    ? "Select a class to enable Save Changes."
    : !hasAttendanceRecords
      ? "Mark at least one learner before saving."
      : "";

  const selectedClassName = filteredClasses.find((c) => c.id === selectedClass);

  const exportAttendance = () => {
    if (!selectedClass || students.length === 0) return;

    const headers = ["Student Number", "First Name", "Last Name", "Status"];
    const rows = students.map((student) => {
      const status = attendance[student.id] || "not marked";
      const statusLabel = STATUS_CONFIG[status as AttendanceStatus]?.label || status;
      return [student.student_number, student.first_name, student.last_name, statusLabel];
    });

    const csvContent = [
      `Attendance Export - ${selectedClassName?.name || "Unknown Class"} - ${date}`,
      "",
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${selectedClassName?.name || selectedClass}-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Attendance exported to CSV");
  };

  const handleCopyYesterday = async () => {
    if (!selectedClass || !school?.id) return;
    setCopyingYesterday(true);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);

      const { data } = await withTimeout(
        supabase.from("attendance").select("student_id, status").eq("class_id", selectedClass).eq("date", yesterdayStr),
        15000,
        timeoutFallback(),
      );

      if (data && data.length > 0) {
        const copied: Record<string, string> = {};
        data.forEach((r: any) => {
          copied[r.student_id] = r.status;
        });
        setAttendance((prev) => ({ ...prev, ...copied }));
        setAllMarked(true);
        toast.success(`Copied attendance from ${yesterdayStr} (${data.length} records)`);
      } else {
        toast.warning(`No attendance records found for ${yesterdayStr}`);
      }
    } catch (err) {
      logger.warn("Failed to copy yesterday's attendance:", err);
      toast.error("Failed to copy yesterday's attendance");
    } finally {
      setCopyingYesterday(false);
    }
  };

  const [confirmAbsentAlert, setConfirmAbsentAlert] = useState(false);

  const sendAbsentAlerts = async () => {
    setConfirmAbsentAlert(false);
    try {
      const absentees = students.filter((s) => attendance[s.id] === "absent");
      const { supabase: sb } = await import("@/lib/supabase");

      for (const student of absentees) {
        const phone = student.parent_phone;
        if (!phone) continue;

        const msgResult = await withTimeout(
          sb.from("messages").insert({
            school_id: school?.id,
            recipient_phone: phone,
            message: `SkoolMate Alert: ${student.first_name} was marked ABSENT today (${date}). Please confirm with school if this is unexpected.`,
            status: "sent",
            type: "attendance_alert",
          }),
          15000,
          timeoutFallback(),
        );
        const msgError = msgResult?.error;
        if (msgError) throw msgError;
      }
      toast.success(`Absence alerts queued for ${absentees.length} parents`);
    } catch (err) {
      toast.error("Failed to send alerts");
    }
  };

  return (
    <PageErrorBoundary>
      <>
        <PageHeader
          title="Attendance Center"
          subtitle={`Marking records for ${selectedClassName?.name || "Academic Classes"}`}
          actions={
            <div className="flex flex-col items-start sm:items-end gap-1">
              <div className="flex items-center gap-2">
                {absentCount > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmAbsentAlert(true)}
                    className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    icon={<MaterialIcon icon="notification_important" />}
                  >
                    Notify Parents ({absentCount})
                  </Button>
                )}
                <Button
                  onClick={() => saveAttendance()}
                  disabled={saving || !selectedClass || !hasAttendanceRecords}
                  loading={saving}
                  variant="primary"
                  size="sm"
                  icon={<MaterialIcon icon="save" />}
                  className="shadow-md shadow-navy/20"
                >
                  Save Changes
                </Button>
                <Button
                  onClick={exportAttendance}
                  disabled={!selectedClass || students.length === 0}
                  variant="secondary"
                  size="sm"
                  icon={<MaterialIcon icon="download" />}
                >
                  Export
                </Button>
                <Button
                  onClick={handleCopyYesterday}
                  disabled={!selectedClass || copyingYesterday}
                  variant="secondary"
                  size="sm"
                  loading={copyingYesterday}
                  icon={<MaterialIcon icon="content_copy" />}
                >
                  Copy Yesterday
                </Button>
              </div>
              {saveDisabledReason && <p className="text-xs text-on-surface-variant">{saveDisabledReason}</p>}
            </div>
          }
        />

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${absenteeAlertEnabled ? "bg-error-container" : "bg-surface-container-high"}`}
            >
              <MaterialIcon
                icon={absenteeAlertEnabled ? "notifications_active" : "notifications_off"}
                className={absenteeAlertEnabled ? "text-error" : "text-on-surface-variant"}
              />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-on-surface text-sm flex items-center gap-2">
                Absentee SMS Alerts
                {loadingAutomation ? (
                  <span className="text-xs text-on-surface-variant">Loading...</span>
                ) : (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${absenteeAlertEnabled ? "bg-error-container text-error" : "bg-surface-container-high text-on-surface-variant"}`}
                  >
                    {absenteeAlertEnabled ? "ON" : "OFF"}
                  </span>
                )}
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Auto-SMS parents when students are marked absent
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleAbsenteeAlert}
            disabled={loadingAutomation}
            title={absenteeAlertEnabled ? "Disable absentee SMS alerts" : "Enable absentee SMS alerts"}
            className={`relative w-14 h-8 rounded-full transition-colors duration-200 min-w-[56px] shrink-0 ${absenteeAlertEnabled ? "bg-error" : "bg-surface-container-highest"}`}
            role="switch"
            aria-checked={absenteeAlertEnabled}
            aria-label="Toggle absentee SMS alerts"
          >
            <div
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${absenteeAlertEnabled ? "translate-x-7" : "translate-x-1"}`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "In School", value: presentCount, tone: "text-secondary" },
            { label: "Away", value: absentCount, tone: "text-error" },
            { label: "Late", value: lateCount, tone: "text-tertiary" },
            { label: "Excused", value: excusedCount, tone: "text-[#7c3aed]" },
            { label: "Offline queue", value: offlineCount, tone: "text-primary" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3 text-center"
            >
              <div className={`text-2xl md:text-3xl font-bold ${item.tone}`}>{item.value}</div>
              <div className="text-xs md:text-sm text-on-surface-variant mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">
                Select Class
                {isClassTeacher && !isAdmin && (
                  <span className="ml-2 normal-case font-medium text-primary">(your classes)</span>
                )}
              </label>
              {classesLoading ? (
                <div className="bg-[var(--navy-soft)] border border-[rgba(0,31,63,0.12)] rounded-xl p-4">
                  <p className="text-[var(--t1)] text-sm font-medium">Loading classes...</p>
                  <p className="text-[var(--t3)] text-xs mt-1">
                    The class list is still being fetched for this school.
                  </p>
                </div>
              ) : classes.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-amber-800 text-sm font-medium">No classes found</p>
                  <p className="text-amber-600 text-xs mt-1">
                    Classes are created automatically when you register a school. If you are seeing this, please contact
                    support or re-register.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedClass || ""}
                  onChange={(e) => setSelectedClass(e.target.value || null)}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select a class</option>
                  {filteredClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.stream ? ` ${c.stream}` : ""} ({c.level})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-end gap-2">
              <div className={bulkMode ? "sm:w-40" : "sm:w-48"}>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={bulkMode}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
                />
              </div>
              <button
                onClick={() => setBulkMode(!bulkMode)}
                className={`px-3 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all min-h-[44px] ${
                  bulkMode
                    ? "bg-primary text-on-primary shadow-md"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
                title="Toggle bulk date-range marking"
              >
                Bulk
              </button>
            </div>
          </div>
          {bulkMode && (
            <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-outline-variant">
              <div className="sm:w-48">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">
                  From Date
                </label>
                <input
                  type="date"
                  value={bulkDateFrom}
                  onChange={(e) => setBulkDateFrom(e.target.value)}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="sm:w-48">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">
                  To Date
                </label>
                <input
                  type="date"
                  value={bulkDateTo}
                  onChange={(e) => setBulkDateTo(e.target.value)}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex-1 flex items-end gap-2 flex-wrap">
                {(["present", "absent", "late", "excused"] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => handleBulkMark(s)}
                      title={`Mark all students as ${cfg.label.toLowerCase()}`}
                      disabled={bulkProgress?.running || !selectedClass || !isOnline}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] disabled:opacity-40 ${
                        s === "present"
                          ? "bg-secondary/10 text-secondary border-2 border-secondary/30 hover:bg-secondary/20"
                          : s === "absent"
                            ? "bg-error/10 text-error border-2 border-error/30 hover:bg-error/20"
                            : s === "late"
                              ? "bg-tertiary/10 text-tertiary border-2 border-tertiary/30 hover:bg-tertiary/20"
                              : "bg-[#f3e8ff] text-[#7c3aed] border-2 border-[#7c3aed]/30 hover:bg-[#ede3fe]"
                      }`}
                    >
                      Mark All {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {bulkProgress?.running && (
            <div className="mt-3 flex items-center gap-3 text-sm text-on-surface-variant">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Bulk marking in progress...
            </div>
          )}
          {bulkSummary && !bulkProgress && (
            <div className="mt-3 bg-secondary/5 border border-secondary/20 rounded-xl p-3 text-sm text-on-surface">
              Bulk mark complete: {bulkSummary.students_count} students marked as {bulkSummary.status} over{" "}
              {bulkSummary.dates_count} day(s) ({bulkSummary.total_records} total records)
            </div>
          )}
        </div>

        {!selectedClass ? (
          <EmptyState
            icon="fact_check"
            title="Select a class"
            description={
              isClassTeacher && !isAdmin && filteredClasses.length === 0
                ? "You are not assigned as class teacher for any class"
                : "Choose a class to mark attendance"
            }
          />
        ) : loading ? (
          <TableSkeleton rows={5} />
        ) : students.length === 0 ? (
          <>
            <div className="mb-4 flex gap-2">
              <Button variant="secondary" disabled icon={<MaterialIcon icon="check_circle" />}>
                Mark All In School
              </Button>
            </div>
            <EmptyState icon="group" title="No students in this class" description="Add students to this class first" />
          </>
        ) : (
          <>
            <details className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-bold text-on-surface-variant select-none">
                How marking works
              </summary>
              <div className="pt-2">
                <PageGuidance
                  title="How to Use Attendance"
                  tips={[
                    {
                      icon: "school",
                      text: "Select a class from the dropdown above",
                    },
                    { icon: "event", text: "Choose the date (defaults to today)" },
                    {
                      icon: "touch_app",
                      text: "Tap once for Away, again for Late, again for Excused",
                    },
                    {
                      icon: "toggle_on",
                      text: "Call Out Names Mode: everyone starts as In School, tap only those Away",
                    },
                    {
                      icon: "save",
                      text: "Click Save when done - unmarked students are recorded as In School",
                    },
                  ]}
                />
              </div>
            </details>

            <div className="dashboard-toolbar">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon icon="mic" className="text-xl text-primary" />
                  <div>
                    <div className="font-semibold text-on-surface">Call Out Names</div>
                    <div className="text-xs text-on-surface-variant">
                      Everyone starts as In School — tap only those Away
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setRollCallMode(!rollCallMode)}
                  title={rollCallMode ? "Switch to list view" : "Call out names one by one"}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-200 min-w-[56px] ${
                    rollCallMode ? "bg-primary" : "bg-surface-container-highest"
                  }`}
                  role="switch"
                  aria-checked={rollCallMode}
                  aria-label="Toggle Call Out Names Mode"
                >
                  <div
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                      rollCallMode ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {rollCallMode ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleMarkAllPresent}
                    icon={<MaterialIcon icon="check_circle" />}
                    size="sm"
                  >
                    Mark All In School
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowQuickAbsentModal(true)}
                    icon={<MaterialIcon icon="person_remove" />}
                    size="sm"
                  >
                    Quick Away
                  </Button>
                  <div className="flex-1" />
                  <div className="text-sm text-on-surface-variant self-center font-medium">
                    {presentCount} present, {absentCount} away, {lateCount} late, {excusedCount} excused
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Search student name..."
                    className="w-full md:w-48 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  {(["all", "present", "absent", "late", "excused"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterStatus(f)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] ${
                        filterStatus === f
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      {f === "all"
                        ? "All"
                        : f === "present"
                          ? "In School"
                          : f === "absent"
                            ? "Away"
                            : f === "late"
                              ? "Late"
                              : "Excused"}
                      {f !== "all" && (
                        <span className="ml-1 opacity-70">
                          (
                          {f === "present"
                            ? presentCount
                            : f === "absent"
                              ? absentCount
                              : f === "late"
                                ? lateCount
                                : excusedCount}
                          )
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {(searchQuery || filterStatus !== "all" || selectedClass) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {searchQuery && (
                      <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-[var(--primary-50)] border border-[var(--primary-200)] text-xs font-medium text-[var(--primary-700)]">
                        Search: “{searchQuery}”{" "}
                        <button
                          onClick={() => setSearchQuery("")}
                          className="w-5 h-5 rounded-full bg-white/70 hover:bg-white flex items-center justify-center"
                        >
                          <MaterialIcon icon="close" className="text-[14px]" />
                        </button>
                      </span>
                    )}
                    {selectedClass && (
                      <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-[var(--primary-50)] border border-[var(--primary-200)] text-xs font-medium text-[var(--primary-700)]">
                        Class: {filteredClasses.find((c) => c.id === selectedClass)?.name || selectedClass}{" "}
                        <button
                          onClick={() => setSelectedClass(null)}
                          className="w-5 h-5 rounded-full bg-white/70 hover:bg-white flex items-center justify-center"
                        >
                          <MaterialIcon icon="close" className="text-[14px]" />
                        </button>
                      </span>
                    )}
                    {filterStatus !== "all" && (
                      <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-[var(--primary-50)] border border-[var(--primary-200)] text-xs font-medium text-[var(--primary-700)]">
                        Status: {filterStatus}{" "}
                        <button
                          onClick={() => setFilterStatus("all")}
                          className="w-5 h-5 rounded-full bg-white/70 hover:bg-white flex items-center justify-center"
                        >
                          <MaterialIcon icon="close" className="text-[14px]" />
                        </button>
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setFilterStatus("all");
                      }}
                      className="text-xs font-semibold text-[var(--primary)] hover:underline ml-1"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {filteredStudents.map((student) => {
                    const status = (attendance[student.id] || "present") as AttendanceStatus;
                    const config = STATUS_CONFIG[status];
                    const borderColor =
                      status === "present"
                        ? "border-secondary/30"
                        : status === "absent"
                          ? "border-error/30"
                          : status === "late"
                            ? "border-tertiary/30"
                            : "border-[#7c3aed]/30";
                    const bgColor =
                      status === "present"
                        ? "bg-secondary/5"
                        : status === "absent"
                          ? "bg-error/5"
                          : status === "late"
                            ? "bg-tertiary/5"
                            : "bg-[#f3e8ff]";
                    return (
                      <div
                        key={student.id}
                        onClick={() => handleTapStatus(student.id)}
                        className={`${bgColor} rounded-xl border ${borderColor} p-4 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer select-none min-h-[56px]`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            <PersonInitials name={`${student.first_name} ${student.last_name}`} size={40} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-on-surface text-base truncate">
                              {student.first_name} {student.last_name}
                            </div>
                            <div className="text-xs text-on-surface-variant">{student.student_number}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-md ${config.bg} ${status === "present" ? "text-on-secondary-container" : status === "absent" ? "text-on-error-container" : status === "late" ? "text-on-tertiary-container" : "text-[#7c3aed]"}`}
                          >
                            {config.label}
                          </span>
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                              status === "present"
                                ? "bg-secondary"
                                : status === "absent"
                                  ? "bg-error"
                                  : status === "late"
                                    ? "bg-tertiary"
                                    : "bg-[#7c3aed]"
                            }`}
                          >
                            <MaterialIcon icon={config.icon} className="text-white text-lg" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <div className="text-center py-8 text-on-surface-variant">No students with this status</div>
                  )}
                </div>

                <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-0 right-0 md:relative md:bottom-auto p-4 md:p-0 bg-surface/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-t border-outline-variant md:border-0 z-10">
                  <Button
                    onClick={() => saveAttendance()}
                    disabled={saving}
                    loading={saving}
                    icon={<MaterialIcon icon="save" />}
                    className="w-full"
                    size="lg"
                  >
                    Save: {effectivePresentCount} present, {absentCount} away, {lateCount} late, {excusedCount} excused
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleMarkAllPresent}
                    icon={<MaterialIcon icon={allMarked ? "undo" : "check_circle"} />}
                  >
                    {allMarked ? "Reset All" : "Mark All In School"}
                  </Button>
                  <Tabs
                    tabs={[
                      { id: "desktop", label: "List" },
                      { id: "mobile", label: "Cards" },
                    ]}
                    activeTab={viewMode}
                    onChange={(id) => setViewMode(id as "desktop" | "mobile")}
                  />
                </div>

                <TabPanel activeTab={viewMode} tabId="desktop">
                  <div className="space-y-3">
                    {paginatedStudents.map((student) => {
                      const status = attendance[student.id] as AttendanceStatus | undefined;
                      const config = status ? STATUS_CONFIG[status] : null;
                      return (
                        <div
                          key={student.id}
                          className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <PersonInitials name={`${student.first_name} ${student.last_name}`} size={40} />
                              <div>
                                <div className="font-bold text-primary">
                                  {student.first_name} {student.last_name}
                                  {student.boarding_status && student.boarding_status !== "day" && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold rounded uppercase">
                                      {student.boarding_status}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-on-surface-variant">{student.student_number}</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {STATUS_CYCLE.map((s) => {
                                const sConfig = STATUS_CONFIG[s];
                                const isActive = status === s;
                                return (
                                  <button
                                    key={s}
                                    onClick={() => markAttendance(student.id, s)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                      isActive
                                        ? `${sConfig.bg} border-${s === "absent" ? "error" : s === "present" ? "secondary" : s === "late" ? "tertiary" : "[#7c3aed]"}`
                                        : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-outline-variant"
                                    }`}
                                  >
                                    {sConfig.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {students.length > attendPerPage && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/10">
                      <span className="text-sm text-on-surface-variant">
                        Page {attendPage} of {attendTotalPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAttendPage((p) => Math.max(1, p - 1))}
                          disabled={attendPage === 1}
                        >
                          <MaterialIcon icon="chevron_left" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAttendPage((p) => Math.min(attendTotalPages, p + 1))}
                          disabled={attendPage >= attendTotalPages}
                        >
                          <MaterialIcon icon="chevron_right" />
                        </Button>
                      </div>
                    </div>
                  )}
                </TabPanel>

                <TabPanel activeTab={viewMode} tabId="mobile">
                  <div className="space-y-2">
                    {paginatedStudents.map((student) => {
                      const status = attendance[student.id] as AttendanceStatus | undefined;
                      const config = status ? STATUS_CONFIG[status] : null;
                      return (
                        <div
                          key={student.id}
                          onClick={() => handleTapStatus(student.id)}
                          className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3">
                            <PersonInitials name={`${student.first_name} ${student.last_name}`} size={40} />
                            <div>
                              <div className="font-bold text-primary text-sm">
                                {student.first_name} {student.last_name}
                              </div>
                              <div className="text-xs text-on-surface-variant">{student.student_number}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {config && (
                              <span className="text-xs font-medium text-on-surface-variant">{config.label}</span>
                            )}
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                status === "present"
                                  ? "bg-secondary"
                                  : status === "late"
                                    ? "bg-tertiary"
                                    : status === "absent"
                                      ? "bg-error"
                                      : status === "excused"
                                        ? "bg-[#7c3aed]"
                                        : "bg-surface-container border-2 border-dashed border-outline-variant"
                              }`}
                            >
                              {status && (
                                <MaterialIcon
                                  icon={STATUS_CONFIG[status as AttendanceStatus].icon}
                                  className="text-white text-lg"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-center text-xs text-on-surface-variant pt-2">Tap a student to cycle status</p>
                  </div>
                </TabPanel>

                <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-0 right-0 md:relative md:bottom-auto p-4 md:p-0 bg-surface/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-t border-outline-variant md:border-0 z-10">
                  <Button
                    onClick={() => saveAttendance()}
                    disabled={saving || Object.keys(attendance).length === 0}
                    loading={saving}
                    icon={<MaterialIcon icon="save" />}
                    className="w-full"
                  >
                    {isOnline ? "Save Attendance" : "Save Offline"}
                  </Button>
                </div>
              </>
            )}

            <Modal
              isOpen={showQuickAbsentModal}
              onClose={() => {
                setShowQuickAbsentModal(false);
                setSelectedAbsentIds(new Set());
              }}
              title="Quick Mark Absent"
              size="lg"
            >
              <div className="mb-4">
                <p className="text-sm text-on-surface-variant mb-3">
                  Select students who are absent. All others remain present.
                </p>
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedAbsentIds(new Set(students.map((s) => s.id)))}
                  >
                    Select All
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedAbsentIds(new Set())}>
                    Clear All
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const alreadyAbsent = students.filter((s) => attendance[s.id] === "absent").map((s) => s.id);
                      setSelectedAbsentIds(new Set(alreadyAbsent));
                    }}
                  >
                    Select Current Absent
                  </Button>
                </div>
                <div className="text-sm font-medium text-on-surface mb-2">
                  {selectedAbsentIds.size} student(s) selected
                </div>
              </div>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {students.map((student) => {
                  const isSelected = selectedAbsentIds.has(student.id);
                  const currentStatus = attendance[student.id] || "present";
                  return (
                    <button
                      key={student.id}
                      onClick={() => toggleAbsentSelection(student.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl min-h-[48px] transition-colors text-left ${
                        isSelected
                          ? "bg-error/10 border border-error/30"
                          : "bg-surface-container hover:bg-surface-container-high"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? "bg-error border-error" : "border-outline-variant"
                        }`}
                      >
                        {isSelected && <MaterialIcon icon="check" className="text-white text-sm" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-on-surface text-sm truncate">
                          {student.first_name} {student.last_name}
                        </div>
                        <div className="text-xs text-on-surface-variant">{student.student_number}</div>
                      </div>
                      {currentStatus !== "present" && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            currentStatus === "absent"
                              ? "bg-error-container text-on-error-container"
                              : "bg-tertiary-container text-on-tertiary-container"
                          }`}
                        >
                          {STATUS_CONFIG[currentStatus as AttendanceStatus]?.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-4 pt-4 border-t border-outline-variant">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowQuickAbsentModal(false);
                    setSelectedAbsentIds(new Set());
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleQuickAbsentApply}
                  disabled={selectedAbsentIds.size === 0}
                  icon={<MaterialIcon icon="person_remove" />}
                  className="flex-1"
                >
                  Mark {selectedAbsentIds.size} Absent
                </Button>
              </div>
            </Modal>
          </>
        )}
        <ConfirmDialog
          isOpen={confirmMarkAll}
          onClose={() => setConfirmMarkAll(false)}
          onConfirm={async () => {
            const allPresent: Record<string, string> = {};
            students.forEach((s) => {
              allPresent[s.id] = "present";
            });
            markAll("present");
            setConfirmMarkAll(false);
            await saveAttendance(allPresent);
          }}
          title="Mark All Present"
          message={`Mark all ${students.length} students as present and save?`}
          confirmLabel="Mark All Present & Save"
          variant="info"
        />
        <ConfirmDialog
          isOpen={confirmAbsentAlert}
          onClose={() => setConfirmAbsentAlert(false)}
          onConfirm={sendAbsentAlerts}
          title="Send Absence Alerts"
          message={`Send absence alerts to parents of ${absentCount} absent students?`}
          confirmLabel="Send Alerts"
          variant="warning"
        />
      </>
    </PageErrorBoundary>
  );
}
