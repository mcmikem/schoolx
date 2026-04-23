"use client";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
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
import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import EcosystemPulse from "@/components/dashboard/EcosystemPulse";

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

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return `${amount}`;
  };

  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12
      ? "Good Morning"
      : currentDate.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

  const boysCount = students.filter((s) => s.gender === "M").length;
  const girlsCount = students.filter((s) => s.gender === "F").length;

  const totalFeesExpected = students.reduce((total, student) => {
    const classFees = feeStructure.filter(
      (f) => !f.class_id || f.class_id === student.class_id,
    );
    const studentExpected = classFees.reduce(
      (sum, f) => sum + Number(f.amount || 0),
      0,
    );
    return total + studentExpected;
  }, 0);

  const totalFeesCollected = payments.reduce(
    (sum, p) => sum + Number(p.amount_paid || 0),
    0,
  );
  const collectionRate =
    totalFeesExpected > 0
      ? Math.round((totalFeesCollected / totalFeesExpected) * 100)
      : 0;

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
  const dayMap = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const todayDayKey = dayMap[dayOfWeekNum];

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
    new Date().toISOString().split("T")[0],
  );
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const [tasks, setTasks] = useState<HeadmasterTask[]>([]);

  const taskStorageKey = `hm_tasks_${school?.id || "default"}_${user?.id || "anon"}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(taskStorageKey);
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
    localStorage.setItem(taskStorageKey, JSON.stringify(tasks));
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

  const todayIso = new Date().toISOString().split("T")[0];
  const pendingTaskCount = tasks.filter((task) => !task.done).length;

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const calendarAnchor = useMemo(
    () => new Date(currentYear, currentMonth, 1),
    [currentYear, currentMonth],
  );

  const academicEvents = useMemo(() => {
    const toIso = (date: Date) => date.toISOString().split("T")[0];
    const mkDate = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d;
    };

    return [
      {
        id: "event-attendance",
        title: "Attendance quality review",
        date: toIso(mkDate(1)),
        kind: "ops",
      },
      {
        id: "event-fees",
        title: "Fee follow-up sprint",
        date: toIso(mkDate(3)),
        kind: "finance",
      },
      {
        id: "event-academic",
        title: `Term ${currentTerm} academic checkpoint`,
        date: toIso(mkDate(6)),
        kind: "academic",
      },
      {
        id: "event-board",
        title: "School leadership stand-up",
        date: toIso(mkDate(9)),
        kind: "ops",
      },
    ];
  }, [currentTerm]);

  const monthStartDay = calendarAnchor.getDay();
  const daysInMonth = new Date(
    calendarAnchor.getFullYear(),
    calendarAnchor.getMonth() + 1,
    0,
  ).getDate();

  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number; iso: string; hasEvent: boolean; isToday: boolean } | null> = [];
    for (let i = 0; i < monthStartDay; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = new Date(
        calendarAnchor.getFullYear(),
        calendarAnchor.getMonth(),
        day,
      )
        .toISOString()
        .split("T")[0];
      cells.push({
        day,
        iso,
        hasEvent: academicEvents.some((event) => event.date === iso),
        isToday: iso === todayIso,
      });
    }
    return cells;
  }, [academicEvents, calendarAnchor, daysInMonth, monthStartDay, todayIso]);

  return (
    <div className="content">
      <section className="relative mb-6 overflow-hidden rounded-[36px] border border-white/65 bg-[linear-gradient(135deg,#f6fbff_0%,#eef4ff_44%,#f7f9fc_100%)] p-4 shadow-[0_28px_70px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-[#b8e6ef]/30 blur-3xl" />
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#d6e4ff]/70 blur-3xl" />
          <div className="absolute right-10 top-10 h-24 w-24 rounded-full border border-white/70 bg-white/35" />
        </div>

        <div className="relative z-10 mb-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cad7ea] bg-white/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#27456f] shadow-sm">
            <MaterialIcon icon="dashboard" className="text-[15px]" />
            Command Deck
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cad7ea] bg-white/70 px-4 py-2 text-xs font-semibold text-[#49627f]">
            <MaterialIcon icon="calendar_today" className="text-[14px]" />
            {todayDayName}, {todayFormatted}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cad7ea] bg-white/70 px-4 py-2 text-xs font-semibold text-[#49627f]">
            <MaterialIcon icon="event_note" className="text-[14px]" />
            {academicYear} · Term {currentTerm}
          </div>
          {alertCount > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f3c4c4] bg-[#fff4f3] px-4 py-2 text-xs font-semibold text-[#b04343]">
              <MaterialIcon icon="notification_important" className="text-[15px]" />
              {alertCount} items need attention
            </div>
          )}
        </div>

        <div className="relative z-10 grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[30px] border border-white/80 bg-white/78 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {school?.logo_url ? (
                      <Image
                        src={school.logo_url}
                        alt={school.name || "School Badge"}
                        width={88}
                        height={88}
                        className="h-20 w-20 rounded-[28px] border border-white/80 object-cover shadow-[0_14px_30px_rgba(23,50,95,0.16)]"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#17325f_0%,#2d69a4_100%)] text-white shadow-[0_18px_34px_rgba(23,50,95,0.22)]">
                        <MaterialIcon icon="school" className="text-[40px]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#7a8aa4]">
                        {greeting}
                      </p>
                      <h1 className="mt-2 font-['Sora'] text-3xl font-semibold tracking-[-0.05em] text-[#17325f] sm:text-4xl">
                        Welcome back, {user?.full_name?.split(" ")[0]}
                      </h1>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-[#5d708d] sm:text-[15px]">
                        Your school workspace is live. Monitor attendance, fee collection, staffing, and approvals from one calm control surface.
                      </p>
                    </div>
                  </div>
                  <div className="hidden rounded-[24px] bg-[linear-gradient(180deg,#17325f_0%,#224878_100%)] px-4 py-3 text-white shadow-[0_14px_34px_rgba(23,50,95,0.24)] sm:block">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/65">
                      Active school
                    </p>
                    <p className="mt-1 text-lg font-semibold leading-none">
                      {school?.name}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: "Students",
                      value: stats.totalStudents || students.length || 0,
                      detail: `${boysCount} boys · ${girlsCount} girls`,
                      icon: "groups",
                      tone: "#17325f",
                      bg: "#edf4ff",
                    },
                    {
                      label: "On duty",
                      value: staffOnDuty || staff.length,
                      detail: `${staff.filter((s: any) => s.role === "teacher").length} teaching staff`,
                      icon: "badge",
                      tone: "#1f8a70",
                      bg: "#eafaf5",
                    },
                    {
                      label: "Alerts",
                      value: loadingExtra ? "--" : alertCount,
                      detail: alertCount > 0 ? "Needs a decision" : "Quiet day so far",
                      icon: "notifications_active",
                      tone: alertCount > 0 ? "#b45309" : "#3f5d7d",
                      bg: alertCount > 0 ? "#fff5e8" : "#eef4fb",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[24px] border border-[#e4ebf4] p-4"
                      style={{ background: item.bg }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#71839d]">
                          {item.label}
                        </p>
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-2xl"
                          style={{ background: "rgba(255,255,255,0.9)", color: item.tone }}
                        >
                          <MaterialIcon icon={item.icon} className="text-[20px]" />
                        </div>
                      </div>
                      <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#17325f]">
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[#6b7f99]">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-[#d8e3f3] bg-[linear-gradient(180deg,#16345f_0%,#214f80_100%)] p-5 text-white shadow-[0_24px_48px_rgba(23,50,95,0.22)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">
                      Daily pulse
                    </p>
                    <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em]">
                      School rhythm
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                    Live
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {[
                    {
                      label: "Attendance",
                      value: `${attendanceRate}%`,
                      width: `${Math.min(attendanceRate, 100)}%`,
                      note: `${stats.presentToday || 0} present · ${Math.max(absentCount, 0)} absent`,
                    },
                    {
                      label: "Fee collection",
                      value: `${collectionRate}%`,
                      width: `${Math.min(collectionRate, 100)}%`,
                      note: `UGX ${formatCurrency(totalFeesCollected)} collected`,
                    },
                    {
                      label: "Class coverage",
                      value: `${classesToday.length}/${classes.length || 0}`,
                      width: `${classes.length ? Math.min((classesToday.length / classes.length) * 100, 100) : 0}%`,
                      note: classesNotMarked > 0 ? `${classesNotMarked} still pending` : "All planned classes covered",
                    },
                  ].map((meter) => (
                    <div key={meter.label} className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white/88">{meter.label}</p>
                        <p className="text-sm font-semibold text-[#7de2d1]">{meter.value}</p>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-[linear-gradient(90deg,#60d7d2_0%,#8fd7ff_100%)]"
                          style={{ width: meter.width }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-white/62">{meter.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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
                      <MaterialIcon icon={action.icon} className="text-[22px]" />
                    </div>
                    <MaterialIcon icon="arrow_outward" className="text-[18px] text-[#8ca0ba] transition group-hover:text-[#17325f]" />
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
          </div>

          <div className="grid gap-4">
            <div className="rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                    Collection track
                  </p>
                  <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em] text-[#17325f]">
                    Financial output
                  </h2>
                </div>
                <div className="rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-semibold text-[#42638d]">
                  This term
                </div>
              </div>

              <div className="mt-6 flex items-center gap-5">
                <div
                  className="grid h-32 w-32 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(#2d69a4 0 ${Math.min(collectionRate, 100)}%, #e7eef8 ${Math.min(collectionRate, 100)}% 100%)`,
                  }}
                >
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7d8ea7]">
                      Collected
                    </p>
                    <p className="font-['Sora'] text-3xl font-semibold tracking-[-0.05em] text-[#17325f]">
                      {collectionRate}%
                    </p>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  {[
                    ["Today", `UGX ${formatCurrency(feesToday)}`],
                    ["This week", `UGX ${formatCurrency(feesThisWeek)}`],
                    ["This term", `UGX ${formatCurrency(feesThisTerm || totalFeesCollected)}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-[20px] bg-[#f4f8fc] px-4 py-3">
                      <span className="text-sm font-medium text-[#5f7390]">{label}</span>
                      <span className="text-sm font-semibold text-[#17325f]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-[#d7e3f2] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                    Action queue
                  </p>
                  <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em] text-[#17325f]">
                    Priorities today
                  </h2>
                </div>
                <div className="rounded-full bg-[#17325f] px-3 py-1 text-[11px] font-semibold text-white">
                  {focusItems.filter((item) => item.status === "alert").length} urgent
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {focusItems.map((item, index) => (
                  <Link
                    key={item.id}
                    href={item.link}
                    className="flex items-center gap-3 rounded-[22px] border border-[#e5ecf4] bg-white px-4 py-3 transition hover:border-[#cbd8ea] hover:bg-[#fbfdff]"
                  >
                    <div className={`grid h-9 w-9 place-items-center rounded-2xl text-sm font-semibold ${item.status === "alert" ? "bg-[#fff1ef] text-[#d05858]" : "bg-[#edf4ff] text-[#17325f]"}`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#17325f]">{item.label}</p>
                      <p className="truncate text-xs text-[#6b7f99]">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold tracking-[-0.03em] text-[#17325f]">
                        {item.value ?? "--"}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8da0ba]">
                        {item.status}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                    Recent activity
                  </p>
                  <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em] text-[#17325f]">
                    Operations log
                  </h2>
                </div>
                <div className="rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-semibold text-[#42638d]">
                  {recentAuditEvents.length || 0} events
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {(recentAuditEvents.length > 0
                  ? recentAuditEvents
                  : upcomingDeadlines.map((deadline) => ({
                      action: deadline.label,
                      detail: deadline.date,
                      time: deadline.type,
                      icon: deadline.type === "fee" ? "payments" : deadline.type === "attendance" ? "how_to_reg" : "approval",
                      color: deadline.type === "fee" ? "var(--amber)" : deadline.type === "attendance" ? "var(--green)" : "var(--navy)",
                    }))
                ).slice(0, 4).map((event) => (
                  <div
                    key={`${event.action}-${event.time}`}
                    className="flex items-start gap-3 rounded-[22px] bg-[#f5f8fc] px-4 py-3"
                  >
                    <div
                      className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white"
                      style={{ color: event.color }}
                    >
                      <MaterialIcon icon={event.icon} className="text-[19px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#17325f]">{event.action}</p>
                      <p className="text-xs leading-5 text-[#6b7f99]">{event.detail}</p>
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa0b7]">
                      {event.time}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                    School calendar
                  </p>
                  <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em] text-[#17325f]">
                    This month
                  </h2>
                </div>
                <div className="rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-semibold text-[#42638d]">
                  {calendarAnchor.toLocaleDateString("en-UG", {
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-[#8ba0bc]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) =>
                  cell ? (
                    <div
                      key={cell.iso}
                      className={`relative rounded-xl border px-1.5 py-2 text-center text-xs font-semibold ${cell.isToday ? "border-[#17325f] bg-[#edf4ff] text-[#17325f]" : "border-[#e7edf5] bg-[#f8fbff] text-[#5e7390]"}`}
                    >
                      {cell.day}
                      {cell.hasEvent && (
                        <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#2d69a4]" />
                      )}
                    </div>
                  ) : (
                    <div key={`empty_${idx}`} />
                  ),
                )}
              </div>

              <div className="mt-4 space-y-2">
                {academicEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-[16px] bg-[#f4f8fc] px-3 py-2"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-semibold text-[#17325f]">{event.title}</p>
                      <p className="text-[10px] text-[#7d8fa8]">{event.kind}</p>
                    </div>
                    <div className="text-[11px] font-semibold text-[#5f7390]">
                      {new Date(event.date).toLocaleDateString("en-UG", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#d7e3f2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafd_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                    Personal task board
                  </p>
                  <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em] text-[#17325f]">
                    Headmaster reminders
                  </h2>
                </div>
                <div className="rounded-full bg-[#17325f] px-3 py-1 text-[11px] font-semibold text-white">
                  {pendingTaskCount} open
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTask();
                    }
                  }}
                  placeholder="Add task or reminder"
                  className="w-full rounded-xl border border-[#dde6f2] bg-[#f6f9fc] px-3 py-2.5 text-sm text-[#17325f] outline-none focus:border-[#aac1df]"
                />
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="rounded-xl border border-[#dde6f2] bg-[#f6f9fc] px-3 py-2 text-xs text-[#17325f] outline-none focus:border-[#aac1df]"
                  />
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as "low" | "medium" | "high")}
                    className="rounded-xl border border-[#dde6f2] bg-[#f6f9fc] px-3 py-2 text-xs font-semibold text-[#17325f] outline-none focus:border-[#aac1df]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <button
                    type="button"
                    onClick={addTask}
                    className="rounded-xl bg-[#17325f] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {tasks.length === 0 ? (
                  <div className="rounded-[16px] border border-dashed border-[#d6e2f1] bg-[#f8fbff] px-3 py-4 text-center text-xs font-medium text-[#7890ad]">
                    No tasks yet. Add your first reminder.
                  </div>
                ) : (
                  tasks.slice(0, 6).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded-[16px] bg-[#f4f8fc] px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={`h-5 w-5 rounded-full border text-[10px] ${task.done ? "border-[#1f8a70] bg-[#1f8a70] text-white" : "border-[#98acc6] text-transparent"}`}
                      >
                        ✓
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs font-semibold ${task.done ? "text-[#89a0bb] line-through" : "text-[#17325f]"}`}>
                          {task.title}
                        </p>
                        <p className="text-[10px] text-[#7d8fa8]">
                          {new Date(task.dueDate).toLocaleDateString("en-UG", {
                            day: "numeric",
                            month: "short",
                          })} · {task.priority}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        className="rounded-md p-1 text-[#90a4bc] hover:bg-white hover:text-[#17325f]"
                      >
                        <MaterialIcon icon="close" className="text-[15px]" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
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
