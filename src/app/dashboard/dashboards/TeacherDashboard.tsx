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
import { useState, useMemo } from "react";
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
  const dataLoading = studentsLoading || classesLoading || subjectsLoading || statsLoading;

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

  const classesNotMarkedToday = classes.filter((c) => { return false; }).length;

  const runSetup = async () => {
    if (!school?.id) return;
    setSettingUp(true);
    try {
      const currentYear = new Date().getFullYear().toString();

      const schoolType =
        ((school as any)?.school_type || "primary") as SchoolSetupType;
      const defaultClasses = buildDefaultClasses(
        school.id,
        schoolType,
        currentYear,
      );
      await withTimeout(
        supabase
          .from("classes")
          .upsert(defaultClasses, { onConflict: "school_id,name,academic_year" }),
        15000,
        null as any,
      );

      const defaultSubjects = getDefaultSubjects(schoolType).map(
        ({ id: _id, ...s }) => ({ ...s, school_id: school.id }),
      );
      await withTimeout(
        supabase.from("subjects").insert(defaultSubjects),
        15000,
        null as any,
      );

      await withTimeout(
        supabase.from("academic_years").insert({
          school_id: school.id,
          name: currentYear,
          start_date: `${currentYear}-01-01`,
          end_date: `${currentYear}-12-31`,
          is_current: true,
        }),
        15000,
        null as any,
      );

      const { count: slotCount } = await withTimeout(
        supabase
          .from("timetable_slots")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id),
        15000,
        { count: 0, error: null } as any,
      );

      if (!slotCount) {
        await withTimeout(
          supabase
            .from("timetable_slots")
            .insert(buildDefaultTimetableSlots(school.id)),
          15000,
          null as any,
        );
      }

      toast?.success("School setup complete!");
      router.refresh();
    } catch (err) {
      toast?.error("Setup failed. Please try again.");
    } finally {
      setSettingUp(false);
    }
  };

  if (dataLoading) {
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
    <div className="content">
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
                  <a href={`/dashboard/attendance?class=${cls.id}`} className="flex-1 rounded-xl bg-[#17325f] py-2 text-center text-xs font-bold text-white hover:opacity-90">Attendance</a>
                  <a href={`/dashboard/grades?class=${cls.id}`} className="flex-1 rounded-xl bg-[#edf4ff] py-2 text-center text-xs font-bold text-[#17325f] hover:bg-[#dce8f5]">Grades</a>
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

      {/* Section 3: PENDING ACTIONS */}
      {stats?.presentToday === 0 && myClasses.length > 0 && (
        <div className="rounded-[20px] bg-[#ffefe8] border border-[#f5d0c5] p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#c2472b] text-2xl">how_to_reg</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#17325f]">Mark attendance</p>
            <p className="text-xs text-[#6b7f99]">Not yet taken for today</p>
          </div>
          <a href="/dashboard/attendance" className="shrink-0 rounded-xl bg-[#c2472b] px-4 py-2 text-xs font-bold text-white">Take now</a>
        </div>
      )}
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
