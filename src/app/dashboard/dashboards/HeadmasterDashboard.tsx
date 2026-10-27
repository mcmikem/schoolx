"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import OwlMascot from "@/components/brand/OwlMascot";
import UpNextCard from "@/components/dashboard/UpNextCard";
import ErrorBoundary from "@/components/ErrorBoundary";
import MaterialIcon from "@/components/MaterialIcon";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { PageHeader } from "@/components/ui/PageHeader";
import { StuckLoadingOverlay, TopLoadingBar } from "@/components/ui/Skeleton";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { useDashboardStats } from "@/lib/hooks/analytics";
import { useAllStudents, useClasses } from "@/lib/hooks/students";
import { useDashboardExtraData } from "@/lib/hooks/useDashboardExtraData";
import { useStaff } from "@/lib/hooks/staff";
import NotifyTeachersModal from "@/components/dashboard/NotifyTeachersModal";
import { askOwly } from "@/lib/owly-bus";
import { refreshFailedComm } from "@/lib/owly-comm";
import { formatNumber, greetingFor, todayLabelFor } from "@/lib/utils";

const SetupChecklist = dynamic(() => import("@/components/onboarding/SetupChecklist"), {
  loading: () => <div className="h-16 rounded-xl bg-[var(--surface)]" aria-hidden="true" />,
});
const TaskManager = dynamic(() => import("@/components/dashboard/TaskManager"));
const TeamPreview = dynamic(() => import("@/components/dashboard/TeamPreview"), {
  loading: () => <div className="h-32 rounded-xl bg-[var(--surface)]" aria-hidden="true" />,
});
const SchoolCalendar = dynamic(() => import("@/components/dashboard/SchoolCalendar"), {
  loading: () => <div className="h-48 rounded-xl bg-[var(--surface)]" aria-hidden="true" />,
});

function HeadmasterDashboardContent() {
  const { school, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();

  const { stats, loading: statsLoading } = useDashboardStats(school?.id, { term: currentTerm, academicYear });
  const { students, ready: rosterReady } = useAllStudents(school?.id);
  const { classes = [] } = useClasses(school?.id);
  // Staff contacts are only loaded once the headmaster opens the reminder
  // modal, so the dashboard does not pull a users scan on every load.
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeLoaded, setNudgeLoaded] = useState(false);
  const { staff = [], loading: staffLoading } = useStaff(nudgeLoaded ? school?.id : undefined);
  const openNudge = () => {
    setNudgeOpen(true);
    setNudgeLoaded(true);
  };
  const remindTeachers = { label: "Remind teachers", onClick: openNudge };

  const {
    pendingExpenses,
    pendingLeave,
    overdueFeeCount,
    lowAttendanceClasses,
    atRiskStudents,
    dropoutRiskCount,
    loading: loadingExtra,
    timedOut,
  } = useDashboardExtraData(school?.id, rosterReady ? students : null, [], currentTerm, academicYear);

  // One announcement per episode: a retry that keeps timing out must not stack
  // copies of the same chat message.
  const [refreshFailedDelivered, setRefreshFailedDelivered] = useState(false);
  const announcedRefreshFailure = useRef(false);
  useEffect(() => {
    if (!timedOut) {
      announcedRefreshFailure.current = false;
      if (refreshFailedDelivered) setRefreshFailedDelivered(false);
      return;
    }
    if (announcedRefreshFailure.current) return;
    announcedRefreshFailure.current = true;
    const comm = refreshFailedComm();
    const delivered = askOwly({ kind: "notify", ...comm });
    // No assistant mounted (does not use the owl): keep the strip on the page.
    setRefreshFailedDelivered(delivered);
  }, [timedOut, refreshFailedDelivered]);
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
      { label: "Students", href: "/dashboard/students", icon: "group" },
      { label: "Attendance", href: "/dashboard/attendance", icon: "how_to_reg" },
      { label: "Fees", href: "/dashboard/fees", icon: "payments" },
      { label: "Grades", href: "/dashboard/grades", icon: "school" },
      { label: "Report cards", href: "/dashboard/report-cards", icon: "description" },
      { label: "Timetable", href: "/dashboard/timetable", icon: "calendar_month" },
      { label: "Messages", href: "/dashboard/messages", icon: "sms" },
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
        secondary: remindTeachers,
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
        secondary: remindTeachers,
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
    <div className="content !gap-6 overflow-x-hidden">
      {isDataLoading && <TopLoadingBar />}
      {timedOut && !refreshFailedDelivered ? (
        // Transient status belongs in Owly. This banner is only the fallback
        // for mounts with no assistant listening; the message is identical.
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
          <PageHeader
            title={`${greeting}, ${user?.full_name?.split(" ")[0] || "there"}`}
            subtitle={[school?.name, todayLabel, `Term ${currentTerm}, ${academicYear}`].filter(Boolean).join(" · ")}
            actions={
              <Link href="/dashboard/students?action=add" className="btn-pill btn-primary">
                <MaterialIcon icon="add" style={{ fontSize: 16 }} />
                Add student
              </Link>
            }
          />

          <section aria-label="School at a glance" className="border-y border-[var(--border)] py-4">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[var(--border)]">
              <Link
                href="/dashboard/students"
                data-testid="stat-Students"
                aria-label="Open students"
                className="group min-w-0 sm:pr-5"
              >
                <p className="text-[11px] font-medium text-[var(--t3)] sm:text-xs">Students</p>
                <p className="mt-1 break-words text-base font-bold tracking-tight text-[var(--t1)] tabular-nums sm:text-2xl">
                  {statsLoading ? "—" : formatNumber(stats.totalStudents)}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--t3)] sm:text-xs">
                  {formatNumber(boysCount)}B · {formatNumber(girlsCount)}G
                </p>
              </Link>
              <Link
                href="/dashboard/attendance"
                data-testid="stat-Attendance today"
                aria-label="Open attendance"
                className="group min-w-0 pl-3 sm:px-5"
              >
                <p className="text-[11px] font-medium text-[var(--t3)] sm:text-xs">Attendance today</p>
                <p className="mt-1 break-words text-base font-bold tracking-tight text-[var(--t1)] tabular-nums sm:text-2xl">
                  {statsLoading || stats.presentToday < 0
                    ? "—"
                    : stats.presentToday > 0
                      ? `${attendanceRate}%`
                      : "Not recorded"}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--t3)] sm:text-xs">
                  {statsLoading || stats.presentToday < 0
                    ? "Updating…"
                    : stats.presentToday > 0
                      ? `${stats.presentToday} present`
                      : "Not taken yet"}
                </p>
              </Link>
              <Link
                href="/dashboard/fees"
                data-testid="stat-Fees collected"
                aria-label="Open fees"
                className="group min-w-0 pl-3 sm:px-5 sm:last:pr-0"
              >
                <p className="text-[11px] font-medium text-[var(--t3)] sm:text-xs">Fees collected</p>
                <p className="mt-1 break-words text-base font-bold tracking-tight text-[var(--t1)] tabular-nums sm:text-2xl">
                  {statsLoading ? (
                    "—"
                  ) : totalExpected > 0 ? (
                    <>
                      <span className="text-[11px] font-medium text-[var(--t3)] sm:text-xl">UGX</span>{" "}
                      {compactFeesCollected}
                    </>
                  ) : (
                    "Not set"
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--t3)] sm:text-xs">
                  {statsLoading ? (
                    "Updating…"
                  ) : totalExpected > 0 ? (
                    <>
                      {collectionRate}%<span className="hidden sm:inline"> of expected</span>
                      {overdueFeeCount > 0 ? ` · ${overdueFeeCount} overdue` : ""}
                    </>
                  ) : (
                    "No fees set"
                  )}
                </p>
              </Link>
            </div>
          </section>

          <SetupChecklist autoHide />

          <NotifyTeachersModal
            open={nudgeOpen}
            onClose={() => setNudgeOpen(false)}
            classes={classes}
            staff={staff}
            kind="attendance"
            schoolName={school?.name}
            staffLoading={staffLoading}
          />

          <nav aria-label="Headmaster common actions" className="min-w-0">
            <div className="grid grid-cols-2 gap-x-5 sm:grid-cols-4 xl:grid-cols-7">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex min-h-12 min-w-0 items-center gap-2 border-b border-[var(--border)] py-2 text-[13px] font-semibold text-[var(--t1)] transition-colors hover:text-[var(--primary)]"
                >
                  <MaterialIcon
                    icon={action.icon}
                    className="text-lg text-[var(--t3)] transition-colors group-hover:text-[var(--primary)]"
                  />
                  <span className="truncate">{action.label}</span>
                </Link>
              ))}
            </div>
          </nav>

          {/* ── Two-Column Layout ── */}
          <div className="grid grid-cols-1 items-start xl:grid-cols-3 gap-6">
            {/* ── Left Column: Metrics + Task Manager ── */}
            <div className="xl:col-span-2 space-y-6">
              <UpNextCard task={primaryTask} />

              {tasks.length > 1 && (
                <CollapsibleSection
                  title="All open tasks"
                  badge={tasks.length}
                  storageKey={`hm-tasks-${school?.id}`}
                  defaultOpen
                  variant="flat"
                >
                  <TaskManager
                    tasks={tasks.filter((t) => t !== primaryTask)}
                    emptyMessage="All caught up! No pending tasks."
                    variant="list"
                  />
                </CollapsibleSection>
              )}

              <TeamPreview schoolId={school?.id} />
            </div>

            {/* ── Right Column: Calendar + Quick Actions ── */}
            <div className="space-y-6">
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
