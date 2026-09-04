"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses, useSubjects, useDashboardStats } from "@/lib/hooks";
import { useState, useEffect, useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import TaskManager from "@/components/dashboard/TaskManager";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import SchoolHero from "@/components/dashboard/SchoolHero";
import { TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import OwlMascot from "@/components/brand/OwlMascot";

function DeanDashboardContent() {
  const { school, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { stats, loading: statsLoading } = useDashboardStats(school?.id);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!statsLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoadingTimedOut(true);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [statsLoading]);

  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12 ? "Good Morning" : currentDate.getHours() < 17 ? "Good Afternoon" : "Good Evening";

  const attendanceRate =
    stats?.presentToday > 0 && stats.totalStudents > 0
      ? Math.round((stats.presentToday / stats.totalStudents) * 100)
      : 0;

  const getStudentCountForClass = (classId: string) => {
    return students.filter((s) => s.class_id === classId).length;
  };

  const todayLabel = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const tasks = useMemo(() => {
    const items = [];
    if (!statsLoading && stats?.presentToday === 0 && classes.length > 0) {
      items.push({
        id: "attendance",
        label: "Attendance not taken for today",
        icon: "how_to_reg",
        priority: "urgent" as const,
        href: "/dashboard/attendance",
        cta: "Take now",
      });
    }
    return items;
  }, [statsLoading, stats?.presentToday, classes.length]);

  const quickLinks = [
    { href: "/dashboard/grades", label: "Grades", icon: "edit_note", color: "text-[#17325f]" },
    { href: "/dashboard/attendance", label: "Attendance", icon: "how_to_reg", color: "text-[#1f8a70]" },
    { href: "/dashboard/homework", label: "Homework", icon: "assignment", color: "text-[#b45309]" },
    { href: "/dashboard/lesson-plans", label: "Lesson Plans", icon: "event_note", color: "text-[#17325f]" },
    { href: "/dashboard/timetable", label: "Timetable", icon: "calendar_month", color: "text-[#1f8a70]" },
    { href: "/dashboard/uneb", label: "UNEB", icon: "workspace_premium", color: "text-[#b45309]" },
  ];

  if ((!school?.id || statsLoading) && !loadingTimedOut) {
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

  return (
    <div className="content overflow-x-hidden">
      <SchoolHero
        school={school}
        greeting={greeting}
        userName={user?.full_name?.split(" ")[0] || ""}
        dateLabel={todayLabel}
        subtitle={`Dean of Academics · ${school?.name}`}
        rightSection={
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#42638d]">
            Term {currentTerm} · {academicYear}
          </p>
        }
        bottomCenter={
          <div className="text-xs text-[#42638d]">
            <span className="font-semibold">
              {stats.totalStudents} students · {classes.length} classes
            </span>
          </div>
        }
        bottomRight={
          stats?.presentToday > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full bg-[#1f8a70]/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1f8a70]" />
              <span className="text-[11px] font-bold text-[#1f8a70]">{attendanceRate}% attendance today</span>
            </div>
          ) : undefined
        }
      />

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Left Column ── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="group rounded-2xl bg-white border border-[#eef2f8] p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef5ff] text-[#17325f]">
                  <MaterialIcon icon="group" className="text-base" />
                </div>
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--t4)]">Students</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-[#17325f]">{formatNumber(stats.totalStudents)}</p>
              <p className="mt-0.5 text-xs text-[#7f91aa]">{classes.length} classes</p>
            </div>

            <div className="group rounded-2xl bg-white border border-[#eef2f8] p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${stats?.presentToday > 0 && attendanceRate >= 80 ? "bg-[#e5f6ef] text-[#1f8a70]" : "bg-[#ffefe8] text-[#c2472b]"}`}
                >
                  <MaterialIcon icon="how_to_reg" className="text-base" />
                </div>
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--t4)]">Attendance</p>
              </div>
              <p
                className={`mt-2 text-2xl font-bold ${stats?.presentToday > 0 ? (attendanceRate >= 80 ? "text-[#1f8a70]" : "text-[#b45309]") : "text-[#7f91aa]"}`}
              >
                {stats?.presentToday > 0 ? `${attendanceRate}%` : "--"}
              </p>
              <p className="mt-0.5 text-xs text-[#7f91aa]">
                {stats?.presentToday > 0
                  ? `${stats.presentToday} present`
                  : stats?.presentToday < 0
                    ? "Checking…"
                    : "0 present"}
              </p>
            </div>

            <div className="group rounded-2xl bg-white border border-[#eef2f8] p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fef3e8] text-[#b45309]">
                  <MaterialIcon icon="school" className="text-base" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7f91aa]">Subjects</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-[#17325f] font-['Sora']">{subjects.length}</p>
              <p className="mt-0.5 text-xs text-[#7f91aa]">Across {classes.length} classes</p>
            </div>
          </div>

          <CollapsibleSection
            title="Task Manager"
            badge={tasks.length > 0 ? tasks.length : null}
            storageKey={`dean-tasks-${school?.id}`}
            defaultOpen={tasks.length > 0}
          >
            <TaskManager tasks={tasks} emptyMessage="No pending tasks — everything is up to date" />
          </CollapsibleSection>

          {/* Quick Links */}
          <div className="rounded-2xl border border-[#eef2f8] bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#17325f]/10">
                <MaterialIcon icon="apps" className="text-sm text-[#17325f]" />
              </div>
              <h2 className="text-sm font-bold text-[#17325f] font-['Sora']">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex flex-col items-center gap-1 rounded-xl border border-[#eef2f8] bg-[#f8fbff] py-3 transition-all hover:border-[#c8dce8] hover:bg-[#edf4ff] hover:shadow-sm active:scale-95"
                >
                  <span className={`material-symbols-outlined text-lg ${link.color}`}>{link.icon}</span>
                  <span className="text-[10px] font-bold text-[#7f91aa]">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Classes Grid */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#17325f]/10">
                <MaterialIcon icon="school" className="text-sm text-[#17325f]" />
              </div>
              <h2 className="text-sm font-bold text-[#17325f] font-['Sora']">
                Classes — {academicYear} Term {currentTerm}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {classes.map((cls: any) => {
                const count = getStudentCountForClass(cls.id);
                return (
                  <Link
                    key={cls.id}
                    href={`/dashboard/grades?class=${cls.id}`}
                    className="group rounded-2xl bg-white border border-[#eef2f8] p-4 text-center transition-all hover:shadow-md hover:-translate-y-0.5"
                  >
                    <MaterialIcon icon="school" className="text-[#17325f] text-xl" />
                    <p className="mt-1 text-sm font-bold text-[#17325f]">{cls.name}</p>
                    <p className="text-[11px] text-[#7f91aa]">{count} students</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right Column: Calendar ── */}
        <div className="space-y-5">
          <SchoolCalendar schoolId={school?.id} userId={user?.id} />
        </div>
      </div>
    </div>
  );
}

export default function DeanDashboard() {
  return (
    <ErrorBoundary>
      <DeanDashboardContent />
    </ErrorBoundary>
  );
}
