"use client";
import Image from "next/image";
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
import SkoolMateLogo from "@/components/SkoolMateLogo";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import TaskManager from "@/components/dashboard/TaskManager";

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
      },
      {
        label: "Students",
        href: "/dashboard/students",
        icon: "group",
      },
      {
        label: "Attendance",
        href: "/dashboard/attendance",
        icon: "how_to_reg",
      },
      {
        label: "Fees",
        href: "/dashboard/fees",
        icon: "payments",
      },
      {
        label: "Messages",
        href: "/dashboard/messages",
        icon: "sms",
      },
      {
        label: "Defaulters",
        href: "/dashboard/fees?tab=defaulters",
        icon: "print",
      },
    ],
    [],
  );

  const tasks = useMemo(() => {
    const items = [];
    if (stats.presentToday === 0 && classes.length > 0) {
      items.push({
        id: "attendance",
        label: "Attendance not taken for today",
        icon: "how_to_reg",
        priority: "urgent" as const,
        href: "/dashboard/attendance",
        cta: "Take now",
      });
    }
    if (overdueFeeCount > 0) {
      items.push({
        id: "fees",
        label: `${overdueFeeCount} student${overdueFeeCount > 1 ? "s" : ""} with overdue fees`,
        icon: "payments",
        priority: "urgent" as const,
        href: "/dashboard/fees",
        cta: "View",
      });
    }
    if (lowAttendanceClasses > 0) {
      items.push({
        id: "low-attendance",
        label: `${lowAttendanceClasses} class${lowAttendanceClasses > 1 ? "es" : ""} below 70% attendance`,
        icon: "warning",
        priority: "attention" as const,
        href: "/dashboard/attendance",
        cta: "View",
      });
    }
    if (pendingLeave > 0) {
      items.push({
        id: "leave",
        label: `${pendingLeave} leave request${pendingLeave > 1 ? "s" : ""} to review`,
        icon: "event_busy",
        priority: "attention" as const,
        href: "/dashboard/leave-approvals",
        cta: "Review",
      });
    }
    if (pendingExpenses > 0) {
      items.push({
        id: "expenses",
        label: `${pendingExpenses} expense${pendingExpenses > 1 ? "s" : ""} to approve`,
        icon: "receipt",
        priority: "attention" as const,
        href: "/dashboard/expense-approvals",
        cta: "Approve",
      });
    }
    return items;
  }, [stats.presentToday, classes.length, overdueFeeCount, lowAttendanceClasses, pendingLeave, pendingExpenses]);

  const isDataLoading = statsLoading || loadingExtra;

  useEffect(() => {
    if (!isDataLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoadingTimedOut(true);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [isDataLoading]);

  if ((!school?.id || isDataLoading) && !loadingTimedOut) {
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

  const isFirstRun = school?.id && stats.totalStudents === 0 && classes.length === 0 && !isDataLoading;

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
          {/* ── Hero: Big Logo + School Branding ── */}
          <div className="relative mb-6 overflow-hidden rounded-[32px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-5 sm:p-7">
            <div className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-[#b7dfd8]/30 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 -bottom-10 h-36 w-36 rounded-full bg-[#d8e9fb]/40 blur-3xl" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-20 w-60 -translate-x-1/2 rounded-full bg-[#c8dce8]/20 blur-2xl" />

            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {school?.logo_url ? (
                  <Image src={school.logo_url} alt={school?.name || "School"} width={80} height={80} className="object-contain rounded-xl" unoptimized />
                ) : (
                  <SkoolMateLogo size="xl" showText variant="default" />
                )}
                <div className="flex flex-col">
                  <p className="text-xs font-semibold text-[#17325f]">{greeting}, {user?.full_name?.split(" ")[0]}</p>
                  <p className="text-[11px] text-[#42638d]">{school?.name}</p>
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#42638d]">
                  Term {currentTerm} · {academicYear}
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-[#c8dce8]/40 pt-4">
              <div className="flex items-center gap-2 text-xs text-[#42638d]">
                <MaterialIcon icon="today" className="text-base" />
                <span className="font-semibold">{todayDayName}, {todayFormatted}</span>
              </div>
              {stats.totalStudents > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#42638d]">
                  <MaterialIcon icon="groups" className="text-base" />
                  <span className="font-semibold">{stats.totalStudents} students enrolled</span>
                </div>
              )}
              {stats.presentToday > 0 && (
                <div className="ml-auto flex items-center gap-1.5 rounded-full bg-[#1f8a70]/10 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1f8a70]" />
                  <span className="text-[11px] font-bold text-[#1f8a70]">{attendanceRate}% attendance today</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Two-Column Layout ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* ── Left Column: Metrics + Task Manager ── */}
            <div className="xl:col-span-2 space-y-5">
              {/* Pulse check */}
              <div className="grid grid-cols-3 gap-3">
                <div className="group rounded-2xl bg-white border border-[#eef2f8] p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef5ff] text-[#17325f]">
                      <MaterialIcon icon="group" className="text-base" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7f91aa]">Students</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-[#17325f] font-['Sora']">{stats.totalStudents}</p>
                  <p className="mt-0.5 text-xs text-[#7f91aa]">
                    <span className="font-semibold text-[#17325f]">{boysCount}B</span> · <span className="font-semibold text-[#17325f]">{girlsCount}G</span>
                  </p>
                </div>

                <div className="group rounded-2xl bg-white border border-[#eef2f8] p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stats.presentToday > 0 && attendanceRate >= 80 ? "bg-[#e5f6ef] text-[#1f8a70]" : "bg-[#ffefe8] text-[#c2472b]"}`}>
                      <MaterialIcon icon="how_to_reg" className="text-base" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7f91aa]">Attendance</p>
                  </div>
                  <p className={`mt-2 text-3xl font-bold font-['Sora'] ${stats.presentToday > 0 ? (attendanceRate >= 80 ? "text-[#1f8a70]" : "text-[#b45309]") : "text-[#7f91aa]"}`}>
                    {stats.presentToday > 0 ? `${attendanceRate}%` : "--"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#7f91aa]">
                    {stats.presentToday > 0
                      ? <span className="font-semibold">{stats.presentToday} present today</span>
                      : "Not taken yet"}
                  </p>
                </div>

                <div className="group rounded-2xl bg-white border border-[#eef2f8] p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${totalExpected > 0 && collectionRate >= 70 ? "bg-[#e5f6ef] text-[#1f8a70]" : "bg-[#ffefe8] text-[#c2472b]"}`}>
                      <MaterialIcon icon="payments" className="text-base" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7f91aa]">Fees</p>
                  </div>
                  <p className={`mt-2 text-3xl font-bold font-['Sora'] ${totalExpected > 0 ? (collectionRate >= 70 ? "text-[#1f8a70]" : "text-[#c2472b]") : "text-[#7f91aa]"}`}>
                    {totalExpected > 0 ? `${collectionRate}%` : "--"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#7f91aa]">
                    {overdueFeeCount > 0
                      ? <span className="font-semibold text-[#c2472b]">{overdueFeeCount} overdue</span>
                      : "On track"}
                  </p>
                </div>
              </div>

              {/* Task Manager */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#17325f]">
                    <MaterialIcon icon="assignment" className="text-sm text-white" />
                  </div>
                  <h2 className="text-sm font-bold text-[#17325f] font-['Sora']">Task Manager</h2>
                  {tasks.length > 0 && (
                    <span className="rounded-full bg-[#c2472b]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#c2472b]">
                      {tasks.length} pending
                    </span>
                  )}
                </div>
                <TaskManager tasks={tasks} emptyMessage="All caught up! No pending tasks." />
              </div>
            </div>

            {/* ── Right Column: Calendar + Quick Actions ── */}
            <div className="space-y-5">
              <SchoolCalendar schoolId={school?.id} userId={user?.id} />

              {/* Quick Actions */}
              <div className="rounded-2xl border border-[#eef2f8] bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b45309]/10">
                    <MaterialIcon icon="bolt" className="text-sm text-[#b45309]" />
                  </div>
                  <h2 className="text-sm font-bold text-[#17325f] font-['Sora']">Quick Actions</h2>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {quickActions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="group flex flex-col items-center gap-1 rounded-xl border border-[#eef2f8] bg-[#f8fbff] py-3 transition-all hover:border-[#c8dce8] hover:bg-[#edf4ff] hover:shadow-sm active:scale-95"
                    >
                      <span className="material-symbols-outlined text-lg text-[#42638d] group-hover:text-[#17325f]">{action.icon}</span>
                      <span className="text-[10px] font-bold text-[#7f91aa] group-hover:text-[#17325f]">{action.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
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
