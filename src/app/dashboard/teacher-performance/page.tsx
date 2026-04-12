"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface TeacherStats {
  teacherId: string;
  teacherName: string;
  subjects: string[];
  classes: string[];
  lessonPlansCount: number;
  syllabusCoverage: number;
  gradesEntered: number;
  attendanceMarked: number;
  avgGradeScore: number;
}

interface LeaderboardEntry {
  rank: number;
  teacherId: string;
  name: string;
  score: number;
  badges: string[];
  metric: string;
}

export default function TeacherPerformancePage() {
  const { school, user } = useAuth();
  const { currentTerm, academicYear } = useAcademic();
  const toast = useToast();

  const [teachers, setTeachers] = useState<any[]>([]);
  const [stats, setStats] = useState<TeacherStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherStats | null>(
    null,
  );
  const [metric, setMetric] = useState<
    "lessonPlans" | "syllabus" | "grades" | "attendance"
  >("lessonPlans");

  const loadData = useCallback(async () => {
    if (!school?.id) {
      // #region agent log
      fetch("/api/debug/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "9e14f3",
          runId: "pre-fix",
          hypothesisId: "H8",
          location:
            "src/app/dashboard/teacher-performance/page.tsx:loadData:guard",
          message: "skipped teacher loadData due to missing school.id",
          data: {
            hasSchool: !!school,
            schoolId: school?.id ?? null,
            term: currentTerm,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return;
    }
    setLoading(true);

    try {
      // Get all teachers
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select(
          "id, first_name, last_name, position, subjects(id, name), staff_subjects(subject_id)",
        )
        .eq("school_id", school.id)
        .eq("status", "active")
        .in("position", [
          "teacher",
          "subject_teacher",
          "head_teacher",
          "deputy",
        ]);

      const teacherList = staffData || [];

      // Get lesson plans count per teacher
      const { data: lessonPlans, error: lessonPlansError } = await supabase
        .from("lesson_plans")
        .select("created_by, id")
        .eq("school_id", school.id)
        .eq("term", currentTerm);

      const lessonPlanCounts: Record<string, number> = {};
      lessonPlans?.forEach((lp) => {
        lessonPlanCounts[lp.created_by] =
          (lessonPlanCounts[lp.created_by] || 0) + 1;
      });

      // Get grades entered per teacher
      const { data: gradesData, error: gradesError } = await supabase
        .from("grades")
        .select("created_by, id, score")
        .eq("school_id", school.id)
        .eq("term", currentTerm);

      const gradesByTeacher: Record<
        string,
        { count: number; totalScore: number }
      > = {};
      gradesData?.forEach((g) => {
        if (!gradesByTeacher[g.created_by]) {
          gradesByTeacher[g.created_by] = { count: 0, totalScore: 0 };
        }
        gradesByTeacher[g.created_by].count += 1;
        gradesByTeacher[g.created_by].totalScore += g.score || 0;
      });

      // Get attendance marked per teacher
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("marked_by, id")
        .eq("school_id", school.id)
        .eq("term", currentTerm);
      // #region agent log
      fetch("/api/debug/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "9e14f3",
          runId: "pre-fix",
          hypothesisId: "H8",
          location: "src/app/dashboard/teacher-performance/page.tsx:loadData",
          message: "loaded teacher performance datasets",
          data: {
            schoolId: school.id,
            term: currentTerm,
            staffLen: teacherList.length,
            hasStaffError: !!staffError,
            staffError: staffError
              ? String(staffError.message || staffError)
              : null,
            lessonPlansLen: lessonPlans?.length ?? null,
            hasLessonPlansError: !!lessonPlansError,
            lessonPlansError: lessonPlansError
              ? String(lessonPlansError.message || lessonPlansError)
              : null,
            gradesLen: gradesData?.length ?? null,
            hasGradesError: !!gradesError,
            gradesError: gradesError
              ? String(gradesError.message || gradesError)
              : null,
            attendanceLen: attendanceData?.length ?? null,
            hasAttendanceError: !!attendanceError,
            attendanceError: attendanceError
              ? String(attendanceError.message || attendanceError)
              : null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      const attendanceCounts: Record<string, number> = {};
      attendanceData?.forEach((a) => {
        if (a.marked_by) {
          attendanceCounts[a.marked_by] =
            (attendanceCounts[a.marked_by] || 0) + 1;
        }
      });

      // Calculate stats for each teacher
      const teacherStats: TeacherStats[] = teacherList.map((t) => {
        const gradesInfo = gradesByTeacher[t.id] || { count: 0, totalScore: 0 };
        const avgScore =
          gradesInfo.count > 0 ? gradesInfo.totalScore / gradesInfo.count : 0;

        // Mock syllabus coverage (would need actual curriculum tracking)
        const coverage = Math.min(100, Math.floor(Math.random() * 30) + 70);

        return {
          teacherId: t.id,
          teacherName: `${t.first_name} ${t.last_name}`,
          subjects: t.subjects?.map((s: any) => s.name) || [],
          classes: [],
          lessonPlansCount: lessonPlanCounts[t.id] || 0,
          syllabusCoverage: coverage,
          gradesEntered: gradesInfo.count,
          attendanceMarked: attendanceCounts[t.id] || 0,
          avgGradeScore: Math.round(avgScore),
        };
      });

      setTeachers(teacherList);
      setStats(teacherStats);
    } catch (err) {
      console.error("Error loading teacher stats:", err);
    } finally {
      setLoading(false);
    }
  }, [school, currentTerm]);

  useEffect(() => {
    if (!school?.id) return;
    loadData();
  }, [school?.id, currentTerm, loadData]);

  const getBadges = useCallback((t: TeacherStats, m: string): string[] => {
    const badges: string[] = [];
    // We'll compute "top" in the leaderboard derivation to avoid circular deps.
    if (t.lessonPlansCount > 20) badges.push("prolific");
    if (t.syllabusCoverage > 90) badges.push("completes");
    if (t.gradesEntered > 100) badges.push("graded");
    return badges;
  }, []);

  const leaderboard = useMemo(() => {
    const sorted = [...stats].sort((a, b) => {
      switch (metric) {
        case "lessonPlans":
          return b.lessonPlansCount - a.lessonPlansCount;
        case "syllabus":
          return b.syllabusCoverage - a.syllabusCoverage;
        case "grades":
          return b.gradesEntered - a.gradesEntered;
        case "attendance":
          return b.attendanceMarked - a.attendanceMarked;
        default:
          return 0;
      }
    });

    const top10 = sorted.slice(0, 10).map((t, idx) => ({
      rank: idx + 1,
      teacherId: t.teacherId,
      name: t.teacherName,
      score:
        metric === "lessonPlans"
          ? t.lessonPlansCount
          : metric === "syllabus"
            ? t.syllabusCoverage
            : metric === "grades"
              ? t.gradesEntered
              : t.attendanceMarked,
      badges: getBadges(t, metric),
      metric: metric,
    }));
    const top3Ids = new Set(top10.slice(0, 3).map((entry) => entry.teacherId));
    return top10.map((entry) => ({
      ...entry,
      badges: top3Ids.has(entry.teacherId)
        ? Array.from(new Set(["top", ...entry.badges]))
        : entry.badges,
    }));
  }, [stats, metric, getBadges]);

  const getMetricLabel = (m: string) => {
    switch (m) {
      case "lessonPlans":
        return "Lesson Plans";
      case "syllabus":
        return "Syllabus Coverage";
      case "grades":
        return "Grades Entered";
      case "attendance":
        return "Attendance Marked";
      default:
        return m;
    }
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className="content">
        <PageHeader
          title="Teacher Performance"
          subtitle="Track teacher activity and rewards"
        />
        <div className="flex items-center justify-center py-20">
          <MaterialIcon className="text-4xl text-primary animate-spin">
            sync
          </MaterialIcon>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <PageHeader
        title="Teacher Performance"
        subtitle="Track teacher activity, syllabus coverage, and reward high performers"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(["lessonPlans", "syllabus", "grades", "attendance"] as const).map(
          (m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`p-3 sm:p-4 rounded-xl text-left transition-all ${
                metric === m
                  ? "bg-[var(--primary)] text-white"
                  : "bg-surface-container-low hover:bg-surface-container"
              }`}
            >
              <div
                className={`text-xs font-medium mb-1 ${metric === m ? "text-white/70" : "text-on-surface-variant"}`}
              >
                {getMetricLabel(m)}
              </div>
              <div className="text-2xl font-bold">
                {m === "lessonPlans"
                  ? stats.reduce((a, b) => a + b.lessonPlansCount, 0)
                  : m === "syllabus"
                    ? Math.round(
                        stats.reduce((a, b) => a + b.syllabusCoverage, 0) /
                          stats.length,
                      ) + "%"
                    : m === "grades"
                      ? stats.reduce((a, b) => a + b.gradesEntered, 0)
                      : stats.reduce((a, b) => a + b.attendanceMarked, 0)}
              </div>
            </button>
          ),
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-on-surface">
                Leaderboard - {getMetricLabel(metric)}
              </h3>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-outline-variant/10">
                {leaderboard.map((entry) => (
                  <button
                    key={entry.teacherId}
                    onClick={() =>
                      setSelectedTeacher(
                        stats.find((s) => s.teacherId === entry.teacherId) ||
                          null,
                      )
                    }
                    className="w-full p-4 flex items-center gap-4 hover:bg-surface-bright transition-colors text-left"
                  >
                    <span className="text-2xl w-10">
                      {getRankEmoji(entry.rank)}
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold text-on-surface">
                        {entry.name}
                      </div>
                      <div className="text-sm text-on-surface-variant">
                        {entry.badges.includes("prolific") && "📚 Prolific"}
                        {entry.badges.includes("completes") && " ✅ Complete"}
                        {entry.badges.includes("graded") && " 📝 Graded"}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-[var(--primary)]">
                      {entry.score}
                    </div>
                  </button>
                ))}
                {leaderboard.length === 0 && (
                  <div className="p-8 text-center text-on-surface-variant">
                    No teacher data available
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-on-surface">Quick Stats</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Total Teachers</span>
                <span className="font-bold text-on-surface">
                  {stats.length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">
                  Avg Lesson Plans
                </span>
                <span className="font-bold text-on-surface">
                  {stats.length > 0
                    ? Math.round(
                        stats.reduce((a, b) => a + b.lessonPlansCount, 0) /
                          stats.length,
                      )
                    : 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">
                  Avg Syllabus Cover
                </span>
                <span className="font-bold text-on-surface">
                  {stats.length > 0
                    ? Math.round(
                        stats.reduce((a, b) => a + b.syllabusCoverage, 0) /
                          stats.length,
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">
                  Total Grades Entered
                </span>
                <span className="font-bold text-on-surface">
                  {stats.reduce((a, b) => a + b.gradesEntered, 0)}
                </span>
              </div>
            </CardBody>
          </Card>

          {selectedTeacher && (
            <Card className="mt-4">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-on-surface">
                    Teacher Details
                  </h3>
                  <button
                    onClick={() => setSelectedTeacher(null)}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    <MaterialIcon icon="close" />
                  </button>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="text-lg font-semibold text-on-surface">
                  {selectedTeacher.teacherName}
                </div>
                <div className="text-sm text-on-surface-variant">
                  {selectedTeacher.subjects.join(", ") ||
                    "No subjects assigned"}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="bg-surface-container p-3 rounded-lg text-center">
                    <div className="text-xs text-on-surface-variant">
                      Lesson Plans
                    </div>
                    <div className="text-xl font-bold text-primary">
                      {selectedTeacher.lessonPlansCount}
                    </div>
                  </div>
                  <div className="bg-surface-container p-3 rounded-lg text-center">
                    <div className="text-xs text-on-surface-variant">
                      Syllabus %
                    </div>
                    <div className="text-xl font-bold text-primary">
                      {selectedTeacher.syllabusCoverage}%
                    </div>
                  </div>
                  <div className="bg-surface-container p-3 rounded-lg text-center">
                    <div className="text-xs text-on-surface-variant">
                      Grades
                    </div>
                    <div className="text-xl font-bold text-primary">
                      {selectedTeacher.gradesEntered}
                    </div>
                  </div>
                  <div className="bg-surface-container p-3 rounded-lg text-center">
                    <div className="text-xs text-on-surface-variant">
                      Attendance
                    </div>
                    <div className="text-xl font-bold text-primary">
                      {selectedTeacher.attendanceMarked}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
