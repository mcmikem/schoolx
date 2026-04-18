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
  useFeePayments,
  useFeeStructure,
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
import { StatsGridSkeleton } from "@/components/Skeletons";

import StatCard from "@/components/dashboard/StatCard";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import EcosystemPulse from "@/components/dashboard/EcosystemPulse";
import ActionCenter from "@/components/dashboard/ActionCenter";
import SmartAdvisor from "@/components/dashboard/SmartAdvisor";

function TeacherDashboardContent() {
  const router = useRouter();
  const toast = useToast();
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { stats } = useDashboardStats(school?.id);
  const { payments } = useFeePayments(school?.id);
  const { feeStructure } = useFeeStructure(school?.id);
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
  const totalFeesExpected = students.reduce((total, student) => {
    const classFees = feeStructure.filter(
      (fee) => !fee.class_id || fee.class_id === student.class_id,
    );
    return (
      total +
      classFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
    );
  }, 0);
  const totalFeesCollected = payments.reduce(
    (sum, payment) => sum + Number(payment.amount_paid || 0),
    0,
  );
  const collectionRate =
    totalFeesExpected > 0
      ? Math.round((totalFeesCollected / totalFeesExpected) * 100)
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
      <div className="relative overflow-hidden rounded-[var(--r2)] p-6 bg-motif border border-[var(--border)] mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="ph-title truncate !text-3xl">
              {greeting}, {user?.full_name?.split(" ")[0]}
            </div>
            <div className="ph-sub truncate !text-sm">
              Teacher · {school?.name} • Term {currentTerm}
            </div>
          </div>
          <div className="ph-actions">
            <Link
              href="/dashboard/timetable"
              className="btn btn-ghost shadow-sm"
            >
              <MaterialIcon
                icon="calendar_month"
                style={{ fontSize: "16px" }}
              />
              <span>My Schedule</span>
            </Link>
            <Link
              href="/dashboard/grades"
              className="btn btn-primary shadow-md"
            >
              <MaterialIcon icon="add" style={{ fontSize: "16px" }} />
              <span>Quick Entry</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="dashboard-toolbar mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)] mb-1">Teaching focus</div>
            <div className="text-lg font-bold text-[var(--t1)]">A clearer start-of-day workspace for attendance, grades, homework, and planning</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="dashboard-pill bg-emerald-50 text-emerald-700">{myClasses.length} classes</span>
            <span className="dashboard-pill bg-blue-50 text-blue-700">{students.length} learners</span>
            <span className="dashboard-pill bg-amber-50 text-amber-700">{mySubjects.length} subjects</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar - Top priority for teachers on mobile */}
      <div className="quick-actions-bar !mb-8">
        <Link href="/dashboard/attendance" className="qa-large">
          <div
            className="qa-large-icon"
            style={{ background: "var(--green-soft)", color: "var(--green)" }}
          >
            <MaterialIcon icon="how_to_reg" style={{ fontSize: "24px" }} />
          </div>
          <span className="qa-large-label">Take Attendance</span>
        </Link>
        <Link href="/dashboard/grades" className="qa-large">
          <div
            className="qa-large-icon"
            style={{ background: "var(--navy-soft)", color: "var(--navy)" }}
          >
            <MaterialIcon icon="edit_note" style={{ fontSize: "24px" }} />
          </div>
          <span className="qa-large-label">Enter Grades</span>
        </Link>
        <Link href="/dashboard/homework" className="qa-large">
          <div
            className="qa-large-icon"
            style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
          >
            <MaterialIcon icon="assignment_add" style={{ fontSize: "24px" }} />
          </div>
          <span className="qa-large-label">Add Homework</span>
        </Link>
        <Link href="/dashboard/lesson-plans" className="qa-large">
          <div
            className="qa-large-icon"
            style={{ background: "rgba(37,99,235,0.1)", color: "#2563eb" }}
          >
            <MaterialIcon icon="event_note" style={{ fontSize: "24px" }} />
          </div>
          <span className="qa-large-label">Lesson Plans</span>
        </Link>
      </div>

      <SmartAdvisor
        stats={stats || {}}
        attendanceRate={attendanceRate}
        collectionRate={collectionRate}
        role="teacher"
      />

      {/* Analytics Section - hidden on mobile */}
      <div className="hidden xl:block grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8 mt-8">
        <div className="xl:col-span-3">
          <DashboardInsights
            stats={stats || {}}
            attendanceRate={attendanceRate}
            collectionRate={collectionRate}
            students={students}
            payments={payments}
            isDemo={isDemo}
          />
        </div>
        <div className="xl:col-span-1">
          <EcosystemPulse payments={payments} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 !mb-8">
        <StatCard
          label="My Classes"
          value={myClasses.length}
          subValue="Classes assigned"
          icon="school"
          accentColor="amber"
          variant="premium-teal"
        />
        <StatCard
          label="Total Students"
          value={students.length}
          subValue="In my classes"
          icon="group"
          accentColor="navy"
          variant="premium-navy"
        />
        <StatCard
          label="My Subjects"
          value={mySubjects.length}
          subValue="Subjects teaching"
          icon="menu_book"
          accentColor="navy"
        />
      </div>

      {needsSetup && (
        <div className="card !bg-amber-soft/50 border-amber/30 p-5 mt-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon icon="warning" className="text-amber text-2xl" />
            <div>
              <div className="text-sm font-bold text-on-surface">
                Setup Required
              </div>
              <div className="text-[11px] text-on-surface-variant font-medium">
                Your school needs initial setup
              </div>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
            It looks like your school doesn&apos;t have classes or subjects yet.
            Click below to set up automatically.
          </p>
          <button
            onClick={runSetup}
            disabled={settingUp}
            className="btn btn-primary !bg-amber border-none shadow-lg shadow-amber/20"
          >
            {settingUp ? "Setting up..." : "Run Setup"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-6">
        <Link
          href="/dashboard/attendance"
          className="qa-item !flex-row !justify-start !p-4"
        >
          <div
            className="qa-icon !mb-0 !mr-3"
            style={{
              background: "var(--navy-soft)",
              borderColor: "rgba(23,50,95,0.1)",
              color: "var(--navy)",
            }}
          >
            <MaterialIcon icon="how_to_reg" style={{ fontSize: 20 }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--t1)] truncate">
              Attendance
            </div>
            <div className="text-[10px] text-[var(--t3)] font-medium truncate">
              Daily register
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/grades"
          className="qa-item !flex-row !justify-start !p-4"
        >
          <div
            className="qa-icon !mb-0 !mr-3"
            style={{
              background: "var(--green-soft)",
              borderColor: "rgba(46,148,72,0.1)",
              color: "var(--green)",
            }}
          >
            <MaterialIcon icon="edit_note" style={{ fontSize: 20 }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--t1)] truncate">
              Enter Grades
            </div>
            <div className="text-[10px] text-[var(--t3)] font-medium truncate">
              Marks entry
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/homework"
          className="qa-item !flex-row !justify-start !p-4"
        >
          <div
            className="qa-icon !mb-0 !mr-3"
            style={{
              background: "var(--green-soft)",
              borderColor: "rgba(46,148,72,0.1)",
              color: "var(--green)",
            }}
          >
            <MaterialIcon icon="assignment_add" style={{ fontSize: 20 }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--t1)] truncate">
              Homework
            </div>
            <div className="text-[10px] text-[var(--t3)] font-medium truncate">
              Assign task
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/lesson-plans"
          className="qa-item !flex-row !justify-start !p-4"
        >
          <div
            className="qa-icon !mb-0 !mr-3"
            style={{
              background: "var(--amber-soft)",
              borderColor: "rgba(184,107,12,0.1)",
              color: "var(--amber)",
            }}
          >
            <MaterialIcon icon="event_note" style={{ fontSize: 20 }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--t1)] truncate">
              Lesson Plans
            </div>
            <div className="text-[10px] text-[var(--t3)] font-medium truncate">
              Plan teaching
            </div>
          </div>
        </Link>
      </div>

      <div className="main-grid">
        <div className="main-col">
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
                  const count = students.filter(
                    (s) => s.class_id === cls.id,
                  ).length;
                  return (
                    <Link
                      key={cls.id}
                      href={`/dashboard/grades?class=${cls.id}`}
                      className="qa-item !py-3"
                    >
                      <MaterialIcon icon="school" className="text-amber mb-1" />
                      <div className="text-[12px] font-bold text-[var(--t1)] truncate w-full">
                        {cls.name}
                      </div>
                      <div className="text-[10px] text-[var(--t3)] font-medium">
                        {count} students
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="main-col lg:col-span-4">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">My Subjects</div>
                <div className="card-sub">{mySubjects.length} subjects</div>
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                {mySubjects.map((subject: any) => (
                  <Link
                    key={subject.id}
                    href={`/dashboard/grades?subject=${subject.id}`}
                    className="qa-item !flex-row !justify-start !p-3"
                  >
                    <MaterialIcon
                      icon="menu_book"
                      className="text-green mr-3"
                    />
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-[var(--t1)] truncate">
                        {subject.name}
                      </div>
                      <div className="text-[10px] text-[var(--t3)] font-medium uppercase tracking-wider">
                        {subject.code}
                      </div>
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
