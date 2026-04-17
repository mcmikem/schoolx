"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses } from "@/lib/hooks";
import {
  getUCEGrade,
  getUCEDivision,
  getUACEGrade,
  getUACEPoints,
  getGradeForLevel,
} from "@/lib/grading";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/EmptyState";

interface StudentResult {
  id: string;
  name: string;
  student_number: string;
  class_name: string;
  subjects: Array<{
    name: string;
    code: string;
    score: number;
    grade: string;
  }>;
  average: number;
  grade: string;
  division: string;
  points?: number;
}

export default function UNEBAnalysisPage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);

  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("");
  const [examType, setExamType] = useState<"ple" | "uce" | "uace">("uce");

  const fetchResults = useCallback(async () => {
    if (!school?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from("grades")
        .select(
          "*, students(first_name, last_name, student_number, classes(name)), subjects(name, code)",
        )
        .eq("school_id", school.id)
        .eq("term", currentTerm)
        .eq("academic_year", academicYear)
        .eq("assessment_type", "exam");

      if (selectedClass) {
        query = query.eq("class_id", selectedClass);
      }

      const { data: grades } = await query;

      if (!grades || grades.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      const studentMap = new Map<string, StudentResult>();

      grades.forEach((g: any) => {
        const studentId = g.student_id;
        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            id: studentId,
            name: `${g.students?.first_name} ${g.students?.last_name}`,
            student_number: g.students?.student_number || "",
            class_name: g.students?.classes?.name || "",
            subjects: [],
            average: 0,
            grade: "",
            division: "",
          });
        }

        const student = studentMap.get(studentId)!;
        const score = Number(g.score);
        const grade =
          examType === "uace" ? getUACEGrade(score) : getUCEGrade(score);

        student.subjects.push({
          name: g.subjects?.name || "",
          code: g.subjects?.code || "",
          score,
          grade,
        });
      });

      const processedResults: StudentResult[] = [];

      studentMap.forEach((student) => {
        if (student.subjects.length > 0) {
          const avg =
            student.subjects.reduce((s, sub) => s + sub.score, 0) /
            student.subjects.length;
          student.average = Math.round(avg);

          if (examType === "uace") {
            const principalSubjects = student.subjects
              .slice(0, 3)
              .map((s) => s.grade);
            const subsidiarySubjects = student.subjects
              .slice(3)
              .map((s) => s.grade);
            const { points, division } = getUACEPoints(
              principalSubjects,
              subsidiarySubjects,
            );
            student.points = points;
            student.division = division;
            student.grade = getUACEGrade(avg);
          } else {
            const gradeValues = student.subjects.map((s) => s.grade);
            student.division = getUCEDivision(gradeValues);
            student.grade =
              examType === "uce"
                ? getUCEGrade(avg)
                : getGradeForLevel(avg, "primary");
          }

          processedResults.push(student);
        }
      });

      processedResults.sort((a, b) => b.average - a.average);
      setResults(processedResults);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id, currentTerm, academicYear, selectedClass, examType]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const stats = useMemo(() => {
    if (results.length === 0) return null;

    const divisionCounts: Record<string, number> = {};
    results.forEach((r) => {
      divisionCounts[r.division] = (divisionCounts[r.division] || 0) + 1;
    });

    const avgScore =
      results.reduce((s, r) => s + r.average, 0) / results.length;
    const passRate = Math.round(
      (results.filter((r) => r.average >= 50).length / results.length) * 100,
    );

    return {
      total: results.length,
      avgScore: Math.round(avgScore),
      passRate,
      divisions: divisionCounts,
      topScore: results[0]?.average || 0,
      lowestScore: results[results.length - 1]?.average || 0,
    };
  }, [results]);

  const getDivisionColor = (division: string) => {
    if (division === "Division I")
      return "bg-[var(--green-soft)] text-[var(--green)]";
    if (division === "Division II")
      return "bg-[var(--navy-soft)] text-[var(--navy)]";
    if (division === "Division III")
      return "bg-[var(--amber-soft)] text-[var(--amber)]";
    if (division === "Division IV") return "bg-yellow-100 text-amber-600";
    return "bg-[var(--red-soft)] text-[var(--red)]";
  };

  const tabs = [
    { id: "uce", label: "O-Level (UCE)" },
    { id: "uace", label: "A-Level (UACE)" },
    { id: "ple", label: "Primary (PLE)" },
  ];

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="UNEB Analysis"
        subtitle={
          examType === "uce"
            ? "UCE (O-Level) Division Analysis"
            : examType === "uace"
              ? "UACE (A-Level) Points Analysis"
              : "PLE (Primary) Performance Analysis"
        }
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={examType}
            onChange={(e) =>
              setExamType(e.target.value as "ple" | "uce" | "uace")
            }
            className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
            aria-label="Exam type"
          >
            <option value="uce">O-Level (UCE)</option>
            <option value="uace">A-Level (UACE)</option>
            <option value="ple">Primary (PLE)</option>
          </select>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
            aria-label="Filter by class"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </PageHeader>

      <Tabs
        tabs={tabs}
        activeTab={examType}
        onChange={(id) => setExamType(id as "ple" | "uce" | "uace")}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-[var(--surface-container)] rounded-xl"
              ></div>
            ))}
          </div>
          <TableSkeleton rows={5} />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-[var(--t1)]">
                {stats.total}
              </div>
              <div className="text-sm text-[var(--t3)] mt-1">Candidates</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-[var(--t1)]">
                {stats.avgScore}%
              </div>
              <div className="text-sm text-[var(--t3)] mt-1">
                School Average
              </div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-[var(--green)]">
                {stats.passRate}%
              </div>
              <div className="text-sm text-[var(--t3)] mt-1">Pass Rate</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-[var(--t1)]">
                {stats.topScore}%
              </div>
              <div className="text-sm text-[var(--t3)] mt-1">Highest Score</div>
            </Card>
          </div>

          <Card>
            <CardBody>
              <h2 className="font-semibold text-[var(--t1)] mb-4">
                Division Breakdown
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(stats.divisions)
                  .sort()
                  .map(([div, count]) => (
                    <div
                      key={div}
                      className={`p-4 rounded-xl ${getDivisionColor(div)}`}
                    >
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-sm font-medium">{div}</div>
                      <div className="text-xs">
                        {Math.round((count / stats.total) * 100)}%
                      </div>
                    </div>
                  ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="font-semibold text-[var(--t1)] mb-4">
                Student Results
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--surface-container-low)]">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">
                        #
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">
                        Name
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">
                        Student No.
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">
                        Subjects
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">
                        Average
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">
                        Grade
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">
                        {examType === "uace" ? "Points" : "Division"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((student, i) => (
                      <tr
                        key={student.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="p-3 text-[var(--t3)]">{i + 1}</td>
                        <td className="p-3 font-medium text-[var(--t1)]">
                          {student.name}
                        </td>
                        <td className="p-3 text-[var(--t3)]">
                          {student.student_number}
                        </td>
                        <td className="p-3 text-[var(--t1)]">
                          {student.subjects.length}
                        </td>
                        <td className="p-3 font-semibold text-[var(--t1)]">
                          {student.average}%
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-bold ${
                              student.grade.startsWith("D") ||
                              student.grade === "A"
                                ? "text-[var(--green)]"
                                : student.grade.startsWith("C") ||
                                    student.grade === "B"
                                  ? "text-[var(--navy)]"
                                  : student.grade.startsWith("P") ||
                                      student.grade === "C"
                                    ? "text-[var(--amber)]"
                                    : "text-[var(--red)]"
                            }`}
                          >
                            {student.grade}
                          </span>
                        </td>
                        <td className="p-3">
                          {examType === "uace" ? (
                            <span className="font-bold text-[var(--green)]">
                              {student.points} pts
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-medium ${getDivisionColor(student.division)}`}
                            >
                              {student.division}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      ) : (
        <EmptyState
          icon="school"
          title="No exam results found"
          description="Enter exam scores first."
        />
      )}
    </div>
    </PageErrorBoundary>
  );
}
