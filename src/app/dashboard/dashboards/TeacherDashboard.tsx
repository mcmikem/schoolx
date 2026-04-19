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
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="font-['Sora'] text-xl sm:text-2xl font-bold text-[var(--t1)] tracking-tight">
          {greeting}, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="text-[13px] text-[var(--t3)] mt-1">
          Teacher · {school?.name} · Term {currentTerm}
        </p>
      </div>

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

      {/* Key numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard label="My Classes" value={myClasses.length} subValue={`${students.length} students`} icon="school" accentColor="navy" />
        <StatCard label="Attendance" value={`${attendanceRate}%`} subValue={`${stats?.presentToday || 0} present`} icon="how_to_reg" accentColor="green" />
        <StatCard label="Subjects" value={mySubjects.length} subValue="Teaching" icon="menu_book" accentColor="amber" />
      </div>

      {/* Quick actions — single set, no duplicates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/dashboard/attendance" className="qa-large">
          <div className="qa-large-icon" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
            <MaterialIcon icon="how_to_reg" style={{ fontSize: 22 }} />
          </div>
          <span className="qa-large-label">Take Attendance</span>
        </Link>
        <Link href="/dashboard/grades" className="qa-large">
          <div className="qa-large-icon" style={{ background: "var(--navy-soft)", color: "var(--navy)" }}>
            <MaterialIcon icon="edit_note" style={{ fontSize: 22 }} />
          </div>
          <span className="qa-large-label">Enter Grades</span>
        </Link>
        <Link href="/dashboard/homework" className="qa-large">
          <div className="qa-large-icon" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
            <MaterialIcon icon="assignment_add" style={{ fontSize: 22 }} />
          </div>
          <span className="qa-large-label">Add Homework</span>
        </Link>
        <Link href="/dashboard/lesson-plans" className="qa-large">
          <div className="qa-large-icon" style={{ background: "var(--navy-soft)", color: "var(--navy)" }}>
            <MaterialIcon icon="event_note" style={{ fontSize: 22 }} />
          </div>
          <span className="qa-large-label">Lesson Plans</span>
        </Link>
      </div>

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
