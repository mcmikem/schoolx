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
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return `${amount}`;
}

const DAY_MAP = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

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

  const pendingTaskCount = tasks.filter((task) => !task.done).length;

  const isDataLoading = statsLoading || loadingExtra;
  
  useEffect(() => {
    if (!isDataLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoadingTimedOut(true);
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [isDataLoading]);

  if (isDataLoading && !loadingTimedOut) {
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
          </div>
        </div>
        <div className="relative z-10 mb-4">
          <h1 className="text-2xl font-bold text-[#17325f] font-['Sora']">{greeting}, {user?.full_name?.split(" ")[0]}</h1>
          <p className="text-sm text-[#60748f] mt-1">{school?.name} · {todayDayName}, {todayFormatted} · {academicYear} Term {currentTerm}</p>
        </div>

        {/* Section 1: BIG NUMBERS STRIP */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-[24px] bg-white border border-[#e5ecf4] p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-[16px] bg-[#edf4ff] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px] text-[#17325f]">groups</span>
            </div>
            <div>
              <p className="text-[28px] font-bold text-[#17325f] leading-none">{stats.totalStudents || students.length || 0}</p>
              <p className="text-[11px] font-medium text-[#7f91aa] mt-1">{boysCount}B · {girlsCount}G</p>
            </div>
          </div>

          <div className="rounded-[24px] bg-white border border-[#e5ecf4] p-4 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-[16px] flex items-center justify-center shrink-0 ${attendanceRate >= 80 ? 'bg-[#e1f3ee]' : 'bg-[#fff5e8]'}`}>
              <span className={`material-symbols-outlined text-[24px] ${attendanceRate >= 80 ? 'text-[#1f8a70]' : 'text-[#b45309]'}`}>how_to_reg</span>
            </div>
            <div>
              <p className={`text-[28px] font-bold leading-none ${stats.presentToday > 0 ? (attendanceRate >= 80 ? 'text-[#1f8a70]' : 'text-[#b45309]') : 'text-[#c7d4e4]'}`}>
                {stats.presentToday > 0 ? `${attendanceRate}%` : '--'}
              </p>
              <p className="text-[11px] font-medium text-[#7f91aa] mt-1">{stats.presentToday > 0 ? `${stats.presentToday} present today` : 'Not taken yet'}</p>
            </div>
          </div>

          <div className="rounded-[24px] bg-white border border-[#e5ecf4] p-4 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-[16px] flex items-center justify-center shrink-0 ${collectionRate >= 70 ? 'bg-[#e1f3ee]' : 'bg-[#ffefe8]'}`}>
              <span className={`material-symbols-outlined text-[24px] ${collectionRate >= 70 ? 'text-[#1f8a70]' : 'text-[#c2472b]'}`}>payments</span>
            </div>
            <div>
              <p className={`text-[28px] font-bold leading-none ${collectionRate >= 70 ? 'text-[#1f8a70]' : 'text-[#c2472b]'}`}>
                {totalFeesExpected > 0 ? `${collectionRate}%` : '--'}
              </p>
              <p className="text-[11px] font-medium text-[#7f91aa] mt-1">Fee collection</p>
            </div>
          </div>
        </div>

        {/* Section 2: NEEDS ACTION — only if pending items */}
        {(stats.presentToday === 0 && classes.length > 0) || pendingLeave > 0 || pendingExpenses > 0 ? (
          <div className="space-y-3 mb-6">
            {stats.presentToday === 0 && classes.length > 0 && (
              <div className="rounded-[20px] bg-[#ffefe8] border border-[#f5d0c5] p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-[#c2472b] text-2xl">how_to_reg</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#17325f]">Attendance today</p>
                  <p className="text-xs text-[#6b7f99]">Not taken yet for any class</p>
                </div>
                <Link href="/dashboard/attendance" className="shrink-0 rounded-xl bg-[#c2472b] px-4 py-2 text-xs font-bold text-white">Take now</Link>
              </div>
            )}
            {pendingLeave > 0 && (
              <div className="rounded-[20px] bg-[#fff5e8] border border-[#f5deb3] p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-[#b45309] text-2xl">event_busy</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#17325f]">{pendingLeave} leave request{pendingLeave > 1 ? 's' : ''}</p>
                  <p className="text-xs text-[#6b7f99]">Pending your approval</p>
                </div>
                <Link href="/dashboard/leave-approvals" className="shrink-0 rounded-xl bg-[#b45309] px-4 py-2 text-xs font-bold text-white">Review</Link>
              </div>
            )}
            {pendingExpenses > 0 && (
              <div className="rounded-[20px] bg-[#ffefe8] border border-[#f5d0c5] p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-[#c2472b] text-2xl">receipt</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#17325f]">{pendingExpenses} expense{pendingExpenses > 1 ? 's' : ''}</p>
                  <p className="text-xs text-[#6b7f99]">Awaiting your sign-off</p>
                </div>
                <Link href="/dashboard/expense-approvals" className="shrink-0 rounded-xl bg-[#c2472b] px-4 py-2 text-xs font-bold text-white">Review</Link>
              </div>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 rounded-[24px] bg-white border border-[#e5ecf4] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#7f91aa] font-bold">Today Actions</p>
                <p className="text-sm font-semibold text-[#17325f]">Fast tasks for operations control</p>
              </div>
              <div className="text-[11px] font-semibold text-[#60748f]">{pendingTaskCount} pending tasks</div>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-xl border border-[#e5ecf4] bg-[#f8fbff] p-3 hover:bg-[#edf4ff] transition-colors"
                >
                  <span className="material-symbols-outlined text-[#17325f] text-[20px]">{action.icon}</span>
                  <div className="text-xs font-bold text-[#17325f] mt-2">{action.label}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] bg-white border border-[#e5ecf4] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#7f91aa] font-bold mb-3">Exceptions First</p>
            <div className="space-y-3">
              {focusItems.map((item) => (
                <Link key={item.id} href={item.link} className="block rounded-xl border border-[#e5ecf4] p-3 hover:bg-[#f8fbff] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#17325f]">{item.label}</span>
                    <span className={`text-xs font-bold ${item.status === "alert" ? "text-[#c2472b]" : "text-[#1f8a70]"}`}>
                      {item.value ?? "--"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7f91aa] mt-1">{item.description}</p>
                </Link>
              ))}

              {upcomingDeadlines.slice(0, 2).map((item) => (
                <Link key={item.label} href={item.link} className="block rounded-xl border border-[#f5deb3] bg-[#fffaf1] p-3">
                  <div className="text-xs font-semibold text-[#17325f]">{item.label}</div>
                  <div className="text-[11px] text-[#b45309] mt-1">{item.date}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: CALENDAR */}
        {/* Section 3: CALENDAR */}
        <div className="mb-6">
          <SchoolCalendar schoolId={school?.id} userId={user?.id} />
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
