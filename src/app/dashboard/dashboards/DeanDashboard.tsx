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

  return (
    <div className="content">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="font-['Sora'] text-xl sm:text-2xl font-bold text-[var(--t1)] tracking-tight">
          {greeting}, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="text-[13px] text-[var(--t3)] mt-1">
          Dean of Academics · {school?.name} · Term {currentTerm}
        </p>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard label="Students" value={students.length} subValue={`${classes.length} classes`} icon="group" accentColor="navy" />
        <StatCard label="Attendance" value={`${attendanceRate}%`} subValue={`${stats?.presentToday || 0} present`} icon="how_to_reg" accentColor="green" />
        <StatCard label="Subjects" value={subjects.length} subValue={`Across ${classes.length} classes`} icon="school" accentColor="amber" />
      </div>

      {/* Academic Actions */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        <Link href="/dashboard/grades" className="qa-item">
          <MaterialIcon icon="edit_note" className="text-[var(--navy)]" style={{ fontSize: 22 }} />
          <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Grades</div>
        </Link>
        <Link href="/dashboard/attendance" className="qa-item">
          <MaterialIcon icon="how_to_reg" className="text-[var(--green)]" style={{ fontSize: 22 }} />
          <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Attendance</div>
        </Link>
        <Link href="/dashboard/homework" className="qa-item">
          <MaterialIcon icon="assignment" className="text-[var(--amber)]" style={{ fontSize: 22 }} />
          <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Homework</div>
        </Link>
        <Link href="/dashboard/lesson-plans" className="qa-item">
          <MaterialIcon icon="event_note" className="text-[var(--navy)]" style={{ fontSize: 22 }} />
          <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Lesson Plans</div>
        </Link>
        <Link href="/dashboard/timetable" className="qa-item">
          <MaterialIcon icon="calendar_month" className="text-[var(--green)]" style={{ fontSize: 22 }} />
          <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Timetable</div>
        </Link>
        <Link href="/dashboard/uneb" className="qa-item">
          <MaterialIcon icon="workspace_premium" className="text-[var(--amber)]" style={{ fontSize: 22 }} />
          <div className="text-[12px] font-bold text-[var(--t1)] mt-2">UNEB</div>
        </Link>
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
  );
}

export default function DeanDashboard() {
  return (
    <ErrorBoundary>
      <DeanDashboardContent />
    </ErrorBoundary>
  );
}
