"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses, useSubjects, useDashboardStats } from "@/lib/hooks";
import { withTimeout } from "@/lib/hooks/utils";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildDefaultClasses, buildDefaultTimetableSlots, type SchoolSetupType } from "@/lib/school-setup";
import { getDefaultSubjects } from "@/lib/curriculum";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import { TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import OwlMascot from "@/components/brand/OwlMascot";
import { TeacherQuickGuide } from "@/components/dashboard/SchoolReadinessGuide";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import TaskManager from "@/components/dashboard/TaskManager";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import SchoolHero from "@/components/dashboard/SchoolHero";

function TeacherDashboardContent() {
  const router = useRouter();
  const toast = useToast();
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students, loading: studentsLoading } = useStudents(school?.id);
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const { subjects, loading: subjectsLoading } = useSubjects(school?.id);
  const { stats, loading: statsLoading } = useDashboardStats(school?.id);
  const [settingUp, setSettingUp] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const dataLoading = studentsLoading || classesLoading || subjectsLoading || statsLoading;

  useEffect(() => {
    if (!dataLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoadingTimedOut(true);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [dataLoading]);

  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12 ? "Good Morning" : currentDate.getHours() < 17 ? "Good Afternoon" : "Good Evening";

  const myClasses = classes;
  const mySubjects = subjects;
  const needsSetup = classes.length === 0 || subjects.length === 0;
  const attendanceRate = useMemo(
    () =>
      stats?.presentToday > 0 && stats.totalStudents > 0
        ? Math.round((stats.presentToday / stats.totalStudents) * 100)
        : 0,
    [stats?.totalStudents, stats?.presentToday],
  );
  const todayLabel = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const classesWithNoStudents = myClasses.filter(
    (cls) => students.filter((s) => s.class_id === cls.id).length === 0,
  ).length;
  const attendancePending = !statsLoading && stats?.presentToday === 0 && myClasses.length > 0;

  const todayActions = [
    {
      label: "Take attendance",
      href: "/dashboard/attendance",
      icon: "how_to_reg",
      tone: "text-[var(--red)]",
    },
    {
      label: "Record grades",
      href: "/dashboard/grades",
      icon: "grade",
      tone: "text-[var(--t1)]",
    },
    {
      label: "Post homework",
      href: "/dashboard/homework",
      icon: "assignment",
      tone: "text-[var(--green)]",
    },
    {
      label: "Open timetable",
      href: "/dashboard/timetable",
      icon: "calendar_month",
      tone: "text-[var(--t1)]",
    },
  ];

  const tasks = useMemo(() => {
    const items = [];
    if (attendancePending) {
      items.push({
        id: "attendance",
        label: "Take attendance for today",
        icon: "how_to_reg",
        priority: "urgent" as const,
        href: "/dashboard/attendance",
        cta: "Take now",
      });
    }
    if (classesWithNoStudents > 0) {
      items.push({
        id: "no-students",
        label: `${classesWithNoStudents} class${classesWithNoStudents > 1 ? "es" : ""} with no students assigned`,
        icon: "warning",
        priority: "attention" as const,
        href: "/dashboard/students",
        cta: "Assign",
      });
    }
    if (needsSetup) {
      items.push({
        id: "setup",
        label: "Complete class and subject setup",
        icon: "rocket_launch",
        priority: "urgent" as const,
        href: "/dashboard/settings?tab=checklist",
        cta: "Setup",
      });
    }
    return items;
  }, [attendancePending, classesWithNoStudents, needsSetup]);

  if ((!school?.id || dataLoading) && !loadingTimedOut) {
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
      <TeacherQuickGuide />

      <SchoolHero
        school={school}
        greeting={greeting}
        userName={user?.full_name?.split(" ")[0] || ""}
        dateLabel={todayLabel}
        rightSection={
          <div className="rounded-full bg-[var(--t1)] px-4 py-2 text-center">
            <p className="text-xl font-bold text-white leading-none">{myClasses.length}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/70">Classes</p>
          </div>
        }
        bottomCenter={
          <div className="text-xs text-[var(--t2)]">
            <span className="font-semibold">{school?.name}</span> · Term {currentTerm} · {academicYear}
          </div>
        }
        bottomRight={
          stats?.totalStudents > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--primary-50)] px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--t1)]" />
              <span className="text-[11px] font-bold text-[var(--t1)]">{stats.totalStudents} students</span>
            </div>
          ) : undefined
        }
      />

      {/* ── My Day Summary ── */}
      {stats && (
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className={`rounded-2xl border p-4 ${!attendancePending ? "border-[var(--green-soft)] bg-[var(--green-soft)]" : "border-[var(--red-soft)] bg-[var(--red-soft)]"}`}
          >
            <div className="flex items-center gap-2">
              <MaterialIcon
                icon={!attendancePending ? "check_circle" : "how_to_reg"}
                className={`text-lg ${!attendancePending ? "text-[var(--green)]" : "text-[var(--red)]"}`}
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--t3)]">Attendance</span>
            </div>
            <p className={`mt-1 text-lg font-bold ${!attendancePending ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
              {!attendancePending ? "Done" : "Pending"}
            </p>
            <p className="text-[10px] text-[var(--t3)] mt-0.5">
              {stats.presentToday > 0
                ? `${stats.presentToday} present today`
                : stats.presentToday < 0
                  ? "Checking…"
                  : "Not taken yet"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--surface-container-low)] bg-white p-4">
            <div className="flex items-center gap-2">
              <MaterialIcon icon="assignment" className="text-lg text-[var(--t1)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--t3)]">Tasks</span>
            </div>
            <p className="mt-1 text-lg font-bold text-[var(--t1)]">{tasks.length}</p>
            <p className="text-[10px] text-[var(--t3)] mt-0.5">
              {tasks.length === 1 ? "Pending item" : tasks.length > 0 ? "Pending items" : "All clear"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--surface-container-low)] bg-white p-4">
            <div className="flex items-center gap-2">
              <MaterialIcon icon="school" className="text-lg text-[var(--amber)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--t3)]">Classes</span>
            </div>
            <p className="mt-1 text-lg font-bold text-[var(--t1)]">{myClasses.length}</p>
            <p className="text-[10px] text-[var(--t3)] mt-0.5">{mySubjects.length} subjects</p>
          </div>
          <div className="rounded-2xl border border-[var(--surface-container-low)] bg-white p-4">
            <div className="flex items-center gap-2">
              <MaterialIcon icon="group" className="text-lg text-[var(--green)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--t3)]">Students</span>
            </div>
            <p className="mt-1 text-lg font-bold text-[var(--t1)]">{stats.totalStudents}</p>
            <p className="text-[10px] text-[var(--t3)] mt-0.5">Enrolled</p>
          </div>
        </div>
      )}

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Left Column ── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Today Actions + At a Glance row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-[var(--surface-container-low)] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--t1)]/10">
                  <MaterialIcon icon="today" className="text-sm text-[var(--t1)]" />
                </div>
                <h2 className="text-sm font-bold text-[var(--t1)] font-['Sora']">Today Actions</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {todayActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--surface-container-low)] bg-[var(--surface-bright)] p-3 transition-all hover:border-[var(--border)] hover:bg-[var(--primary-50)] hover:shadow-sm active:scale-95"
                  >
                    <span className={`material-symbols-outlined text-lg ${action.tone}`}>{action.icon}</span>
                    <span className="text-[11px] font-bold text-[var(--t1)]">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--surface-container-low)] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--green)]/10">
                  <MaterialIcon icon="insights" className="text-sm text-[var(--green)]" />
                </div>
                <h2 className="text-sm font-bold text-[var(--t1)] font-['Sora']">At a Glance</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[var(--surface-bright)] border border-[var(--surface-container-low)] p-3 text-center">
                  <span className="text-xl font-bold text-[var(--t1)]">{myClasses.length}</span>
                  <p className="text-[10px] font-medium text-[var(--t3)]">Classes</p>
                </div>
                <div className="rounded-xl bg-[var(--surface-bright)] border border-[var(--surface-container-low)] p-3 text-center">
                  <span className="text-xl font-bold text-[var(--t1)]">{mySubjects.length}</span>
                  <p className="text-[10px] font-medium text-[var(--t3)]">Subjects</p>
                </div>
                <div className="rounded-xl bg-[var(--surface-bright)] border border-[var(--surface-container-low)] p-3 text-center">
                  <span className="text-xl font-bold text-[var(--t1)]">{stats.totalStudents}</span>
                  <p className="text-[10px] font-medium text-[var(--t3)]">Students</p>
                </div>
              </div>
            </div>
          </div>

          <CollapsibleSection
            title="Task Manager"
            badge={tasks.length > 0 ? tasks.length : null}
            storageKey={`teacher-tasks-${school?.id}`}
            defaultOpen={tasks.length > 0}
          >
            <TaskManager tasks={tasks} emptyMessage="All caught up! No pending tasks." />
          </CollapsibleSection>

          {/* My Classes */}
          {myClasses.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--t1)]/10">
                  <MaterialIcon icon="school" className="text-sm text-[var(--t1)]" />
                </div>
                <h2 className="text-sm font-bold text-[var(--t1)] font-['Sora']">My Classes</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {myClasses.map((cls: any) => {
                  const count = students.filter((s) => s.class_id === cls.id).length;
                  return (
                    <div
                      key={cls.id}
                      className="group rounded-2xl bg-white border border-[var(--surface-container-low)] p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
                    >
                      <p className="text-base font-bold text-[var(--t1)]">{cls.name}</p>
                      <p className="text-xs text-[var(--t3)] mt-0.5">
                        {count} student{count !== 1 ? "s" : ""}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Link
                          href={`/dashboard/attendance?class=${cls.id}`}
                          className="flex-1 rounded-xl bg-[var(--t1)] py-1.5 text-center text-[10px] font-bold text-white hover:opacity-90 transition-opacity"
                        >
                          Attendance
                        </Link>
                        <Link
                          href={`/dashboard/grades?class=${cls.id}`}
                          className="flex-1 rounded-xl bg-[var(--primary-50)] py-1.5 text-center text-[10px] font-bold text-[var(--t1)] hover:bg-[var(--border)] transition-colors"
                        >
                          Grades
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Today's Schedule */}
          <div className="rounded-2xl border border-[var(--surface-container-low)] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--amber)]/10">
                  <MaterialIcon icon="calendar_month" className="text-sm text-[var(--amber)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--t1)] font-['Sora']">Today's Schedule</p>
                  <p className="text-[11px] text-[var(--t3)]">View your classes and periods for today</p>
                </div>
              </div>
              <Link
                href="/dashboard/timetable"
                className="rounded-xl bg-[var(--t1)] px-4 py-2 text-[11px] font-bold text-white hover:opacity-90 transition-opacity"
              >
                Open timetable
              </Link>
            </div>
          </div>
        </div>

        {/* ── Right Column: Calendar ── */}
        <div className="space-y-5">
          <SchoolCalendar schoolId={school?.id} userId={user?.id} />
        </div>
      </div>
      <StuckLoadingOverlay />
    </div>
  );
}

export default function TeacherDashboard() {
  return (
    <ErrorBoundary>
      <TeacherDashboardContent />
    </ErrorBoundary>
  );
}
