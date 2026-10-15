"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { RollCallPhoto } from "@/components/attendance/RollCallPhoto";
import { SwipeRow } from "@/components/attendance/SwipeRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { normalizeAttendanceInput, validateAttendanceInput } from "@/lib/validation";
import type { Student } from "@/types";
import { canAccess, type UserRole } from "@/lib/roles";
import { withTimeout, timeoutFallback, notifyDashboardStatsChanged, getLocalDateString } from "@/lib/hooks/utils";
import { getAutomationStatus, toggleAutomation } from "@/lib/sms-automation";

const STATUS_CYCLE = ["present", "absent", "late", "excused"] as const;
type AttendanceStatus = (typeof STATUS_CYCLE)[number];

const STATUS_CONFIG: Record<AttendanceStatus, { color: string; bg: string; label: string; icon: string }> = {
  absent: {
    color: "bg-error",
    bg: "bg-error-container",
    label: "Absent",
    icon: "cancel",
  },
  present: {
    color: "bg-secondary",
    bg: "bg-secondary-container",
    label: "Present",
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
  // First tap on an unmarked student marks Absent — the most common action.
  if (!current) return "absent";
  const idx = STATUS_CYCLE.indexOf(current as AttendanceStatus);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

/** Tally a saved batch by status for the post-save summary. */
function countStatuses(statuses: string[]): { present: number; absent: number; late: number; excused: number } {
  return {
    present: statuses.filter((s) => s === "present").length,
    absent: statuses.filter((s) => s === "absent").length,
    late: statuses.filter((s) => s === "late").length,
    excused: statuses.filter((s) => s === "excused").length,
  };
}

export default function AttendancePage() {
  const { school, user, isDemo } = useAuth();
  const canNotifyParents = user?.role ? canAccess(user.role as UserRole, "messages") : false;
  const canManageSmsAutomation = user?.role ? canAccess(user.role as UserRole, "autoSMS") : false;
  const canExport = user?.role ? canAccess(user.role as UserRole, "export") : false;
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const urlFilters = useUrlSyncedFilters();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedClass, setSelectedClass] = useState<string | null>(() => {
    // URL param wins (deep links), otherwise resume the teacher's last class
    // so the daily flow opens ready-to-mark with zero dropdown hunting.
    const fromUrl = urlFilters.get("class");
    if (fromUrl) return fromUrl;
    try {
      if (typeof window !== "undefined" && school?.id && user?.id) {
        return window.localStorage.getItem(`skoolmate_attendance_class:${school.id}|${user.id}`);
      }
    } catch {
      // Ignore storage errors — just start unselected.
    }
    return null;
  });
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
  // Post-save done state: after a save the register is replaced by a summary
  // (counts + next actions) instead of dropping the teacher back on the same
  // list with nothing changed. Cleared on class/date change or explicit back.
  const [savedSummary, setSavedSummary] = useState<{
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    offline: boolean;
    className: string;
    date: string;
  } | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [allMarked, setAllMarked] = useState(false);
  const [confirmMarkAll, setConfirmMarkAll] = useState(false);
  const [absenteeAlertEnabled, setAbsenteeAlertEnabled] = useState(false);
  const [loadingAutomation, setLoadingAutomation] = useState(true);
  // One marking list, no List/Cards tabs and no Call-Out mode toggle: the
  // list below is responsive (buttons disclose on md+) and swipeable
  // everywhere, so there is nothing to switch between.
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
  const [pendingBulk, setPendingBulk] = useState<{ status: string; label: string } | null>(null);
  const [bulkRangeError, setBulkRangeError] = useState<string | null>(null);
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
  // Undo: keep the last single-row mark so a mis-tap is one tap to reverse.
  const [undoMark, setUndoMark] = useState<{ studentId: string; prev?: string; name: string } | null>(null);
  const undoTimer = useRef<number | null>(null);
  // Explicit "bring collapsed rows back" escape hatch (also available in the
  // all-marked empty state and the progress bar).
  const [showMarked, setShowMarked] = useState(false);
  // Overflow menu: Bulk + SMS settings live here so the register stays first.
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [showSmsSettings, setShowSmsSettings] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | AttendanceStatus>(
    () => (urlFilters.get("status") as "all" | AttendanceStatus) || "all",
  );
  const [searchQuery, setSearchQuery] = useState(() => urlFilters.get("q") || "");

  const isClassTeacher = user?.role === "teacher";
  const isAdmin =
    user?.role === "headmaster" ||
    user?.role === "dean_of_studies" ||
    user?.role === "school_admin" ||
    user?.role === "super_admin" ||
    user?.role === "bursar";

  // RLS scopes this list to the classes the teacher leads or teaches, so take
  // it as-is: filtering on class_teacher_id alone drops every class where the
  // teacher only teaches a subject (and the column used to be unselected, so
  // teachers got an empty dropdown either way).
  const filteredClasses = classes;

  // Persist the class this teacher actually used so the next day's roll call
  // opens on it instead of forcing a dropdown hunt on a 2GB phone.
  useEffect(() => {
    if (!selectedClass || !school?.id || !user?.id) return;
    try {
      window.localStorage.setItem(`skoolmate_attendance_class:${school.id}|${user.id}`, selectedClass);
    } catch {
      // Ignore storage errors (private mode / quota) — not worth interrupting class.
    }
  }, [selectedClass, school?.id, user?.id]);

  // A remembered class can disappear (deleted / teacher reassigned). Clear it
  // once the class list arrives so the page doesn't sit on a dead selection.
  useEffect(() => {
    if (!selectedClass || classesLoading || classes.length === 0) return;
    if (!filteredClasses.some((c) => c.id === selectedClass)) {
      setSelectedClass(null);
      try {
        if (typeof window !== "undefined" && school?.id && user?.id) {
          window.localStorage.removeItem(`skoolmate_attendance_class:${school.id}|${user.id}`);
        }
      } catch {
        // Ignore storage errors.
      }
    }
  }, [selectedClass, classesLoading, classes.length, filteredClasses, school?.id, user?.id]);

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
    const classPupils = (offlineStudents || []).filter(
      (student) => student.class_id === selectedClass && student.status === "active",
    );
    setStudents(classPupils);
    // The records query is school+date scoped, so other classes' marks for
    // the same day arrive here too. Scope everything to this register's
    // pupils — otherwise counts, chips, and the save bar report the whole
    // school (e.g. "264 present" for a 26-pupil class).
    const classIds = new Set(classPupils.map((s) => s.id));
    const attendanceMap: Record<string, string> = {};
    (offlineAttendance || []).forEach((record: any) => {
      if (!classIds.has(record.student_id)) return;
      attendanceMap[record.student_id] = record.status;
    });
    // Only saved/edited marks live in state — unmarked rows show an honest
    // "Unmarked" chip (first tap = Absent) and still save as Present, so a
    // save is never silently partial.
    setAttendance(attendanceMap);
  }, [selectedClass, school?.id, offlineStudents, offlineAttendance, studentsLoading, attendanceLoading]);

  const markAttendance = (studentId: string, status: string) => {
    const prev = attendance[studentId];
    const student = students.find((s) => s.id === studentId);
    setUndoMark({ studentId, prev, name: student ? `${student.first_name} ${student.last_name}` : "student" });
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoMark(null), 4000);
    setAttendance((prevMap) => ({ ...prevMap, [studentId]: status }));
    setAllMarked(false);
    flashConfirm(studentId);
    scheduleCollapse(studentId);
  };

  const undoLastMark = () => {
    if (!undoMark) return;
    setAttendance((prevMap) => {
      const next = { ...prevMap };
      if (undoMark.prev === undefined) delete next[undoMark.studentId];
      else next[undoMark.studentId] = undoMark.prev;
      return next;
    });
    setCollapsedIds((prev) => {
      if (!prev.has(undoMark.studentId)) return prev;
      const next = new Set(prev);
      next.delete(undoMark.studentId);
      return next;
    });
    setUndoMark(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
  };

  // Post-mark feedback: the row flashes its new status, then tucks away so
  // the next unmarked pupil slides up — no scrolling through marked rows.
  // Both timers are per-mark (never cleared by later marks) so rapid marking
  // never strands a row confirmed-but-visible or collapses one unflashed.
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const flashConfirm = (studentId: string) => {
    setConfirmedId(studentId);
    window.setTimeout(() => {
      setConfirmedId((cur) => (cur === studentId ? null : cur));
    }, 900);
  };
  const scheduleCollapse = (studentId: string) => {
    window.setTimeout(() => {
      setCollapsedIds((prev) => {
        if (prev.has(studentId)) return prev;
        const next = new Set(prev);
        next.add(studentId);
        return next;
      });
    }, 900);
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
      setCollapsedIds(new Set());
      setConfirmedId(null);
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
    // Freshly-marked absentees tuck away with the rest of this session's marks.
    setCollapsedIds((prev) => new Set([...prev, ...selectedAbsentIds]));
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

  // Marked rows tuck away automatically — but only while browsing the whole
  // register with the collapse on. An active filter or search means "I'm
  // looking for someone", and "Show marked" explicitly brings them back, so
  // review views always show everything matching.
  const isReviewing = filterStatus !== "all" || searchQuery.trim() !== "";
  const visibleStudents =
    isReviewing || showMarked ? filteredStudents : filteredStudents.filter((s) => !collapsedIds.has(s.id));

  // A new class or date means a new register — drop the previous save summary
  // and tuck state so the teacher always lands back on the marking list, never
  // a stale done.
  useEffect(() => {
    setSavedSummary(null);
    setCollapsedIds(new Set());
    setConfirmedId(null);
    setShowMarked(false);
    setUndoMark(null);
  }, [selectedClass, date]);

  const saveAttendance = async (attendanceOverride?: Record<string, string>) => {
    if (!selectedClass || !user?.id) return;

    const source = attendanceOverride ?? attendance;
    // Unmarked pupils are recorded present so a save is never silently
    // partial — the register says so above the list, and the save bar shows
    // the resulting counts before anything is written.
    const effective: Record<string, string> = !attendanceOverride
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
        const summaryCounts = countStatuses(Object.values(effective));
        setSavedSummary({
          ...summaryCounts,
          total: records.length,
          offline: false,
          className: filteredClasses.find((c) => c.id === selectedClass)?.name || "",
          date,
        });
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
      const summaryCounts = countStatuses(records.map((r) => String((r as { status?: unknown }).status ?? "")));
      setSavedSummary({
        ...summaryCounts,
        total: records.length,
        offline: true,
        className: filteredClasses.find((c) => c.id === selectedClass)?.name || "",
        date,
      });
    } catch (err) {
      logger.error("Offline save failed:", err);
      toast.error("Failed to save locally");
    }
  };

  const bulkRangeInvalid = Boolean(bulkDateFrom && bulkDateTo && bulkDateFrom > bulkDateTo);

  const requestBulkMark = (status: string) => {
    if (!selectedClass || !school?.id) return;
    if (bulkRangeInvalid) return;
    // These buttons rewrite every day in the chosen range for the whole class.
    // The default range is the last 7 days but the buttons were labelled only
    // "Mark All Present", so a teacher who meant today could silently overwrite
    // six days of real attendance -- recorded absences and sick days included --
    // with no confirmation and no undo. Confirm the class and the dates first.
    setPendingBulk({ status, label: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label || status });
  };

  const handleBulkMark = async (status: string) => {
    if (!selectedClass || !school?.id) return;
    if (bulkRangeInvalid) {
      toast.error("The From date must not be after the To date.");
      return;
    }
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
  // Unmarked pupils count (and save) as present — reflected here and in the
  // save gate below — but the row itself shows an honest "Unmarked" chip.
  const unmarkedCount = students.filter((s) => !(s.id in attendance)).length;
  const markedCount = students.length - unmarkedCount;
  const markedPct = students.length > 0 ? Math.round((markedCount / students.length) * 100) : 0;
  const effectivePresentCount = presentCount + unmarkedCount;
  const hasAttendanceRecords = students.length > 0;
  // Briefly highlight the row "Next unmarked" scrolls to, so the eye lands on
  // it in a 60-pupil list.
  const [flashId, setFlashId] = useState<string | null>(null);
  // One-time swipe teaching nudge: the first row slides right and back
  // once per session (see swipe-peek keyframes), demonstrating the gesture
  // instead of only describing it in the hint line.
  const [peekDone] = useState(() => {
    try {
      if (typeof window === "undefined" || window.sessionStorage.getItem("att-swipe-peek")) return true;
      window.sessionStorage.setItem("att-swipe-peek", "1");
      return false;
    } catch {
      return true;
    }
  });
  const flashTimer = useRef<number | null>(null);
  const jumpToNextUnmarked = useCallback(() => {
    const pool = visibleStudents.length > 0 ? visibleStudents : students;
    const next = pool.find((s) => !(s.id in attendance));
    if (!next) {
      toast.info("Everyone on this list is marked");
      return;
    }
    setFlashId(next.id);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1600);
    document.getElementById(`att-row-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [visibleStudents, students, attendance, toast]);
  const saveDisabledReason = !selectedClass
    ? "Select a class to enable Save."
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
            phone,
            recipient_type: "individual",
            message: `SkoolMate Alert: ${student.first_name} was marked ABSENT today (${date}). Please confirm with school if this is unexpected.`,
            status: "sent",
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
      <div className="space-y-5 p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
        <PageHeader
          title="Attendance Center"
          subtitle={`Marking records for ${selectedClassName?.name || "Academic Classes"}`}
          actions={
            <div className="flex flex-col items-start sm:items-end gap-1">
              <div className="flex flex-wrap items-center gap-2">
                {canNotifyParents && absentCount > 0 && (
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
                  Save
                </Button>
                {canExport && (
                  <Button
                    onClick={exportAttendance}
                    disabled={!selectedClass || students.length === 0}
                    variant="secondary"
                    size="sm"
                    icon={<MaterialIcon icon="download" />}
                  >
                    Export
                  </Button>
                )}
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
                {(canManageSmsAutomation || selectedClass) && (
                  <div className="relative">
                    <Button
                      onClick={() => setOverflowOpen((v) => !v)}
                      variant="secondary"
                      size="sm"
                      icon={<MaterialIcon icon="more_horiz" />}
                      aria-expanded={overflowOpen}
                      aria-haspopup="menu"
                      aria-label="More attendance tools"
                    />
                    {overflowOpen && (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-10 cursor-default"
                          aria-label="Close menu"
                          onClick={() => setOverflowOpen(false)}
                        />
                        <div
                          role="menu"
                          className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
                        >
                          <button
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setOverflowOpen(false);
                              setBulkMode(true);
                            }}
                            className="w-full text-left rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium text-on-surface hover:bg-surface-container"
                          >
                            Bulk date-range marking
                          </button>
                          {canManageSmsAutomation && (
                            <button
                              role="menuitem"
                              type="button"
                              onClick={() => {
                                setOverflowOpen(false);
                                setShowSmsSettings((v) => !v);
                              }}
                              className="w-full text-left rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium text-on-surface hover:bg-surface-container"
                            >
                              {showSmsSettings ? "Hide" : "Show"} Absentee SMS Alerts
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              {saveDisabledReason && <p className="text-xs text-on-surface-variant">{saveDisabledReason}</p>}
            </div>
          }
        />

        <div
          aria-label="Teacher attendance register summary"
          className="rounded-[28px] border border-[var(--border)] bg-white p-4 shadow-[0_16px_35px_rgba(15,23,42,0.06)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--primary)]">Register</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--t1)] font-['Sora']">Mark today&apos;s class</h2>
            </div>
            <span className="rounded-full bg-[var(--primary-50)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--t1)]">
              {selectedClassName?.name || "Choose class"}
            </span>
          </div>

          <p className="mt-3 text-sm text-on-surface-variant">
            <span className="font-bold text-on-surface">
              {markedCount}/{students.length} marked
            </span>
            {" · "}
            <span className="font-semibold text-secondary">{effectivePresentCount} present</span>
            {" · "}
            <span className="font-semibold text-error">{absentCount} absent</span>
            {lateCount > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-tertiary">{lateCount} late</span>
              </>
            )}
            {excusedCount > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-[#7c3aed]">{excusedCount} excused</span>
              </>
            )}
            {offlineCount > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-primary">{offlineCount} offline</span>
              </>
            )}
          </p>
        </div>

        {canManageSmsAutomation && showSmsSettings && (
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
        )}

        <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-variant mb-2 block">
                Select class
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
                  {isClassTeacher && !isAdmin ? (
                    <>
                      <p className="text-amber-800 text-sm font-medium">No classes assigned yet</p>
                      <p className="text-amber-600 text-xs mt-1">
                        Your administrator hasn&apos;t assigned you to a class or subject yet.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-amber-800 text-sm font-medium">No classes found</p>
                      <p className="text-amber-600 text-xs mt-1">
                        Classes are created automatically when you register a school. If you are seeing this, please
                        contact support or re-register.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <select
                  value={selectedClass || ""}
                  onChange={(e) => setSelectedClass(e.target.value || null)}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 min-h-[44px] text-base font-medium focus:ring-2 focus:ring-primary/20"
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
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-variant mb-2 block">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={bulkMode}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 min-h-[44px] text-base font-medium focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
                />
              </div>
            </div>
          </div>
          {bulkMode && (
            <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-outline-variant">
              <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:order-3">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Bulk marking</span>
                <button
                  type="button"
                  onClick={() => setBulkMode(false)}
                  className="min-h-[44px] px-3 text-sm font-semibold text-[var(--primary)]"
                >
                  Done
                </button>
              </div>
              <div className="sm:w-48">
                <label
                  htmlFor="bulk-date-from"
                  className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block"
                >
                  From Date
                </label>
                <input
                  id="bulk-date-from"
                  type="date"
                  aria-invalid={bulkRangeInvalid}
                  aria-describedby={bulkRangeInvalid ? "bulk-range-error" : undefined}
                  value={bulkDateFrom}
                  onChange={(e) => {
                    setBulkDateFrom(e.target.value);
                    setBulkRangeError(null);
                  }}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 min-h-[44px] text-base font-medium focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="sm:w-48">
                <label
                  htmlFor="bulk-date-to"
                  className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block"
                >
                  To Date
                </label>
                <input
                  id="bulk-date-to"
                  type="date"
                  aria-invalid={bulkRangeInvalid}
                  aria-describedby={bulkRangeInvalid ? "bulk-range-error" : undefined}
                  value={bulkDateTo}
                  onChange={(e) => {
                    setBulkDateTo(e.target.value);
                    setBulkRangeError(null);
                  }}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 min-h-[44px] text-base font-medium focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {bulkRangeInvalid && (
                <p
                  id="bulk-range-error"
                  role="alert"
                  className="w-full text-sm font-semibold text-error"
                >
                  The From date is after the To date. Adjust the range before marking.
                </p>
              )}
              <div className="flex-1 flex items-end gap-2 flex-wrap">
                {(["present", "absent", "late", "excused"] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => requestBulkMark(s)}
                      title={`Mark all students in ${bulkDateFrom} to ${bulkDateTo} as ${cfg.label.toLowerCase()}`}
                      disabled={bulkProgress?.running || !selectedClass || !isOnline || bulkRangeInvalid}
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
                      <span className="block text-[10px] font-medium opacity-80 normal-case tracking-normal">
                        {bulkDateFrom} to {bulkDateTo}
                      </span>
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
                ? "Your administrator hasn't assigned you to a class or subject yet"
                : "Choose a class to mark attendance"
            }
          />
        ) : loading ? (
          <TableSkeleton rows={5} />
        ) : students.length === 0 ? (
          <>
            <div className="mb-4 flex gap-2">
              <Button variant="secondary" disabled icon={<MaterialIcon icon="check_circle" />}>
                Mark All Present
              </Button>
            </div>
            <EmptyState icon="group" title="No students in this class" description="Add students to this class first" />
          </>
        ) : savedSummary ? (
          <div className="max-w-lg mx-auto text-center py-8 px-4">
            <div
              className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
                savedSummary.offline ? "bg-tertiary-container" : "bg-secondary-container"
              }`}
            >
              <MaterialIcon
                icon={savedSummary.offline ? "cloud_off" : "check_circle"}
                className={`text-5xl ${savedSummary.offline ? "text-on-tertiary-container" : "text-on-secondary-container"}`}
              />
            </div>
            <h2 className="mt-4 text-xl font-bold text-on-surface">
              {savedSummary.offline ? "Saved offline — will sync" : "Attendance saved"}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {savedSummary.className} · {savedSummary.date} · {savedSummary.total} pupils
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border border-secondary/30 bg-secondary/5 p-4">
                <div className="text-3xl font-bold text-secondary tabular-nums">{savedSummary.present}</div>
                <div className="text-sm font-medium text-on-surface-variant">Present</div>
              </div>
              <div className="rounded-2xl border border-error/30 bg-error/5 p-4">
                <div className="text-3xl font-bold text-error tabular-nums">{savedSummary.absent}</div>
                <div className="text-sm font-medium text-on-surface-variant">Absent</div>
              </div>
              <div className="rounded-2xl border border-tertiary/30 bg-tertiary/5 p-4">
                <div className="text-3xl font-bold text-tertiary tabular-nums">{savedSummary.late}</div>
                <div className="text-sm font-medium text-on-surface-variant">Late</div>
              </div>
              <div className="rounded-2xl border border-[#7c3aed]/30 bg-[#f3e8ff] p-4">
                <div className="text-3xl font-bold text-[#7c3aed] tabular-nums">{savedSummary.excused}</div>
                <div className="text-sm font-medium text-on-surface-variant">Excused</div>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => router.push("/dashboard/attendance/history/")}
                icon={<MaterialIcon icon="bar_chart" />}
                className="w-full"
                size="lg"
              >
                View report
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedClass(null);
                  setSavedSummary(null);
                }}
                icon={<MaterialIcon icon="group_add" />}
                className="w-full"
              >
                Mark another class
              </Button>
              <button
                type="button"
                onClick={() => setSavedSummary(null)}
                className="w-full min-h-[44px] text-sm font-semibold text-[var(--primary)]"
              >
                Back to register
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* How marking works. The previous version shipped this twice: a
                collapsed "How marking works" disclosure and then a second
                always-visible card, both of which led with "Tap once to mark
                Absent". That is the wrong instruction to lead with — almost
                every pupil is present, so a teacher following it literally
                marks the whole register absent. Unmarked pupils are recorded
                as present when you save, so the real model is "mark the
                exceptions". Shown until the first mark so it does not
                permanently cost vertical space on the register. */}
            {students.length > 0 && markedCount === 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] p-4">
                <div className="flex items-start gap-3">
                  <MaterialIcon icon="touch_app" className="text-xl text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-sm text-[var(--t1)]">How marking works</p>
                    <ol className="mt-2 space-y-1.5 text-[13px] text-[var(--t2)] list-decimal list-inside">
                      <li>Everyone counts as Present. You only mark the ones who are not there.</li>
                      <li>Tap a pupil who is absent. Tap again to change it to Late or Excused.</li>
                      <li>Swipe a row right for Present, left for Absent.</li>
                      <li>When you finish, tap Save.</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {students.length > 0 && (
              <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[var(--bg)]/95 backdrop-blur-sm">
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-sm">
                  <div
                    className="relative h-10 w-10 shrink-0"
                    role="img"
                    aria-label={`${markedCount} of ${students.length} marked`}
                  >
                    <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="4" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="currentColor"
                        className="text-emerald-500"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${markedPct} 100`}
                        pathLength={100}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--t1)]">
                      {markedPct}%
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-[var(--t1)]">
                      {markedCount} of {students.length} marked
                    </div>
                    <div className="truncate text-xs text-[var(--t3)]">
                      {!isOnline
                        ? "Offline — marks queue on this device"
                        : offlineCount > 0
                          ? `${offlineCount} waiting to sync`
                          : "All synced"}
                    </div>
                  </div>
                  {unmarkedCount > 0 && !showMarked && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={jumpToNextUnmarked}
                      icon={<MaterialIcon icon="arrow_downward" />}
                    >
                      Next unmarked
                    </Button>
                  )}
                  {collapsedIds.size > 0 && !isReviewing && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowMarked((v) => !v)}
                      icon={<MaterialIcon icon={showMarked ? "visibility_off" : "visibility"} />}
                    >
                      {showMarked ? "Hide marked" : `Show marked (${collapsedIds.size})`}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-on-surface">Mark register</div>
                <div className="text-xs text-on-surface-variant font-medium">
                  {presentCount} present · {absentCount} absent
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={handleMarkAllPresent}
                  icon={<MaterialIcon icon="check_circle" />}
                  size="sm"
                >
                  Mark All Present
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowQuickAbsentModal(true)}
                  icon={<MaterialIcon icon="person_remove" />}
                  size="sm"
                >
                  Quick Absent
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                placeholder="Search student name..."
                className="w-full md:w-48 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 min-h-[44px] text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2 px-1">
                {(["all", "present", "absent", "late", "excused"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                      filterStatus === f
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {f === "all"
                      ? "All"
                      : f === "present"
                        ? "Present"
                        : f === "absent"
                          ? "Absent"
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
              {visibleStudents.map((student, index) => {
                // WYSIWYG: an unmarked row shows "Unmarked" — never a fake
                // Present. First tap still marks Absent (the common case).
                const status = attendance[student.id] as AttendanceStatus | undefined;
                const config = status ? STATUS_CONFIG[status] : null;
                const borderColor = !status
                  ? "border-outline-variant"
                  : status === "present"
                    ? "border-secondary/30"
                    : status === "absent"
                      ? "border-error/30"
                      : status === "late"
                        ? "border-tertiary/30"
                        : "border-[#7c3aed]/30";
                const bgColor = !status
                  ? "bg-surface-container-lowest"
                  : status === "present"
                    ? "bg-secondary/5"
                    : status === "absent"
                      ? "bg-error/5"
                      : status === "late"
                        ? "bg-tertiary/5"
                        : "bg-[#f3e8ff]";
                return (
                  <SwipeRow
                    key={student.id}
                    id={`att-row-${student.id}`}
                    onSwipeRight={() => markAttendance(student.id, "present")}
                    onSwipeLeft={() => markAttendance(student.id, "absent")}
                    onTap={() => handleTapStatus(student.id)}
                    className={`${bgColor} rounded-xl border ${borderColor} p-4 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer select-none min-h-[56px] relative ${flashId === student.id ? "ring-2 ring-primary" : ""} ${!peekDone && index === 0 ? "animate-[swipe-peek_1.4s_ease-in-out_0.8s]" : ""}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <RollCallPhoto
                          name={`${student.first_name} ${student.last_name}`}
                          photoUrl={student.photo_url}
                        />
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
                        className={`text-xs font-semibold px-2 py-1 rounded-md ${
                          !config
                            ? "bg-surface-container text-on-surface-variant"
                            : `${config.bg} ${status === "present" ? "text-on-secondary-container" : status === "absent" ? "text-on-error-container" : status === "late" ? "text-on-tertiary-container" : "text-[#7c3aed]"}`
                        }`}
                      >
                        {config ? config.label : "Unmarked"}
                      </span>
                      <div
                        className={`md:hidden w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          !status
                            ? "bg-surface-container-high text-on-surface-variant"
                            : status === "present"
                              ? "bg-secondary"
                              : status === "absent"
                                ? "bg-error"
                                : status === "late"
                                  ? "bg-tertiary"
                                  : "bg-[#7c3aed]"
                        }`}
                      >
                        <MaterialIcon
                          icon={config ? config.icon : "radio_button_unchecked"}
                          className={`${config ? "text-white" : "text-on-surface-variant"} text-lg`}
                        />
                      </div>
                      <div className="hidden md:flex gap-1.5">
                        {STATUS_CYCLE.map((s) => {
                          const sConfig = STATUS_CONFIG[s];
                          const isActive = status === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => markAttendance(student.id, s)}
                              aria-pressed={isActive}
                              aria-label={`Mark ${student.first_name} ${s}`}
                              className={`px-3 py-1.5 min-h-[44px] rounded-lg text-sm font-medium border transition-all ${
                                isActive
                                  ? `${sConfig.bg} border-current font-bold`
                                  : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-outline-variant"
                              }`}
                            >
                              {sConfig.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {confirmedId === student.id && config && (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end gap-2 rounded-xl bg-surface/70 pr-5 animate-fade-in">
                        <span
                          className={`text-base font-bold ${
                            status === "present"
                              ? "text-secondary"
                              : status === "absent"
                                ? "text-error"
                                : status === "late"
                                  ? "text-tertiary"
                                  : "text-[#7c3aed]"
                          }`}
                        >
                          {config.label}
                        </span>
                        <MaterialIcon
                          icon={config.icon}
                          className={`text-4xl ${
                            status === "present"
                              ? "text-secondary"
                              : status === "absent"
                                ? "text-error"
                                : status === "late"
                                  ? "text-tertiary"
                                  : "text-[#7c3aed]"
                          }`}
                        />
                      </div>
                    )}
                  </SwipeRow>
                );
              })}
              {visibleStudents.length === 0 &&
                (collapsedIds.size > 0 && !isReviewing ? (
                  <div className="text-center py-10 px-4">
                    <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-secondary-container">
                      <MaterialIcon icon="check_circle" className="text-4xl text-on-secondary-container" />
                    </div>
                    <p className="mt-3 font-bold text-on-surface text-base">All {students.length} marked</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {presentCount} present · {absentCount} absent · {lateCount} late · {excusedCount} excused. Use the
                      filters or &quot;Show marked&quot; to review or correct.
                    </p>
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <Button
                        onClick={() => saveAttendance()}
                        disabled={saving}
                        loading={saving}
                        icon={<MaterialIcon icon="save" />}
                        size="lg"
                      >
                        Save
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowMarked(true)}
                        className="min-h-[44px] text-sm font-semibold text-[var(--primary)]"
                      >
                        Show marked rows
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 px-4 text-on-surface-variant">
                    <p>No students with this status</p>
                    {(searchQuery.trim() !== "" || filterStatus !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setFilterStatus("all");
                        }}
                        className="mt-2 min-h-[44px] px-4 text-sm font-semibold text-[var(--primary)]"
                      >
                        Clear search and filters
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {undoMark && (
              <div className="fixed bottom-[calc(160px+env(safe-area-inset-bottom,0px))] left-0 right-0 px-4 z-20 flex justify-center md:static md:px-0 md:justify-end md:mb-2">
                <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 shadow-lg">
                  <span className="text-sm text-on-surface">
                    Marked <span className="font-semibold">{undoMark.name}</span>
                    {undoMark.prev
                      ? ` (${STATUS_CONFIG[undoMark.prev as AttendanceStatus]?.label ?? undoMark.prev})`
                      : ""}
                  </span>
                  <Button variant="secondary" size="sm" onClick={undoLastMark} icon={<MaterialIcon icon="undo" />}>
                    Undo
                  </Button>
                </div>
              </div>
            )}

            <div className="mobile-sticky-action fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] left-0 right-0 p-4 md:relative md:bottom-auto md:p-0 bg-surface/95 md:bg-transparent border-t border-outline-variant md:border-0 z-10">
              <Button
                onClick={() => saveAttendance()}
                disabled={saving}
                loading={saving}
                icon={<MaterialIcon icon="save" />}
                className="w-full"
                size="lg"
              >
                <span className="flex flex-col items-center leading-tight">
                  <span>Save</span>
                  <span className="text-[11px] font-medium opacity-80">
                    {effectivePresentCount} present · {absentCount} absent
                    {lateCount > 0 ? ` · ${lateCount} late` : ""}
                    {excusedCount > 0 ? ` · ${excusedCount} excused` : ""}
                  </span>
                </span>
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
            <div className="text-sm font-medium text-on-surface mb-2">{selectedAbsentIds.size} student(s) selected</div>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {students.map((student) => {
              const isSelected = selectedAbsentIds.has(student.id);
              const currentStatus = attendance[student.id];
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
                  {currentStatus && currentStatus !== "present" && (
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
        <ConfirmDialog
          isOpen={!!pendingBulk}
          onClose={() => setPendingBulk(null)}
          onConfirm={async () => {
            const status = pendingBulk?.status;
            setPendingBulk(null);
            if (status) await handleBulkMark(status);
          }}
          title={`Mark All ${pendingBulk?.label || ""}`}
          message={`Mark every student in this class as ${(pendingBulk?.label || "").toLowerCase()} for ${bulkDateFrom} to ${bulkDateTo}? Any attendance already recorded in that range will be overwritten, and there is no undo.`}
          confirmLabel={`Yes, Mark All ${pendingBulk?.label || ""}`}
          variant="danger"
        />
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
      </div>
    </PageErrorBoundary>
  );
}
