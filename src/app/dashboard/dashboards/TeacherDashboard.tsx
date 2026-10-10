"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import OwlMascot from "@/components/brand/OwlMascot";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import SchoolHero from "@/components/dashboard/SchoolHero";
import TaskManager from "@/components/dashboard/TaskManager";
import ErrorBoundary from "@/components/ErrorBoundary";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { StuckLoadingOverlay, TopLoadingBar } from "@/components/ui/Skeleton";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { getDefaultSubjects } from "@/lib/curriculum";
import { useAllStudents, useClasses, useDashboardStats, useSubjects } from "@/lib/hooks";
import { getLocalDateString, withTimeout } from "@/lib/hooks/utils";
import { isClassScopedRole } from "@/lib/roles";
import { buildDefaultClasses, buildDefaultTimetableSlots, type SchoolSetupType } from "@/lib/school-setup";
import { supabase } from "@/lib/supabase";
import { greetingFor, todayLabelFor } from "@/lib/utils";

interface TodaySlot {
  id: string;
  period_number: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  classes?: { name?: string | null } | null;
  subjects?: { name?: string | null } | null;
}

export function TeacherDashboardContent() {
  const router = useRouter();
  const toast = useToast();
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  // The whole roster, not `useStudents`' first 100 rows: per-class counts off a
  // capped page stop rising at 100 and start reporting healthy classes as empty.
  const { students, ready: rosterReady } = useAllStudents(school?.id);
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const { subjects, loading: subjectsLoading } = useSubjects(school?.id);
  const { stats, loading: statsLoading } = useDashboardStats(school?.id, { term: currentTerm, academicYear });
  const [settingUp, setSettingUp] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  // Distinct class_ids with at least one attendance row today. RLS scopes the
  // rows to this teacher's classes. null = still checking (or check failed).
  const [markedClassIds, setMarkedClassIds] = useState<Set<string> | null>(null);
  const [todaySlots, setTodaySlots] = useState<TodaySlot[] | null>(null);
  const dataLoading = !rosterReady || classesLoading || subjectsLoading || statsLoading;

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

  useEffect(() => {
    if (dataLoading || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await withTimeout(
          supabase
            .from("attendance")
            .select("class_id")
            .eq("date", getLocalDateString())
            .then((r) => {
              if (r.error) throw r.error;
              return (r.data || []) as { class_id: string | null }[];
            }),
          15000,
          null,
        );
        if (cancelled || rows == null) return;
        setMarkedClassIds(new Set(rows.map((r) => r.class_id).filter(Boolean) as string[]));
      } catch {
        // Keep markedClassIds null: the card shows "Checking…" rather than lying.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataLoading, user?.id]);

  useEffect(() => {
    if (dataLoading || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const slots = await withTimeout(
          supabase
            .from("teacher_timetable")
            .select("id, period_number, start_time, end_time, room, classes(name), subjects(name)")
            .eq("teacher_id", user.id)
            .eq("day_of_week", new Date().getDay())
            .order("period_number")
            .then((r) => {
              if (r.error) throw r.error;
              return (r.data || []) as TodaySlot[];
            }),
          15000,
          null,
        );
        if (!cancelled && slots != null) setTodaySlots(slots);
      } catch {
        if (!cancelled) setTodaySlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataLoading, user?.id]);

  const currentDate = new Date();
  const greeting = greetingFor(currentDate);

  const myClasses = classes;
  const mySubjects = subjects;
  const needsSetup = classes.length === 0 || subjects.length === 0;
  // Attendance is marked for enrolled students only, so the rate divides by the
  // active head count — `totalStudents` now counts the whole roster.
  const attendanceBase = stats?.activeStudents ? stats.activeStudents : stats?.totalStudents || 0;
  const attendanceRate = useMemo(
    () => (stats?.presentToday > 0 && attendanceBase > 0 ? Math.round((stats.presentToday / attendanceBase) * 100) : 0),
    [attendanceBase, stats?.presentToday],
  );
  const todayLabel = todayLabelFor(currentDate);
  const classesWithNoStudents = myClasses.filter(
    (cls) => students.filter((s) => s.class_id === cls.id).length === 0,
  ).length;
  const markedCount = markedClassIds ? myClasses.filter((cls) => markedClassIds.has(cls.id)).length : null;
  const allClassesMarked = markedCount !== null && myClasses.length > 0 && markedCount === myClasses.length;
  // Per-class truth: pending until every assigned class has a register for
  // today. Falls back to the school-wide presentToday count when the per-class
  // check hasn't resolved (slow network / offline).
  const attendancePending =
    !statsLoading && myClasses.length > 0 && (markedCount === null ? stats?.presentToday === 0 : !allClassesMarked);

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
      label: "Add class test",
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
        label: isClassScopedRole(user?.role)
          ? `${classesWithNoStudents} class${classesWithNoStudents > 1 ? "es" : ""} need a student roster — ask your school administrator`
          : `${classesWithNoStudents} class${classesWithNoStudents > 1 ? "es" : ""} with no students assigned`,
        icon: "warning",
        priority: "attention" as const,
        href: "/dashboard/students",
        cta: isClassScopedRole(user?.role) ? "View roster" : "Assign",
      });
    }
    if (needsSetup && !isClassScopedRole(user?.role)) {
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
  }, [attendancePending, classesWithNoStudents, needsSetup, user?.role]);

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

  // RLS scopes this teacher's classes to the ones they lead or teach a subject
  // in, so an empty list means "no assignments yet" — not "the school has no
  // classes". Show an honest waiting screen instead of a dashboard full of
  // zeros that looks broken.
  if (!dataLoading && isClassScopedRole(user?.role) && myClasses.length === 0) {
    return (
      <div className="content overflow-x-hidden">
        <SchoolHero
          school={school}
          greeting={greeting}
          userName={user?.full_name?.split(" ")[0] || ""}
          dateLabel={todayLabel}
          bottomCenter={
            <div className="text-xs text-[var(--t2)]">
              <span className="font-semibold">{school?.name}</span> · Term {currentTerm} · {academicYear}
            </div>
          }
        />
        <div className="rounded-2xl border border-[var(--surface-container-low)] bg-white p-6 text-center">
          <OwlMascot size={64} premium ring glow animated />
          <h2 className="mt-4 text-lg font-bold text-[var(--t1)] font-['Sora']">No classes assigned yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--t3)]">
            Your school administrator hasn&apos;t assigned you to a class or subject. Contact them to request your
            teaching assignments; your classes, students, attendance and marks will appear here once assigned.
          </p>
        </div>
        <div className="mt-5">
          <SchoolCalendar schoolId={school?.id} userId={user?.id} />
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

      {isClassScopedRole(user?.role) && needsSetup && myClasses.length > 0 && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Your teaching subjects are not assigned yet. Ask your school administrator to complete your class and subject
          setup.
        </div>
      )}

      {/* ── My Day Summary ── */}
      {stats && (
        <section aria-label="Today status" className="mb-5 grid grid-cols-2 gap-3">
          <div
            className={`rounded-2xl border p-4 ${
              allClassesMarked
                ? "border-[var(--green-soft)] bg-[var(--green-soft)]"
                : markedCount !== null && markedCount > 0
                  ? "border-amber-200 bg-amber-50"
                  : "border-[var(--red-soft)] bg-[var(--red-soft)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <MaterialIcon
                icon={allClassesMarked ? "check_circle" : "how_to_reg"}
                className={`text-lg ${allClassesMarked ? "text-[var(--green)]" : markedCount !== null && markedCount > 0 ? "text-amber-600" : "text-[var(--red)]"}`}
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--t3)]">Attendance</span>
            </div>
            <p
              className={`mt-1 text-lg font-bold ${allClassesMarked ? "text-[var(--green)]" : markedCount !== null && markedCount > 0 ? "text-amber-700" : "text-[var(--red)]"}`}
            >
              {markedCount === null
                ? "Checking…"
                : allClassesMarked
                  ? "Done"
                  : markedCount === 0
                    ? "Pending"
                    : `${markedCount} of ${myClasses.length} marked`}
            </p>
            <p className="text-[10px] text-[var(--t3)] mt-0.5">
              {markedCount === null
                ? "Checking registers…"
                : allClassesMarked
                  ? stats.presentToday > 0
                    ? `${stats.presentToday} present today`
                    : "Marked for all classes"
                  : markedCount === 0
                    ? "Not taken yet"
                    : "Finish marking the rest"}
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
        </section>
      )}

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Left Column ── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Quick actions */}
          <div>
            <div
              aria-label="Teacher quick actions"
              className="rounded-[24px] border border-[var(--surface-container-low)] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--t1)]/10">
                    <MaterialIcon icon="today" className="text-sm text-[var(--t1)]" />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--t1)] font-['Sora']">Quick actions</h2>
                </div>
                <span className="rounded-full bg-[var(--primary-50)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--t1)]">
                  Today
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {todayActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex min-h-[72px] flex-col justify-between gap-2 rounded-2xl border border-[var(--surface-container-low)] bg-[var(--surface-bright)] p-3 transition-all hover:border-[var(--border)] hover:bg-[var(--primary-50)] hover:shadow-sm active:scale-[0.98]"
                  >
                    <span className={`material-symbols-outlined text-xl ${action.tone}`}>{action.icon}</span>
                    <span className="text-[11px] font-bold leading-tight text-[var(--t1)]">{action.label}</span>
                  </Link>
                ))}
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
                <h2 className="text-sm font-bold text-[var(--t1)] font-['Sora']">My classes</h2>
              </div>
              <div className="-mx-1 overflow-x-auto pb-1">
                <div className="flex min-w-max gap-3 px-1">
                  {myClasses.map((cls: any) => {
                    const count = students.filter((s) => s.class_id === cls.id).length;
                    return (
                      <div
                        key={cls.id}
                        className="group min-w-[220px] flex-1 rounded-[22px] bg-white border border-[var(--surface-container-low)] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition-all hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-base font-bold text-[var(--t1)]">{cls.name}</p>
                          <span className="rounded-full bg-[var(--primary-50)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--t1)]">
                            {count} {count === 1 ? "student" : "students"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-[var(--t3)]">
                          {count === 0 ? "No students assigned yet" : "Ready for teaching"}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <Link
                            href={`/dashboard/attendance?class=${cls.id}`}
                            className="flex-1 rounded-xl bg-[var(--t1)] py-2.5 text-center text-[10px] font-bold text-white hover:opacity-90 transition-opacity"
                          >
                            Attendance
                          </Link>
                          <Link
                            href={`/dashboard/grades?class=${cls.id}`}
                            className="flex-1 rounded-xl bg-[var(--primary-50)] py-2.5 text-center text-[10px] font-bold text-[var(--t1)] hover:bg-[var(--border)] transition-colors"
                          >
                            Grades
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                  <p className="text-[11px] text-[var(--t3)]">{todayLabel}</p>
                </div>
              </div>
              <Link
                href="/dashboard/timetable"
                className="rounded-xl bg-[var(--t1)] px-4 py-2 text-[11px] font-bold text-white hover:opacity-90 transition-opacity"
              >
                Open timetable
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {todaySlots === null ? (
                <div className="h-10 w-full animate-pulse rounded-xl bg-[var(--surface-container-low)]" />
              ) : todaySlots.length === 0 ? (
                <p className="py-2 text-xs text-[var(--t3)]">No lessons scheduled for today.</p>
              ) : (
                todaySlots.map((slot) => {
                  const now = new Date();
                  const minutes = now.getHours() * 60 + now.getMinutes();
                  const starts = slot.start_time
                    ? Number(slot.start_time.slice(0, 2)) * 60 + Number(slot.start_time.slice(3, 5))
                    : null;
                  const ends = slot.end_time
                    ? Number(slot.end_time.slice(0, 2)) * 60 + Number(slot.end_time.slice(3, 5))
                    : null;
                  const isNow = starts !== null && ends !== null && minutes >= starts && minutes < ends;
                  return (
                    <div
                      key={slot.id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-xs ${
                        isNow
                          ? "border-[var(--t1)] bg-[var(--primary-50)]"
                          : "border-[var(--surface-container-low)] bg-[var(--surface-bright)]"
                      }`}
                    >
                      <span className="w-6 shrink-0 text-center font-bold text-[var(--t2)]">
                        {slot.period_number ?? "–"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--t1)]">
                          {slot.classes?.name || "Class"}
                          {slot.subjects?.name ? ` · ${slot.subjects.name}` : ""}
                        </p>
                        <p className="text-[10px] text-[var(--t3)]">
                          {slot.start_time && slot.end_time ? `${slot.start_time}–${slot.end_time}` : ""}
                          {slot.room ? ` · ${slot.room}` : ""}
                        </p>
                      </div>
                      {isNow && (
                        <span className="shrink-0 rounded-full bg-[var(--t1)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                          Now
                        </span>
                      )}
                    </div>
                  );
                })
              )}
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
