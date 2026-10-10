"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import OwlMascot from "@/components/brand/OwlMascot";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import StatCard from "@/components/dashboard/StatCard";
import TaskManager from "@/components/dashboard/TaskManager";
import TeamPreview from "@/components/dashboard/TeamPreview";
import UpNextCard from "@/components/dashboard/UpNextCard";
import ErrorBoundary from "@/components/ErrorBoundary";
import MaterialIcon from "@/components/MaterialIcon";
import SetupChecklist from "@/components/onboarding/SetupChecklist";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { StuckLoadingOverlay, TopLoadingBar } from "@/components/ui/Skeleton";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { useAllStudents, useClasses, useDashboardStats, useFeeStructure } from "@/lib/hooks";
import { useDashboardExtraData } from "@/lib/hooks/useDashboardExtraData";
import { formatNumber, greetingFor, todayLabelFor } from "@/lib/utils";

function HeadmasterDashboardContent() {
  const { school, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();

  const { stats, loading: statsLoading } = useDashboardStats(school?.id, { term: currentTerm, academicYear });
  const { students, ready: rosterReady } = useAllStudents(school?.id);
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
  } = useDashboardExtraData(school?.id, rosterReady ? students : null, feeStructure, currentTerm, academicYear);

  const currentDate = useMemo(() => new Date(), []);
  const greeting = greetingFor(currentDate);

  const boysCount = stats.maleStudents;
  const girlsCount = stats.femaleStudents;

  const totalExpected = stats.feesCollected + stats.feesBalance;
  const compactFeesCollected = useMemo(
    () => new Intl.NumberFormat("en-UG", { notation: "compact", maximumFractionDigits: 1 }).format(stats.feesCollected),
    [stats.feesCollected],
  );

  const collectionRate = useMemo(
    () => (totalExpected > 0 ? Math.round((stats.feesCollected / totalExpected) * 100) : 0),
    [totalExpected, stats.feesCollected],
  );

  // Attendance is only marked for students still enrolled, so the rate divides
  // by the active head count — the whole roster now includes dropouts, which
  // would drag the percentage down for a school that marked everyone present.
  // The fallback covers stats snapshots cached before `activeStudents` existed.
  const attendanceBase = stats.activeStudents > 0 ? stats.activeStudents : stats.totalStudents;
  const attendanceRate = useMemo(() => {
    return stats.presentToday > 0 && attendanceBase > 0 ? Math.round((stats.presentToday / attendanceBase) * 100) : 0;
  }, [stats.presentToday, attendanceBase]);

  const todayLabel = todayLabelFor(currentDate);

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
        href: "/dashboard/fees?status=unpaid",
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
    const unassignedClassCount = classes.filter((c) => !c.class_teacher_id).length;
    if (unassignedClassCount > 0) {
      items.push({
        id: "class-teachers",
        label: `${unassignedClassCount} ${unassignedClassCount === 1 ? "class" : "classes"} with no class teacher`,
        icon: "person_search",
        priority: "attention" as const,
        href: "/dashboard/classes",
        cta: "Assign",
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
    classes,
    overdueFeeCount,
    lowAttendanceClasses,
    atRiskStudents,
    dropoutRiskCount,
    pendingLeave,
    pendingExpenses,
  ]);

  const primaryTask = tasks.find((t) => t.priority === "urgent") ?? tasks[0] ?? null;

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

  // Two things this deliberately does not test, and one it now does.
  //
  // Not `classes.length === 0`: the 10-step onboarding creates the classes,
  // terms and fee structure before a single learner is imported, so requiring
  // an empty class list meant this welcome never appeared for the schools it
  // was written for.
  //
  // Not `stats.totalStudents === 0` either: an unread school and an empty
  // school both look like zero there, and the welcome would take over a
  // dashboard that simply could not be reached.
  //
  // `rosterReady` is only true after a read actually succeeded, so it is the
  // one signal that separates "no students" from "we do not know".
  const isFirstRun = school?.id && !isDataLoading && rosterReady && students.length === 0;

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
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--green-soft)] p-6 text-center mb-6">
          <span className="material-symbols-outlined text-[var(--t1)] text-4xl">rocket_launch</span>
          <h2 className="text-lg font-bold text-[var(--t1)] mt-2">Welcome to {school?.name || "your school"}!</h2>
          <p className="text-sm text-[var(--t3)] mt-1 max-w-md mx-auto">
            {classes.length === 0
              ? "Start by adding students and setting up your classes."
              : "Your classes are ready — add your first student to get going."}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Link
              href="/dashboard/students?action=add"
              title="Add your first student"
              className="rounded-xl bg-[var(--t1)] px-5 py-2.5 text-xs font-bold text-white hover:opacity-90"
            >
              Add first student
            </Link>
            <Link
              href="/dashboard/settings?tab=checklist"
              title="View setup progress"
              className="rounded-xl border border-[var(--t1)] px-5 py-2.5 text-xs font-bold text-[var(--t1)] hover:bg-[var(--primary-50)]"
            >
              Setup guide
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Keep the identity header compact so today's work stays above the fold. */}
          <div className="card relative overflow-hidden !p-4 sm:!p-5 mb-4">
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
                  width={60}
                  height={60}
                  className="h-[60px] w-[60px] rounded-[18px] object-cover ring-1 ring-[var(--border)] shadow-[var(--sh1)] flex-shrink-0"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-[18px] bg-[var(--primary)] text-[23px] font-bold text-[var(--on-primary)] shadow-[var(--sh1)]"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                  aria-hidden="true"
                >
                  {(school?.name || "S").charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1
                  className="text-[23px] sm:text-[28px] font-bold text-[var(--t1)] tracking-tight leading-tight truncate"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  {greeting}, {user?.full_name?.split(" ")[0] || "there"}
                </h1>
                <p className="text-[13px] text-[var(--t3)] mt-1 truncate">
                  {school?.name} · {todayLabel} · Term {currentTerm}, {academicYear}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
                <Link href="/dashboard/students?action=add" className="btn-pill btn-primary">
                  <MaterialIcon icon="add" style={{ fontSize: 16 }} />
                  Add student
                </Link>
              </div>
            </div>
          </div>
          <SetupChecklist autoHide />

          <div className="card mb-5">
            <div className="panel-head !mb-3">
              <h2 className="panel-title">Common actions</h2>
            </div>
            <nav
              aria-label="Headmaster common actions"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
            >
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] px-2 py-3 text-center transition-colors hover:border-[var(--primary)]/30 hover:bg-[var(--primary-50)]"
                >
                  <MaterialIcon
                    icon={action.icon}
                    className="text-lg text-[var(--t3)] group-hover:text-[var(--primary)]"
                  />
                  <span className="text-xs font-semibold text-[var(--t2)] group-hover:text-[var(--primary)]">
                    {action.label}
                  </span>
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Two-Column Layout ── */}
          <div className="grid grid-cols-1 items-start xl:grid-cols-3 gap-5">
            {/* ── Left Column: Metrics + Task Manager ── */}
            <div className="xl:col-span-2 space-y-5">
              <UpNextCard task={primaryTask} />

              <div className="stat-grid !mb-0 md:!grid-cols-3 lg:!grid-cols-3">
                <StatCard
                  label="Students"
                  value={statsLoading ? "—" : formatNumber(stats.totalStudents)}
                  subValue={`${formatNumber(boysCount)}B · ${formatNumber(girlsCount)}G`}
                  icon="group"
                  accentColor="navy"
                  loading={statsLoading}
                  href="/dashboard/students"
                  hrefLabel="Open students"
                />
                <StatCard
                  label="Attendance today"
                  value={
                    statsLoading || stats.presentToday < 0
                      ? "—"
                      : stats.presentToday > 0
                        ? `${attendanceRate}%`
                        : "Not recorded"
                  }
                  subValue={
                    statsLoading || stats.presentToday < 0
                      ? "Updating…"
                      : stats.presentToday > 0
                        ? `${stats.presentToday} present`
                        : "Not taken yet"
                  }
                  icon="how_to_reg"
                  accentColor={
                    statsLoading || stats.presentToday < 0
                      ? "amber"
                      : stats.presentToday > 0
                        ? attendanceRate >= 80
                          ? "green"
                          : "amber"
                        : "red"
                  }
                  loading={statsLoading}
                  href="/dashboard/attendance"
                  hrefLabel="Open attendance"
                />
                <StatCard
                  label="Fees collected"
                  value={statsLoading ? "—" : totalExpected > 0 ? `UGX ${compactFeesCollected}` : "Not set"}
                  subValue={
                    statsLoading
                      ? undefined
                      : totalExpected > 0
                        ? `${collectionRate}% of expected${overdueFeeCount > 0 ? ` · ${overdueFeeCount} overdue` : ""}`
                        : "No fees set"
                  }
                  icon="payments"
                  accentColor={totalExpected > 0 ? (collectionRate >= 70 ? "green" : "amber") : "red"}
                  loading={statsLoading}
                  href="/dashboard/fees"
                  hrefLabel="Open fees"
                />
              </div>

              {tasks.length > 1 && (
                <CollapsibleSection
                  title="All open tasks"
                  badge={tasks.length}
                  storageKey={`hm-tasks-${school?.id}`}
                  defaultOpen
                >
                  <TaskManager
                    tasks={tasks.filter((t) => t !== primaryTask)}
                    emptyMessage="All caught up! No pending tasks."
                  />
                </CollapsibleSection>
              )}

              <TeamPreview schoolId={school?.id} />
            </div>

            {/* ── Right Column: Calendar + Quick Actions ── */}
            <div className="space-y-5">
              <SchoolCalendar schoolId={school?.id} userId={user?.id} />
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
