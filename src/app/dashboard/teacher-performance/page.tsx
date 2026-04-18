"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
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
      return;
    }
    setLoading(true);

    try {
      const { data: schoolClasses, error: classError } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", school.id);

      if (classError) throw classError;

      const classIds = (schoolClasses || []).map((entry) => entry.id);

      const { data: teacherUsers, error: staffError } = await supabase
        .from("users")
        .select("id, full_name, role")
        .eq("school_id", school.id)
        .in("role", [
          "teacher",
          "subject_teacher",
          "head_teacher",
          "dean_of_studies",
          "deputy_headteacher",
          "deputy",
        ]);

      if (staffError) throw staffError;

      const teacherList = teacherUsers || [];
      const teacherIds = teacherList.map((teacher) => teacher.id);

      const [
        { data: assignments },
        { data: lessonPlans },
        { data: gradesData },
        { data: attendanceData },
        { data: coverageRows },
      ] = await Promise.all([
        teacherIds.length > 0
          ? supabase
              .from("teacher_subjects")
              .select("teacher_id, subjects(name), classes(name)")
              .in("teacher_id", teacherIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from("lesson_plans")
          .select("teacher_id, id")
          .eq("school_id", school.id)
          .eq("term", currentTerm)
          .eq("academic_year", academicYear),
        classIds.length > 0
          ? supabase
              .from("grades")
              .select("recorded_by, id, score")
              .in("class_id", classIds)
              .eq("term", currentTerm)
              .eq("academic_year", academicYear)
          : Promise.resolve({ data: [] }),
        classIds.length > 0
          ? supabase
              .from("attendance")
              .select("recorded_by, id")
              .in("class_id", classIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from("topic_coverage")
          .select("teacher_id, status, syllabus!inner(school_id, term, academic_year)")
          .eq("syllabus.school_id", school.id)
          .eq("syllabus.term", currentTerm)
          .eq("syllabus.academic_year", academicYear),
      ]);

      const lessonPlanCounts: Record<string, number> = {};
      lessonPlans?.forEach((plan: any) => {
        if (!plan.teacher_id) return;
        lessonPlanCounts[plan.teacher_id] =
          (lessonPlanCounts[plan.teacher_id] || 0) + 1;
      });

      const gradesByTeacher: Record<string, { count: number; totalScore: number }> = {};
      gradesData?.forEach((grade: any) => {
        if (!grade.recorded_by) return;
        if (!gradesByTeacher[grade.recorded_by]) {
          gradesByTeacher[grade.recorded_by] = { count: 0, totalScore: 0 };
        }
        gradesByTeacher[grade.recorded_by].count += 1;
        gradesByTeacher[grade.recorded_by].totalScore += Number(grade.score || 0);
      });

      const attendanceCounts: Record<string, number> = {};
      attendanceData?.forEach((entry: any) => {
        if (!entry.recorded_by) return;
        attendanceCounts[entry.recorded_by] =
          (attendanceCounts[entry.recorded_by] || 0) + 1;
      });

      const syllabusMap: Record<string, { total: number; covered: number }> = {};
      coverageRows?.forEach((row: any) => {
        if (!row.teacher_id) return;
        if (!syllabusMap[row.teacher_id]) {
          syllabusMap[row.teacher_id] = { total: 0, covered: 0 };
        }
        syllabusMap[row.teacher_id].total += 1;
        if (row.status === "completed") {
          syllabusMap[row.teacher_id].covered += 1;
        }
      });

      const assignmentMap = new Map<string, { subjects: string[]; classes: string[] }>();
      (assignments || []).forEach((assignment: any) => {
        const entry = assignmentMap.get(assignment.teacher_id) || {
          subjects: [],
          classes: [],
        };

        const subjectName = assignment.subjects?.name;
        const className = assignment.classes?.name;

        if (subjectName && !entry.subjects.includes(subjectName)) {
          entry.subjects.push(subjectName);
        }
        if (className && !entry.classes.includes(className)) {
          entry.classes.push(className);
        }

        assignmentMap.set(assignment.teacher_id, entry);
      });

      const teacherStats: TeacherStats[] = teacherList.map((teacher: any) => {
        const gradesInfo = gradesByTeacher[teacher.id] || { count: 0, totalScore: 0 };
        const avgScore =
          gradesInfo.count > 0 ? gradesInfo.totalScore / gradesInfo.count : 0;
        const syllabusInfo = syllabusMap[teacher.id];
        const coverage =
          syllabusInfo && syllabusInfo.total > 0
            ? Math.round((syllabusInfo.covered / syllabusInfo.total) * 100)
            : 0;
        const assignmentInfo = assignmentMap.get(teacher.id) || {
          subjects: [],
          classes: [],
        };

        return {
          teacherId: teacher.id,
          teacherName: teacher.full_name || "Teacher",
          subjects: assignmentInfo.subjects,
          classes: assignmentInfo.classes,
          lessonPlansCount: lessonPlanCounts[teacher.id] || 0,
          syllabusCoverage: coverage,
          gradesEntered: gradesInfo.count,
          attendanceMarked: attendanceCounts[teacher.id] || 0,
          avgGradeScore: Math.round(avgScore),
        };
      });

      setTeachers(teacherList);
      setStats(teacherStats);
    } catch (err) {
      toast.error("Failed to load teacher statistics");
    } finally {
      setLoading(false);
    }
  }, [school, currentTerm, academicYear, toast]);

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
    <PageErrorBoundary>
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
    </PageErrorBoundary>
  );
}
