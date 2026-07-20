"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useDashboardStats, useStudents, useFeeStructure, useClasses } from "@/lib/hooks";
import { useDashboardExtraData } from "@/lib/hooks/useDashboardExtraData";
import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import SchoolHero from "@/components/dashboard/SchoolHero";
import OwlMascot from "@/components/brand/OwlMascot";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import TaskManager from "@/components/dashboard/TaskManager";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

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
          <SchoolHero
            school={school}
            greeting={greeting}
            userName={user?.full_name?.split(" ")[0] || ""}
            dateLabel={`${todayDayName}, ${todayFormatted}`}
            rightSection={
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#42638d]">
                Term {currentTerm} · {academicYear}
              </p>
            }
            bottomCenter={
              stats.totalStudents > 0 ? (
                <div className="flex items-center gap-2 text-xs text-[#42638d]">
                  <MaterialIcon icon="groups" className="text-base" />
                  <span className="font-semibold">{stats.totalStudents} students enrolled</span>
                </div>
              ) : undefined
            }
            bottomRight={
              stats.presentToday > 0 ? (
                <div className="flex items-center gap-1.5 rounded-full bg-[#1f8a70]/10 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1f8a70]" />
                  <span className="text-[11px] font-bold text-[#1f8a70]">{attendanceRate}% attendance today</span>
                </div>
              ) : undefined
            }
          />

          {/* ── Two-Column Layout ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* ── Left Column: Metrics + Task Manager ── */}
            <div className="xl:col-span-2 space-y-5">
              <CollapsibleSection title="Pulse Check" storageKey={`hm-pulse-${school?.id}`}>
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
                      <span className="font-semibold text-[#17325f]">{boysCount}B</span> ·{" "}
                      <span className="font-semibold text-[#17325f]">{girlsCount}G</span>
                    </p>
                  </div>

                  <div className="group rounded-2xl bg-white border border-[#eef2f8] p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${stats.presentToday > 0 && attendanceRate >= 80 ? "bg-[#e5f6ef] text-[#1f8a70]" : "bg-[#ffefe8] text-[#c2472b]"}`}
                      >
                        <MaterialIcon icon="how_to_reg" className="text-base" />
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7f91aa]">Attendance</p>
                    </div>
                    <p
                      className={`mt-2 text-3xl font-bold font-['Sora'] ${stats.presentToday > 0 ? (attendanceRate >= 80 ? "text-[#1f8a70]" : "text-[#b45309]") : "text-[#7f91aa]"}`}
                    >
                      {stats.presentToday > 0 ? `${attendanceRate}%` : "--"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#7f91aa]">
                      {stats.presentToday > 0 ? (
                        <span className="font-semibold">{stats.presentToday} present today</span>
                      ) : (
                        "Not taken yet"
                      )}
                    </p>
                  </div>

                  <div className="group rounded-2xl bg-white border border-[#eef2f8] p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${totalExpected > 0 && collectionRate >= 70 ? "bg-[#e5f6ef] text-[#1f8a70]" : "bg-[#ffefe8] text-[#c2472b]"}`}
                      >
                        <MaterialIcon icon="payments" className="text-base" />
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7f91aa]">Fees</p>
                    </div>
                    <p
                      className={`mt-2 text-3xl font-bold font-['Sora'] ${totalExpected > 0 ? (collectionRate >= 70 ? "text-[#1f8a70]" : "text-[#c2472b]") : "text-[#7f91aa]"}`}
                    >
                      {totalExpected > 0 ? `${collectionRate}%` : "--"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#7f91aa]">
                      {overdueFeeCount > 0 ? (
                        <span className="font-semibold text-[#c2472b]">{overdueFeeCount} overdue</span>
                      ) : (
                        "On track"
                      )}
                    </p>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Task Manager"
                badge={tasks.length > 0 ? tasks.length : null}
                storageKey={`hm-tasks-${school?.id}`}
                defaultOpen={tasks.length > 0}
              >
                <TaskManager tasks={tasks} emptyMessage="All caught up! No pending tasks." />
              </CollapsibleSection>
            </div>

            {/* ── Right Column: Calendar + Quick Actions ── */}
            <div className="space-y-5">
              <SchoolCalendar schoolId={school?.id} userId={user?.id} />

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
                      <span className="text-[10px] font-bold text-[#7f91aa] group-hover:text-[#17325f]">
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
