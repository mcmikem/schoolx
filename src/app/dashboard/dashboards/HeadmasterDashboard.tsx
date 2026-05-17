"use client";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useAcademic } from "@/lib/academic-context";
import {
  useDashboardStats,
  useStudents,
  useFeePayments,
  useFeeStructure,
  useClasses,
  useStaff,
} from "@/lib/hooks";
import { useDashboardExtraData } from "@/lib/hooks/useDashboardExtraData";
import { useEffect, useMemo, useState, useRef } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import EcosystemPulse from "@/components/dashboard/EcosystemPulse";
import { TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import OwlMascot from "@/components/brand/OwlMascot";
import { toLocalDateString } from "@/lib/date-utils";
import { withTimeout } from "@/lib/hooks/utils";
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";

function toLocalDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return `${amount}`;
}

const DAY_MAP = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const DAYS_HEADER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type HeadmasterTask = {
  id: string;
  title: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
  done: boolean;
};

function HeadmasterDashboardContent() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();

  const { stats, loading: statsLoading } = useDashboardStats(school?.id);
  const { students = [] } = useStudents(school?.id);
  const { payments = [] } = useFeePayments(school?.id);
  const { feeStructure = [] } = useFeeStructure(school?.id);
  const { classes = [] } = useClasses(school?.id);
  const { staff = [] } = useStaff(school?.id);

  const {
    classAttendance,
    atRiskStudents,
    smsStats,
    pendingExpenses,
    pendingLeave,
    feesToday,
    feesThisWeek,
    feesThisTerm,
    staffOnDuty,
    overdueFeeCount,
    lowAttendanceClasses,
    dropoutRiskCount,
    loading: loadingExtra,
  } = useDashboardExtraData(
    school?.id,
    students,
    feeStructure,
    currentTerm,
    academicYear,
  );

  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState<
    Array<{ id: string; title: string; start_date: string; event_type: string }>
  >([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const dayInputRef = useRef<HTMLInputElement>(null);
  const seedCalendarAttemptedRef = useRef(false);

  // Fetch events from database
  useEffect(() => {
    if (!school?.id) return;
    const fetchEvents = async () => {
      setEventsLoading(true);
      const monthStart = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
      const monthEnd = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 0));
      const { data, error } = await supabase
        .from("events")
        .select("id, title, start_date, event_type")
        .eq("school_id", school.id)
        .gte("start_date", monthStart)
        .lte("start_date", monthEnd)
        .order("start_date");
      if (!error && data) setCalendarEvents(data as any);
      setEventsLoading(false);
    };
    fetchEvents();
  }, [school?.id, viewDate]);

  // Seed academic calendar events if none exist
  useEffect(() => {
    if (!school?.id || eventsLoading) return;
    if (calendarEvents.length > 0) return;
    if (seedCalendarAttemptedRef.current) return;
    seedCalendarAttemptedRef.current = true;
    const seedCalendar = async () => {
      const { buildUgandaCalendarEvents } = await import(
        "@/lib/uganda-school-calendar"
      );
      const defaultEvents = buildUgandaCalendarEvents(
        school.id,
        new Date().getFullYear().toString(),
      );
      const { error } = await withTimeout(
        supabase.from("events").insert(defaultEvents),
        15000,
        { data: null, error: { message: "Calendar seed timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as any,
      );
      if (!error) {
        const monthStart = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
        const monthEnd = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 0));
        const { data } = await supabase
          .from("events")
          .select("id, title, start_date, event_type")
          .eq("school_id", school.id)
          .gte("start_date", monthStart)
          .lte("start_date", monthEnd)
          .order("start_date");
        if (data) setCalendarEvents(data as any);
      }
    };
    seedCalendar();
  }, [school?.id, calendarEvents.length, eventsLoading]);

  const addCalendarEvent = async () => {
    if (!school?.id || !newEventTitle.trim() || !newEventDate) return;
    const { error } = await withTimeout(
      supabase.from("events").insert({
        school_id: school.id,
        title: newEventTitle.trim(),
        start_date: newEventDate,
        end_date: newEventDate,
        event_type: "event",
        created_by: user?.id,
      }),
      15000,
      { data: null, error: { message: "Event creation timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as any,
    );
    if (!error) {
      const monthStart = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
      const monthEnd = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 0));
      const { data } = await supabase
        .from("events")
        .select("id, title, start_date, event_type")
        .eq("school_id", school.id)
        .gte("start_date", monthStart)
        .lte("start_date", monthEnd)
        .order("start_date");
      if (data) setCalendarEvents(data as any);
      setNewEventTitle("");
      setNewEventDate("");
      setShowAddEvent(false);
    }
  };

  const currentDate = useMemo(() => new Date(), []);
  const greeting =
    currentDate.getHours() < 12
      ? "Good Morning"
      : currentDate.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

  const boysCount = useMemo(() => students.filter((s) => s.gender === "M").length, [students]);
  const girlsCount = useMemo(() => students.filter((s) => s.gender === "F").length, [students]);

  const totalFeesExpected = useMemo(() => students.reduce((total, student) => {
    const classFees = feeStructure.filter(
      (f) => !f.class_id || f.class_id === student.class_id,
    );
    const studentExpected = classFees.reduce(
      (sum, f) => sum + Number(f.amount || 0),
      0,
    );
    return total + studentExpected;
  }, 0), [students, feeStructure]);

  const totalFeesCollected = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0),
    [payments],
  );

  const collectionRate = useMemo(
    () => totalFeesExpected > 0
      ? Math.round((totalFeesCollected / totalFeesExpected) * 100)
      : 0,
    [totalFeesExpected, totalFeesCollected],
  );

  const { totalPresent, totalInClass, attendanceRate, absentCount } = useMemo(() => {
    const totalPresent = Object.values(classAttendance).reduce(
      (sum, c) => sum + c.present,
      0,
    );
    const totalInClass = Object.values(classAttendance).reduce(
      (sum, c) => sum + c.total,
      0,
    );
    const attendanceRate =
      totalInClass > 0
        ? Math.round((totalPresent / totalInClass) * 100)
        : stats.presentToday > 0 && stats.totalStudents > 0
          ? Math.round((stats.presentToday / stats.totalStudents) * 100)
          : 0;
    const absentCount = students.length - stats.presentToday;
    return { totalPresent, totalInClass, attendanceRate, absentCount };
  }, [classAttendance, stats.presentToday, stats.totalStudents, students.length]);

  const hasAttendanceSignals = Object.keys(classAttendance).length > 0;
  const classesNotMarked = hasAttendanceSignals
    ? classes.filter(
        (c: any) => !classAttendance[c.id] || classAttendance[c.id].total === 0,
      ).length
    : 0;

  const totalPendingApprovals = pendingExpenses + pendingLeave;

  const alertCount = loadingExtra
    ? 0
    : classesNotMarked +
      atRiskStudents.length +
      dropoutRiskCount +
      lowAttendanceClasses +
      (overdueFeeCount > 0 ? 1 : 0) +
      (totalPendingApprovals > 0 ? 1 : 0);

  const focusItems = useMemo(
    () => [
      {
        id: "low-attendance",
        label: "Low attendance classes",
        value: loadingExtra ? null : lowAttendanceClasses,
        description: "Classes with less than 70% present today",
        link: "/dashboard/attendance",
        status: lowAttendanceClasses > 0 ? "alert" : "ok",
      },
      {
        id: "overdue-fees",
        label: "Overdue fees",
        value: loadingExtra ? null : overdueFeeCount,
        description: "Students with unsettled balances this term",
        link: "/dashboard/fees",
        status: overdueFeeCount > 0 ? "alert" : "ok",
      },
      {
        id: "pending-approvals",
        label: "Pending approvals",
        value: loadingExtra ? null : totalPendingApprovals,
        description: "Expenses or leave requests waiting for action",
        link:
          totalPendingApprovals > 0
            ? "/dashboard/expense-approvals"
            : "/dashboard/leave-approvals",
        status: totalPendingApprovals > 0 ? "alert" : "ok",
      },
    ],
    [
      lowAttendanceClasses,
      overdueFeeCount,
      totalPendingApprovals,
      loadingExtra,
    ],
  );

  const todayDayName = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
  });
  const todayFormatted = currentDate.toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dayOfWeekNum = currentDate.getDay();
  const todayDayKey = DAY_MAP[dayOfWeekNum];

  const classesToday = useMemo(() => {
    if (!classes.length) return [];
    return classes
      .filter((c: any) => {
        const timetableEntries = (c as any).timetable_entries || [];
        return timetableEntries.some((e: any) => e.day_of_week === todayDayKey);
      })
      .slice(0, 6);
  }, [classes, todayDayKey]);

  const upcomingDeadlines = useMemo(() => {
    const deadlines: {
      label: string;
      date: string;
      type: string;
      link: string;
    }[] = [];
    if (overdueFeeCount > 0) {
      deadlines.push({
        label: `${overdueFeeCount} students with overdue fees`,
        date: "Overdue",
        type: "fee",
        link: "/dashboard/fees",
      });
    }
    if (classesNotMarked > 0) {
      deadlines.push({
        label: `${classesNotMarked} classes pending attendance`,
        date: "Today",
        type: "attendance",
        link: "/dashboard/attendance",
      });
    }
    if (pendingExpenses > 0) {
      deadlines.push({
        label: `${pendingExpenses} expenses awaiting approval`,
        date: "Pending",
        type: "approval",
        link: "/dashboard/expense-approvals",
      });
    }
    if (pendingLeave > 0) {
      deadlines.push({
        label: `${pendingLeave} leave requests pending`,
        date: "Pending",
        type: "approval",
        link: "/dashboard/leave-approvals",
      });
    }
    return deadlines.slice(0, 5);
  }, [overdueFeeCount, classesNotMarked, pendingExpenses, pendingLeave]);

  const recentAuditEvents = useMemo(() => {
    const events: {
      action: string;
      detail: string;
      time: string;
      icon: string;
      color: string;
    }[] = [];
    payments.slice(0, 3).forEach((payment: any) => {
      events.push({
        action: "Payment received",
        detail: `${payment.students?.first_name || "Student"} ${payment.students?.last_name || ""} · UGX ${formatCurrency(payment.amount_paid)}`,
        time: payment.payment_date || "Today",
        icon: "payments",
        color: "var(--green)",
      });
    });
    if (smsStats.sentToday > 0) {
      events.push({
        action: "SMS sent",
        detail: `${smsStats.sentToday} messages delivered`,
        time: "Today",
        icon: "sms",
        color: "var(--navy)",
      });
    }
    if (pendingLeave > 0) {
      events.push({
        action: "Leave request submitted",
        detail: `${pendingLeave} pending review`,
        time: "Recent",
        icon: "event_busy",
        color: "var(--amber)",
      });
    }
    return events.slice(0, 5);
  }, [payments, smsStats, pendingLeave]);

  const quickActions = useMemo(
    () => [
      {
        label: "Enroll student",
        href: "/dashboard/students?action=add",
        icon: "person_add",
        color: "navy",
      },
      {
        label: "Take attendance",
        href: "/dashboard/attendance",
        icon: "how_to_reg",
        color: "green",
      },
      {
        label: "Record payment",
        href: "/dashboard/fees",
        icon: "payments",
        color: "amber",
      },
      {
        label: "Send reminder",
        href: "/dashboard/messages",
        icon: "sms",
        color: "purple",
      },
    ],
    [],
  );

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(
    toLocalDateString(),
  );
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const [tasks, setTasks] = useState<HeadmasterTask[]>([]);

  const taskStorageKey = `hm_tasks_${school?.id || "default"}_${user?.id || "anon"}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = safeGetItem(taskStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as HeadmasterTask[];
      if (Array.isArray(parsed)) {
        setTasks(parsed.slice(0, 12));
      }
    } catch {
      setTasks([]);
    }
  }, [taskStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    safeSetItem(taskStorageKey, JSON.stringify(tasks));
  }, [taskStorageKey, tasks]);

  const addTask = () => {
    const cleaned = taskTitle.trim();
    if (!cleaned) return;
    const nextTask: HeadmasterTask = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: cleaned,
      dueDate: taskDueDate,
      priority: taskPriority,
      done: false,
    };
    setTasks((prev) => [nextTask, ...prev].slice(0, 12));
    setTaskTitle("");
  };

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    );
  };

  const removeTask = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const todayIso = localISODate(new Date());
  const pendingTaskCount = tasks.filter((task) => !task.done).length;

  const academicEvents = useMemo(() => {
    return calendarEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.start_date,
      kind: e.event_type || "event",
    }));
  }, [calendarEvents]);

  const calendarYear = viewDate.getFullYear();
  const calendarMonth = viewDate.getMonth();
  const monthStartDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  const calendarCells = useMemo(() => {
    const cells: Array<{
      day: number;
      iso: string;
      hasEvent: boolean;
      isToday: boolean;
    } | null> = [];
    for (let i = 0; i < monthStartDay; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toLocalDate(calendarYear, calendarMonth, day);
      cells.push({
        day,
        iso,
        hasEvent: academicEvents.some((event) => event.date === iso),
        isToday: iso === todayIso,
      });
    }
    return cells;
  }, [academicEvents, calendarYear, calendarMonth, monthStartDay, daysInMonth, todayIso]);

  const navMonth = (delta: number) => {
    const d = new Date(calendarYear, calendarMonth + delta, 1);
    setViewDate(d);
  };

  const eventsOnSelected = useMemo(() => {
    if (!selectedDate) return [];
    return academicEvents.filter((e) => e.date === selectedDate);
  }, [academicEvents, selectedDate]);

  const isDataLoading = statsLoading || loadingExtra || eventsLoading;

  const candidateCount = students.filter((s: any) => s.uneb_number).length || 0;
  const urgentItems = pendingLeave > 0 || pendingExpenses > 0 || classesNotMarked > 0;
  const urgentCount = (pendingLeave > 0 ? 1 : 0) + (pendingExpenses > 0 ? 1 : 0) + (classesNotMarked > 0 ? 1 : 0);

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <TopLoadingBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <OwlMascot size={52} premium ring glow animated />
            <p className="mt-4 text-sm text-[var(--t3)]">Loading your dashboard...</p>
          </div>
        </div>
        <StuckLoadingOverlay />
      </div>
    );
  }

  return (
    <div className="content overflow-x-hidden">
      <section className="relative mb-6 overflow-hidden rounded-[36px] border border-white/65 bg-[linear-gradient(135deg,#f6fbff_0%,#eef4ff_44%,#f7f9fc_100%)] p-4 shadow-[0_28px_70px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-[#b8e6ef]/30 blur-3xl" />
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#d6e4ff]/70 blur-3xl" />
          <div className="absolute right-10 top-10 h-24 w-24 rounded-full border border-white/70 bg-white/35" />
        </div>

        <div className="relative z-10 mb-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cad7ea] bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#27456f] shadow-sm">
            <MaterialIcon icon="dashboard" className="text-[13px]" />
            Command Deck
            {alertCount > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#fff4f3] px-2 py-0.5 text-[9px] font-semibold text-[#b04343]">
                <MaterialIcon icon="notification_important" className="text-[11px]" />
                {alertCount}
              </span>
            )}
          </div>
        </div>

        {/* 1. NEEDS YOUR ATTENTION - action items first */}
        {urgentItems && (
          <div className="rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#c2472b] text-lg">notifications_active</span>
              <h2 className="text-sm font-bold text-[#17325f]">Needs your attention</h2>
              {urgentCount > 0 && <span className="rounded-full bg-[#c2472b] text-white text-[10px] font-bold px-2 py-0.5">{urgentCount} urgent</span>}
            </div>
            <div className="space-y-2">
              {stats.presentToday === 0 && classes.length > 0 && (
                <div className="flex items-center gap-3 rounded-[16px] bg-[#ffefe8] border border-[#f5d0c5] px-4 py-3">
                  <span className="material-symbols-outlined text-[#c2472b]">how_to_reg</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#17325f]">Attendance not taken today</p>
                    <p className="text-xs text-[#6b7f99]">{classesNotMarked} classes still pending</p>
                  </div>
                  <a href="/dashboard/attendance" className="shrink-0 rounded-lg bg-[#c2472b] px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90">Take now</a>
                </div>
              )}
              {pendingLeave > 0 && (
                <div className="flex items-center gap-3 rounded-[16px] bg-[#fff5e8] border border-[#f5deb3] px-4 py-3">
                  <span className="material-symbols-outlined text-[#b45309]">event_busy</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#17325f]">{pendingLeave} leave request{pendingLeave > 1 ? 's' : ''} to approve</p>
                    <p className="text-xs text-[#6b7f99]">Staff requesting time off</p>
                  </div>
                  <a href="/dashboard/leave-approvals" className="shrink-0 rounded-lg bg-[#b45309] px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90">Review</a>
                </div>
              )}
              {pendingExpenses > 0 && (
                <div className="flex items-center gap-3 rounded-[16px] bg-[#ffefe8] border border-[#f5d0c5] px-4 py-3">
                  <span className="material-symbols-outlined text-[#c2472b]">receipt</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#17325f]">{pendingExpenses} expense{pendingExpenses > 1 ? 's' : ''} awaiting approval</p>
                    <p className="text-xs text-[#6b7f99]">Needs your sign-off</p>
                  </div>
                  <a href="/dashboard/expense-approvals" className="shrink-0 rounded-lg bg-[#c2472b] px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90">Review</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Grid: Left 2/3 = Calendar, Right 1/3 = Staff + Discipline + SMS */}
        <div className="relative z-10 grid gap-4 xl:grid-cols-[2fr_1fr]">
          {/* Left = Calendar */}
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                    School calendar
                  </p>
                  <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em] text-[#17325f]">
                    {viewDate.toLocaleDateString("en-UG", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => navMonth(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#7f91aa] hover:bg-[#edf4ff] hover:text-[#17325f]"
                    aria-label="Previous month"
                  >
                    <MaterialIcon icon="chevron_left" className="text-lg" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewDate(new Date())}
                    className="rounded-full bg-[#eef5ff] px-3 py-1 text-[10px] font-semibold text-[#42638d] hover:bg-[#dce8f5]"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => navMonth(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#7f91aa] hover:bg-[#edf4ff] hover:text-[#17325f]"
                    aria-label="Next month"
                  >
                    <MaterialIcon icon="chevron_right" className="text-lg" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] text-[#8ba0bc]">
                {DAYS_HEADER.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7">
                {calendarCells.map((cell, idx) =>
                  cell ? (
                    <button
                      type="button"
                      key={cell.iso}
                      onClick={() => setSelectedDate(cell.iso === selectedDate ? null : cell.iso)}
                      className={`relative flex items-center justify-center rounded-xl border min-h-[36px] text-center text-[11px] sm:text-xs font-semibold transition-colors ${
                        cell.iso === selectedDate
                          ? "border-[#17325f] bg-[#17325f] text-white"
                          : cell.isToday
                            ? "border-[#17325f] bg-[#edf4ff] text-[#17325f]"
                            : "border-[#e7edf5] bg-[#f8fbff] text-[#5e7390]"
                      } hover:border-[#aac1df] hover:bg-[#f0f6ff]`}
                    >
                      {cell.day}
                      {cell.hasEvent && (
                        <span
                          className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                            cell.iso === selectedDate
                              ? "bg-white"
                              : "bg-[#2d69a4]"
                          }`}
                        />
                      )}
                    </button>
                  ) : (
                    <div key={`empty_${idx}`} />
                  ),
                )}
              </div>

              {/* Events for selected day or upcoming events */}
              {selectedDate && eventsLoading && eventsOnSelected.length === 0 && (
                <div className="mt-3 space-y-2 rounded-[16px] bg-[#f0f6ff] p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-[12px] bg-white px-3 py-2 shadow-sm"
                    >
                      <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
                      <div className="h-5 w-14 rounded-full bg-gray-200 animate-pulse" />
                    </div>
                  ))}
                </div>
              )}
              {selectedDate && !eventsLoading && eventsOnSelected.length > 0 && (
                <div className="mt-3 space-y-1.5 rounded-[16px] bg-[#f0f6ff] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7f91aa]">
                    {new Date(selectedDate).toLocaleDateString("en-UG", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  {eventsOnSelected.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-[12px] bg-white px-3 py-2 shadow-sm"
                    >
                      <p className="truncate text-sm font-semibold text-[#17325f]">
                        {event.title}
                      </p>
                      <span className="shrink-0 rounded-full bg-[#edf4ff] px-2 py-0.5 text-[9px] font-semibold uppercase text-[#42638d]">
                        {event.kind}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEvent(!showAddEvent);
                    if (!showAddEvent) {
                      setNewEventDate(selectedDate || todayIso);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-[#17325f] px-4 py-2 text-[11px] font-semibold text-white hover:opacity-90"
                >
                  <MaterialIcon icon="add" className="text-[14px]" />
                  Add event
                </button>
                {!showAddEvent && academicEvents.length > 0 && !selectedDate && (
                  <div className="flex items-center gap-2 text-[10px] text-[#8ba0bc]">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#2d69a4]" />
                    {academicEvents.length} event{academicEvents.length > 1 ? "s" : ""} this month
                  </div>
                )}
              </div>

              {showAddEvent && (
                <div className="mt-3 rounded-[16px] border border-[#d7e3f2] bg-[#f8fbff] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      ref={dayInputRef}
                      type="text"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      placeholder="Event title..."
                      className="min-w-0 flex-1 rounded-xl border border-[#dde6f2] bg-white px-3 py-2 text-sm text-[#17325f] outline-none focus:border-[#aac1df]"
                    />
                    <input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      className="rounded-xl border border-[#dde6f2] bg-white px-3 py-2 text-sm text-[#17325f] outline-none focus:border-[#aac1df]"
                    />
                    <button
                      type="button"
                      onClick={addCalendarEvent}
                      disabled={!newEventTitle.trim() || !newEventDate}
                      className="rounded-xl bg-[#17325f] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddEvent(false)}
                      className="rounded-xl border border-[#dde6f2] px-3 py-2 text-sm font-semibold text-[#7f91aa] hover:bg-[#edf4ff]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!selectedDate && academicEvents.length === 0 && !showAddEvent && (
                <p className="mt-3 text-center text-[11px] text-[#8ba0bc]">
                  No events. Add one above.
                </p>
              )}
            </div>
          </div>

          {/* Right = Staff with phones + Actionable defaulters + UNEB */}
          <div className="grid gap-4">
            {/* A: Staff Attendance Board — with names, roles, phones */}
            <div className="overflow-hidden rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">Staff today</p>
                  <h2 className="mt-1 font-['Sora'] text-xl font-semibold tracking-[-0.04em] text-[#17325f]">{staffOnDuty} on duty · {staff.length - staffOnDuty} absent</h2>
                </div>
                <a href="/dashboard/staff" className="rounded-full bg-[#f2f6fc] px-3 py-1 text-[10px] font-semibold text-[#42638d]">All staff</a>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {staff.slice(0, 10).map(member => (
                  <div key={member.id} className="flex items-center gap-3 rounded-[14px] bg-[#f6f9fc] px-3 py-2.5 border border-[#eaedf2]">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${staffOnDuty > 0 ? 'bg-[#1f8a70]' : 'bg-[#c7d4e4]'}`}>
                      {member.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#17325f] truncate">{member.full_name}</p>
                      <p className="text-[10px] text-[#7890ad]">{member.role || 'Staff'} {staffOnDuty > 0 ? '· On duty' : '· Absent'}</p>
                    </div>
                    {member.phone && (
                      <a href={`tel:${member.phone}`} className="shrink-0 rounded-lg bg-[#17325f] px-2.5 py-1.5 text-[10px] font-bold text-white hover:opacity-90 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">call</span>
                        {member.phone}
                      </a>
                    )}
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${staffOnDuty > 0 ? 'bg-[#1f8a70]' : 'bg-[#c7d4e4]'}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* B: Actionable Fee Defaulters — names + parent phone + SMS */}
            <div className="overflow-hidden rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">Fee defaulters</p>
                  <h2 className="mt-1 font-['Sora'] text-xl font-semibold tracking-[-0.04em] text-[#17325f]">{overdueFeeCount} overdue</h2>
                </div>
                <a href="/dashboard/fees" className="rounded-full bg-[#ffefe8] px-3 py-1 text-[10px] font-bold text-[#c2472b]">Full list</a>
              </div>
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {students.filter(s => {
                  const paid = payments.filter(p => p.student_id === s.id).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
                  const expected = feeStructure.filter(f => !f.class_id || f.class_id === s.class_id).reduce((sum, f) => sum + Number(f.amount || 0), 0);
                  return paid < expected && expected > 0;
                }).slice(0, 8).map(student => (
                  <div key={student.id} className="flex items-center gap-3 rounded-[14px] bg-[#fcfcfd] border border-[#eaedf2] px-3 py-2.5">
                    <div className="h-8 w-8 rounded-full bg-[#ffefe8] flex items-center justify-center text-xs font-bold text-[#c2472b] shrink-0">
                      {(student.first_name?.[0] || '')}{(student.last_name?.[0] || '')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#17325f] truncate">{student.first_name} {student.last_name}</p>
                      <p className="text-[10px] text-[#7890ad]">{student.parent_name} · {(student as any).classes?.name || ''}</p>
                    </div>
                    {student.parent_phone && (
                      <div className="flex gap-1 shrink-0">
                        <a href={`tel:${student.parent_phone}`} className="rounded-lg bg-[#eef4fb] px-2 py-1.5 text-[#42638d] hover:bg-[#dce8f5]">
                          <span className="material-symbols-outlined text-[14px]">call</span>
                        </a>
                        <a href={smsStats?.remaining > 0 ? `/dashboard/messages?to=${student.parent_phone}` : '#'} className="rounded-lg bg-[#17325f] px-2 py-1.5 text-white hover:opacity-90">
                          <span className="material-symbols-outlined text-[14px]">sms</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* C: UNEB Countdown — only for secondary schools */}
            {school?.school_type !== 'primary' && candidateCount > 0 && (
              <div className="overflow-hidden rounded-[30px] border border-[#d7e3f2] bg-gradient-to-br from-[#17325f] to-[#25507f] p-5 shadow-sm text-white">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-white/80 text-lg">award_star</span>
                  <h2 className="text-sm font-bold">UNEB Readiness</h2>
                </div>
                <div className="flex items-end gap-4">
                  <div className="text-4xl font-bold font-['Sora']">{candidateCount}</div>
                  <div className="pb-1">
                    <p className="text-[11px] text-white/70">Registered candidates</p>
                    <p className="text-[11px] text-white/50">{school?.uneb_center_number ? `Center: ${school.uneb_center_number}` : 'Center number not set'}</p>
                  </div>
                </div>
                {candidateCount > 0 && (
                  <a href="/dashboard/uneb-registration" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/25">
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                    View candidates
                  </a>
                )}
              </div>
            )}

            {/* D: Daily Changes */}
            <div className="overflow-hidden rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[#17325f] text-lg">trending_up</span>
                <h2 className="text-sm font-bold text-[#17325f]">Today&apos;s changes</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[16px] bg-[#e1f3ee] p-3 text-center">
                  <p className="text-xl font-bold text-[#1f8a70]">0</p>
                  <p className="text-[10px] font-semibold text-[#5e7390]">New</p>
                </div>
                <div className="rounded-[16px] bg-[#fff5e8] p-3 text-center">
                  <p className="text-xl font-bold text-[#b45309]">0</p>
                  <p className="text-[10px] font-semibold text-[#5e7390]">Transfers</p>
                </div>
                <div className="rounded-[16px] bg-[#ffefe8] p-3 text-center">
                  <p className="text-xl font-bold text-[#c2472b]">0</p>
                  <p className="text-[10px] font-semibold text-[#5e7390]">Dropouts</p>
                </div>
              </div>
            </div>

            {/* E: Discipline — at-risk students with names */}
            {atRiskStudents.length > 0 && (
              <div className="overflow-hidden rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#b45309] text-lg">gavel</span>
                    <h2 className="text-sm font-bold text-[#17325f]">At-risk students</h2>
                  </div>
                  <a href="/dashboard/discipline" className="rounded-full bg-[#f2f6fc] px-3 py-1 text-[10px] font-semibold text-[#42638d]">All</a>
                </div>
                <div className="space-y-2">
                  {atRiskStudents.slice(0, 4).map((s: any, i: number) => (
                    <div key={s.id || i} className="flex items-center gap-3 rounded-[14px] bg-[#fcfcfd] border border-[#eaedf2] px-3 py-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#fff5e8] flex items-center justify-center text-xs font-bold text-[#b45309] shrink-0">
                        {(s.first_name?.[0] || '')}{(s.last_name?.[0] || '')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#17325f] truncate">{s.first_name} {s.last_name}</p>
                        <p className="text-[9px] text-[#7890ad]">{s.reason || 'At risk'}</p>
                      </div>
                      <a href={`/dashboard/students/${s.id}`} className="shrink-0 rounded-lg border border-[#d7e3f2] px-2.5 py-1.5 text-[10px] font-bold text-[#42638d] hover:bg-[#eef4fb]">View</a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trends snapshot — 3 key metrics */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Student:Teacher', value: `${Math.round((students.length || 1) / Math.max(staff.filter(s => s.role === 'teacher').length, 1))}:1`, status: (students.length / Math.max(staff.filter(s => s.role === 'teacher').length, 1)) <= 40 ? 'Good' : 'Review', color: (students.length / Math.max(staff.filter(s => s.role === 'teacher').length, 1)) <= 40 ? 'text-[#1f8a70]' : 'text-[#b45309]' },
            { label: 'Attendance', value: `${attendanceRate}%`, status: attendanceRate >= 80 ? 'Good' : 'Needs improvement', color: attendanceRate >= 80 ? 'text-[#1f8a70]' : 'text-[#b45309]' },
            { label: 'Fee Collection', value: `${collectionRate}%`, status: collectionRate >= 70 ? 'On track' : 'Needs follow-up', color: collectionRate >= 70 ? 'text-[#1f8a70]' : 'text-[#c2472b]' },
          ].map(m => (
            <div key={m.label} className="rounded-[20px] border border-[#e5ecf4] bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">{m.label}</p>
              <p className="mt-1 text-xl font-bold text-[#17325f]">{m.value}</p>
              <p className={`mt-0.5 text-[10px] font-semibold ${m.color}`}>{m.status}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group rounded-[28px] border border-white/75 bg-white/80 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-[18px]"
                  style={{
                    background:
                      action.color === "green"
                        ? "#eafaf5"
                        : action.color === "amber"
                          ? "#fff5e8"
                          : action.color === "purple"
                            ? "#eef1ff"
                            : "#edf4ff",
                    color:
                      action.color === "green"
                        ? "#1f8a70"
                        : action.color === "amber"
                          ? "#b45309"
                          : action.color === "purple"
                            ? "#5564d8"
                            : "#17325f",
                  }}
                >
                  <MaterialIcon
                    icon={action.icon}
                    className="text-[22px]"
                  />
                </div>
                <MaterialIcon
                  icon="arrow_outward"
                  className="text-[18px] text-[#8ca0ba] transition group-hover:text-[#17325f]"
                />
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7a8aa3]">
                Quick action
              </p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#17325f]">
                {action.label}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-6">
        <div className="xl:col-span-3">
          <DashboardInsights
            stats={stats}
            attendanceRate={attendanceRate}
            collectionRate={collectionRate}
            students={students}
            payments={payments}
            loading={loadingExtra}
            isDemo={isDemo}
          />
        </div>
        <div className="xl:col-span-1">
          <EcosystemPulse
            payments={payments}
            smsStats={smsStats}
            loading={loadingExtra}
          />
        </div>
      </div>
    </div>
  );
}

export default function HeadmasterDashboard() {
  return (
    <ErrorBoundary>
      <HeadmasterDashboardContent />
    </ErrorBoundary>
  );
}
