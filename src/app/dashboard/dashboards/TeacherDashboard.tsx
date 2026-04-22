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
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  buildDefaultClasses,
  buildDefaultTimetableSlots,
  type SchoolSetupType,
} from "@/lib/school-setup";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";

import StatCard from "@/components/dashboard/StatCard";

function TeacherDashboardContent() {
  const router = useRouter();
  const toast = useToast();
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { stats } = useDashboardStats(school?.id);
  const [settingUp, setSettingUp] = useState(false);

  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12
      ? "Good Morning"
      : currentDate.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

  const myClasses = classes.slice(0, 6);
  const mySubjects = subjects.slice(0, 6);
  const needsSetup = classes.length === 0 || subjects.length === 0;
  const attendanceRate =
    stats?.totalStudents > 0
      ? Math.round((stats.presentToday / stats.totalStudents) * 100)
      : 0;
  const todayLabel = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

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
      await supabase
        .from("classes")
        .upsert(defaultClasses, { onConflict: "school_id,name,academic_year" });

      const defaultSubjects = [
        {
          school_id: school.id,
          name: "English",
          code: "ENG",
          level: "primary",
        },
        {
          school_id: school.id,
          name: "Mathematics",
          code: "MTC",
          level: "primary",
        },
        {
          school_id: school.id,
          name: "Science",
          code: "SCI",
          level: "primary",
        },
        {
          school_id: school.id,
          name: "Social Studies",
          code: "SST",
          level: "primary",
        },
        {
          school_id: school.id,
          name: "Religious Education",
          code: "CRE",
          level: "primary",
        },
        {
          school_id: school.id,
          name: "Physical Education",
          code: "PE",
          level: "primary",
        },
      ];
      await supabase.from("subjects").insert(defaultSubjects);

      await supabase.from("academic_years").insert({
        school_id: school.id,
        name: currentYear,
        start_date: `${currentYear}-01-01`,
        end_date: `${currentYear}-12-31`,
        is_current: true,
      });

      const { count: slotCount } = await supabase
        .from("timetable_slots")
        .select("id", { count: "exact", head: true })
        .eq("school_id", school.id);

      if (!slotCount) {
        await supabase
          .from("timetable_slots")
          .insert(buildDefaultTimetableSlots(school.id));
      }

      toast?.success("School setup complete!");
      router.refresh();
    } catch (err) {
      toast?.error("Setup failed. Please try again.");
    } finally {
      setSettingUp(false);
    }
  };

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
        <div className="rounded-xl border border-[var(--amber)] bg-[var(--amber-soft)] p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <MaterialIcon icon="warning" className="text-[var(--amber)]" style={{ fontSize: 20 }} />
            <div className="text-sm font-bold text-[var(--t1)]">Setup Required</div>
          </div>
          <p className="text-xs text-[var(--t2)] mb-3">
            Your school needs initial classes and subjects. Click below to set up automatically.
          </p>
          <button onClick={runSetup} disabled={settingUp} className="btn btn-primary text-xs">
            {settingUp ? "Setting up..." : "Run Setup"}
          </button>
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
