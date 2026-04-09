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

  return (
    <div className="content">
        <div className="relative overflow-hidden rounded-[var(--r2)] p-6 bg-motif border border-[var(--border)] mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="ph-title truncate !text-3xl">
                {greeting}, {user?.full_name?.split(" ")[0]}
              </div>
              <div className="ph-sub truncate !text-sm">
                {school?.name} • {academicYear} Term {currentTerm} • {todayDayName},{" "}
                {todayFormatted}
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

      {/* Premium Dashboard Insights Section */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
        <div className="xl:col-span-3">
          <DashboardInsights
            stats={stats}
            attendanceRate={attendanceRate}
            collectionRate={collectionRate}
            students={students}
            payments={payments}
            loading={loadingExtra}
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

      <ActionCenter 
        items={focusItems.map(item => ({
          ...item,
          priority: item.status === "alert" ? "high" : "medium"
        })) as any} 
        loading={loadingExtra} 
      />

      {/* Quick Actions Bar - Top of Dashboard */}
      <div className="quick-actions-bar">
        <Link href="/dashboard/attendance" className="qa-large">
          <div
            className="qa-large-icon"
            style={{ background: "var(--green-soft)", color: "var(--green)" }}
          >
            <MaterialIcon icon="how_to_reg" style={{ fontSize: "24px" }} />
          </div>
          <span className="qa-large-label">Take Attendance</span>
        </Link>
        <Link href="/dashboard/grades" className="qa-large">
          <div
            className="qa-large-icon"
            style={{ background: "var(--navy-soft)", color: "var(--navy)" }}
          >
            <MaterialIcon icon="edit_note" style={{ fontSize: "24px" }} />
          </div>
          <span className="qa-large-label">Enter Grades</span>
        </Link>
        <Link href="/dashboard/fees" className="qa-large">
          <div
            className="qa-large-icon"
            style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
          >
            <MaterialIcon icon="payments" style={{ fontSize: "24px" }} />
          </div>
          <span className="qa-large-label">Record Payment</span>
        </Link>
        <Link href="/dashboard/bulk-sms" className="qa-large">
          <div
            className="qa-large-icon"
            style={{ background: "var(--navy-soft)", color: "var(--navy)" }}
          >
            <MaterialIcon icon="sms" style={{ fontSize: "24px" }} />
          </div>
          <span className="qa-large-label">Send SMS</span>
        </Link>
      </div>

      {/* Today's Overview */}
      <div className="today-overview">
        <div className="today-overview-header">
          <MaterialIcon
            icon="today"
            style={{ fontSize: "18px", color: "var(--navy)" }}
          />
          <span>Today's Overview</span>
          {(() => {
            const overviewCount =
              classesToday.length +
              totalPendingApprovals +
              upcomingDeadlines.length;
            return overviewCount > 0 ? (
              <span className="today-overview-badge">
                {overviewCount} items
              </span>
            ) : null;
          })()}
        </div>
        <div className="today-overview-grid">
          <div className="today-overview-card">
            <div
              className="today-overview-card-icon"
              style={{ background: "var(--green-soft)", color: "var(--green)" }}
            >
              <MaterialIcon
                icon="calendar_month"
                style={{ fontSize: "16px" }}
              />
            </div>
            <div className="today-overview-card-body">
              <div className="today-overview-card-value">
                {loadingExtra ? "..." : classesToday.length || classes.length}
              </div>
              <div className="today-overview-card-label">
                Classes {classesToday.length > 0 ? "scheduled" : "total"}
              </div>
            </div>
            <Link
              href="/dashboard/timetable"
              className="today-overview-card-link"
            >
              <MaterialIcon icon="arrow_forward" style={{ fontSize: "16px" }} />
            </Link>
          </div>
          <div className="today-overview-card">
            <div
              className="today-overview-card-icon"
              style={{
                background:
                  totalPendingApprovals > 0
                    ? "var(--red-soft)"
                    : "var(--navy-soft)",
                color: totalPendingApprovals > 0 ? "var(--red)" : "var(--navy)",
              }}
            >
              <MaterialIcon icon="approval" style={{ fontSize: "16px" }} />
            </div>
            <div className="today-overview-card-body">
              <div
                className="today-overview-card-value"
                style={{
                  color:
                    totalPendingApprovals > 0 ? "var(--red)" : "var(--green)",
                }}
              >
                {loadingExtra ? "..." : totalPendingApprovals}
              </div>
              <div className="today-overview-card-label">Pending approvals</div>
            </div>
            <Link
              href={
                pendingExpenses > 0
                  ? "/dashboard/expense-approvals"
                  : "/dashboard/leave-approvals"
              }
              className="today-overview-card-link"
            >
              <MaterialIcon icon="arrow_forward" style={{ fontSize: "16px" }} />
            </Link>
          </div>
          <div className="today-overview-card">
            <div
              className="today-overview-card-icon"
              style={{
                background:
                  upcomingDeadlines.length > 0
                    ? "var(--amber-soft)"
                    : "var(--green-soft)",
                color:
                  upcomingDeadlines.length > 0
                    ? "var(--amber)"
                    : "var(--green)",
              }}
            >
              <MaterialIcon icon="flag" style={{ fontSize: "16px" }} />
            </div>
            <div className="today-overview-card-body">
              <div
                className="today-overview-card-value"
                style={{
                  color:
                    upcomingDeadlines.length > 0
                      ? "var(--amber)"
                      : "var(--green)",
                }}
              >
                {upcomingDeadlines.length}
              </div>
              <div className="today-overview-card-label">
                Upcoming deadlines
              </div>
            </div>
            <Link
              href={upcomingDeadlines[0]?.link || "/dashboard/fees"}
              className="today-overview-card-link"
            >
              <MaterialIcon icon="arrow_forward" style={{ fontSize: "16px" }} />
            </Link>
          </div>
        </div>
      </div>

      {students.length === 0 && !loadingExtra && (
        <OnboardingTips schoolId={school?.id} />
      )}

      {/* Legacy focus items removed - replaced by ActionCenter above */}

      <div className="stat-grid">
        <Link
          href="/dashboard/attendance"
          className="stat-card card-gradient-teal animate-float-gentle"
          style={{
            boxShadow:
              "0 20px 40px rgba(13, 148, 136, 0.2), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <div className="stat-inner !p-6">
            <div className="stat-meta">
              <div className="stat-label !text-white/80">Present Today</div>
              <div
                className="stat-icon-box"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                }}
              >
                <MaterialIcon
                  icon="check_circle"
                  style={{ fontSize: "17px" }}
                />
              </div>
            </div>
            <div className="stat-val !text-white">
              {loadingExtra
                ? "..."
                : `${stats.presentToday || 0} / ${stats.totalStudents}`}
            </div>
            {(() => {
              const boardingCount = students.filter(
                (s: any) => s.boarding_status && s.boarding_status !== "day",
              ).length;
              if (boardingCount > 0) {
                return (
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        background: "rgba(255,255,255,0.2)",
                        color: "white",
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {boardingCount} boarders
                    </span>
                  </div>
                );
              }
              return null;
            })()}
            <div
              className="mt-6 flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10"
            >
              <ProgressRing progress={attendanceRate} color="white" />
              <div>
                <div
                  style={{
                    fontFamily: "Sora",
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "white",
                    lineHeight: 1,
                  }}
                >
                  {attendanceRate}%
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "white/70",
                    marginTop: "3px",
                  }}
                >
                  Attendance rate
                </div>
              </div>
            </div>
          </div>
          <div className="stat-footer !bg-black/5 !border-white/10">
            <span className="stat-foot-label !text-white/80">
              {classesNotMarked} classes pending
            </span>
            <span
              className="stat-foot-val"
              style={{
                color: classesNotMarked > 0 ? "#FFD700" : "white",
              }}
            >
              {classesNotMarked > 0 ? "Action needed" : "All marked"}
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/fees"
          className="stat-card card-gradient-navy animate-float-gentle"
          style={{
            animationDelay: "0.2s",
            boxShadow:
              "0 20px 40px rgba(0, 31, 63, 0.2), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <div className="stat-inner !p-6">
            <div className="stat-meta">
              <div className="stat-label !text-white/80">Fees Collected</div>
              <div
                className="stat-icon-box"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                }}
              >
                <MaterialIcon icon="payments" style={{ fontSize: "17px" }} />
              </div>
            </div>
            <div className="stat-val !text-white">
              UGX <span>{formatCurrency(totalFeesCollected)}</span>
            </div>
            <div style={{ marginTop: "10px" }}>
              <div
                style={{
                  height: "8px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "99px",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.1)"
                }}
              >
                <div
                  style={{
                    width: `${Math.min(collectionRate, 100)}%`,
                    height: "100%",
                    background: "white",
                    borderRadius: "99px",
                    boxShadow: "0 0 12px rgba(255,255,255,0.5)"
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "8px",
                  fontSize: "11px",
                  color: "white/70",
                }}
              >
                <span className="font-medium">Target: {formatCurrency(totalFeesExpected)}</span>
                <span>
                  <b style={{ color: "white" }}>{collectionRate}%</b>
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <div className="flex-1 bg-white/10 rounded-xl p-2 min-w-0 border border-white/5">
                <div className="text-[9px] text-white/60 font-bold uppercase truncate">
                  Today
                </div>
                <div className="text-xs font-extrabold text-white truncate">
                  {formatCurrency(feesToday)}
                </div>
              </div>
              <div className="flex-1 bg-white/10 rounded-xl p-2 min-w-0 border border-white/5">
                <div className="text-[9px] text-white/60 font-bold uppercase truncate">
                  Week
                </div>
                <div className="text-xs font-extrabold text-white truncate">
                  {formatCurrency(feesThisWeek)}
                </div>
              </div>
            </div>
          </div>
          <div className="stat-footer !bg-black/5 !border-white/10">
            <span className="stat-foot-label !text-white/80 truncate max-w-[120px]">
              Cash + Mobile Money
            </span>
            <span
              className="stat-foot-val"
              style={{
                color: collectionRate >= 80 ? "#2dd4bf" : "#FFD700",
              }}
            >
              {collectionRate >= 80 ? "On target" : "Review needed"}
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/expense-approvals"
          className="stat-card glass-premium animate-float-gentle border-l-4 border-l-[var(--red)]"
          style={{
            animationDelay: "0.4s",
            boxShadow:
              "0 20px 40px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <div className="stat-inner !p-6">
            <div className="stat-meta">
              <div className="stat-label">Pending Approvals</div>
              <div
                className="stat-icon-box"
                style={{
                  background: totalPendingApprovals > 0 ? "var(--red-soft)" : "var(--navy-soft)",
                  color: totalPendingApprovals > 0 ? "var(--red)" : "var(--navy)",
                }}
              >
                <MaterialIcon icon="approval" style={{ fontSize: "17px" }} />
              </div>
            </div>
            <div
              className="stat-val font-heading"
              style={{
                color: totalPendingApprovals > 0 ? "var(--red)" : "var(--green)",
              }}
            >
              {loadingExtra ? "..." : totalPendingApprovals}
            </div>
            <div className="flex gap-4 mt-6">
              <div className="flex-1 bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)]">
                <div className="text-[10px] text-[var(--t3)] font-bold uppercase tracking-wider">Expenses</div>
                <div className="text-lg font-extrabold text-[var(--t1)] mt-1">
                  {loadingExtra ? "..." : pendingExpenses}
                </div>
              </div>
              <div className="flex-1 bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)]">
                <div className="text-[10px] text-[var(--t3)] font-bold uppercase tracking-wider">Leave</div>
                <div className="text-lg font-extrabold text-[var(--t1)] mt-1">
                  {loadingExtra ? "..." : pendingLeave}
                </div>
              </div>
            </div>
          </div>
          <div className="stat-footer">
            <span className="stat-foot-label">Required Actions</span>
            <span
              className="stat-foot-val"
              style={{
                color: totalPendingApprovals > 0 ? "var(--red)" : "var(--green)",
              }}
            >
              {totalPendingApprovals > 0 ? "Review Now" : "Systems Nominal"}
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/staff-attendance"
          className="stat-card glass-premium animate-float-gentle border-l-4 border-l-[var(--navy)]"
          style={{
            animationDelay: "0.6s",
            boxShadow:
              "0 20px 40px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <div className="stat-inner !p-6">
            <div className="stat-meta">
              <div className="stat-label">Staff on Duty</div>
              <div
                className="stat-icon-box"
                style={{ background: "var(--navy-soft)", color: "var(--navy)" }}
              >
                <MaterialIcon icon="badge" style={{ fontSize: "17px" }} />
              </div>
            </div>
            <div className="stat-val text-[var(--navy)] font-heading">
              {loadingExtra ? "..." : staffOnDuty} / {stats?.totalStaff || staff?.length || 0}
            </div>
            
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[var(--t3)] uppercase">Coverage</span>
                <span className="text-xs font-bold text-[var(--navy)]">
                   {Number(stats?.totalStaff || staff?.length || 0) > 0 ? Math.round((staffOnDuty / (stats?.totalStaff || staff?.length)) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--border)]">
                <div 
                  className="h-full bg-[var(--navy)] rounded-full transition-all duration-1000"
                  style={{ width: `${Number(stats?.totalStaff || staff?.length || 0) > 0 ? (staffOnDuty / (stats?.totalStaff || staff?.length)) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          <div className="stat-footer">
            <span className="stat-foot-label">Teachers + Admin</span>
            <span
              className="stat-foot-val"
              style={{
                color: staffOnDuty >= ((stats?.totalStaff || staff?.length || 1) * 0.8) ? "var(--green)" : "var(--amber)",
              }}
            >
              {staffOnDuty >= ((stats?.totalStaff || staff?.length || 1) * 0.8) ? "Full Team" : "On Duty"}
            </span>
          </div>
        </Link>
      </div>

      <div className="main-grid">
        <div className="main-col">
          <div
            className="card"
            style={{
              padding: 16,
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="card-header">
              <div>
                <div className="card-title">Quick Actions</div>
                <div className="card-sub">Common tasks for today</div>
              </div>
            </div>
            <div className="card-body" style={{ padding: "16px 16px" }}>
              <div className="qa-grid">
                <Link href="/dashboard/attendance" className="qa-item">
                  <div
                    className="qa-icon"
                    style={{
                      background: "var(--navy-soft)",
                      borderColor: "rgba(23,50,95,.12)",
                      color: "var(--navy)",
                    }}
                  >
                    <MaterialIcon
                      icon="how_to_reg"
                      style={{ fontSize: "20px" }}
                    />
                  </div>
                  <div className="qa-label">Mark Attendance</div>
                </Link>
                <Link href="/dashboard/grades" className="qa-item">
                  <div
                    className="qa-icon"
                    style={{
                      background: "var(--green-soft)",
                      borderColor: "rgba(46,148,72,.12)",
                      color: "var(--green)",
                    }}
                  >
                    <MaterialIcon icon="grade" style={{ fontSize: "20px" }} />
                  </div>
                  <div className="qa-label">Enter Grades</div>
                </Link>
                <Link href="/dashboard/fees" className="qa-item">
                  <div
                    className="qa-icon"
                    style={{
                      background: "var(--amber-soft)",
                      borderColor: "rgba(184,107,12,.12)",
                      color: "var(--amber)",
                    }}
                  >
                    <MaterialIcon
                      icon="payments"
                      style={{ fontSize: "20px" }}
                    />
                  </div>
                  <div className="qa-label">Record Payment</div>
                </Link>
                <Link href="/dashboard/messages" className="qa-item">
                  <div
                    className="qa-icon"
                    style={{
                      background: "var(--bg)",
                      borderColor: "var(--border)",
                      color: "var(--t2)",
                    }}
                  >
                    <MaterialIcon icon="chat" style={{ fontSize: "20px" }} />
                  </div>
                  <div className="qa-label">Send Message</div>
                </Link>
                <Link href="/dashboard/bulk-sms" className="qa-item">
                  <div
                    className="qa-icon"
                    style={{
                      background: "rgba(37,99,235,0.1)",
                      borderColor: "rgba(37,99,235,0.2)",
                      color: "#2563eb",
                    }}
                  >
                    <MaterialIcon icon="sms" style={{ fontSize: "20px" }} />
                  </div>
                  <div className="qa-label">Bulk SMS</div>
                </Link>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: 16,
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="card-header">
              <div>
                <div className="card-title">Class Attendance · Today</div>
                <div className="card-sub">
                  {currentDate.toLocaleDateString("en-UG", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {classes.length} classes
                </div>
              </div>
              <Link
                href="/dashboard/attendance"
                className="btn btn-ghost"
                style={{ fontSize: "11px", padding: "5px 10px" }}
              >
                View All
              </Link>
            </div>
            <div>
              {classes.slice(0, 5).map((cls: any, idx: number) => {
                const classStudents = students.filter(
                  (s) => s.class_id === cls.id,
                ).length;
                const classAtt = classAttendance[cls.id] || {
                  present: 0,
                  total: classStudents,
                };
                const classRate =
                  classAtt.total > 0
                    ? Math.round((classAtt.present / classAtt.total) * 100)
                    : 0;
                const color =
                  classRate >= 80
                    ? "var(--green)"
                    : classRate >= 60
                      ? "var(--amber)"
                      : "var(--red)";

                return (
                  <div key={cls.id} className="att-row">
                    <div
                      className="att-pill"
                      style={{
                        background: `${color.replace("var(", "rgba(").replace(")", ",.15)")}`,
                        color,
                      }}
                    >
                      {cls.name.substring(0, 3).toUpperCase()}
                      {cls.stream ? cls.stream.toUpperCase() : ""}
                    </div>
                    <div className="att-info">
                      <div className="att-name">
                        {cls.name}
                        {cls.stream ? ` ${cls.stream}` : ""}
                      </div>
                      <div className="att-meta">
                        {classStudents} students ·{" "}
                        {cls.class_teacher_id
                          ? staff
                              .find((s) => s.id === cls.class_teacher_id)
                              ?.full_name?.split(" ")[0] || "Teacher"
                          : "No teacher"}
                      </div>
                    </div>
                    <div className="att-bar-col">
                      <div className="att-bar-bg">
                        <div
                          className="att-bar-fill"
                          style={{ width: `${classRate}%`, background: color }}
                        />
                      </div>
                    </div>
                    <div
                      className="att-pct"
                      style={{
                        color,
                        fontFamily: "DM Mono",
                        fontSize: "12px",
                        fontWeight: 500,
                        width: "36px",
                        textAlign: "right",
                      }}
                    >
                      {classRate}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: 16,
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="card-header">
              <div>
                <div className="card-title">Recent Activity</div>
                <div className="card-sub">Last 24 hours</div>
              </div>
              <Link
                href="/dashboard/fees"
                className="btn btn-ghost"
                style={{ fontSize: "11px", padding: "5px 10px" }}
              >
                View All
              </Link>
            </div>
            <div>
              {payments.slice(0, 4).map((payment: any, idx: number) => (
                <div key={payment.id} className="activity-row">
                  <div className="act-dot-col">
                    <div
                      className="act-dot"
                      style={{
                        background:
                          idx === 0
                            ? "var(--green)"
                            : idx === 1
                              ? "var(--amber)"
                              : "var(--navy)",
                      }}
                    />
                  </div>
                  <div className="act-body">
                    <div className="act-title">
                      Payment received from {payment.students?.first_name}{" "}
                      {payment.students?.last_name}
                    </div>
                    <div className="act-sub">
                      UGX {formatCurrency(payment.amount_paid)} ·{" "}
                      {payment.payment_method || "Cash"}
                    </div>
                  </div>
                  <div className="act-time">
                    {payment.payment_date || "Today"}
                  </div>
                </div>
              ))}
              <div className="activity-row" style={{ borderBottom: "none" }}>
                <div className="act-dot-col">
                  <div
                    className="act-dot"
                    style={{ background: "var(--green)" }}
                  />
                </div>
                <div className="act-body">
                  <div className="act-title">Fee payment recorded</div>
                  <div className="act-sub">
                    From {payments[0]?.students?.first_name || "Student"}
                  </div>
                </div>
                <div className="act-time">
                  {payments[0]?.payment_date || "Today"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="main-col">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Alerts</div>
                <div className="card-sub">Needs attention</div>
              </div>
              <span className="badge badge-red">
                {loadingExtra ? "..." : alertCount} active
              </span>
            </div>
            <div className="card-body">
              {atRiskStudents.length > 0 && (
                <Link href="/dashboard/warnings" className="alert-box red">
                  <div
                    className="ab-icon"
                    style={{
                      background: "rgba(192,57,43,.12)",
                      color: "var(--red)",
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MaterialIcon icon="warning" style={{ fontSize: "15px" }} />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">
                      {atRiskStudents.length} students at risk
                    </div>
                    <div className="ab-sub">Below 50% in 2+ subjects</div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--t4)",
                      fontWeight: 600,
                    }}
                  >
                    ›
                  </span>
                </Link>
              )}
              {dropoutRiskCount > 0 && (
                <Link
                  href="/dashboard/dropout-tracking"
                  className="alert-box red"
                >
                  <div
                    className="ab-icon"
                    style={{
                      background: "rgba(231,76,60,.12)",
                      color: "#e74c3c",
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MaterialIcon
                      icon="person_off"
                      style={{ fontSize: "15px" }}
                    />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">
                      {dropoutRiskCount} students at risk of dropout
                    </div>
                    <div className="ab-sub">Absent 14+ consecutive days</div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--t4)",
                      fontWeight: 600,
                    }}
                  >
                    ›
                  </span>
                </Link>
              )}
              {classesNotMarked > 0 && (
                <Link href="/dashboard/attendance" className="alert-box amb">
                  <div
                    className="ab-icon"
                    style={{
                      background: "rgba(184,107,12,.12)",
                      color: "var(--amber)",
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MaterialIcon
                      icon="schedule"
                      style={{ fontSize: "15px" }}
                    />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">
                      {classesNotMarked} classes not marked
                    </div>
                    <div className="ab-sub">Attendance pending today</div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--t4)",
                      fontWeight: 600,
                    }}
                  >
                    ›
                  </span>
                </Link>
              )}
              {lowAttendanceClasses > 0 && (
                <Link href="/dashboard/attendance" className="alert-box red">
                  <div
                    className="ab-icon"
                    style={{
                      background: "rgba(192,57,43,.12)",
                      color: "var(--red)",
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MaterialIcon
                      icon="trending_down"
                      style={{ fontSize: "15px" }}
                    />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">
                      {lowAttendanceClasses} classes below 70%
                    </div>
                    <div className="ab-sub">Low attendance today</div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--t4)",
                      fontWeight: 600,
                    }}
                  >
                    ›
                  </span>
                </Link>
              )}
              {overdueFeeCount > 0 && (
                <Link href="/dashboard/fees" className="alert-box amb">
                  <div
                    className="ab-icon"
                    style={{
                      background: "rgba(184,107,12,.12)",
                      color: "var(--amber)",
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MaterialIcon
                      icon="money_off"
                      style={{ fontSize: "15px" }}
                    />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">
                      {overdueFeeCount} students with overdue fees
                    </div>
                    <div className="ab-sub">Less than 50% paid</div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--t4)",
                      fontWeight: 600,
                    }}
                  >
                    ›
                  </span>
                </Link>
              )}
              {totalPendingApprovals > 0 && (
                <Link
                  href="/dashboard/expense-approvals"
                  className="alert-box navy"
                >
                  <div
                    className="ab-icon"
                    style={{
                      background: "rgba(23,50,95,.10)",
                      color: "var(--navy)",
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MaterialIcon
                      icon="approval"
                      style={{ fontSize: "15px" }}
                    />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">
                      {totalPendingApprovals} pending approvals
                    </div>
                    <div className="ab-sub">
                      {pendingExpenses} expenses · {pendingLeave} leave
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--t4)",
                      fontWeight: 600,
                    }}
                  >
                    ›
                  </span>
                </Link>
              )}
              {smsStats.sentToday > 0 && (
                <Link href="/dashboard/messages" className="alert-box green">
                  <div
                    className="ab-icon"
                    style={{
                      background: "rgba(46,148,72,.12)",
                      color: "var(--green)",
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MaterialIcon icon="chat" style={{ fontSize: "15px" }} />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">
                      {smsStats.sentToday} SMS sent today
                    </div>
                    <div className="ab-sub">
                      {smsStats.deliveryRate}% delivery rate
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--t4)",
                      fontWeight: 600,
                    }}
                  >
                    ›
                  </span>
                </Link>
              )}
              {!loadingExtra && alertCount === 0 && (
                <div
                  style={{
                    padding: 20,
                    textAlign: "center",
                    color: "var(--t3)",
                  }}
                >
                  <MaterialIcon
                    icon="check_circle"
                    style={{
                      fontSize: 24,
                      color: "var(--green)",
                      marginBottom: 8,
                    }}
                  />
                  <div style={{ fontSize: 13 }}>
                    No alerts — everything looks good!
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: 16,
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="card-header">
              <div>
                <div className="card-title">Academic Term</div>
              </div>
            </div>
            <div className="card-body" style={{ padding: "4px 4px 4px" }}>
              <div className="term-row">
                <div className="term-row-label">
                  <MaterialIcon
                    icon="calendar_today"
                    style={{ fontSize: "14px", color: "var(--t3)" }}
                  />
                  Academic Year
                </div>
                <div className="term-row-val">{academicYear || "2025"}</div>
              </div>
              <div className="term-row">
                <div className="term-row-label">
                  <MaterialIcon
                    icon="schedule"
                    style={{ fontSize: "14px", color: "var(--t3)" }}
                  />
                  Current Term
                </div>
                <div className="term-row-val">Term {currentTerm || "1"}</div>
              </div>
              <div className="term-row">
                <div className="term-row-label">
                  <MaterialIcon
                    icon="location_on"
                    style={{ fontSize: "14px", color: "var(--t3)" }}
                  />
                  District
                </div>
                <div className="term-row-val" style={{ color: "var(--t3)" }}>
                  {school?.district || "N/A"}
                </div>
              </div>
              <div className="term-row">
                <div className="term-row-label">
                  <MaterialIcon
                    icon="sms"
                    style={{ fontSize: "14px", color: "var(--t3)" }}
                  />
                  SMS Balance
                </div>
                <div className="term-row-val" style={{ color: "var(--green)" }}>
                  Active
                </div>
              </div>
              <div className="term-row" style={{ borderBottom: "none" }}>
                <div className="term-row-label">
                  <MaterialIcon
                    icon="badge"
                    style={{ fontSize: "14px", color: "var(--t3)" }}
                  />
                  Staff Count
                </div>
                <div className="term-row-val">{staff?.length || 0}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">At-Risk Students</div>
                <div className="card-sub">Academic warning</div>
              </div>
              <span className="badge badge-red font-mono">
                {loadingExtra ? "..." : atRiskStudents.length} FLAGS
              </span>
            </div>
            <div className="no-scrollbar max-h-[300px] overflow-y-auto">
              {loadingExtra ? (
                <div className="p-5 flex flex-col gap-3">
                  <div className="h-12 bg-[var(--bg)] rounded-xl animate-pulse" />
                  <div className="h-12 bg-[var(--bg)] rounded-xl animate-pulse" />
                </div>
              ) : atRiskStudents.length > 0 ? (
                atRiskStudents.map((student: any, idx: number) => (
                  <Link
                    key={student?.id || idx}
                    href={`/dashboard/students/${student?.id}`}
                    className="warn-row"
                  >
                    <div
                      className="warn-av"
                      style={{ background: "var(--navy)" }}
                    >
                      {student?.first_name?.charAt(0) || "?"}
                      {student?.last_name?.charAt(0) || ""}
                    </div>
                    <div className="warn-info">
                      <div className="warn-name truncate">
                        {student?.first_name} {student?.last_name}
                      </div>
                      <div className="warn-detail truncate">
                        {student?.classes?.name} · Critical
                      </div>
                    </div>
                    <MaterialIcon
                      icon="chevron_right"
                      className="text-[var(--t4)]"
                    />
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-[var(--t3)]">
                  <MaterialIcon
                    icon="check_circle"
                    className="text-2xl text-[var(--green)] mb-2"
                  />
                  <div className="text-xs font-semibold">
                    No at-risk students
                  </div>
                </div>
              )}
            </div>
            {atRiskStudents.length > 0 && (
              <div
                style={{
                  padding: "10px 0 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <Link
                  href="/dashboard/warnings"
                  className="btn btn-ghost"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    fontSize: "12px",
                  }}
                >
                  <MaterialIcon icon="chat" style={{ fontSize: "14px" }} />
                  SMS All Guardians
                </Link>
              </div>
            )}
          </div>
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
