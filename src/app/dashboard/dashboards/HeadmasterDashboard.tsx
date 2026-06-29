"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useDashboardStats,
  useStudents,
  useFeeStructure,
  useClasses,
} from "@/lib/hooks";
import { useDashboardExtraData } from "@/lib/hooks/useDashboardExtraData";
import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import OwlMascot from "@/components/brand/OwlMascot";

function HeadmasterDashboardContent() {
  const { school, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();

  const { stats, loading: statsLoading } = useDashboardStats(school?.id);
  const { students = [] } = useStudents(school?.id);
  const { feeStructure = [] } = useFeeStructure(school?.id);
  const { classes = [] } = useClasses(school?.id);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const {
    pendingExpenses,
    pendingLeave,
    overdueFeeCount,
    lowAttendanceClasses,
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

  const boysCount = stats.maleStudents;
  const girlsCount = stats.femaleStudents;

  const totalExpected = stats.feesCollected + stats.feesBalance;

  const collectionRate = useMemo(
    () => totalExpected > 0
      ? Math.round((stats.feesCollected / totalExpected) * 100)
      : 0,
    [totalExpected, stats.feesCollected],
  );

  const attendanceRate = useMemo(() => {
    return stats.presentToday > 0 && stats.totalStudents > 0
      ? Math.round((stats.presentToday / stats.totalStudents) * 100)
      : 0;
  }, [stats.presentToday, stats.totalStudents]);

  const todayDayName = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
  });
  const todayFormatted = currentDate.toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const quickActions = useMemo(
    () => [
      {
        label: "Add student",
        href: "/dashboard/students?action=add",
        icon: "person_add",
        color: "navy",
      },
      {
        label: "View students",
        href: "/dashboard/students",
        icon: "group",
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
      {
        label: "Print defaulters",
        href: "/dashboard/fees?tab=defaulters",
        icon: "print",
        color: "red",
      },
    ],
    [],
  );

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

  const isFirstRun = stats.totalStudents === 0 && classes.length === 0 && !isDataLoading;

  const hasAlerts = (stats.presentToday === 0 && classes.length > 0) || pendingLeave > 0 || pendingExpenses > 0 || overdueFeeCount > 0 || lowAttendanceClasses > 0;

  return (
    <div className="content overflow-x-hidden">
      {isFirstRun ? (
        <div className="rounded-[24px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-6 text-center mb-6">
          <span className="material-symbols-outlined text-[#17325f] text-4xl">rocket_launch</span>
          <h2 className="text-lg font-bold text-[#17325f] mt-2">Welcome to {school?.name || "your school"}!</h2>
          <p className="text-sm text-[#60748f] mt-1 max-w-md mx-auto">Start by adding students and setting up your classes.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Link href="/dashboard/students?action=add" title="Add your first student" className="rounded-xl bg-[#17325f] px-5 py-2.5 text-xs font-bold text-white hover:opacity-90">
              Add first student
            </Link>
            <Link href="/dashboard/settings?tab=checklist" title="View setup progress" className="rounded-xl border border-[#17325f] px-5 py-2.5 text-xs font-bold text-[#17325f] hover:bg-[#edf4ff]">
              Setup guide
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Greeting — compact */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold font-['Sora'] text-[var(--t1)]">{greeting}, {user?.full_name?.split(" ")[0]}</h1>
              <p className="text-xs text-[var(--t3)] mt-0.5">{school?.name} · {todayDayName}, {todayFormatted} · Term {currentTerm}</p>
            </div>
            {stats.presentToday > 0 && (
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-[var(--green-soft)] px-4 py-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
                <span className="text-xs font-semibold text-[var(--green)]">{attendanceRate}% attendance today</span>
              </div>
            )}
          </div>

          {/* Pulse check: 3 key metrics */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-2xl bg-white border border-[var(--border)] p-4">
              <p className="text-[11px] font-medium text-[var(--t3)]">Students</p>
              <p className="text-2xl font-bold text-[var(--t1)] mt-1">{stats.totalStudents || students.length || 0}</p>
              <p className="text-[11px] text-[var(--t3)] mt-0.5">{boysCount}B · {girlsCount}G</p>
            </div>
            <div className="rounded-2xl bg-white border border-[var(--border)] p-4">
              <p className="text-[11px] font-medium text-[var(--t3)]">Attendance</p>
              <p className={`text-2xl font-bold mt-1 ${stats.presentToday > 0 ? (attendanceRate >= 80 ? 'text-[var(--green)]' : 'text-[var(--amber)]') : 'text-[var(--t4)]'}`}>
                {stats.presentToday > 0 ? `${attendanceRate}%` : '--'}
              </p>
              <p className="text-[11px] text-[var(--t3)] mt-0.5">{stats.presentToday > 0 ? `${stats.presentToday} present today` : 'Not taken'}</p>
            </div>
            <div className="rounded-2xl bg-white border border-[var(--border)] p-4">
              <p className="text-[11px] font-medium text-[var(--t3)]">Fees</p>
              <p className={`text-2xl font-bold mt-1 ${totalExpected > 0 ? (collectionRate >= 70 ? 'text-[var(--green)]' : 'text-[var(--red)]') : 'text-[var(--t4)]'}`}>
                {totalExpected > 0 ? `${collectionRate}%` : '--'}
              </p>
              <p className="text-[11px] text-[var(--t3)] mt-0.5">{overdueFeeCount > 0 ? `${overdueFeeCount} overdue` : 'On track'}</p>
            </div>
          </div>

          {/* Alerts — only when something needs attention */}
          {hasAlerts && (
            <div className="space-y-2 mb-5">
              {stats.presentToday === 0 && classes.length > 0 && (
                <div className="rounded-xl bg-[#ffefe8] border border-[#f5d0c5] px-4 py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#c2472b] text-xl">how_to_reg</span>
                  <p className="flex-1 text-sm font-semibold text-[#17325f]">Attendance not taken yet</p>
                  <Link href="/dashboard/attendance" className="rounded-lg bg-[#c2472b] px-3 py-1.5 text-xs font-bold text-white">Take now</Link>
                </div>
              )}
              {overdueFeeCount > 0 && (
                <div className="rounded-xl bg-[#ffefe8] border border-[#f5d0c5] px-4 py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#c2472b] text-xl">payments</span>
                  <p className="flex-1 text-sm font-semibold text-[#17325f]">{overdueFeeCount} student{overdueFeeCount > 1 ? 's' : ''} with overdue fees</p>
                  <Link href="/dashboard/fees" className="rounded-lg bg-[#c2472b] px-3 py-1.5 text-xs font-bold text-white">View</Link>
                </div>
              )}
              {lowAttendanceClasses > 0 && (
                <div className="rounded-xl bg-[#fff5e8] border border-[#f5deb3] px-4 py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#b45309] text-xl">warning</span>
                  <p className="flex-1 text-sm font-semibold text-[#17325f]">{lowAttendanceClasses} class{lowAttendanceClasses > 1 ? 'es' : ''} below 70% attendance</p>
                  <Link href="/dashboard/attendance" className="rounded-lg bg-[#b45309] px-3 py-1.5 text-xs font-bold text-white">View</Link>
                </div>
              )}
              {pendingLeave > 0 && (
                <div className="rounded-xl bg-[#fff5e8] border border-[#f5deb3] px-4 py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#b45309] text-xl">event_busy</span>
                  <p className="flex-1 text-sm font-semibold text-[#17325f]">{pendingLeave} leave request{pendingLeave > 1 ? 's' : ''} to review</p>
                  <Link href="/dashboard/leave-approvals" className="rounded-lg bg-[#b45309] px-3 py-1.5 text-xs font-bold text-white">Review</Link>
                </div>
              )}
              {pendingExpenses > 0 && (
                <div className="rounded-xl bg-[#ffefe8] border border-[#f5d0c5] px-4 py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#c2472b] text-xl">receipt</span>
                  <p className="flex-1 text-sm font-semibold text-[#17325f]">{pendingExpenses} expense{pendingExpenses > 1 ? 's' : ''} to approve</p>
                  <Link href="/dashboard/expense-approvals" className="rounded-lg bg-[#c2472b] px-3 py-1.5 text-xs font-bold text-white">Review</Link>
                </div>
              )}
            </div>
          )}

          {/* Quick actions row */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {quickActions.slice(0, 4).map((action) => (
              <Link
                key={action.href}
                href={action.href}
                title={action.label}
                className="flex flex-col items-center gap-1 rounded-xl bg-white border border-[var(--border)] py-3 hover:bg-[var(--surface-container)] transition-colors"
              >
                <span className="material-symbols-outlined text-[var(--t1)] text-xl">{action.icon}</span>
                <span className="text-[10px] font-semibold text-[var(--t2)]">{action.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}
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
