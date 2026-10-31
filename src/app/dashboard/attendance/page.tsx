"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { AttendanceMarkCard } from "@/components/attendance/AttendanceMarkCard";
import { RollCallPhoto } from "@/components/attendance/RollCallPhoto";
import { ABSENT_SWIPE, PRESENT_SWIPE, SwipeRow } from "@/components/attendance/SwipeRow";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { OwlyTrigger } from "@/components/owly/OwlyTrigger";
import { VideoLessonButton } from "@/components/onboarding/VideoLesson";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StaleDataNotice } from "@/components/dashboard/StaleDataNotice";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { logAuditEventWithOfflineSupport } from "@/lib/audit";
import { useAuth } from "@/lib/auth-context";
import { DEMO_ATTENDANCE, DEMO_STUDENTS } from "@/lib/demo-data";
import { useClasses } from "@/lib/hooks";
import { useUrlSyncedFilters } from "@/lib/hooks/useUrlSyncedFilters";
import { getLocalDateString, notifyDashboardStatsChanged, timeoutFallback, withTimeout } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { useOfflineAttendance, useOfflineStudents } from "@/lib/offline-hooks";
import TodaysMarkingPanel, { type ClassMarkingStatus } from "@/components/attendance/TodaysMarkingPanel";
import { canAccess, type UserRole } from "@/lib/roles";
import { getAutomationStatus, toggleAutomation } from "@/lib/sms-automation";
import { supabase } from "@/lib/supabase";
import { normalizeAttendanceInput, validateAttendanceInput } from "@/lib/validation";
import type { Student } from "@/types";

const STATUS_CYCLE = ["present", "absent", "late", "excused"] as const;
type AttendanceStatus = (typeof STATUS_CYCLE)[number];
const ATTENDANCE_VIRTUALIZATION_THRESHOLD = 40;

/**
 * The three marks offered on the card, with the colours that say "this one is
 * set". Declared here rather than inside the card so the register, the
 * one-pupil view and any future surface all agree on what "Absent" looks like.
 *
 * Late and Excused are on the card as buttons, not on the swipe: they are the
 * rare marks, and the swipe is reserved for the two the teacher writes on
 * almost every child.
 */
const CARD_STATUSES = [
  { key: "present", label: "Present", icon: "check_circle", activeBg: "bg-secondary", activeText: "text-white" },
  { key: "absent", label: "Absent", icon: "cancel", activeBg: "bg-error", activeText: "text-white" },
  { key: "late", label: "Late", icon: "schedule", activeBg: "bg-tertiary", activeText: "text-white" },
  { key: "excused", label: "Excused", icon: "verified", activeBg: "bg-[var(--violet)]", activeText: "text-white" },
] as const;

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
    color: "bg-[var(--violet)]",
    bg: "bg-[var(--violet-soft)]",
    label: "Excused",
    icon: "verified",
  },
};

/**
 * What a tap on a row does.
 *
 * It used to cycle the status and, on an unmarked row, land on **Absent**. That
 * is the worst possible default: a teacher scrolling a long register brushes a
 * row with a thumb and a child is recorded absent, which can fire a parent SMS
 * and start a truancy record. The most frequent action should be the harmless
 * one, so tap marks Present.
 *
 * Tap again marks Absent, and again returns to Present -- a reversible pair.
 * Late and Excused are deliberately not on the tap path at all: they are rarer,
 * they are reached by swiping, and neither can be set by accident.
 */
function tapStatus(current: string | undefined): AttendanceStatus {
  return current === "present" ? "absent" : "present";
}

/**
 * Swipe left = Present, swipe right = Absent.
 *
 * These are the two marks written on nearly every child, so they are the two
 * the gesture should carry -- a green sweep to the left, a red sweep to the
 * right, one buzz for Present and two for Absent. Late and Excused are rare
 * and are picked from the buttons instead, where they cannot be set by a
 * stray thumb.
 */
function leftSwipeStatus(): AttendanceStatus {
  return "present";
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

/** "2026-08-09" → "Sun, 9 Aug 2026" for the register header. Local, never UTC. */
function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  // True once the teacher has marked anything this session that has not been
  // saved. A refresh triggered by returning to the tab must not clobber it.
  const dirtyRef = useRef(false);
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
  // One pupil, full screen. Swiping a long register works until the list is
  // longer than the thumb can reliably target, and then the teacher starts
  // marking the wrong child. This removes the list entirely: one name, one
  // photo, four large targets, and the next pupil one tap away.
  const [focusStudentId, setFocusStudentId] = useState<string | null>(null);
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
  const [undoMark, setUndoMark] = useState<{ studentId: string; prev?: string; status?: string; name: string } | null>(
    null,
  );
  const undoTimer = useRef<number | null>(null);
  // Explicit "bring collapsed rows back" escape hatch (also available in the
  // all-marked empty state and the progress bar).
  const [showMarked, setShowMarked] = useState(false);
  // One secondary-tools sheet: export, copy-yesterday, notify, bulk marking and
  // the absentee-SMS toggle all live here, so the register itself stays first.
  const [showTools, setShowTools] = useState(false);
  const [showSmsSettings, setShowSmsSettings] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | AttendanceStatus>(
    () => (urlFilters.get("status") as "all" | AttendanceStatus) || "all",
  );
  const [searchQuery, setSearchQuery] = useState(() => urlFilters.get("q") || "");

  const isClassTeacher = user?.role === "teacher";
  // The people who are handed the register to check rather than write it.
  const isReviewer = ["headmaster", "school_admin", "admin", "dean_of_studies"].includes(user?.role || "");
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
    refetch: refetchStudents,
  } = useOfflineStudents(selectedClass && school?.id ? school.id : undefined);

  const {
    data: offlineAttendance,
    loading: attendanceLoading,
    error: attendanceError,
    refetch: refetchAttendance,
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
    // Freshly loaded from source — nothing local is unsaved.
    dirtyRef.current = false;
  }, [selectedClass, school?.id, offlineStudents, offlineAttendance, studentsLoading, attendanceLoading]);

  // Returning to this tab (a phone call, another app, a locked screen) should
  // show the truth: marks may have moved on another device, or synced in from
  // offline. Re-fetch then — but never while there are unsaved marks, because
  // the register rebuilds from the fetched rows and a refresh would wipe them.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (dirtyRef.current) return;
      void refetchStudents();
      void refetchAttendance();
      void loadOfflineCount();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refetchStudents, refetchAttendance, loadOfflineCount]);

  const markAttendance = (studentId: string, status: string) => {
    const prev = attendance[studentId];
    dirtyRef.current = true;
    const student = students.find((s) => s.id === studentId);
    setUndoMark({
      studentId,
      prev,
      status,
      name: student ? `${student.first_name} ${student.last_name}` : "student",
    });
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoMark(null), 4000);
    setAttendance((prevMap) => ({ ...prevMap, [studentId]: status }));
    setAllMarked(false);
    flashConfirm(studentId);
    scheduleCollapse(studentId);
  };

  const undoLastMark = () => {
    if (!undoMark) return;
    dirtyRef.current = true;
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
    markAttendance(studentId, tapStatus(attendance[studentId]));
  };

  const markAll = (status: string) => {
    const newAttendance: Record<string, string> = {};
    dirtyRef.current = true;
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
      dirtyRef.current = true;
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
    dirtyRef.current = true;
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

  const attendanceListRef = useRef<HTMLDivElement>(null);
  const [attendanceListOffset, setAttendanceListOffset] = useState(0);
  const shouldVirtualizeAttendance = visibleStudents.length > ATTENDANCE_VIRTUALIZATION_THRESHOLD;

  useEffect(() => {
    if (!shouldVirtualizeAttendance) return;
    const updateListOffset = () => {
      const bounds = attendanceListRef.current?.getBoundingClientRect();
      if (bounds) setAttendanceListOffset(bounds.top + window.scrollY);
    };
    updateListOffset();
    window.addEventListener("resize", updateListOffset);
    return () => window.removeEventListener("resize", updateListOffset);
  }, [shouldVirtualizeAttendance, visibleStudents.length]);

  const attendanceVirtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: shouldVirtualizeAttendance ? visibleStudents.length : 0,
    estimateSize: () => (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches ? 66 : 170),
    getItemKey: (index) => visibleStudents[index]?.id ?? index,
    gap: 10,
    overscan: 6,
    scrollMargin: attendanceListOffset,
    enabled: shouldVirtualizeAttendance,
  });

  const attendanceRows = shouldVirtualizeAttendance
    ? attendanceVirtualizer.getVirtualItems().map((virtualItem) => ({
        student: visibleStudents[virtualItem.index],
        index: virtualItem.index,
        virtualItem,
      }))
    : visibleStudents.map((student, index) => ({ student, index, virtualItem: null }));

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
        dirtyRef.current = false;
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
      dirtyRef.current = false;
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

  // Resolved from the whole class, NOT from visibleStudents. Marking a pupil
  // collapses their row after 900ms, which used to remove them from the
  // filtered list -- and since the overlay was derived from that list, tapping
  // a status made the overlay vanish and dropped the teacher back into the
  // register mid-pupil. The pupil being marked is pinned regardless of what
  // the list does; only the counter is computed against the list.
  const focusStudent = focusStudentId ? (students.find((s) => s.id === focusStudentId) ?? null) : null;
  const focusListIndex = focusStudentId ? visibleStudents.findIndex((s) => s.id === focusStudentId) : -1;
  const focusList = focusListIndex >= 0 ? visibleStudents : students;
  const focusPosition = focusListIndex >= 0 ? focusListIndex : students.findIndex((s) => s.id === focusStudentId);
  const focusStatus = focusStudent ? (attendance[focusStudent.id] as AttendanceStatus | undefined) : undefined;
  const focusInitials = focusStudent
    ? `${focusStudent.first_name?.[0] ?? ""}${focusStudent.last_name?.[0] ?? ""}`.toUpperCase()
    : "";

  /**
   * Mark a pupil and move on to the next one.
   *
   * The register does this by itself, so the single-pupil view must too: the
   * teacher is working down a list, not choosing one child to study. The
   * short delay lets the new mark register on screen before the view swaps,
   * and when every pupil is marked the view stays where it is rather than
   * jumping to the top of the class.
   */
  const focusAdvanceTimer = useRef<number | null>(null);
  const markFocusAndAdvance = useCallback(
    (studentId: string, status: string) => {
      markAttendance(studentId, status);
      if (focusAdvanceTimer.current) window.clearTimeout(focusAdvanceTimer.current);
      focusAdvanceTimer.current = window.setTimeout(() => {
        focusAdvanceTimer.current = null;
        const list = focusList;
        const current = list.findIndex((s) => s.id === studentId);
        if (current < 0) return;
        const nextUnmarked = list.findIndex((s, i) => i > current && !attendance[s.id]);
        if (nextUnmarked === -1) return; // everyone after this one is marked
        setFocusStudentId(list[nextUnmarked].id);
      }, 350);
    },
    // `attendance` is read at the time the timer fires, so the marked child
    // counts as marked by then.
    [focusList, attendance, markAttendance],
  );

  useEffect(() => {
    return () => {
      if (focusAdvanceTimer.current) window.clearTimeout(focusAdvanceTimer.current);
    };
  }, []);

  // Escape closes the one-pupil view. On a phone the corner button is the
  // way out, but a teacher on a laptop (or anyone who taps the screen and
  // expects Escape to work) must not be stuck in a full-screen dialog.
  useEffect(() => {
    if (!focusStudentId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusStudentId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusStudentId]);

  /**
   * Who has marked today, class by class.
   *
   * The register only shows what exists, so a class that has not registered
   * at all is invisible from the headmaster's desk. A headmaster's first
   * question in the morning is "who has not marked yet", so this lists every
   * class -- marked or not.
   */
  const todaysMarking = useMemo<ClassMarkingStatus[]>(() => {
    if (!isReviewer) return [];
    const markedByClass = new Map<string, { count: number; absent: number }>();
    for (const row of (offlineAttendance ?? []) as Array<{
      class_id?: string;
      student_id?: string;
      status?: string;
    }>) {
      if (!row.class_id) continue;
      const entry = markedByClass.get(row.class_id) ?? { count: 0, absent: 0 };
      entry.count += 1;
      if (row.status === "absent") entry.absent += 1;
      markedByClass.set(row.class_id, entry);
    }
    const pupilsByClass = new Map<string, number>();
    for (const student of (offlineStudents ?? []) as Array<{ class_id?: string; status?: string }>) {
      if (!student.class_id) continue;
      if (student.status && student.status !== "active") continue;
      pupilsByClass.set(student.class_id, (pupilsByClass.get(student.class_id) ?? 0) + 1);
    }
    return filteredClasses.map((cls) => {
      const entry = markedByClass.get(cls.id);
      return {
        classId: cls.id,
        className: `${cls.name}${cls.stream ? ` ${cls.stream}` : ""}`,
        marked: entry?.count ?? 0,
        total: pupilsByClass.get(cls.id) ?? 0,
        absent: entry?.absent ?? 0,
      };
    });
  }, [isReviewer, offlineAttendance, offlineStudents, filteredClasses]);

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
        dirtyRef.current = true;
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
    <>
      {/* One pupil, full screen.

        Built to the shape of the grades page's mobile card, because that is
        what a teacher's thumb already knows: initials, name, then the thing to
        do. Swipeable like the register, so the same muscle memory works in
        both -- swipe left for Present, right for Absent.

        Marking moves on to the next unmarked pupil by itself. The register
        does the same, and a teacher working down a list of forty should not
        have to hunt for the next name: the mark is made, the count ticks
        over, and the next child is already on screen.

        There is always a way out: the close button in the corner, the
        "All pupils" link, and the Escape key. A full-screen view that traps
        you is a view you stop opening. */}
      {focusStudent && (
        <div
          className="fixed inset-0 z-[150] flex flex-col bg-[var(--bg)]"
          role="dialog"
          aria-modal="true"
          aria-label={`Mark ${focusStudent.first_name} ${focusStudent.last_name}`}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setFocusStudentId(null)}
              className="flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--primary)]"
            >
              <MaterialIcon icon="arrow_back" /> All pupils
            </button>
            <span className="ml-auto rounded-full bg-[var(--surface-container-low)] px-3 py-1 text-xs font-bold text-[var(--t2)]">
              {focusPosition + 1} / {focusList.length}
            </span>
            <button
              type="button"
              onClick={() => setFocusStudentId(null)}
              aria-label="Close and go back to the register"
              title="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--t2)]"
            >
              <MaterialIcon icon="close" style={{ fontSize: 20 }} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 pb-6">
            <SwipeRow
              id={`att-focus-${focusStudent.id}`}
              onSwipeRight={() => markFocusAndAdvance(focusStudent.id, "absent")}
              onSwipeLeft={() => markFocusAndAdvance(focusStudent.id, leftSwipeStatus())}
              onTap={() => markFocusAndAdvance(focusStudent.id, tapStatus(focusStatus))}
              rightAction={ABSENT_SWIPE}
              leftAction={PRESENT_SWIPE}
              className="flex w-full max-w-md flex-col items-center gap-5"
            >
              <div className="flex flex-col items-center text-center">
                {focusStudent.photo_url ? (
                  <img
                    src={focusStudent.photo_url}
                    alt=""
                    className="h-32 w-32 rounded-2xl object-cover ring-4 ring-[var(--primary)]"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex h-32 w-32 items-center justify-center rounded-2xl bg-[var(--primary)] text-4xl font-bold text-white"
                  >
                    {focusInitials}
                  </div>
                )}
                <h2 className="mt-3 text-2xl font-bold leading-tight text-[var(--t1)]">
                  {focusStudent.first_name} {focusStudent.last_name}
                </h2>
                <p className="text-sm text-[var(--t3)]">{focusStudent.student_number}</p>
                {focusStatus && (
                  <span
                    className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                      STATUS_CONFIG[focusStatus].bg
                    } text-[var(--on-surface)]`}
                  >
                    <MaterialIcon icon={STATUS_CONFIG[focusStatus].icon} size={14} />
                    {STATUS_CONFIG[focusStatus].label}
                  </span>
                )}
              </div>

              <div className="grid w-full max-w-md grid-cols-2 gap-3">
                {STATUS_CYCLE.map((option) => {
                  const cfg = STATUS_CONFIG[option];
                  const active = focusStatus === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={active}
                      onClick={() => markFocusAndAdvance(focusStudent.id, option)}
                      className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-base font-bold transition-colors ${
                        active
                          ? `${cfg.bg} border-[var(--primary)] text-[var(--on-surface)]`
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--t2)]"
                      }`}
                    >
                      <MaterialIcon icon={cfg.icon} size={26} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-xs text-[var(--t3)]">
                Swipe the card left for Present, right for Absent &middot; one buzz for Present, two for Absent
              </p>

              <div className="flex w-full max-w-md gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (focusStatus) markAttendance(focusStudent.id, "");
                  }}
                  className="min-h-14 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--t2)]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Next ungraded pupil, because those are why the teacher is
                    // here. Falls back to simply the next one at the end.
                    const nextUnmarked = focusList.findIndex((st, i) => i > focusPosition && !attendance[st.id]);
                    const next = nextUnmarked !== -1 ? nextUnmarked : Math.min(focusPosition + 1, focusList.length - 1);
                    setFocusStudentId(focusList[next]?.id ?? null);
                  }}
                  className="min-h-14 flex-[2] rounded-xl bg-[var(--primary)] text-base font-bold text-white"
                >
                  Next pupil
                </button>
              </div>
            </SwipeRow>
          </div>
        </div>
      )}

      <PageErrorBoundary>
        <div className="content min-w-0 pb-28 lg:pb-20">
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
                  <VideoLessonButton lesson="attendance" />
                  <Button
                    onClick={() => saveAttendance()}
                    disabled={saving || !selectedClass || !hasAttendanceRecords}
                    loading={saving}
                    variant="primary"
                    size="sm"
                    icon={<MaterialIcon icon="save" />}
                    className="hidden shadow-md shadow-navy/20 md:inline-flex"
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
                        onClick={() => setShowTools((v) => !v)}
                        variant="secondary"
                        size="sm"
                        icon={<MaterialIcon icon="more_horiz" />}
                        aria-expanded={showTools}
                        aria-haspopup="menu"
                        aria-label="More attendance tools"
                      />
                      {showTools && (
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-10 cursor-default"
                            aria-label="Close menu"
                            onClick={() => setShowTools(false)}
                          />
                          <div
                            role="menu"
                            className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
                          >
                            <button
                              role="menuitem"
                              type="button"
                              onClick={() => {
                                setShowTools(false);
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
                                  setShowTools(false);
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

          <div className="mb-2">
            <StaleDataNotice tables="students" />
          </div>

          {/* For a headmaster this is the page: who has marked. */}
          {todaysMarking.length > 0 && (
            <TodaysMarkingPanel
              classes={todaysMarking}
              dateLabel={date}
              onOpen={(classId) => setSelectedClass(classId)}
            />
          )}

          {canManageSmsAutomation && showSmsSettings && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${absenteeAlertEnabled ? "bg-red-50" : "bg-surface-container-high"}`}
                >
                  <MaterialIcon
                    icon={absenteeAlertEnabled ? "notifications_active" : "notifications_off"}
                    className={absenteeAlertEnabled ? "text-red-600" : "text-[var(--t3)]"}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--t1)]">
                    Absentee SMS Alerts
                    {loadingAutomation ? (
                      <span className="text-xs text-[var(--t3)]">Loading...</span>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${absenteeAlertEnabled ? "bg-red-50 text-red-700" : "bg-surface-container-high text-[var(--t3)]"}`}
                      >
                        {absenteeAlertEnabled ? "ON" : "OFF"}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--t3)]">
                    Auto-SMS parents when students are marked absent
                  </div>
                </div>
              </div>
              <button
                onClick={handleToggleAbsenteeAlert}
                disabled={loadingAutomation}
                title={absenteeAlertEnabled ? "Disable absentee SMS alerts" : "Enable absentee SMS alerts"}
                className={`relative h-8 w-14 min-w-[56px] shrink-0 rounded-full transition-colors duration-200 ${absenteeAlertEnabled ? "bg-red-600" : "bg-surface-container-highest"}`}
                role="switch"
                aria-checked={absenteeAlertEnabled}
                aria-label="Toggle absentee SMS alerts"
              >
                <div
                  className={`absolute top-1 h-6 w-6 rounded-full bg-[var(--surface)] shadow transition-transform duration-200 ${absenteeAlertEnabled ? "translate-x-7" : "translate-x-1"}`}
                />
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_200px] sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
                  Class
                  {isClassTeacher && !isAdmin && (
                    <span className="ml-2 normal-case font-medium text-[var(--primary)]">(your classes)</span>
                  )}
                </label>
                {classesLoading ? (
                  <div className="rounded-xl border border-[rgba(0,31,63,0.12)] bg-[var(--navy-soft)] p-3">
                    <p className="text-sm font-medium text-[var(--t1)]">Loading classes...</p>
                  </div>
                ) : classes.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    {isClassTeacher && !isAdmin ? (
                      <p className="text-sm text-amber-800">
                        No classes assigned yet. Ask your administrator to assign you a class.
                      </p>
                    ) : (
                      <p className="text-sm text-amber-800">No classes found. Add classes from School Settings.</p>
                    )}
                  </div>
                ) : (
                  <select
                    value={selectedClass || ""}
                    onChange={(e) => setSelectedClass(e.target.value || null)}
                    className="input h-10 text-sm font-medium"
                  >
                    <option value="">Select a class</option>
                    {filteredClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.stream ? ` ${c.stream}` : ""} · {c.level}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-end gap-2">
                <div className="w-full">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={bulkMode}
                    className="input h-10 text-sm font-medium disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
            {bulkMode && (
              <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-outline-variant">
                <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:order-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Bulk marking
                  </span>
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
                  <p id="bulk-range-error" role="alert" className="w-full text-sm font-semibold text-error">
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
                                : "bg-[var(--violet-soft)] text-[var(--violet-ink)] border-2 border-[var(--violet)]/30 hover:opacity-90"
                        }`}
                      >
                        Mark All {cfg.label}
                        <span className="block text-xs font-medium opacity-80 normal-case tracking-normal">
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] py-5">
              <p className="text-sm text-[var(--t3)]">
                {isClassTeacher && !isAdmin && filteredClasses.length === 0
                  ? "Your administrator has not assigned you to a class yet."
                  : "Choose a class to open its attendance register."}
              </p>
              <OwlyTrigger guideId="attendance" label="How do I mark attendance?" />
            </div>
          ) : loading ? (
            <TableSkeleton rows={5} />
          ) : students.length === 0 ? (
            <>
              <div className="mb-4 flex gap-2">
                <Button variant="secondary" disabled icon={<MaterialIcon icon="check_circle" />}>
                  Mark All Present
                </Button>
              </div>
              <EmptyState
                icon="group"
                title="No students in this class"
                description="Add students to this class first"
                owlyQuestion="How do I add students to a class?"
              />
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
              <dl className="mt-6 grid grid-cols-4 divide-x divide-[var(--border)] border-y border-[var(--border)] py-3 text-left">
                <div className="px-2 first:pl-0 sm:px-4">
                  <dt className="text-xs text-[var(--t3)]">Present</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-[var(--green)]">{savedSummary.present}</dd>
                </div>
                <div className="px-2 sm:px-4">
                  <dt className="text-xs text-[var(--t3)]">Absent</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-[var(--red)]">{savedSummary.absent}</dd>
                </div>
                <div className="px-2 sm:px-4">
                  <dt className="text-xs text-[var(--t3)]">Late</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-[var(--amber)]">{savedSummary.late}</dd>
                </div>
                <div className="px-2 last:pr-0 sm:px-4">
                  <dt className="text-xs text-[var(--t3)]">Excused</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-[var(--violet)]">{savedSummary.excused}</dd>
                </div>
              </dl>
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
                <div className="border-l-2 border-[var(--primary)] py-1 pl-3 text-xs text-[var(--t3)]">
                  <p>Everyone counts as Present. Mark exceptions as Absent, Late, or Excused, then save the class.</p>
                  <p className="mt-1 lg:hidden">On a phone, swipe left for Present or right for Absent.</p>
                  <div className="mt-2 flex gap-3">
                    <OwlyTrigger guideId="attendance" label="How do I mark attendance?" />
                    <VideoLessonButton lesson="attendance" />
                  </div>
                </div>
              )}

              {students.length > 0 && (
                <div className="sticky top-0 z-10 -mx-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--t1)]">
                      {markedCount}/{students.length} marked
                    </span>
                    <div
                      className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-[var(--surface-container-high)]"
                      role="progressbar"
                      aria-label="Attendance marked"
                      aria-valuenow={markedCount}
                      aria-valuemin={0}
                      aria-valuemax={students.length}
                    >
                      <div className="h-full bg-[var(--green)] transition-all" style={{ width: `${markedPct}%` }} />
                    </div>
                    <span className="text-xs text-[var(--t3)]">
                      {!isOnline
                        ? "Offline · saved on this device"
                        : offlineCount > 0
                          ? `${offlineCount} waiting to sync`
                          : "Synced"}
                    </span>
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

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold text-[var(--t1)]">Register</h2>
                  <span className="text-xs font-medium text-[var(--t3)]">
                    {presentCount} present · {absentCount} absent · {lateCount} late · {excusedCount} excused
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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

              <div className="flex flex-col gap-3 border-b border-[var(--border)] py-3 sm:flex-row sm:items-end">
                <div className="min-w-[220px] flex-1">
                  <label
                    htmlFor="attendance-student-search"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]"
                  >
                    Find a pupil
                  </label>
                  <input
                    id="attendance-student-search"
                    type="search"
                    placeholder="Name or student number"
                    className="input h-10 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div
                  role="group"
                  aria-label="Attendance status"
                  className="flex min-w-0 items-center gap-3 overflow-x-auto"
                >
                  {(["all", "present", "absent", "late", "excused"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={filterStatus === f}
                      onClick={() => setFilterStatus(f)}
                      className={`min-h-10 shrink-0 border-b-2 px-1 text-sm font-medium transition-colors ${
                        filterStatus === f
                          ? "border-[var(--primary)] font-bold text-[var(--primary)]"
                          : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
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
                        <span className="ml-1 text-xs tabular-nums text-[var(--t3)]">
                          {f === "present"
                            ? presentCount
                            : f === "absent"
                              ? absentCount
                              : f === "late"
                                ? lateCount
                                : excusedCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {(searchQuery || filterStatus !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterStatus("all");
                    }}
                    className="min-h-10 shrink-0 text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* The gesture legend used to live here as permanent copy. Owly
                  now owns the explanation; the functional "one pupil at a
                  time" shortcut stays because it changes the register itself. */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFocusStudentId(visibleStudents[0]?.id ?? null)}
                  className="ml-auto min-h-11 px-2 text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  One pupil at a time
                </button>
              </div>

              <div
                ref={attendanceListRef}
                className={shouldVirtualizeAttendance ? "relative" : "space-y-2.5 lg:space-y-0"}
                style={shouldVirtualizeAttendance ? { height: attendanceVirtualizer.getTotalSize() } : undefined}
                data-attendance-virtualized={shouldVirtualizeAttendance ? "true" : undefined}
              >
                {attendanceRows.map(({ student, index, virtualItem }) => {
                  const studentStatus = attendance[student.id] as AttendanceStatus | undefined;
                  const rowShell = `${flashId === student.id ? "ring-2 ring-primary" : ""} ${
                    !peekDone && index === 0 ? "animate-[swipe-peek_1.4s_ease-in-out_0.8s]" : ""
                  }`;

                  // One map, two layouts. A phone gets the card, because a thumb
                  // needs the marks printed at a size it can hit and cannot
                  // afford a cycle-to-discover gesture. A desktop gets a dense
                  // row, because a headmaster marking forty children wants them
                  // all on screen at once -- giving them the card would throw
                  // away the density that makes the wide screen worth having.
                  return (
                    <div
                      key={student.id}
                      ref={virtualItem ? attendanceVirtualizer.measureElement : undefined}
                      data-index={virtualItem?.index}
                      className={index === 0 ? rowShell : undefined}
                      style={
                        virtualItem
                          ? {
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              transform: `translateY(${virtualItem.start - attendanceListOffset}px)`,
                            }
                          : undefined
                      }
                    >
                      {/* Phone */}
                      <div className="lg:hidden">
                        <AttendanceMarkCard
                          student={student}
                          status={studentStatus}
                          onMark={(next) => markAttendance(student.id, next)}
                          onTapCycle={() => handleTapStatus(student.id)}
                          onFocus={() => setFocusStudentId(student.id)}
                          leftAction={PRESENT_SWIPE}
                          rightAction={ABSENT_SWIPE}
                          onSwipeLeft={() => markAttendance(student.id, leftSwipeStatus())}
                          onSwipeRight={() => markAttendance(student.id, "absent")}
                          flash={flashId === student.id}
                          peek={!peekDone && index === 0}
                          statuses={CARD_STATUSES}
                        />
                      </div>

                      {/* Desktop */}
                      <div className="hidden min-h-12 border-b border-[var(--border)] px-2 py-1.5 transition-colors hover:bg-[var(--surface-container-low)] lg:flex lg:items-center lg:gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <RollCallPhoto
                            name={`${student.first_name} ${student.last_name}`}
                            photoUrl={student.photo_url}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-on-surface truncate">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-xs text-on-surface-variant">{student.student_number}</p>
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-1">
                          {CARD_STATUSES.map((option) => {
                            const active = studentStatus === option.key;
                            return (
                              <button
                                key={option.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => markAttendance(student.id, option.key)}
                                className={`flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                                  active
                                    ? `${option.activeBg} ${option.activeText}`
                                    : "text-on-surface-variant hover:bg-surface-container"
                                }`}
                              >
                                <MaterialIcon icon={option.icon} size={15} />
                                {option.label}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setFocusStudentId(student.id)}
                            className="ml-1 flex h-9 w-9 items-center justify-center text-on-surface-variant hover:bg-surface-container"
                            aria-label={`Open ${student.first_name} ${student.last_name} on their own screen`}
                            title="Mark one pupil at a time"
                          >
                            <MaterialIcon icon="open_in_full" size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
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
                        {presentCount} present · {absentCount} absent · {lateCount} late · {excusedCount} excused. Use
                        the filters or &quot;Show marked&quot; to review or correct.
                      </p>
                      <div className="mt-4 flex flex-col items-center gap-2">
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
                    {/* Reads as "who became what". It used to show the *previous*
                      status in brackets, which under the new tap model was
                      ambiguous -- "(Present)" could be read as the new value. */}
                    <span className="text-sm text-on-surface">
                      <span className="font-semibold">{undoMark.name}</span>
                      {undoMark.status
                        ? ` marked ${STATUS_CONFIG[undoMark.status as AttendanceStatus]?.label ?? undoMark.status}`
                        : " unmarked"}
                      {undoMark.prev
                        ? ` · was ${STATUS_CONFIG[undoMark.prev as AttendanceStatus]?.label ?? undoMark.prev}`
                        : ""}
                    </span>
                    <Button variant="secondary" size="sm" onClick={undoLastMark} icon={<MaterialIcon icon="undo" />}>
                      Undo
                    </Button>
                  </div>
                </div>
              )}

              <div
                data-page-action-bar=""
                className="mobile-sticky-action fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-10 border-t border-outline-variant bg-surface/95 p-4 md:hidden"
              >
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
                    <span className="text-xs font-medium opacity-80">
                      {effectivePresentCount} present · {absentCount} absent
                      {lateCount > 0 ? ` · ${lateCount} late` : ""}
                      {excusedCount > 0 ? ` · ${excusedCount} excused` : ""}
                    </span>
                    <span className="text-[11px] font-semibold opacity-90">
                      {!isOnline
                        ? "Offline · saves on this phone, syncs when signal returns"
                        : unmarkedCount > 0
                          ? `${unmarkedCount} not yet marked — these save as Present`
                          : "Whole class marked"}
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
              <div className="text-sm font-medium text-on-surface mb-2">
                {selectedAbsentIds.size} student(s) selected
              </div>
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
    </>
  );
}
