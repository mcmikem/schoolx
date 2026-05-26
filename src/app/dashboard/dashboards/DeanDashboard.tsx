"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useStudents,
  useClasses,
  useSubjects,
  useDashboardStats,
} from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import StatCard from "@/components/dashboard/StatCard";

function DeanDashboardContent() {
  const { school, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { stats, loading: statsLoading } = useDashboardStats(school?.id);

  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12
      ? "Good Morning"
      : currentDate.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

  const attendanceRate =
    stats?.totalStudents > 0
      ? Math.round((stats.presentToday / stats.totalStudents) * 100)
      : 0;

  const getStudentCountForClass = (classId: string) => {
    return students.filter((s) => s.class_id === classId).length;
  };

  if (statsLoading) {
    return (
      <div className="content">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--surface)] rounded w-1/3" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[var(--surface)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const todayLabel = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-[28px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-4 sm:p-6">
        <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-[#b7dfd8]/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-[#d8e9fb]/60 blur-3xl" />

        <div className="relative z-10">
      <section className="relative mb-6 overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(132deg,#f8fbff_0%,#eef6ff_45%,#f8f9ff_100%)] p-4 shadow-[0_24px_62px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-[#bfeadf]/25 blur-3xl" />
          <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-[#d7e5ff]/70 blur-3xl" />
        </div>

        <div className="relative z-10 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.07)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                  Academic operations
                </p>
                <h1 className="mt-2 font-['Sora'] text-3xl font-semibold tracking-[-0.04em] text-[#17325f]">
                  {greeting}, {user?.full_name?.split(" ")[0]}
                </h1>
                <p className="mt-2 text-sm text-[#60748f]">
                  Dean of Academics · {school?.name} · Term {currentTerm}
                </p>
              </div>
              <div className="rounded-full border border-[#d8e4f2] bg-[#f5f9ff] px-3 py-1 text-[11px] font-semibold text-[#516a88]">
                {todayLabel}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard label="Students" value={students.length} subValue={`${classes.length} classes`} icon="group" accentColor="navy" />
              <StatCard label="Attendance" value={`${attendanceRate}%`} subValue={`${stats?.presentToday || 0} present`} icon="how_to_reg" accentColor="green" />
              <StatCard label="Subjects" value={subjects.length} subValue={`Across ${classes.length} classes`} icon="school" accentColor="amber" />
            </div>
          </div>

          <div className="rounded-[28px] border border-[#d8e3f3] bg-[linear-gradient(180deg,#17325f_0%,#25537f_100%)] p-5 text-white shadow-[0_24px_48px_rgba(23,50,95,0.25)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
              Focus today
            </p>
            <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em]">
              Teaching quality
            </h2>
            <div className="mt-5 space-y-3">
              {[
                ["Class readiness", `${classes.length} classes`],
                ["Subject coverage", `${subjects.length} subjects`],
                ["Attendance health", `${attendanceRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-[16px] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Link href="/dashboard/grades" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <MaterialIcon icon="edit_note" className="text-[var(--navy)]" style={{ fontSize: 22 }} />
            <div className="mt-2 text-[12px] font-bold text-[var(--t1)]">Grades</div>
          </Link>
          <Link href="/dashboard/attendance" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <MaterialIcon icon="how_to_reg" className="text-[var(--green)]" style={{ fontSize: 22 }} />
            <div className="mt-2 text-[12px] font-bold text-[var(--t1)]">Attendance</div>
          </Link>
          <Link href="/dashboard/homework" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <MaterialIcon icon="assignment" className="text-[var(--amber)]" style={{ fontSize: 22 }} />
            <div className="mt-2 text-[12px] font-bold text-[var(--t1)]">Homework</div>
          </Link>
          <Link href="/dashboard/lesson-plans" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <MaterialIcon icon="event_note" className="text-[var(--navy)]" style={{ fontSize: 22 }} />
            <div className="mt-2 text-[12px] font-bold text-[var(--t1)]">Lesson Plans</div>
          </Link>
          <Link href="/dashboard/timetable" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <MaterialIcon icon="calendar_month" className="text-[var(--green)]" style={{ fontSize: 22 }} />
            <div className="mt-2 text-[12px] font-bold text-[var(--t1)]">Timetable</div>
          </Link>
          <Link href="/dashboard/uneb" className="rounded-[20px] border border-white/70 bg-white/85 p-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <MaterialIcon icon="workspace_premium" className="text-[var(--amber)]" style={{ fontSize: 22 }} />
            <div className="mt-2 text-[12px] font-bold text-[var(--t1)]">UNEB</div>
          </Link>
        </div>
      </section>

      {/* Pending Tasks */}
      <div className="rounded-[22px] border border-[#e5ecf4] bg-white p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Pending Tasks</p>
            <p className="text-sm font-semibold text-[#17325f]">Items requiring your review</p>
          </div>
          <span className="text-[11px] font-semibold text-[#60748f]">{stats?.presentToday === 0 && classes.length > 0 ? "1 pending" : "All clear"}</span>
        </div>
        <div className="space-y-3">
          {stats?.presentToday === 0 && classes.length > 0 && (
            <div className="rounded-xl border border-[#f5d0c5] bg-[#ffefe8] p-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-[#c2472b] text-xl">how_to_reg</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-[#17325f]">Attendance not taken today</p>
                <p className="text-[11px] text-[#6b7f99]">{classes.length} class{classes.length > 1 ? 'es' : ''} waiting</p>
              </div>
              <Link href="/dashboard/attendance" className="shrink-0 rounded-xl bg-[#c2472b] px-3 py-1.5 text-[11px] font-bold text-white">Review</Link>
            </div>
          )}
          {(!stats || stats.presentToday > 0) && (
            <div className="rounded-xl border border-dashed border-[#d7e3f2] bg-[#f8fbff] p-4 text-center">
              <span className="material-symbols-outlined text-[#7f91aa] text-2xl">task_alt</span>
              <p className="mt-1 text-xs font-semibold text-[#7f91aa]">No pending tasks — everything is up to date</p>
            </div>
          )}
        </div>
      </div>

      {/* Classes */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Classes - {academicYear} Term {currentTerm}</div>
            <div className="card-sub">{classes.length} classes enrolled</div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {classes.map((cls: any) => {
              const count = getStudentCountForClass(cls.id);
              return (
                <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} className="qa-item !bg-[var(--bg)] border-none">
                  <MaterialIcon icon="school" className="text-[var(--navy)] text-2xl mb-1" />
                  <div className="text-[13px] font-bold text-[var(--t1)] truncate w-full">{cls.name}</div>
                  <div className="text-[11px] text-[var(--t3)]">{count} students</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
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
