"use client";
import Link from "next/link";
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
import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import {
  DashboardSkeleton,
  StatsGridSkeleton,
  QuickActionsSkeleton,
} from "@/components/Skeletons";
import OnboardingTips from "@/components/OnboardingTips";
import { useToast } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import ActionCenter from "@/components/dashboard/ActionCenter";
import EcosystemPulse from "@/components/dashboard/EcosystemPulse";
import SmartAdvisor from "@/components/dashboard/SmartAdvisor";
import StatCard from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";

function ProgressRing({
  progress,
  color = "#2E9448",
}: {
  progress: number;
  color?: string;
}) {
  const radius = 22;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      className="ring-svg"
      viewBox="0 0 52 52"
      style={{ width: "56px", height: "56px" }}
    >
      <circle className="ring-track" cx="26" cy="26" r={radius} />
      <circle
        className="ring-fill"
        cx="26"
        cy="26"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ stroke: color }}
      />
    </svg>
  );
}

function HeadmasterDashboardContent() {
  const toast = useToast();
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

  const classesNotMarked = classes.filter(
    (c: any) => !classAttendance[c.id] || classAttendance[c.id].total === 0,
  ).length;

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

  const executiveSignals = useMemo(
    () => [
      {
        label: "Present now",
        value: `${stats.presentToday || 0}`,
        detail: `${absentCount > 0 ? absentCount : 0} absent or unmarked`,
        tone: "navy",
      },
      {
        label: "Collected today",
        value: `UGX ${formatCurrency(feesToday)}`,
        detail: `UGX ${formatCurrency(feesThisWeek)} this week`,
        tone: "green",
      },
      {
        label: "Teaching strength",
        value: `${staffOnDuty}`,
        detail: `${staff.length} total staff on record`,
        tone: "amber",
      },
      {
        label: "Learner mix",
        value: `${boysCount} / ${girlsCount}`,
        detail: "Boys and girls currently enrolled",
        tone: "purple",
      },
    ],
    [
      absentCount,
      boysCount,
      feesToday,
      feesThisWeek,
      girlsCount,
      staff.length,
      staffOnDuty,
      stats.presentToday,
    ],
  );

  return (
    <div className="content">
      <div className="relative overflow-hidden rounded-[28px] p-6 md:p-7 bg-motif border border-[var(--border)] mb-6 shadow-[var(--sh2)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--navy)_0%,var(--green)_50%,var(--amber)_100%)] opacity-80" />
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)]/90 border border-[var(--border)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--t3)] shadow-[var(--sh1)] mb-4">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--green)] animate-pulse" />
              Headteacher command centre
            </div>
            <div className="ph-title truncate !text-3xl">
              {greeting}, {user?.full_name?.split(" ")[0]}
            </div>
            <div className="ph-sub truncate !text-sm">
              {school?.name} • {academicYear} Term {currentTerm} • {todayDayName}, {todayFormatted}
            </div>
            <div className="mt-4 text-[15px] leading-7 text-[var(--t2)] max-w-2xl">
              Attendance, finance, staffing, and urgent follow-up are summarized here so you can move from overview to action without hunting through modules.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
              {executiveSignals.map((signal) => (
                <div key={signal.label} className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)]/92 px-4 py-4 shadow-[var(--sh1)] backdrop-blur-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--t4)]">
                    {signal.label}
                  </div>
                  <div className="mt-2 text-2xl font-black text-[var(--t1)] tracking-tight">
                    {signal.value}
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--t3)]">
                    {signal.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ph-actions">
            <Link href="/dashboard/reports" className="btn btn-ghost shadow-sm">
              <MaterialIcon icon="download" style={{ fontSize: "16px" }} />
              <span className="hidden sm:inline">Analytics</span>
            </Link>
            <Link
              href="/dashboard/students?action=add"
              className="btn btn-primary shadow-md"
            >
              <MaterialIcon icon="add" style={{ fontSize: "16px" }} />
              <span className="hidden sm:inline">Enroll Student</span>
            </Link>
          </div>
        </div>
      </div>

      <QuickActions actions={quickActions} title="Move quickly" />

      <div className="dashboard-toolbar mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)] mb-1">
              Leadership overview
            </div>
            <div className="text-lg font-bold text-[var(--t1)]">
              Attendance, fees, staffing, and alerts brought into one sharper command view
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="dashboard-pill bg-emerald-50 text-emerald-700">{attendanceRate}% attendance</span>
            <span className="dashboard-pill bg-blue-50 text-blue-700">{collectionRate}% collection</span>
            <span className="dashboard-pill bg-amber-50 text-amber-700">{staff.length} staff</span>
            <span className="dashboard-pill bg-rose-50 text-rose-700">{alertCount} alerts</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="dashboard-note-card">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--t3)] mb-1">Today</div>
            <div className="text-sm font-semibold text-[var(--t1)]">{stats.presentToday || 0} learners confirmed in school</div>
          </div>
          <div className="dashboard-note-card">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--t3)] mb-1">Finance</div>
            <div className="text-sm font-semibold text-[var(--t1)]">UGX {formatCurrency(totalFeesCollected)} collected so far</div>
          </div>
          <div className="dashboard-note-card">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--t3)] mb-1">Attention</div>
            <div className="text-sm font-semibold text-[var(--t1)]">{overdueFeeCount} overdue fee cases and {classesNotMarked} classes still unmarked</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 !mb-8">
        <StatCard
          label="Total Students"
          value={stats.totalStudents || students.length || 0}
          subValue={`${stats.totalStudents || 0} enrolled this year`}
          icon="groups"
          accentColor="navy"
          variant="premium-navy"
          loading={loadingExtra}
        />
        <StatCard
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          subValue={`${stats.presentToday || 0} present today`}
          icon="how_to_reg"
          accentColor="green"
          variant="premium-teal"
          loading={loadingExtra}
        />
        <StatCard
          label="Fee Collection"
          value={`${collectionRate}%`}
          subValue={`UGX ${((stats.feesCollected || 0) / 1000000).toFixed(1)}M collected`}
          icon="payments"
          accentColor="amber"
          variant="premium-amber"
          loading={loadingExtra}
        />
        <StatCard
          label="Staff"
          value={staff.length}
          subValue={`${staff.filter((s: any) => s.role === "teacher").length} teachers`}
          icon="school"
          accentColor="purple"
          variant="premium-navy"
          loading={loadingExtra}
        />
      </div>

      <SmartAdvisor
        stats={stats}
        collectionRate={collectionRate}
        attendanceRate={attendanceRate}
        role="headmaster"
      />

      <div className="mb-8">
        <ActionCenter
          items={
            focusItems.map((item) => ({
              ...item,
              priority: item.status === "alert" ? "high" : "medium",
            })) as any
          }
          loading={loadingExtra}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8 xl:hidden">
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--sh1)]">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--t4)] mb-2">
            This week
          </div>
          <div className="text-2xl font-black text-[var(--t1)]">
            UGX {formatCurrency(feesThisWeek)}
          </div>
          <div className="mt-1 text-[12px] text-[var(--t3)]">
            UGX {formatCurrency(feesThisTerm)} collected this term so far.
          </div>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--sh1)]">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--t4)] mb-2">
            Classes today
          </div>
          <div className="text-2xl font-black text-[var(--t1)]">
            {classesToday.length}
          </div>
          <div className="mt-1 text-[12px] text-[var(--t3)]">
            Timetabled classes currently mapped for {todayDayName}.
          </div>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--sh1)]">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--t4)] mb-2">
            Alerts waiting
          </div>
          <div className="text-2xl font-black text-[var(--t1)]">
            {alertCount}
          </div>
          <div className="mt-1 text-[12px] text-[var(--t3)]">
            Operational items needing attention across attendance, fees, and approvals.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:hidden gap-6 mb-8">
        <EcosystemPulse
          payments={payments}
          smsStats={smsStats}
          loading={loadingExtra}
        />
      </div>

      {/* Analytics Section - hidden on mobile, shown on larger screens */}
      <div className="hidden xl:block grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
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
