"use client";
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

import StatCard from "@/components/dashboard/StatCard";

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
    }, 12000);
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-[28px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-4 sm:p-6">
        <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-[#b7dfd8]/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-[#d8e9fb]/60 blur-3xl" />

        <div className="relative z-10">
      {/* Section 1: GREETING + MY DAY */}
      <section className="relative mb-6 overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(130deg,#f9fbff_0%,#eff6ff_40%,#f8faff_100%)] p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7f91aa]">{todayLabel}</p>
            <h1 className="mt-1 text-3xl font-bold text-[#17325f]">{greeting}, {user?.full_name?.split(" ")[0]}</h1>
            <p className="mt-1 text-sm text-[#60748f]">{school?.name} · Term {currentTerm} · {academicYear}</p>
          </div>
          <div className="rounded-full bg-[#17325f] px-4 py-2 text-center">
            <p className="text-2xl font-bold text-white">{myClasses.length}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/70">Classes</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-[22px] border border-[#e5ecf4] bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Today Actions</div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {todayActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-xl border border-[#e5ecf4] bg-[#f8fbff] p-3 hover:bg-[#edf4ff] transition-colors"
              >
                <span className={`material-symbols-outlined text-[20px] ${action.tone}`}>{action.icon}</span>
                <div className="text-xs font-bold text-[#17325f] mt-2">{action.label}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-[#e5ecf4] bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Exceptions First</div>
          <div className="space-y-3 mt-3">
            <div className={`rounded-xl border p-3 ${attendancePending ? "border-[#f5d0c5] bg-[#ffefe8]" : "border-[#d8efe7] bg-[#f3fbf8]"}`}>
              <div className="text-xs font-semibold text-[#17325f]">Attendance status</div>
              <div className={`text-sm font-bold mt-1 ${attendancePending ? "text-[#c2472b]" : "text-[#1f8a70]"}`}>
                {attendancePending ? "Pending for today" : "Captured"}
              </div>
            </div>
            <div className={`rounded-xl border p-3 ${classesWithNoStudents > 0 ? "border-[#f5deb3] bg-[#fff8eb]" : "border-[#e5ecf4] bg-[#f8fbff]"}`}>
              <div className="text-xs font-semibold text-[#17325f]">Class data quality</div>
              <div className="text-sm font-bold mt-1 text-[#17325f]">
                {classesWithNoStudents > 0
                  ? `${classesWithNoStudents} class(es) have no students`
                  : "All classes have student records"}
              </div>
            </div>
            <div className="rounded-xl border border-[#e5ecf4] bg-[#f8fbff] p-3">
              <div className="text-xs font-semibold text-[#17325f]">My teaching load</div>
              <div className="text-sm font-bold mt-1 text-[#17325f]">{myClasses.length} classes · {mySubjects.length} subjects</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: MY CLASSES */}
      {myClasses.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {myClasses.map((cls: any) => {
            const count = students.filter((s) => s.class_id === cls.id).length;
            return (
              <div key={cls.id} className="rounded-[20px] bg-white border border-[#e5ecf4] p-4">
                <p className="text-lg font-bold text-[#17325f]">{cls.name}</p>
                <p className="text-xs text-[#7f91aa] mt-0.5">{count} student{count !== 1 ? 's' : ''}</p>
                <div className="flex gap-2 mt-3">
                  <Link href={`/dashboard/attendance?class=${cls.id}`} className="flex-1 rounded-xl bg-[#17325f] py-2 text-center text-xs font-bold text-white hover:opacity-90">Attendance</Link>
                  <Link href={`/dashboard/grades?class=${cls.id}`} className="flex-1 rounded-xl bg-[#edf4ff] py-2 text-center text-xs font-bold text-[#17325f] hover:bg-[#dce8f5]">Grades</Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[20px] bg-white border border-dashed border-[#d7e3f2] p-6 text-center mb-6">
          <p className="text-sm font-semibold text-[#7f91aa]">No classes assigned yet</p>
        </div>
      )}

      {/* Section 3: TODAY'S SCHEDULE */}
      <div className="rounded-[22px] border border-[#e5ecf4] bg-white p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Today's Schedule</p>
            <p className="text-sm font-semibold text-[#17325f]">Your classes and periods for today</p>
          </div>
          <Link href="/dashboard/timetable" className="text-xs font-bold text-[#17325f] underline-offset-2 hover:underline">View full timetable</Link>
        </div>
        <div className="rounded-xl border border-dashed border-[#d7e3f2] bg-[#f8fbff] p-6 text-center">
          <span className="material-symbols-outlined text-[#7f91aa] text-3xl">calendar_month</span>
          <p className="mt-2 text-sm font-semibold text-[#7f91aa]">Schedule loaded once timetable is configured</p>
          <p className="text-xs text-[#a0b3c9] mt-1">Your period-by-period plan will appear here</p>
        </div>
      </div>

      {/* Section 4: RECENT ACTIVITY */}
      <div className="rounded-[22px] border border-[#e5ecf4] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Recent Activity</p>
            <p className="text-sm font-semibold text-[#17325f]">Latest actions across your classes</p>
          </div>
          <span className="text-[11px] font-semibold text-[#60748f]">Today</span>
        </div>
        <div className="rounded-xl border border-dashed border-[#d7e3f2] bg-[#f8fbff] p-6 text-center">
          <span className="material-symbols-outlined text-[#7f91aa] text-3xl">history</span>
          <p className="mt-2 text-sm font-semibold text-[#7f91aa]">No recent activity recorded yet</p>
          <p className="text-xs text-[#a0b3c9] mt-1">Attendance marks, grade entries, and homework posts will appear here</p>
        </div>
      </div>

      {/* Section 5: PENDING ACTIONS */}
      {stats?.presentToday === 0 && myClasses.length > 0 && (
        <div className="rounded-[20px] bg-[#ffefe8] border border-[#f5d0c5] p-4 flex items-center gap-3 mt-4">
          <span className="material-symbols-outlined text-[#c2472b] text-2xl">how_to_reg</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#17325f]">Mark attendance</p>
            <p className="text-xs text-[#6b7f99]">Not yet taken for today</p>
          </div>
          <Link href="/dashboard/attendance" className="shrink-0 rounded-xl bg-[#c2472b] px-4 py-2 text-xs font-bold text-white">Take now</Link>
        </div>
      )}
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
