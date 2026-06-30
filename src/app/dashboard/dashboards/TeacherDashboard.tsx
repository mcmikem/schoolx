"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useStudents,
  useClasses,
  useSubjects,
  useDashboardStats,
} from "@/lib/hooks";
import { withTimeout } from "@/lib/hooks/utils";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  buildDefaultClasses,
  buildDefaultTimetableSlots,
  type SchoolSetupType,
} from "@/lib/school-setup";
import { getDefaultSubjects } from "@/lib/curriculum";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import { TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import OwlMascot from "@/components/brand/OwlMascot";
import { TeacherQuickGuide } from "@/components/dashboard/SchoolReadinessGuide";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import TaskManager from "@/components/dashboard/TaskManager";

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
    currentDate.getHours() < 12
      ? "Good Morning"
      : currentDate.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

  const myClasses = classes;
  const mySubjects = subjects;
  const needsSetup = classes.length === 0 || subjects.length === 0;
  const attendanceRate = useMemo(
    () =>
      stats?.totalStudents > 0
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
  const attendancePending = stats?.presentToday === 0 && myClasses.length > 0;

  const todayActions = [
    {
      label: "Take attendance",
      href: "/dashboard/attendance",
      icon: "how_to_reg",
      tone: "text-[#c2472b]",
    },
    {
      label: "Record grades",
      href: "/dashboard/grades",
      icon: "grade",
      tone: "text-[#17325f]",
    },
    {
      label: "Post homework",
      href: "/dashboard/homework",
      icon: "assignment",
      tone: "text-[#1f8a70]",
    },
    {
      label: "Open timetable",
      href: "/dashboard/timetable",
      icon: "calendar_month",
      tone: "text-[#17325f]",
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

  if (dataLoading && !loadingTimedOut) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <TopLoadingBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <OwlMascot size={52} premium ring glow animated />
            <p className="mt-4 text-sm text-[var(--t3)]">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content overflow-x-hidden">
      <TeacherQuickGuide />

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
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="rounded-full bg-[#17325f] px-4 py-2 text-center">
              <p className="text-xl font-bold text-white leading-none">{myClasses.length}</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/70">Classes</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-[#c8dce8]/40 pt-4">
          <div className="flex items-center gap-2 text-xs text-[#42638d]">
            <MaterialIcon icon="today" className="text-base" />
            <span className="font-semibold">{todayLabel}</span>
          </div>
          <div className="text-xs text-[#42638d]">
            <span className="font-semibold">{school?.name}</span> · Term {currentTerm} · {academicYear}
          </div>
          {stats?.totalStudents > 0 && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full bg-[#edf4ff] px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#17325f]" />
              <span className="text-[11px] font-bold text-[#17325f]">{students.length} students</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Left Column ── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Today Actions + At a Glance row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-[#eef2f8] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#17325f]/10">
                  <MaterialIcon icon="today" className="text-sm text-[#17325f]" />
                </div>
                <h2 className="text-sm font-bold text-[#17325f] font-['Sora']">Today Actions</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {todayActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-2.5 rounded-xl border border-[#eef2f8] bg-[#f8fbff] p-3 transition-all hover:border-[#c8dce8] hover:bg-[#edf4ff] hover:shadow-sm active:scale-95"
                  >
                    <span className={`material-symbols-outlined text-lg ${action.tone}`}>{action.icon}</span>
                    <span className="text-[11px] font-bold text-[#17325f]">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#eef2f8] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1f8a70]/10">
                  <MaterialIcon icon="insights" className="text-sm text-[#1f8a70]" />
                </div>
                <h2 className="text-sm font-bold text-[#17325f] font-['Sora']">At a Glance</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[#f8fbff] border border-[#eef2f8] p-3 text-center">
                  <span className="text-xl font-bold text-[#17325f]">{myClasses.length}</span>
                  <p className="text-[10px] font-medium text-[#7f91aa]">Classes</p>
                </div>
                <div className="rounded-xl bg-[#f8fbff] border border-[#eef2f8] p-3 text-center">
                  <span className="text-xl font-bold text-[#17325f]">{mySubjects.length}</span>
                  <p className="text-[10px] font-medium text-[#7f91aa]">Subjects</p>
                </div>
                <div className="rounded-xl bg-[#f8fbff] border border-[#eef2f8] p-3 text-center">
                  <span className="text-xl font-bold text-[#17325f]">{students.length}</span>
                  <p className="text-[10px] font-medium text-[#7f91aa]">Students</p>
                </div>
              </div>
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

          {/* My Classes */}
          {myClasses.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#17325f]/10">
                  <MaterialIcon icon="school" className="text-sm text-[#17325f]" />
                </div>
                <h2 className="text-sm font-bold text-[#17325f] font-['Sora']">My Classes</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {myClasses.map((cls: any) => {
                  const count = students.filter((s) => s.class_id === cls.id).length;
                  return (
                    <div key={cls.id} className="group rounded-2xl bg-white border border-[#eef2f8] p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                      <p className="text-base font-bold text-[#17325f]">{cls.name}</p>
                      <p className="text-xs text-[#7f91aa] mt-0.5">{count} student{count !== 1 ? "s" : ""}</p>
                      <div className="flex gap-2 mt-3">
                        <Link href={`/dashboard/attendance?class=${cls.id}`} className="flex-1 rounded-xl bg-[#17325f] py-1.5 text-center text-[10px] font-bold text-white hover:opacity-90 transition-opacity">Attendance</Link>
                        <Link href={`/dashboard/grades?class=${cls.id}`} className="flex-1 rounded-xl bg-[#edf4ff] py-1.5 text-center text-[10px] font-bold text-[#17325f] hover:bg-[#dce8f5] transition-colors">Grades</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Today's Schedule */}
          <div className="rounded-2xl border border-[#eef2f8] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b45309]/10">
                  <MaterialIcon icon="calendar_month" className="text-sm text-[#b45309]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#17325f] font-['Sora']">Today's Schedule</p>
                  <p className="text-[11px] text-[#7f91aa]">View your classes and periods for today</p>
                </div>
              </div>
              <Link href="/dashboard/timetable" className="rounded-xl bg-[#17325f] px-4 py-2 text-[11px] font-bold text-white hover:opacity-90 transition-opacity">
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
