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
} from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import ActionCenter from "@/components/dashboard/ActionCenter";
import EcosystemPulse from "@/components/dashboard/EcosystemPulse";
import StatCard from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";

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

  return (
    <div className="content">
      {/* Greeting — compact, no hero banner */}
      <div className="mb-6">
        <h1 className="font-['Sora'] text-xl sm:text-2xl font-bold text-[var(--t1)] tracking-tight">
          {greeting}, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="text-[13px] text-[var(--t3)] mt-1">
          {school?.name} · {academicYear} Term {currentTerm} · {todayDayName}, {todayFormatted}
        </p>
      </div>

      {/* 4 Key Numbers — the only stat display, no duplicates */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Students"
          value={stats.totalStudents || students.length || 0}
          subValue={`${boysCount}B · ${girlsCount}G`}
          icon="groups"
          accentColor="navy"
          loading={loadingExtra}
        />
        <StatCard
          label="Attendance"
          value={`${attendanceRate}%`}
          subValue={`${stats.presentToday || 0} present today`}
          icon="how_to_reg"
          accentColor="green"
          loading={loadingExtra}
        />
        <StatCard
          label="Fees Collected"
          value={`${collectionRate}%`}
          subValue={`UGX ${formatCurrency(totalFeesCollected)}`}
          icon="payments"
          accentColor="amber"
          loading={loadingExtra}
        />
        <StatCard
          label="Staff"
          value={staff.length}
          subValue={`${staff.filter((s: any) => s.role === "teacher").length} teachers`}
          icon="school"
          accentColor="purple"
          loading={loadingExtra}
        />
      </div>

      {/* Needs Attention — what requires action right now */}
      <div className="mb-6">
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

      {/* Quick Actions — 4 common tasks */}
      <QuickActions actions={quickActions} title="Quick actions" />

      {/* Today's Snapshot — compact summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--t4)] mb-1">Fees today</div>
          <div className="text-lg font-bold text-[var(--t1)]">UGX {formatCurrency(feesToday)}</div>
          <div className="text-[12px] text-[var(--t3)]">UGX {formatCurrency(feesThisWeek)} this week</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--t4)] mb-1">Classes today</div>
          <div className="text-lg font-bold text-[var(--t1)]">{classesToday.length}</div>
          <div className="text-[12px] text-[var(--t3)]">{classesNotMarked > 0 ? `${classesNotMarked} not yet marked` : "All marked"}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--t4)] mb-1">Pending</div>
          <div className="text-lg font-bold text-[var(--t1)]">{totalPendingApprovals}</div>
          <div className="text-[12px] text-[var(--t3)]">
            {pendingExpenses > 0 ? `${pendingExpenses} expenses` : ""}
            {pendingExpenses > 0 && pendingLeave > 0 ? " · " : ""}
            {pendingLeave > 0 ? `${pendingLeave} leave` : ""}
            {totalPendingApprovals === 0 ? "All caught up" : ""}
          </div>
        </div>
      </div>

      {/* Charts & Activity — below the fold */}
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
