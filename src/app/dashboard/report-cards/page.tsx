"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import Image from "next/image";
import { useClasses, useStudents, useSubjects, useFeePayments, useFeeStructure } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { DEMO_GRADES, DEMO_SUBJECTS } from "@/lib/demo-data";
import { logger } from "@/lib/logger";
import MaterialIcon from "@/components/MaterialIcon";
import PersonInitials from "@/components/ui/PersonInitials";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { APP_NAME } from "@/lib/app-name";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { calculateSubjectTotal } from "@/lib/grading";
import {
  calculateFormativeScore,
  calculateSummativeScore,
  getCBCGrade,
  escapeHtml,
  generateCBCReportHTML,
} from "@/lib/cbc-report";

interface StudentReport {
  studentId: string;
  name: string;
  studentNumber: string;
  gender: string;
  photoUrl?: string;
  className: string;
  subjects: {
    name: string;
    score: number;
    grade: string;
    gradeColor: string;
    competencyLevel?: string;
    competencyNotes?: string;
    isMissing?: boolean;
  }[];
  totalMarks: number;
  maxMarks: number;
  average: number;
  position: number;
  division: string;
  classTeacherComment: string;
  hmComment: string;
  feeBalance: number;
}

function getGradeLabel(score: number): { grade: string; color: string } {
  if (score >= 80) return { grade: "D1", color: "text-green-600" };
  if (score >= 70) return { grade: "D2", color: "text-green-500" };
  if (score >= 65) return { grade: "C3", color: "text-blue-600" };
  if (score >= 60) return { grade: "C4", color: "text-blue-500" };
  if (score >= 55) return { grade: "C5", color: "text-indigo-500" };
  if (score >= 50) return { grade: "C6", color: "text-indigo-400" };
  if (score >= 45) return { grade: "P7", color: "text-yellow-600" };
  if (score >= 40) return { grade: "P8", color: "text-yellow-500" };
  return { grade: "F9", color: "text-red-500" };
}

function getCompetencyLabel(level: string | undefined): { label: string; emoji: string; color: string } {
  switch (level) {
    case "mastered":
      return { label: "Mastered", emoji: "⭐⭐⭐", color: "text-green-600" };
    case "demonstrates":
      return { label: "Demonstrates", emoji: "⭐⭐", color: "text-blue-600" };
    case "developing":
      return { label: "Developing", emoji: "⭐", color: "text-yellow-600" };
    case "extended":
      return { label: "Extended", emoji: "🏆", color: "text-purple-600" };
    default:
      return { label: "Not Started", emoji: "—", color: "text-gray-400" };
  }
}

function getDivision(total: number, maxTotal: number): string {
  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  if (pct >= 80) return "Division 1";
  if (pct >= 60) return "Division 2";
  if (pct >= 40) return "Division 3";
  if (pct >= 20) return "Division 4";
  return "Division U";
}

function getAutoComment(position: number): string {
  if (position >= 1 && position <= 5) return "Excellent performance. Keep it up!";
  if (position >= 6 && position <= 15) return "Good work. Strive for better.";
  return "Needs more effort. Work harder.";
}

export default function ReportCardsPage() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { students: classStudents } = useStudents(school?.id);
  const { payments } = useFeePayments(school?.id);
  const { feeStructure } = useFeeStructure(school?.id);

  const [selectedClass, setSelectedClass] = useState("");
  const [reportFormat, setReportFormat] = useState<"numerical" | "competency" | "both" | "cbc">("numerical");
  const [generated, setGenerated] = useState(false);
  const [hideWithFees, setHideWithFees] = useState(false);
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [comments, setComments] = useState<Record<string, { classTeacher: string; hm: string }>>({});
  const [sendingSms, setSendingSms] = useState(false);
  const [hasMissingMarks, setHasMissingMarks] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    currentClass: string;
    studentsProcessed: number;
    errors: number;
  }>({ current: 0, total: 0, currentClass: "", studentsProcessed: 0, errors: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [urlStudentIds, setUrlStudentIds] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const classId = params.get("class");
    if (classId && classes.some((c) => c.id === classId)) {
      setSelectedClass(classId);
    }
    const studentsParam = params.get("students");
    if (studentsParam) {
      setUrlStudentIds(studentsParam.split(",").filter(Boolean));
    }
  }, [classes]);

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    let list = classStudents.filter((s) => s.class_id === selectedClass);
    if (urlStudentIds.length > 0) {
      const idSet = new Set(urlStudentIds);
      list = list.filter((s) => idSet.has(s.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q));
    }
    return list;
  }, [classStudents, selectedClass, searchQuery, urlStudentIds]);

  const selectedClassObj = classes.find((c) => c.id === selectedClass);
  const selectedClassName = selectedClassObj
    ? `${selectedClassObj.name}${selectedClassObj.stream ? ` ${selectedClassObj.stream}` : ""}`
    : "";

  const totalFeePerStudent = useMemo(() => {
    return feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  }, [feeStructure]);

  const getStudentFeeBalance = useCallback(
    (studentId: string): number => {
      const studentPayments = payments.filter((p) => p.student_id === studentId);
      const paid = studentPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
      return Math.max(0, totalFeePerStudent - paid);
    },
    [payments, totalFeePerStudent],
  );

  const displayedReports = useMemo(() => {
    if (!hideWithFees) return reports;
    return reports.filter((r) => getStudentFeeBalance(r.studentId) === 0);
  }, [reports, hideWithFees, getStudentFeeBalance]);

  const stats = useMemo(() => {
    if (reports.length === 0) return { avgTotal: 0, div1: 0, withFees: 0 };

    const avg = reports.reduce((sum, r) => sum + r.average, 0) / reports.length;
    const div1 = reports.filter((r) => r.division === "Division 1").length;
    const withFees = reports.filter((r) => getStudentFeeBalance(r.studentId) > 0).length;

    return {
      avgTotal: Math.round(avg * 10) / 10,
      div1,
      withFees,
    };
  }, [reports, getStudentFeeBalance]);

  async function generateReportsForClass(
    classId: string,
    className: string,
    students: any[],
  ): Promise<{ reports: StudentReport[]; missingMarks: boolean }> {
    if (reportFormat === "cbc") {
      return generateCBCReports(classId, className, students);
    }
    let gradesData: any[] = [];
    let competencyData: any[] = [];

    if (isDemo) {
      gradesData = DEMO_GRADES.filter((grade) => grade.class_id === classId).map((grade) => ({
        ...grade,
        subjects: DEMO_SUBJECTS.find((subject) => subject.id === grade.subject_id) || null,
      }));
    } else {
      const { supabase: sb } = await import("@/lib/supabase");

      const gradesResult = await withTimeout(
        sb
          .from("grades")
          .select("*, subjects(id, name)")
          .eq("class_id", classId)
          .eq("term", currentTerm)
          .eq("academic_year", academicYear)
          .in("assessment_type", ["ca1", "ca2", "ca3", "ca4", "project", "exam"]),
        15000,
        timeoutFallback(),
      );

      if (gradesResult.error) throw gradesResult.error;
      gradesData = gradesResult.data || [];

      if (reportFormat !== "numerical") {
        const compResult = await withTimeout(
          sb
            .from("grades")
            .select("student_id, subject_id, competency_level, competency_notes, subjects(id, name)")
            .eq("class_id", classId)
            .eq("term", currentTerm)
            .eq("academic_year", academicYear)
            .in("assessment_type", ["competency"]),
          15000,
          timeoutFallback(),
        );

        if (!compResult.error) {
          competencyData = compResult.data || [];
        }
      }
    }

    const studentSubjectScores: Record<string, Record<string, { total: number; name: string }>> = {};
    const studentCompetencies: Record<string, Record<string, { level: string; notes: string; name: string }>> = {};

    for (const g of gradesData) {
      if (!studentSubjectScores[g.student_id]) {
        studentSubjectScores[g.student_id] = {};
      }
      const subjName = g.subjects?.name || "Unknown";
      if (!studentSubjectScores[g.student_id][g.subject_id]) {
        studentSubjectScores[g.student_id][g.subject_id] = {
          total: 0,
          name: subjName,
        };
      }
      studentSubjectScores[g.student_id][g.subject_id].total += Number(g.score || 0);
    }

    for (const c of competencyData) {
      if (!studentCompetencies[c.student_id]) {
        studentCompetencies[c.student_id] = {};
      }
      const subjName = c.subjects?.name || "Unknown";
      studentCompetencies[c.student_id][c.subject_id] = {
        level: c.competency_level || "not_started",
        notes: c.competency_notes || "",
        name: subjName,
      };
    }

    const subjectList =
      Object.values(studentSubjectScores).length > 0
        ? Object.values(Object.values(studentSubjectScores)[0]).map((s) => s.name)
        : subjects.map((s: any) => s.name);
    const numSubjects = subjectList.length || 1;

    if (students.length === 0) {
      return { reports: [], missingMarks: false };
    }

    const reportList: StudentReport[] = students.map((student) => {
      const subjScores = studentSubjectScores[student.id] || {};
      const studentComp = studentCompetencies[student.id] || {};
      const subjectDetails = Object.entries(subjScores).map(([subjId, data]) => {
        const gradeInfo = getGradeLabel(data.total);
        const comp = studentComp[subjId];
        return {
          name: data.name,
          score: data.total,
          grade: gradeInfo.grade,
          gradeColor: gradeInfo.color,
          competencyLevel: comp?.level,
          competencyNotes: comp?.notes,
          isMissing: false,
        };
      });

      const allSubjectDetails = subjects.map((sub: any) => {
        const existing = subjectDetails.find((sd) => sd.name === sub.name);
        return (
          existing || {
            name: sub.name,
            score: 0,
            grade: "M.M",
            gradeColor: "text-amber-500",
            competencyLevel: "not_started",
            isMissing: true,
          }
        );
      });

      const totalMarks = allSubjectDetails.reduce((sum, s) => sum + s.score, 0);
      const maxMarks = numSubjects * 100;
      const average = numSubjects > 0 ? Math.round((totalMarks / numSubjects) * 10) / 10 : 0;

      return {
        studentId: student.id,
        name: `${student.first_name} ${student.last_name}`,
        studentNumber: student.student_number || "",
        gender: student.gender,
        photoUrl: student.photo_url,
        className,
        subjects: allSubjectDetails,
        totalMarks,
        maxMarks,
        average,
        position: 0,
        division: "",
        classTeacherComment: "",
        hmComment: "",
        feeBalance: getStudentFeeBalance(student.id),
      };
    });

    reportList.sort((a, b) => b.totalMarks - a.totalMarks);
    reportList.forEach((r, i) => {
      if (i > 0 && r.totalMarks === reportList[i - 1].totalMarks) {
        r.position = reportList[i - 1].position;
      } else {
        r.position = i + 1;
      }
      r.division = getDivision(r.totalMarks, r.maxMarks);
      r.classTeacherComment = getAutoComment(r.position);
      r.hmComment = getAutoComment(r.position);
    });

    const missing = reportList.some((r) => r.subjects.some((s: any) => s.isMissing));

    return { reports: reportList, missingMarks: missing };
  }

  async function generateCBCReports(
    classId: string,
    className: string,
    students: any[],
  ): Promise<{ reports: StudentReport[]; missingMarks: boolean }> {
    if (students.length === 0) return { reports: [], missingMarks: false };

    const { supabase: sb } = await import("@/lib/supabase");

    const [u1Result, u2Result, eotResult] = await Promise.all([
      withTimeout(
        sb
          .from("grades")
          .select("*, subjects(id, name)")
          .eq("class_id", classId)
          .eq("term", currentTerm)
          .eq("academic_year", academicYear)
          .eq("assessment_type", "u1"),
        15000,
        timeoutFallback(),
      ),
      withTimeout(
        sb
          .from("grades")
          .select("*, subjects(id, name)")
          .eq("class_id", classId)
          .eq("term", currentTerm)
          .eq("academic_year", academicYear)
          .eq("assessment_type", "u2"),
        15000,
        timeoutFallback(),
      ),
      withTimeout(
        sb
          .from("grades")
          .select("*, subjects(id, name)")
          .eq("class_id", classId)
          .eq("term", currentTerm)
          .eq("academic_year", academicYear)
          .eq("assessment_type", "eot"),
        15000,
        timeoutFallback(),
      ),
    ]);

    const u1Grades = u1Result.data || [];
    const u2Grades = u2Result.data || [];
    const eotGrades = eotResult.data || [];

    const subjectOrder = subjects.map((s: any) => s.name);

    const reportList: StudentReport[] = students.map((student) => {
      const studentU1 = u1Grades.filter((g: any) => g.student_id === student.id);
      const studentU2 = u2Grades.filter((g: any) => g.student_id === student.id);
      const studentEot = eotGrades.filter((g: any) => g.student_id === student.id);

      const subjectsCBC = subjectOrder.map((subjName) => {
        const u1ForSubj = studentU1.filter((g: any) => g.subjects?.name === subjName);
        const u2ForSubj = studentU2.filter((g: any) => g.subjects?.name === subjName);
        const eotForSubj = studentEot.filter((g: any) => g.subjects?.name === subjName);

        const u1Avg =
          u1ForSubj.length > 0
            ? u1ForSubj.reduce((s: number, g: any) => s + Number(g.identifier_score || g.score || 0), 0) /
              u1ForSubj.length
            : 0;
        const u2Avg =
          u2ForSubj.length > 0
            ? u2ForSubj.reduce((s: number, g: any) => s + Number(g.identifier_score || g.score || 0), 0) /
              u2ForSubj.length
            : 0;
        const avgIdentifier = (u1Avg + u2Avg) / 2;
        const formativeScore = calculateFormativeScore(avgIdentifier);
        const eotScore = eotForSubj.length > 0 ? Number(eotForSubj[0].score || 0) : 0;
        const summativeScore = calculateSummativeScore(eotScore);
        const totalMark = Math.round(formativeScore + summativeScore);
        const grade = getCBCGrade(totalMark);

        const learningOutcomes: { description: string; u1Score: number; u2Score: number }[] = [];
        const maxLen = Math.max(u1ForSubj.length, u2ForSubj.length);
        for (let i = 0; i < maxLen; i++) {
          learningOutcomes.push({
            description: u1ForSubj[i]?.topic_name || u2ForSubj[i]?.topic_name || `Learning outcome ${i + 1}`,
            u1Score: u1ForSubj[i] ? Number(u1ForSubj[i].identifier_score || u1ForSubj[i].score || 0) : 0,
            u2Score: u2ForSubj[i] ? Number(u2ForSubj[i].identifier_score || u2ForSubj[i].score || 0) : 0,
          });
        }

        return {
          name: subjName,
          score: totalMark,
          grade,
          gradeColor:
            grade === "A+" || grade === "A"
              ? "text-green-600"
              : grade === "B" || grade === "C"
                ? "text-blue-600"
                : grade === "D" || grade === "E"
                  ? "text-amber-600"
                  : "text-red-500",
          isMissing: u1ForSubj.length === 0 && u2ForSubj.length === 0 && eotForSubj.length === 0,
          teacherName: u1ForSubj[0]?.teacher_remark ? "Subject Teacher" : "Subject Teacher",
          teacherRemark: u1ForSubj[0]?.teacher_remark || "",
          teacherInitials: "",
          learningOutcomes,
          u1Average: Math.round(u1Avg * 10) / 10,
          u2Average: Math.round(u2Avg * 10) / 10,
          averageIdentifier: Math.round(avgIdentifier * 10) / 10,
          formativeScore,
          eotScore,
          summativeScore,
        };
      });

      const totalMarks = subjectsCBC.reduce((sum, s) => sum + s.score, 0);
      const numSubjects = subjectsCBC.length || 1;
      const average = Math.round((totalMarks / numSubjects) * 10) / 10;

      return {
        studentId: student.id,
        name: `${student.first_name} ${student.last_name}`,
        studentNumber: student.student_number || "",
        gender: student.gender,
        photoUrl: student.photo_url,
        className,
        subjects: subjectsCBC as any,
        totalMarks,
        maxMarks: numSubjects * 100,
        average,
        position: 0,
        division: getCBCGrade(average),
        classTeacherComment: "",
        hmComment: "",
        feeBalance: getStudentFeeBalance(student.id),
      } as StudentReport;
    });

    reportList.sort((a, b) => b.totalMarks - a.totalMarks);
    reportList.forEach((r, i) => {
      if (i > 0 && r.totalMarks === reportList[i - 1].totalMarks) {
        r.position = reportList[i - 1].position;
      } else {
        r.position = i + 1;
      }
      r.classTeacherComment = getAutoComment(r.position);
      r.hmComment = getAutoComment(r.position);
    });

    const missing = reportList.some((r) => r.subjects.some((s: any) => s.isMissing));
    return { reports: reportList, missingMarks: missing };
  }

  const persistReportCards = async (reportList: StudentReport[], classId: string) => {
    const { supabase: sb } = await import("@/lib/supabase");
    const best4 = (scores: number[]) => [...scores].sort((a, b) => b - a).slice(0, 4);

    let savedCount = 0;
    const failedNames: string[] = [];

    for (const rpt of reportList) {
      const subjectsJson = rpt.subjects.map((s) => ({
        name: s.name,
        score: s.score,
        grade: s.grade,
        gradeColor: s.gradeColor,
        competencyLevel: s.competencyLevel,
        competencyNotes: s.competencyNotes,
        isMissing: s.isMissing,
      }));
      const rptBest4 = best4(rpt.subjects.map((s) => s.score));
      const rptAggregate = rptBest4.reduce((a, b) => a + b, 0);

      const existingResult = await withTimeout(
        sb
          .from("report_cards")
          .select("id")
          .eq("student_id", rpt.studentId)
          .eq("academic_year", academicYear)
          .eq("term", currentTerm)
          .limit(1),
        10000,
        timeoutFallback(),
      );
      const existingCard = existingResult.data;

      const cardPayload = {
        school_id: school?.id,
        student_id: rpt.studentId,
        class_id: classId,
        academic_year: academicYear,
        term: currentTerm,
        subjects: subjectsJson,
        aggregate: rptAggregate,
        division: rpt.division,
        best4: rptBest4,
        generated_at: new Date().toISOString(),
        generated_by: user?.full_name || user?.id || "system",
      };

      let writeResult: { error?: unknown } | null = null;
      if (existingCard && existingCard.length > 0) {
        writeResult = await withTimeout(
          sb.from("report_cards").update(cardPayload).eq("id", existingCard[0].id),
          15000,
          timeoutFallback(),
        );
      } else {
        writeResult = await withTimeout(sb.from("report_cards").insert(cardPayload), 15000, timeoutFallback());
      }

      if (writeResult?.error) {
        logger.error(`Failed to save report card for ${rpt.name}:`, writeResult.error);
        failedNames.push(rpt.name);
      } else {
        savedCount++;
      }
    }

    return { savedCount, failedNames };
  };

  const handleGenerate = async () => {
    if (!selectedClass) {
      toast.error("Please select a class first");
      return;
    }
    if (filteredStudents.length === 0 && !isDemo) {
      toast.error("No students in this class");
      return;
    }

    try {
      const { reports: reportList, missingMarks } = await generateReportsForClass(
        selectedClass,
        selectedClassName,
        filteredStudents,
      );

      if (reportList.length === 0) {
        toast.error("No students found for the selected class");
        return;
      }

      const initialComments: Record<string, { classTeacher: string; hm: string }> = {};
      for (const r of reportList) {
        initialComments[r.studentId] = {
          classTeacher: r.classTeacherComment,
          hm: r.hmComment,
        };
      }

      setHasMissingMarks(missingMarks);
      setReports(reportList);
      setComments(initialComments);
      setGenerated(true);

      const { savedCount, failedNames } = await persistReportCards(reportList, selectedClass);

      if (failedNames.length > 0) {
        toast.warning(
          `Saved ${savedCount}/${reportList.length} report cards. Failed: ${failedNames.slice(0, 3).join(", ")}${
            failedNames.length > 3 ? ` and ${failedNames.length - 3} more` : ""
          }`,
        );
      } else {
        toast.success(`Report cards generated for ${savedCount} students`);
      }
    } catch (err) {
      logger.error("Error generating report cards:", err);
      toast.error("Failed to generate report cards");
    }
  };

  const handleGenerateAll = async () => {
    if (classes.length === 0) {
      toast.error("No classes available");
      return;
    }

    setGeneratingAll(true);
    setGenerationProgress({
      current: 0,
      total: classes.length,
      currentClass: "",
      studentsProcessed: 0,
      errors: 0,
    });

    const allReports: StudentReport[] = [];
    let totalErrors = 0;
    let totalStudents = 0;
    let totalSaved = 0;
    let totalFailed = 0;

    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      const className = `${c.name}${c.stream ? ` ${c.stream}` : ""}`;

      setGenerationProgress((prev) => ({
        ...prev,
        current: i + 1,
        currentClass: className,
      }));

      const studentsForClass = classStudents.filter((s) => s.class_id === c.id);

      if (studentsForClass.length === 0) {
        continue;
      }

      try {
        const { reports: classReports } = await generateReportsForClass(c.id, className, studentsForClass);

        allReports.push(...classReports);
        totalStudents += classReports.length;
        setGenerationProgress((prev) => ({
          ...prev,
          studentsProcessed: totalStudents,
        }));

        const { savedCount, failedNames } = await persistReportCards(classReports, c.id);
        totalSaved += savedCount;
        totalFailed += failedNames.length;
      } catch (err) {
        logger.error(`Error generating reports for class ${className}:`, err);
        totalErrors++;
        setGenerationProgress((prev) => ({
          ...prev,
          errors: totalErrors,
        }));
      }
    }

    setGeneratingAll(false);

    if (allReports.length > 0) {
      const initialComments: Record<string, { classTeacher: string; hm: string }> = {};
      for (const r of allReports) {
        initialComments[r.studentId] = {
          classTeacher: r.classTeacherComment,
          hm: r.hmComment,
        };
      }

      const hasMissing = allReports.some((r) => r.subjects.some((s: any) => s.isMissing));

      setHasMissingMarks(hasMissing);
      setReports(allReports);
      setComments(initialComments);
      setGenerated(true);

      if (totalFailed > 0) {
        toast.warning(
          `Report cards generated for ${totalSaved} students across ${classes.length} classes. ${totalFailed} could not be saved${
            totalErrors > 0 ? `, and ${totalErrors} class${totalErrors > 1 ? "es" : ""} failed to generate` : ""
          }.`,
        );
      } else if (totalErrors > 0) {
        toast.warning(
          `Generated and saved ${totalSaved} report cards, but ${totalErrors} class${totalErrors > 1 ? "es" : ""} failed to generate.`,
        );
      } else {
        toast.success(`Report cards generated and saved for ${totalSaved} students across ${classes.length} classes`);
      }
    } else {
      toast.error("No reports could be generated for any class");
    }
  };

  const handleCommentChange = (studentId: string, field: "classTeacher" | "hm", value: string) => {
    setComments((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleSuggestComment = (studentId: string, position: number) => {
    const auto = getAutoComment(position);
    setComments((prev) => ({
      ...prev,
      [studentId]: { classTeacher: auto, hm: auto },
    }));
  };

  const handlePrintReport = (report: StudentReport) => {
    if (reportFormat === "cbc") {
      handlePrintCBCReport(report);
      return;
    }
    const studentComment = comments[report.studentId] || {
      classTeacher: "",
      hm: "",
    };
    const schoolName = school?.name || "School Name";
    const schoolColor = school?.primary_color || "#002045";
    const logoUrl = school?.logo_url || "";
    const reportHeader = (school as any)?.report_header_text || (school as any)?.report_header || "";
    const reportFooter = (school as any)?.report_footer_text || (school as any)?.report_footer || "";
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const subjectRows = report.subjects
      .map((s) => {
        const compCell =
          reportFormat !== "numerical" && s.competencyLevel
            ? `<td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.competencyLevel === "mastered" ? "⭐⭐⭐" : s.competencyLevel === "demonstrates" ? "⭐⭐" : s.competencyLevel === "developing" ? "⭐" : "—"}</td>`
            : "";
        return `<tr>
        <td style="padding:6px 10px;border:1px solid #ddd">${escapeHtml(s.name)}</td>
        ${
          reportFormat !== "competency"
            ? `<td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.score}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold">${escapeHtml(s.grade)}</td>`
            : ""
        }
        ${compCell}
      </tr>`;
      })
      .join("");

    const feeBlock =
      report.feeBalance > 0
        ? `<div style="background:#fff3f3;border:1px solid #fca5a5;border-radius:8px;padding:10px;margin-top:12px;text-align:center">
           <strong style="color:#dc2626">Fees outstanding: UGX ${report.feeBalance.toLocaleString()}</strong>
         </div>`
        : "";
    const photoBlock = report.photoUrl
      ? `<div style="display:flex;justify-content:center;margin:12px 0 4px"><img src="${escapeHtml(report.photoUrl)}" alt="${escapeHtml(report.name)}" style="width:88px;height:108px;object-fit:cover;border-radius:12px;border:1px solid #ddd" /></div>`
      : "";

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const printCardStyles = `
      body{font-family:Arial,sans-serif;padding:20px;max-width:700px;margin:0 auto}
      .header{text-align:center;border-bottom:3px solid ${schoolColor};padding-bottom:15px;margin-bottom:15px}
      .logo{max-width:80px;max-height:60px;margin-bottom:10px}
      .school-name{font-size:22px;font-weight:bold;color:${schoolColor}}
      .school-info{font-size:11px;color:#666;margin:3px 0}
      .report-title{font-size:16px;font-weight:bold;color:${schoolColor};margin:10px 0}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0;font-size:13px}
      .info-grid div{padding:4px 0}
      .info-label{color:#888;display:inline-block;width:120px}
      .info-value{font-weight:bold}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th{background:${schoolColor}15;padding:8px 10px;border:1px solid #ddd;text-align:left;font-size:12px;text-transform:uppercase}
      .summary{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin:15px 0}
      .summary-card{border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center}
      .summary-value{font-size:20px;font-weight:bold;color:${schoolColor}}
      .summary-label{font-size:10px;color:#888;text-transform:uppercase}
      .comment-box{border:1px solid #ddd;border-radius:8px;padding:10px;margin:8px 0}
      .comment-label{font-size:11px;font-weight:bold;text-transform:uppercase;color:#888;margin-bottom:4px}
      .footer{text-align:center;margin-top:25px;font-size:11px;color:#999;border-top:2px solid ${schoolColor};padding-top:15px}
    `;

    const printCardBody = `
      <div class="header">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="logo" alt="${escapeHtml(schoolName)}">` : ""}
        <div class="school-name">${escapeHtml(schoolName)}</div>
        <div class="school-info">Tel: ${escapeHtml(school?.phone || "")} | Email: ${escapeHtml(school?.email || "")}</div>
        <div class="report-title">${escapeHtml(reportHeader || "STUDENT REPORT CARD")}</div>
        <div class="school-info">Term ${currentTerm}, ${academicYear}</div>
      </div>
      ${photoBlock}
      <div class="info-grid">
        <div><span class="info-label">Student Name:</span> <span class="info-value">${escapeHtml(report.name)}</span></div>
        <div><span class="info-label">Student No:</span> <span class="info-value">${escapeHtml(report.studentNumber)}</span></div>
        <div><span class="info-label">Class:</span> <span class="info-value">${escapeHtml(report.className)}</span></div>
        <div><span class="info-label">Gender:</span> <span class="info-value">${report.gender === "M" ? "Male" : "Female"}</span></div>
      </div>
      <table>
        <thead>
          <tr><th>Subject</th>${reportFormat !== "competency" ? '<th style="text-align:center">Score</th><th style="text-align:center">Grade</th>' : ""}${reportFormat !== "numerical" ? '<th style="text-align:center">Competency</th>' : ""}</tr>
        </thead>
        <tbody>${subjectRows}</tbody>
      </table>
      <div class="summary">
        <div class="summary-card"><div class="summary-value">${report.totalMarks}/${report.maxMarks}</div><div class="summary-label">Total</div></div>
        <div class="summary-card"><div class="summary-value">${report.average}%</div><div class="summary-label">Average</div></div>
        <div class="summary-card"><div class="summary-value">${report.position}</div><div class="summary-label">Position</div></div>
        <div class="summary-card"><div class="summary-value">${escapeHtml(report.division)}</div><div class="summary-label">Division</div></div>
      </div>
      <div class="comment-box">
        <div class="comment-label">Class Teacher's Comment</div>
        <div>${escapeHtml(studentComment.classTeacher || report.classTeacherComment)}</div>
      </div>
      <div class="comment-box">
        <div class="comment-label">Headteacher's Comment</div>
        <div>${escapeHtml(studentComment.hm || report.hmComment)}</div>
      </div>
      ${feeBlock}
      <div class="footer">
        <div>${escapeHtml(reportFooter || `Generated by ${APP_NAME}`)}</div>
      </div>
    `;

    printWindow.document.open();
    printWindow.document.title = `Report Card - ${escapeHtml(report.name)}`;
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
      printWindow.document.head.appendChild(el.cloneNode(true));
    });
    printWindow.document.head.insertAdjacentHTML("beforeend", `<style>${printCardStyles}</style>`);
    printWindow.document.body.innerHTML = printCardBody;
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const handlePrintCBCReport = (report: StudentReport) => {
    const student = classStudents.find((s) => s.id === report.studentId);
    if (!student) return;
    const classTeacherName = (selectedClassObj as any)?.class_teacher_name || "Class Teacher";
    const studentComment = comments[report.studentId] || { classTeacher: "", hm: "" };

    const cbcData = {
      school: {
        name: school?.name || "School Name",
        schoolCode: (school as any)?.school_code || "",
        unebCenterNumber: (school as any)?.uneb_center_number || "",
        phone: school?.phone || "",
        email: school?.email || "",
        address: (school as any)?.address || "",
        logoUrl: school?.logo_url || "",
        motto: (school as any)?.motto || "",
        primaryColor: school?.primary_color || "#002045",
      },
      student: {
        firstName: student.first_name,
        lastName: student.last_name,
        fullName: report.name,
        studentNumber: report.studentNumber,
        photoUrl: report.photoUrl || "",
        className: report.className,
        formClass: "Form",
        gender: report.gender,
      },
      term: currentTerm,
      academicYear,
      examTitle: `End of Term ${currentTerm} Exams - ${academicYear}`,
      subjects: report.subjects.map((s, idx) => ({
        name: s.name,
        teacherName: (s as any).teacherName || "Subject Teacher",
        teacherRemark: (s as any).teacherRemark || "",
        teacherInitials: (s as any).teacherInitials || "",
        learningOutcomes: (s as any).learningOutcomes || [
          { description: "General competency", u1Score: (s as any).u1Average || 0, u2Score: (s as any).u2Average || 0 },
        ],
        u1Average: (s as any).u1Average || 0,
        u2Average: (s as any).u2Average || 0,
        averageIdentifier: (s as any).averageIdentifier || 0,
        formativeScore: (s as any).formativeScore || 0,
        eotScore: (s as any).eotScore || 0,
        summativeScore: (s as any).summativeScore || 0,
        totalMark: s.score,
        grade: s.grade,
      })),
      summary: {
        totalIdentifier: 0,
        totalFormative: 0,
        totalEot: 0,
        totalMarkSum: report.totalMarks,
        overallAverage: report.average,
        averageGrade: report.division,
      },
      gradingScheme: "See below",
      identifierRanges: [
        {
          level: 3,
          label: "Outstanding",
          descriptor: "Most or all LO's achieved for overall achievement",
          min: 2.5,
          max: 3.0,
        },
        {
          level: 2,
          label: "Moderate",
          descriptor: "Many LO's achieved, enough for overall achievement",
          min: 1.5,
          max: 2.49,
        },
        {
          level: 1,
          label: "Basic",
          descriptor: "Few LO's achieved, but not sufficient for overall achievement",
          min: 0.9,
          max: 1.49,
        },
      ],
      classTeacher: { name: classTeacherName, comment: studentComment.classTeacher },
      headTeacher: { name: (school as any)?.principal_name || "Headteacher", comment: studentComment.hm },
      nextTermOpens: "February 3, 2025",
      dateOfIssue: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    };

    const printHtml = generateCBCReportHTML(cbcData);

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const handlePrintAll = () => {
    if (displayedReports.length === 0) return;

    if (reportFormat === "cbc") {
      toast.info("Print individual reports using the print button per student");
      return;
    }

    const schoolName = school?.name || "School Name";
    const schoolColor = school?.primary_color || "#002045";
    const logoUrl = school?.logo_url || "";
    const reportHeader = (school as any)?.report_header_text || (school as any)?.report_header || "";
    const reportFooter = (school as any)?.report_footer_text || (school as any)?.report_footer || "";
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    let allHtml = "";

    displayedReports.forEach((report, index) => {
      const studentComment = comments[report.studentId] || {
        classTeacher: "",
        hm: "",
      };

      const subjectRows = report.subjects
        .map(
          (s) =>
            `<tr>
          <td style="padding:6px 10px;border:1px solid #ddd">${escapeHtml(s.name)}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.score}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold">${escapeHtml(s.grade)}</td>
        </tr>`,
        )
        .join("");

      const feeBlock =
        report.feeBalance > 0
          ? `<div style="background:#fff3f3;border:1px solid #fca5a5;border-radius:8px;padding:10px;margin-top:12px;text-align:center">
             <strong style="color:#dc2626">Fees outstanding: UGX ${report.feeBalance.toLocaleString()}</strong>
           </div>`
          : "";
      const photoBlock = report.photoUrl
        ? `<div style="display:flex;justify-content:center;margin:12px 0 4px"><img src="${escapeHtml(report.photoUrl)}" alt="${escapeHtml(report.name)}" style="width:88px;height:108px;object-fit:cover;border-radius:12px;border:1px solid #ddd" /></div>`
        : "";

      allHtml += `
        <div class="report-page ${index > 0 ? "page-break" : ""}">
          <div class="header">
            ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="logo" alt="${escapeHtml(schoolName)}">` : ""}
            <div class="school-name text-nowrap">${escapeHtml(schoolName)}</div>
            <div class="school-info">Tel: ${escapeHtml(school?.phone || "")} | Email: ${escapeHtml(school?.email || "")}</div>
            <div class="report-title">${escapeHtml(reportHeader || "STUDENT REPORT CARD")}</div>
            <div class="school-info">Term ${currentTerm}, ${academicYear}</div>
          </div>
          ${photoBlock}
          <div class="info-grid">
            <div><span class="info-label">Student Name:</span> <span class="info-value text-nowrap">${escapeHtml(report.name)}</span></div>
            <div><span class="info-label">Student No:</span> <span class="info-value">${escapeHtml(report.studentNumber)}</span></div>
            <div><span class="info-label">Class:</span> <span class="info-value">${escapeHtml(report.className)}</span></div>
            <div><span class="info-label">Gender:</span> <span class="info-value">${report.gender === "M" ? "Male" : "Female"}</span></div>
          </div>
          <table>
            <thead>
              <tr><th>Subject</th><th style="text-align:center">Score</th><th style="text-align:center">Grade</th></tr>
            </thead>
            <tbody>${subjectRows}</tbody>
          </table>
          <div class="summary">
            <div class="summary-card"><div class="summary-value">${report.totalMarks}/${report.maxMarks}</div><div class="summary-label">Total</div></div>
            <div class="summary-card"><div class="summary-value">${report.average}%</div><div class="summary-label">Average</div></div>
            <div class="summary-card"><div class="summary-value">${report.position}</div><div class="summary-label">Position</div></div>
            <div class="summary-card"><div class="summary-value text-nowrap">${escapeHtml(report.division)}</div><div class="summary-label">Division</div></div>
          </div>
          <div class="comment-box">
            <div class="comment-label">Class Teacher's Comment</div>
            <div class="text-xs">${escapeHtml(studentComment.classTeacher || report.classTeacherComment)}</div>
          </div>
          <div class="comment-box">
            <div class="comment-label">Headteacher's Comment</div>
            <div class="text-xs">${escapeHtml(studentComment.hm || report.hmComment)}</div>
          </div>
          ${feeBlock}
          <div class="footer">
            <div>${escapeHtml(reportFooter || `Result Slip Summary - Generated by ${APP_NAME}`)}</div>
            <div style="font-size:8px; margin-top:5px;">Page ${index + 1} of ${displayedReports.length}</div>
          </div>
        </div>
      `;
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const massPrintStyles = `
      @media print { .page-break { page-break-before: always; } }
      body{font-family:Arial,sans-serif;padding:0;margin:0;background:#f5f5f5}
      .report-page{background:white;padding:40px;max-width:800px;margin:20px auto;box-shadow:0 0 10px rgba(0,0,0,0.1);min-height:297mm}
      @media print { .report-page{margin:0;box-shadow:none;width:100%;max-width:none} body{background:white} }
      .header{text-align:center;border-bottom:3px solid ${schoolColor};padding-bottom:15px;margin-bottom:15px}
      .logo{max-width:80px;max-height:60px;margin-bottom:10px}
      .school-name{font-size:24px;font-weight:bold;color:${schoolColor};text-transform:uppercase}
      .school-info{font-size:11px;color:#666;margin:3px 0}
      .report-title{font-size:18px;font-weight:bold;color:${schoolColor};margin:10px 0;letter-spacing:1px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:15px 0;font-size:14px}
      .info-label{color:#888;display:inline-block;width:120px}
      .info-value{font-weight:bold;color:#333}
      table{width:100%;border-collapse:collapse;margin:15px 0}
      th{background:${schoolColor}15;padding:10px;border:1px solid #ddd;text-align:left;font-size:11px;text-transform:uppercase;color:${schoolColor}}
      td{padding:8px 10px;border:1px solid #ddd;font-size:13px}
      .summary{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:15px;margin:20px 0}
      .summary-card{border:2px solid ${schoolColor}20;border-radius:12px;padding:12px;text-align:center;background:${schoolColor}05}
      .summary-value{font-size:22px;font-weight:bold;color:${schoolColor}}
      .summary-label{font-size:9px;color:#888;text-transform:uppercase;margin-top:4px;font-weight:bold}
      .comment-box{border:1px solid #eee;border-radius:12px;padding:15px;margin:12px 0;background:#fafafa}
      .comment-label{font-size:10px;font-weight:bold;text-transform:uppercase;color:#aaa;margin-bottom:6px}
      .text-nowrap{white-space:nowrap}
      .text-xs{font-size:12px;line-height:1.4}
      .footer{text-align:center;margin-top:30px;font-size:10px;color:#bbb;border-top:1px dashed #ddd;padding-top:20px}
    `;

    printWindow.document.open();
    printWindow.document.title = `Mass Report Printing - ${selectedClassName}`;
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
      printWindow.document.head.appendChild(el.cloneNode(true));
    });
    printWindow.document.head.insertAdjacentHTML("beforeend", `<style>${massPrintStyles}</style>`);
    printWindow.document.body.innerHTML = allHtml;
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleSendSms = async (report: StudentReport) => {
    const student = classStudents.find((s) => s.id === report.studentId);
    if (!student || !student.parent_phone) {
      toast.error(`Phone number missing for ${report.name}`);
      return;
    }

    setSendingSms(true);
    try {
      const message = `SkoolMate Alert: ${report.name} (Term ${currentTerm} Results). Avg: ${report.average}%, Pos: ${report.position}, Div: ${report.division}. Balance: UGX ${report.feeBalance.toLocaleString()}.`;

      const response = await fetch("/api/sms/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: student.parent_phone,
          message,
          schoolId: school?.id,
          studentId: student.id,
          type: "individual",
        }),
      });
      const result = await response.json().catch(() => null);
      const resultData = result?.data || {};

      if (response.ok && resultData.status === "sent") {
        const { supabase: sb } = await import("@/lib/supabase");
        const msgResult = await withTimeout(
          sb.from("messages").insert({
            school_id: school?.id,
            recipient_type: "individual",
            recipient_id: student.id,
            phone: student.parent_phone,
            message,
            status: "sent",
            sent_by: user?.id,
            sent_at: new Date().toISOString(),
          }),
          15000,
          timeoutFallback(),
        );
        if (msgResult?.error) throw msgResult.error;
        toast.success(`Result summary sent to ${student.parent_phone}`);
      } else if (response.ok && resultData.demo) {
        toast.info(`Demo mode: result summary logged for ${student.parent_phone} (no SMS gateway)`);
      } else if (response.ok && resultData.status === "fallback") {
        toast.warning(
          resultData.smsError
            ? `SMS provider failed for ${student.parent_phone}: ${resultData.smsError}`
            : `SMS could not be sent to ${student.parent_phone}`,
        );
      } else {
        toast.error(result?.error || "Failed to send results via SMS");
      }
    } catch (err) {
      logger.error("SMS Error:", err);
      toast.error("Failed to send results via SMS");
    } finally {
      setSendingSms(false);
    }
  };

  const actions = (
    <div className="flex gap-2">
      {generated && reports.length > 0 && (
        <Button
          variant="ghost"
          onClick={handlePrintAll}
          className="border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
        >
          <MaterialIcon icon="print_connect" style={{ fontSize: "18px" }} />
          Print All Class ({displayedReports.length})
        </Button>
      )}
      {classes.length > 0 && (
        <Button
          variant="ghost"
          onClick={handleGenerateAll}
          disabled={generatingAll}
          className="border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
        >
          <MaterialIcon icon="select_all" style={{ fontSize: "18px" }} />
          Generate All Classes
        </Button>
      )}
      <Button onClick={handleGenerate} disabled={generatingAll} className="bg-indigo-600 shadow-indigo-600/20">
        <MaterialIcon icon="bolt" style={{ fontSize: "18px" }} />
        Generate Now
      </Button>
    </div>
  );

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader title="Report Cards" subtitle="Generate and manage student report cards" actions={actions} />

        {generatingAll && (
          <Card className="mb-5">
            <CardBody>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MaterialIcon icon="progress_activity" className="animate-spin text-emerald-600" />
                    <span className="font-semibold text-[var(--on-surface)]">Generating All Classes...</span>
                  </div>
                  <span className="text-sm text-[var(--t3)]">
                    {generationProgress.current} of {generationProgress.total}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-[var(--t3)]">Current Class:</span>{" "}
                    <span className="font-semibold">{generationProgress.currentClass || "Starting..."}</span>
                  </div>
                  <div>
                    <span className="text-[var(--t3)]">Students Processed:</span>{" "}
                    <span className="font-semibold">{generationProgress.studentsProcessed}</span>
                  </div>
                  <div>
                    <span className="text-[var(--t3)]">Errors:</span>{" "}
                    <span
                      className={`font-semibold ${generationProgress.errors > 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {generationProgress.errors}
                    </span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        <Card className="mb-5">
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="report-cards-class" className="block text-sm font-medium mb-2 text-[var(--on-surface)]">
                  Select Class
                </label>
                {classes.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                    No classes available
                  </div>
                ) : (
                  <select
                    id="report-cards-class"
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setGenerated(false);
                      setReports([]);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.stream ? ` ${c.stream}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">Term</label>
                <div className="px-4 py-3 rounded-xl bg-[var(--surface-container)] text-[var(--primary)] font-semibold">
                  Term {currentTerm}, {academicYear}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">Students</label>
                <div className="px-4 py-3 rounded-xl bg-[var(--surface-container)] text-[var(--primary)] font-semibold">
                  {filteredStudents.length} students
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">Report Format</label>
                <select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value as "numerical" | "competency" | "both" | "cbc")}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                >
                  <option value="numerical">Numerical (Marks)</option>
                  <option value="competency">CBC Competency</option>
                  <option value="both">Combined (Marks + Competency)</option>
                  <option value="cbc">CBC/NCDC Report (A4)</option>
                </select>
              </div>
            </div>
          </CardBody>
        </Card>

        {generated && hasMissingMarks && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-center gap-3">
            <MaterialIcon icon="warning" className="text-amber-600" style={{ color: "#d97706" }} />
            <div>
              <div className="font-semibold text-amber-800">Incomplete Data Detected</div>
              <div className="text-sm text-amber-700">
                Some students have missing marks for certain subjects. These are marked as "M.M". Printing these report
                cards may be misleading.
              </div>
            </div>
          </div>
        )}

        {generated && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
            <Card>
              <CardBody className="text-center">
                <div className="text-xs font-semibold text-[var(--t3)] mb-1">Class Average</div>
                <div className="text-2xl font-bold text-[var(--primary)]">{stats.avgTotal}%</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-xs font-semibold text-[var(--t3)] mb-1">Division 1</div>
                <div className="text-2xl font-bold text-green-600">{stats.div1} students</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-xs font-semibold text-[var(--t3)] mb-1">Fee Defaulters</div>
                <div className="text-2xl font-bold text-red-600">{stats.withFees} students</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-xs font-semibold text-[var(--t3)] mb-1">Total Students</div>
                <div className="text-2xl font-bold text-[var(--on-surface)]">{reports.length}</div>
              </CardBody>
            </Card>
          </div>
        )}

        {generated && (
          <div className="flex items-center gap-3 mb-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideWithFees}
                onChange={(e) => setHideWithFees(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold text-[var(--on-surface)]">
                Hide students with outstanding fees
              </span>
            </label>
          </div>
        )}

        {generated && displayedReports.length > 0 && (
          <Card>
            <CardBody>
              <input
                type="text"
                placeholder="Search by student name..."
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm mb-4"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-container)] text-left">
                      <th className="px-6 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)]">
                        Student
                      </th>
                      <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-center">
                        Total
                      </th>
                      <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-center">
                        Average
                      </th>
                      <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-center">
                        Position
                      </th>
                      <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-center">
                        Division
                      </th>
                      <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)]">
                        Fees
                      </th>
                      <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)]">
                        Comments
                      </th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {displayedReports.map((report) => {
                      const studentComment = comments[report.studentId] || {
                        classTeacher: "",
                        hm: "",
                      };
                      return (
                        <tr key={report.studentId} className="hover:bg-[var(--surface-container)] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full">
                                {report.photoUrl ? (
                                  <Image
                                    src={report.photoUrl}
                                    alt={report.name}
                                    width={36}
                                    height={36}
                                    unoptimized
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <PersonInitials name={report.name} size={36} />
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-[var(--primary)]">{report.name}</div>
                                <div className="text-xs text-[var(--t3)] font-mono">{report.studentNumber}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="font-bold text-lg text-[var(--primary)]">{report.totalMarks}</span>
                            <span className="text-xs text-[var(--t3)]">/{report.maxMarks}</span>
                          </td>
                          <td className="px-4 py-4 text-center font-semibold">{report.average}%</td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-sm">
                              {report.position}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${report.division === "Division 1" ? "bg-green-100 text-green-700" : report.division === "Division 2" ? "bg-blue-100 text-blue-700" : report.division === "Division 3" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
                            >
                              {report.division}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {report.feeBalance > 0 ? (
                              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                {report.feeBalance.toLocaleString()} UGX
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                Clear
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-1.5 max-w-[260px]">
                              <div>
                                <label className="text-[10px] font-semibold uppercase text-[var(--t3)]">
                                  Class Teacher
                                </label>
                                <input
                                  type="text"
                                  value={studentComment.classTeacher}
                                  onChange={(e) =>
                                    handleCommentChange(report.studentId, "classTeacher", e.target.value)
                                  }
                                  className="w-full rounded-[14px] border border-[#dce4ee] bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/12"
                                  placeholder="Class teacher comment..."
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold uppercase text-[var(--t3)]">
                                  Headteacher
                                </label>
                                <input
                                  type="text"
                                  value={studentComment.hm}
                                  onChange={(e) => handleCommentChange(report.studentId, "hm", e.target.value)}
                                  className="w-full rounded-[14px] border border-[#dce4ee] bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/12"
                                  placeholder="HM comment..."
                                />
                              </div>
                              <button
                                onClick={() => handleSuggestComment(report.studentId, report.position)}
                                className="text-[10px] font-semibold text-[var(--primary)] hover:underline"
                              >
                                Auto-suggest
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => handlePrintReport(report)}
                                title="Print Report Card"
                                className="p-2 rounded-lg hover:bg-[var(--surface-container)] text-[var(--t3)]"
                              >
                                <MaterialIcon className="text-xl">print</MaterialIcon>
                              </button>
                              <button
                                onClick={() => handleSendSms(report)}
                                disabled={sendingSms}
                                title="Send SMS"
                                className="p-2 rounded-lg hover:bg-[var(--surface-container)] text-[var(--t3)] disabled:opacity-40"
                              >
                                <MaterialIcon className="text-xl">sms</MaterialIcon>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}

        {!generated && (
          <Card>
            <CardBody>
              <EmptyState
                icon="summarize"
                title="Generate Cards"
                description="Select a class and click Generate to create report cards with positions, divisions, and comments."
              />
            </CardBody>
          </Card>
        )}

        {generated && displayedReports.length === 0 && reports.length > 0 && (
          <Card>
            <CardBody>
              <EmptyState
                icon="filter_alt_off"
                title="All Hidden"
                description="All students have outstanding fees. Uncheck the filter to view."
              />
            </CardBody>
          </Card>
        )}
      </div>
    </PageErrorBoundary>
  );
}
