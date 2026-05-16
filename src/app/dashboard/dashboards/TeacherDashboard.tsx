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
  const mySubjects = useMemo(() => subjects, [subjects]);
  const needsSetup = (classes.length === 0 || subjects.length === 0) && user?.role === "school_admin";
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

  const todayDayName = currentDate.toLocaleDateString("en-UG", { weekday: "long" });
  const classesToday = useMemo(() => classes.slice(0, 5), [classes]);

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
        <StuckLoadingOverlay />
      </div>
    );
  }

  return (
    <div className="content">
      <section className="relative mb-6 overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(130deg,#f9fbff_0%,#eff6ff_40%,#f8faff_100%)] p-4 shadow-[0_24px_62px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-2 h-48 w-48 rounded-full bg-[#d8e5ff]/65 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-40 w-40 rounded-full bg-[#c8efe4]/25 blur-3xl" />
        </div>

        <div className="relative z-10 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/80 bg-white/82 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.07)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                  Classroom cockpit
                </p>
                <h1 className="font-['Sora'] mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#17325f]">
                  {greeting}, {user?.full_name?.split(" ")[0]}
                </h1>
                <p className="mt-2 text-sm text-[#60748f]">
                  Teacher · {school?.name} · Term {currentTerm}
                </p>
              </div>
              <div className="rounded-full border border-[#d8e4f2] bg-[#f5f9ff] px-3 py-1 text-[11px] font-semibold text-[#516a88]">
                {todayLabel}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard label="My Classes" value={myClasses.length} subValue={`${students.length} students`} icon="school" accentColor="navy" />
              <StatCard label="Attendance" value={`${attendanceRate}%`} subValue={`${stats?.presentToday || 0} present`} icon="how_to_reg" accentColor="green" />
              <StatCard label="Subjects" value={mySubjects.length} subValue="Teaching" icon="menu_book" accentColor="amber" />
            </div>
          </div>

          <div className="rounded-[28px] border border-[#d8e3f3] bg-[linear-gradient(180deg,#17325f_0%,#25507f_100%)] p-5 text-white shadow-[0_24px_48px_rgba(23,50,95,0.25)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
              Teaching pulse
            </p>
            <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em]">
              Daily flow
            </h2>
            <div className="mt-5 space-y-3">
              {[
                ["Classes", myClasses.length],
                ["Subjects", mySubjects.length],
                ["Live attendance", `${attendanceRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-[16px] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/dashboard/attendance" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--green-soft)] text-[var(--green)]">
              <MaterialIcon icon="how_to_reg" style={{ fontSize: 22 }} />
            </div>
            <span className="mt-2 block text-[12px] font-bold text-[var(--t1)]">Take Attendance</span>
          </Link>
          <Link href="/dashboard/grades" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--navy-soft)] text-[var(--navy)]">
              <MaterialIcon icon="edit_note" style={{ fontSize: 22 }} />
            </div>
            <span className="mt-2 block text-[12px] font-bold text-[var(--t1)]">Enter Grades</span>
          </Link>
          <Link href="/dashboard/homework" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--amber-soft)] text-[var(--amber)]">
              <MaterialIcon icon="assignment_add" style={{ fontSize: 22 }} />
            </div>
            <span className="mt-2 block text-[12px] font-bold text-[var(--t1)]">Add Homework</span>
          </Link>
          <Link href="/dashboard/lesson-plans" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4d5dd1]">
              <MaterialIcon icon="event_note" style={{ fontSize: 22 }} />
            </div>
            <span className="mt-2 block text-[12px] font-bold text-[var(--t1)]">Lesson Plans</span>
          </Link>
        </div>
      </section>

      {needsSetup && (
        <div className="rounded-xl border border-[var(--primary)]/20 bg-[linear-gradient(135deg,var(--primary-50),#f0f7ff)] p-5 mb-6">
          <div className="flex items-start gap-4">
            <OwlMascot size={40} premium ring glow />
            <div className="flex-1">
              <div className="text-sm font-bold text-[var(--t1)]">Let&apos;s get your classroom ready!</div>
              <p className="text-xs text-[var(--t2)] mt-1">
                Your school needs initial classes and subjects set up. This only takes a second.
              </p>
              <button onClick={runSetup} disabled={settingUp} className="mt-3 px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-colors disabled:opacity-50">
                {settingUp ? "Setting up..." : "Quick Setup"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      {classesToday.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon icon="today" className="text-[var(--primary)] text-lg" />
            <h2 className="text-sm font-bold text-[var(--t1)]">Today&apos;s Schedule</h2>
            <span className="text-[11px] text-[var(--t3)]">{todayDayName} · {classesToday.length} classes</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {classesToday.map((cls: any, idx: number) => {
              const count = students.filter((s) => s.class_id === cls.id).length;
              return (
                <Link
                  key={cls.id}
                  href={`/dashboard/attendance?class=${cls.id}`}
                  className={`shrink-0 rounded-xl border p-3 min-w-[140px] transition-colors hover:bg-[var(--surface-container)] ${
                    idx === 0 ? "border-[var(--primary)] bg-[var(--primary-50)]" : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="text-[13px] font-bold text-[var(--t1)]">{cls.name}</div>
                  <div className="text-[11px] text-[var(--t3)] mt-0.5">{count} students</div>
                  {idx === 0 && <div className="text-[10px] font-semibold text-[var(--primary)] mt-1">Next class</div>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Classes & Subjects */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">My Classes</div>
                <div className="card-sub">{myClasses.length} assigned</div>
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-3">
                {myClasses.map((cls: any) => {
                  const count = students.filter((s) => s.class_id === cls.id).length;
                  return (
                    <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} className="qa-item !py-3">
                      <MaterialIcon icon="school" className="text-[var(--amber)] mb-1" />
                      <div className="text-[12px] font-bold text-[var(--t1)] truncate w-full">{cls.name}</div>
                      <div className="text-[10px] text-[var(--t3)]">{count} students</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">My Subjects</div>
                <div className="card-sub">{mySubjects.length} subjects</div>
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 gap-2">
                {mySubjects.map((subject: any) => (
                  <Link key={subject.id} href={`/dashboard/grades?subject=${subject.id}`} className="qa-item !flex-row !justify-start !p-3">
                    <MaterialIcon icon="menu_book" className="text-[var(--green)] mr-3" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-[var(--t1)] truncate">{subject.name}</div>
                      <div className="text-[10px] text-[var(--t3)] uppercase tracking-wider">{subject.code}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
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
