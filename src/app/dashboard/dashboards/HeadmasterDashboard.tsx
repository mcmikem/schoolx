"use client";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useDashboardStats, useStudents, useFeeStructure, useClasses } from "@/lib/hooks";
import { useDashboardExtraData } from "@/lib/hooks/useDashboardExtraData";
import { useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import MaterialIcon from "@/components/MaterialIcon";
import StatCard from "@/components/dashboard/StatCard";
import UpNextCard from "@/components/dashboard/UpNextCard";
import TeamPreview from "@/components/dashboard/TeamPreview";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import OwlMascot from "@/components/brand/OwlMascot";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import TaskManager from "@/components/dashboard/TaskManager";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import SetupChecklist from "@/components/onboarding/SetupChecklist";

function HeadmasterDashboardContent() {
  const { school, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();

  const { stats, loading: statsLoading } = useDashboardStats(school?.id);
  const { students = [] } = useStudents(school?.id);
  const { feeStructure = [] } = useFeeStructure(school?.id);
  const { classes = [] } = useClasses(school?.id);

  const {
    pendingExpenses,
    pendingLeave,
    overdueFeeCount,
    lowAttendanceClasses,
    atRiskStudents,
    dropoutRiskCount,
    loading: loadingExtra,
    timedOut,
  } = useDashboardExtraData(school?.id, students, feeStructure, currentTerm, academicYear);

  const currentDate = useMemo(() => new Date(), []);
  const greeting =
    currentDate.getHours() < 12 ? "Good Morning" : currentDate.getHours() < 17 ? "Good Afternoon" : "Good Evening";

  const boysCount = stats.maleStudents;
  const girlsCount = stats.femaleStudents;

  const totalExpected = stats.feesCollected + stats.feesBalance;

  const collectionRate = useMemo(
    () => (totalExpected > 0 ? Math.round((stats.feesCollected / totalExpected) * 100) : 0),
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
    if (!statsLoading && stats.presentToday === 0 && classes.length > 0) {
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
    if (dropoutRiskCount > 0) {
      items.push({
        id: "dropout-risk",
        label: `${dropoutRiskCount} student${dropoutRiskCount > 1 ? "s" : ""} at risk of dropping out`,
        icon: "priority_high",
        priority: "urgent" as const,
        href: "/dashboard/attendance",
        cta: "Check",
      });
    }
    if (atRiskStudents.length > 0) {
      items.push({
        id: "at-risk-academics",
        label: `${atRiskStudents.length} student${atRiskStudents.length > 1 ? "s" : ""} with failing grades`,
        icon: "school",
        priority: "attention" as const,
        href: "/dashboard/grades",
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
  }, [
    statsLoading,
    stats.presentToday,
    classes.length,
    overdueFeeCount,
    lowAttendanceClasses,
    atRiskStudents,
    dropoutRiskCount,
    pendingLeave,
    pendingExpenses,
  ]);

  const isDataLoading = statsLoading || loadingExtra;

  if (!school?.id) {
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

  const isFirstRun = school?.id && !isDataLoading && stats.totalStudents === 0 && classes.length === 0;

  return (
    <div className="content overflow-x-hidden">
      {isDataLoading && <TopLoadingBar />}
      {timedOut ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 mb-4 flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-600 mt-0.5" aria-hidden>
            wifi_off
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Some dashboard data couldn&apos;t refresh</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Showing the most recent available data. This usually means your internet or the school server is slow — it
              will retry automatically.
            </p>
          </div>
        </div>
      ) : null}
      {isFirstRun ? (
        <div className="rounded-[24px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-6 text-center mb-6">
          <span className="material-symbols-outlined text-[#17325f] text-4xl">rocket_launch</span>
          <h2 className="text-lg font-bold text-[#17325f] mt-2">Welcome to {school?.name || "your school"}!</h2>
          <p className="text-sm text-[#60748f] mt-1 max-w-md mx-auto">
            Start by adding students and setting up your classes.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Link
              href="/dashboard/students?action=add"
              title="Add your first student"
              className="rounded-xl bg-[#17325f] px-5 py-2.5 text-xs font-bold text-white hover:opacity-90"
            >
              Add first student
            </Link>
            <Link
              href="/dashboard/settings?tab=checklist"
              title="View setup progress"
              className="rounded-xl border border-[#17325f] px-5 py-2.5 text-xs font-bold text-[#17325f] hover:bg-[#edf4ff]"
            >
              Setup guide
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Greeting header — big greeting, prominent school mark, watermark */}
          <div className="card relative overflow-hidden !p-5 sm:!p-6 mb-6">
            {school?.logo_url && (
              <Image
                src={school.logo_url}
                alt=""
                aria-hidden="true"
                width={224}
                height={224}
                className="pointer-events-none absolute -right-10 -bottom-12 h-56 w-56 object-contain opacity-[0.07] select-none"
                unoptimized
              />
            )}
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
              {school?.logo_url ? (
                <Image
                  src={school.logo_url}
                  alt={school?.name || "School"}
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-[20px] object-cover ring-1 ring-[var(--border)] shadow-[var(--sh1)] flex-shrink-0"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[20px] bg-[var(--primary)] text-[26px] font-bold text-[var(--on-primary)] shadow-[var(--sh1)]"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                  aria-hidden="true"
                >
                  {(school?.name || "S").charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1
                  className="text-[26px] sm:text-[32px] font-bold text-[var(--t1)] tracking-tight leading-tight truncate"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  {greeting}, {user?.full_name?.split(" ")[0] || "there"}
                </h1>
                <p className="text-[13px] text-[var(--t3)] mt-1 truncate">
                  {school?.name} · {todayDayName}, {todayFormatted} · Term {currentTerm}, {academicYear}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
                <Link href="/dashboard/students?action=add" className="btn-pill btn-primary">
                  <MaterialIcon icon="add" style={{ fontSize: 16 }} />
                  Add student
                </Link>
                <Link href="/dashboard/attendance" className="btn-pill btn-secondary">
                  Take attendance
                </Link>
              </div>
            </div>
          </div>
          <div className="mb-5">
            <SetupChecklist autoHide />
          </div>

          {/* ── Two-Column Layout ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* ── Left Column: Metrics + Task Manager ── */}
            <div className="xl:col-span-2 space-y-5">
              <div className="stat-grid !mb-0">
                <StatCard
                  label="Students"
                  value={statsLoading ? "—" : formatNumber(stats.totalStudents)}
                  subValue={`${formatNumber(boysCount)}B · ${formatNumber(girlsCount)}G`}
                  icon="group"
                  accentColor="navy"
                  loading={statsLoading}
                  variant="premium-navy"
                  href="/dashboard/students"
                  hrefLabel="Open students"
                />
                <StatCard
                  label="Attendance today"
                  value={statsLoading ? "—" : `${attendanceRate}%`}
                  subValue={
                    statsLoading
                      ? undefined
                      : stats.presentToday > 0
                        ? `${stats.presentToday} present`
                        : "Not taken yet"
                  }
                  icon="how_to_reg"
                  accentColor={stats.presentToday > 0 ? (attendanceRate >= 80 ? "green" : "amber") : "red"}
                  loading={statsLoading}
                  href="/dashboard/attendance"
                  hrefLabel="Open attendance"
                />
                <StatCard
                  label="Fees collected"
                  value={statsLoading ? "—" : `${collectionRate}%`}
                  subValue={
                    statsLoading
                      ? undefined
                      : overdueFeeCount > 0
                        ? `${overdueFeeCount} overdue`
                        : totalExpected > 0
                          ? "On track"
                          : "No fees set"
                  }
                  icon="payments"
                  accentColor={totalExpected > 0 ? (collectionRate >= 70 ? "green" : "amber") : "red"}
                  loading={statsLoading}
                  href="/dashboard/fees"
                  hrefLabel="Open fees"
                />
              </div>

              <UpNextCard task={tasks.find((t) => t.priority === "urgent") ?? tasks[0] ?? null} />

              <CollapsibleSection
                title="Task Manager"
                badge={tasks.length > 0 ? tasks.length : null}
                storageKey={`hm-tasks-${school?.id}`}
                defaultOpen={tasks.length > 0}
              >
                <TaskManager tasks={tasks} emptyMessage="All caught up! No pending tasks." />
              </CollapsibleSection>

              <TeamPreview schoolId={school?.id} />
            </div>

            {/* ── Right Column: Calendar + Quick Actions ── */}
            <div className="space-y-5">
              <SchoolCalendar schoolId={school?.id} userId={user?.id} />

              {tasks.length > 0 && (
                <div className="card">
                  <div className="panel-head !mb-1">
                    <h2 className="panel-title">Needs attention</h2>
                    <span className="badge badge-red">{tasks.length}</span>
                  </div>
                  <div role="list" className="divide-y divide-[var(--bg)]">
                    {tasks.slice(0, 4).map((t) => (
                      <Link
                        key={t.id}
                        href={t.href}
                        role="listitem"
                        className="flex items-center gap-3 py-3 transition-colors hover:opacity-80"
                      >
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            t.priority === "urgent"
                              ? "bg-[var(--red-soft)] text-[var(--red)]"
                              : "bg-[var(--amber-soft)] text-[var(--amber)]"
                          }`}
                          aria-hidden="true"
                        >
                          <MaterialIcon icon={t.icon} style={{ fontSize: 17 }} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-bold text-[var(--t1)] truncate">{t.label}</span>
                          <span className="block text-[11px] text-[var(--t3)] mt-0.5">{t.cta} now</span>
                        </span>
                        <MaterialIcon icon="chevron_right" className="text-[var(--t4)] flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <CollapsibleSection title="Quick Actions" storageKey={`hm-actions-${school?.id}`}>
                <div className="grid grid-cols-3 gap-2">
                  {quickActions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="group flex flex-col items-center gap-1 rounded-xl border border-[#eef2f8] bg-[#f8fbff] py-3 transition-all hover:border-[#c8dce8] hover:bg-[#edf4ff] hover:shadow-sm active:scale-95"
                    >
                      <span className="material-symbols-outlined text-lg text-[#42638d] group-hover:text-[#17325f]">
                        {action.icon}
                      </span>
                      <span className="text-sm font-bold text-[#7f91aa] group-hover:text-[#17325f]">
                        {action.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </CollapsibleSection>
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
