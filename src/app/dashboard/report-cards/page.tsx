"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { generateUgandaPrimaryBody, ugandaDocumentShell } from "@/components/reports/ugandaPrimaryReport";
import { openPrintWindow, printWhenReady, writePrintDocument } from "@/lib/print-window";
import { useToast } from "@/components/Toast";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { PageHeader } from "@/components/ui/PageHeader";
import PersonInitials from "@/components/ui/PersonInitials";
import SearchField from "@/components/ui/SearchField";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useAcademic } from "@/lib/academic-context";
import { APP_NAME } from "@/lib/app-name";
import { useAuth } from "@/lib/auth-context";
import {
  calculateCBCSubject,
  cbcIdentifierValue,
  summarizeCBCSubjects,
  type CBCSubjectEntry,
  escapeHtml,
  generateCBCReportHTML,
} from "@/lib/cbc-report";
import { DEMO_GRADES, DEMO_SUBJECTS } from "@/lib/demo-data";
import { useClasses, useFeePayments, useFeeStructure, useStudents, useSubjects } from "@/lib/hooks";
import { isTimeoutResult, timeoutFallback, withTimeout } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";
import { searchReportList } from "@/lib/report-list";
import { classicReportSubject, rankCompleteReports, summarizeClassicReport } from "@/lib/report-summary";
import { loadSchoolSettings } from "@/lib/school-settings";
import { type ReportLayoutId, SETTING_KEYS, resolveUseBot } from "@/lib/grading-tracks";
import {
  bucketUgandaSubject,
  orderUgandaSubjects,
  sumUgandaTotals,
  type UgandaSubjectResult,
} from "@/lib/uganda-report";

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
    /** MID/END/AVG/AGG breakdown for the Uganda print layout (additive). */
    uganda?: UgandaSubjectResult;
  }[];
  totalMarks: number;
  maxMarks: number;
  average: number;
  position: number;
  division: string;
  classTeacherComment: string;
  hmComment: string;
  feeBalance: number;
  isComplete?: boolean;
  recordedSubjects?: number;
  aggregate?: number | null;
}

function getGradeColor(grade: string): string {
  if (grade.startsWith("D")) return "text-green-600";
  if (grade.startsWith("C")) return "text-blue-600";
  if (grade.startsWith("P")) return "text-yellow-600";
  return grade === "F9" ? "text-red-500" : "text-amber-600";
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

function getAutoComment(position: number): string {
  if (position <= 0) return "Assessment incomplete. Complete the missing marks before ranking.";
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
  const { students: classStudents } = useStudents(school?.id, { limit: 1000 });
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
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    currentClass: string;
    studentsProcessed: number;
    errors: number;
  }>({ current: 0, total: 0, currentClass: "", studentsProcessed: 0, errors: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [urlStudentIds, setUrlStudentIds] = useState<string[]>([]);
  // True when the shown cards were computed from the on-device cache because
  // the network was down or timed out — preview + print work, saving waits.
  const [offlinePreview, setOfflinePreview] = useState(false);

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
    return list;
  }, [classStudents, selectedClass, urlStudentIds]);

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
    const eligible = hideWithFees ? reports.filter((r) => getStudentFeeBalance(r.studentId) === 0) : reports;
    return searchReportList(eligible, searchQuery);
  }, [reports, hideWithFees, getStudentFeeBalance, searchQuery]);

  const [reportLayout, setReportLayout] = useState<ReportLayoutId>("uganda_classic");
  // Whether the school runs a beginning-of-term test. Drives whether the printed
  // report has a BOT column at all.
  const [showBot, setShowBot] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setReportLayout("uganda_classic");
    setReportFormat("numerical");
    if (!school?.id) return;
    if (isDemo) {
      try {
        const settings = JSON.parse(sessionStorage.getItem("demo-grading-settings") || "{}");
        const layout = settings[SETTING_KEYS.reportLayout] === "ncdc_cbc" ? "ncdc_cbc" : "uganda_classic";
        setReportLayout(layout);
        setReportFormat(layout === "ncdc_cbc" ? "cbc" : "numerical");
        setShowBot(resolveUseBot(settings));
      } catch {
        setReportFormat("numerical");
      }
      return;
    }
    void withTimeout(
      loadSchoolSettings(school.id),
      10000,
      {},
    ).then((settings) => {
      if (cancelled) return;
      const resolved = settings[SETTING_KEYS.reportLayout] === "ncdc_cbc" ? "ncdc_cbc" : "uganda_classic";
      setReportLayout(resolved);
      setReportFormat(resolved === "ncdc_cbc" ? "cbc" : "numerical");
      setShowBot(resolveUseBot(settings));
    });
    return () => {
      cancelled = true;
    };
  }, [school?.id, isDemo]);

  const stats = useMemo(() => {
    if (reports.length === 0) return { avgTotal: 0, div1: 0, withFees: 0 };

    const completed = reports.filter((report) => report.isComplete !== false && report.maxMarks > 0);
    const avg = completed.length ? completed.reduce((sum, report) => sum + report.average, 0) / completed.length : null;
    const div1 = completed.filter((report) => ["Division 1", "Division I"].includes(report.division)).length;
    const withFees = reports.filter((r) => getStudentFeeBalance(r.studentId) > 0).length;

    return {
      avgTotal: avg === null ? null : Math.round(avg * 10) / 10,
      div1,
      withFees,
    };
  }, [reports, getStudentFeeBalance]);

  // Grades for one class: live from Supabase, falling back to the on-device
  // IndexedDB cache when offline or timed out (a timeout means UNKNOWN, not
  // empty — see isTimeoutResult). Cached rows lack the joined subjects, so
  // subject names are hydrated from the already-loaded subjects list.
  const fetchReportGrades = async (
    classId: string,
    assessmentTypes: string[],
  ): Promise<{ rows: any[]; offline: boolean }> => {
    const { supabase: sb } = await import("@/lib/supabase");
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("offline");
      const res = await withTimeout(
        sb
          .from("grades")
          .select("*, subjects(id, name)")
          .eq("class_id", classId)
          .eq("term", currentTerm)
          .eq("academic_year", academicYear)
          .in("assessment_type", assessmentTypes),
        15000,
        timeoutFallback(),
      );
      if ((res as { error?: unknown })?.error) throw (res as { error: unknown }).error;
      if (isTimeoutResult(res)) throw new Error("timeout");
      return { rows: ((res as { data?: unknown }).data as any[]) || [], offline: false };
    } catch {
      const { offlineDB } = await import("@/lib/offline");
      const cached = await offlineDB.getAll("grades", { class_id: classId });
      const nameById = new Map((subjects as any[]).map((s: any) => [s.id, s.name]));
      const rows = (cached as Record<string, unknown>[])
        .filter(
          (g) =>
            String(g.term) === String(currentTerm) &&
            String(g.academic_year) === String(academicYear) &&
            assessmentTypes.includes(String(g.assessment_type)),
        )
        .map((g) => ({
          ...(g as object),
          subjects: { id: g.subject_id, name: nameById.get(g.subject_id as string) || "Unknown" },
        }));
      return { rows, offline: true };
    }
  };

  async function generateReportsForClass(
    classId: string,
    className: string,
    students: any[],
  ): Promise<{ reports: StudentReport[]; missingMarks: boolean; offline: boolean }> {
    if (reportFormat === "cbc") {
      return generateCBCReports(classId, className, students);
    }
    let gradesData: any[] = [];
    let competencyData: any[] = [];
    let usedOffline = false;

    if (isDemo) {
      gradesData = DEMO_GRADES.filter((grade) => grade.class_id === classId).map((grade) => {
        const fixtureSubject = DEMO_SUBJECTS.find((subject) => subject.id === grade.subject_id);
        const currentSubject = subjects.find((subject) => subject.name === fixtureSubject?.name);
        return {
          ...grade,
          subject_id: currentSubject?.id || grade.subject_id,
          subjects: currentSubject || fixtureSubject || null,
        };
      });
    } else {
      const main = await fetchReportGrades(classId, [
        "bot",
        "mid_term",
        "ca1",
        "ca2",
        "ca3",
        "ca4",
        "project",
        "exam",
        "u1",
        "u2",
        "eot",
      ]);
      gradesData = main.rows;
      usedOffline = main.offline;

      if (reportFormat !== "numerical") {
        const comp = await fetchReportGrades(classId, ["competency"]);
        competencyData = comp.rows;
        usedOffline = usedOffline || comp.offline;
      }
    }

    const studentSubjectScores: Record<
      string,
      Record<string, { name: string; rows: { assessment_type: string; score: number; max_score?: number | null }[] }>
    > = {};
    const studentCompetencies: Record<string, Record<string, { level: string; notes: string; name: string }>> = {};

    for (const g of gradesData) {
      if (!studentSubjectScores[g.student_id]) {
        studentSubjectScores[g.student_id] = {};
      }
      const subjName = g.subjects?.name || "Unknown";
      if (!studentSubjectScores[g.student_id][g.subject_id]) {
        studentSubjectScores[g.student_id][g.subject_id] = {
          name: subjName,
          rows: [],
        };
      }
      studentSubjectScores[g.student_id][g.subject_id].rows.push({
        assessment_type: g.assessment_type,
        score: g.score == null ? Number.NaN : Number(g.score),
        max_score: g.max_score ?? null,
      });
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

    if (students.length === 0) {
      return { reports: [], missingMarks: false, offline: usedOffline };
    }

    const reportList: StudentReport[] = students.map((student) => {
      const subjScores = studentSubjectScores[student.id] || {};
      const studentComp = studentCompetencies[student.id] || {};
      const subjectDetails = Object.entries(subjScores).map(([subjId, data]) => {
        const result = classicReportSubject(data.rows);
        const comp = studentComp[subjId];
        return {
          subjectId: subjId,
          name: data.name,
          score: result.score,
          grade: result.grade,
          gradeColor: getGradeColor(result.grade),
          competencyLevel: comp?.level,
          competencyNotes: comp?.notes,
          isMissing: result.isMissing,
          uganda: result.uganda,
        };
      });

      const allSubjectDetails = subjects.map((sub: any) => {
        const existing = subjectDetails.find((sd) => sd.subjectId === sub.id);
        return (
          existing || {
            name: sub.name,
            score: 0,
            grade: "M.M",
            gradeColor: "text-amber-500",
            competencyLevel: "not_started",
            isMissing: true,
            uganda: bucketUgandaSubject([]),
          }
        );
      });

      const summary = summarizeClassicReport(allSubjectDetails, className);

      return {
        studentId: student.id,
        name: `${student.first_name} ${student.last_name}`,
        studentNumber: student.student_number || "",
        gender: student.gender,
        photoUrl: student.photo_url,
        className,
        subjects: allSubjectDetails,
        ...summary,
        position: 0,
        division: summary.division,
        classTeacherComment: "",
        hmComment: "",
        feeBalance: getStudentFeeBalance(student.id),
      };
    });

    const rankedReports = rankCompleteReports(reportList);
    rankedReports.forEach((r) => {
      r.classTeacherComment = getAutoComment(r.position);
      r.hmComment = getAutoComment(r.position);
    });

    const missing = reportList.some((r) => r.subjects.some((s: any) => s.isMissing));

    return { reports: rankedReports, missingMarks: missing, offline: usedOffline };
  }

  async function generateCBCReports(
    classId: string,
    className: string,
    students: any[],
  ): Promise<{ reports: StudentReport[]; missingMarks: boolean; offline: boolean }> {
    if (students.length === 0) return { reports: [], missingMarks: false, offline: false };

    // One cached-or-live fetch, split client-side (was 3 round-trips).
    const fetched = isDemo
      ? { rows: [], offline: false }
      : await fetchReportGrades(classId, ["u1", "u2", "eot", "exam", "competency", "identifier_score", "aoi"]);

    const reportList: StudentReport[] = students.map((student) => {
      const studentRows = fetched.rows.filter((row: any) => row.student_id === student.id);
      const subjectsCBC = subjects.map((subject) => {
        const rows = studentRows.filter((row: any) => row.subject_id === subject.id);
        const u1ForSubj = rows.filter((row: any) => row.assessment_type === "u1");
        const u2ForSubj = rows.filter((row: any) => row.assessment_type === "u2");
        const calculation = calculateCBCSubject(rows);
        const grade = calculation.grade;
        const learningOutcomes: CBCSubjectEntry["learningOutcomes"] = [];
        const maxLen = Math.max(u1ForSubj.length, u2ForSubj.length);
        for (let i = 0; i < maxLen; i++) {
          learningOutcomes.push({
            description: u1ForSubj[i]?.topic_name || u2ForSubj[i]?.topic_name || `Learning outcome ${i + 1}`,
            u1Score: u1ForSubj[i] ? cbcIdentifierValue(u1ForSubj[i]) : null,
            u2Score: u2ForSubj[i] ? cbcIdentifierValue(u2ForSubj[i]) : null,
          });
        }
        for (const row of rows.filter((item: any) =>
          ["competency", "identifier_score", "aoi"].includes(item.assessment_type),
        )) {
          learningOutcomes.push({
            description: row.topic_name || "Learning outcome",
            u1Score: null,
            u2Score: null,
            identifierScore: cbcIdentifierValue(row),
          });
        }

        return {
          ...calculation,
          name: subject.name,
          score: calculation.totalMark ?? 0,
          gradeColor:
            grade === "A+" || grade === "A"
              ? "text-green-600"
              : grade === "B" || grade === "C"
                ? "text-blue-600"
                : grade === "D" || grade === "E"
                  ? "text-amber-600"
                  : "text-red-500",
          isMissing: calculation.totalMark === null,
          teacherName: u1ForSubj[0]?.teacher_remark ? "Subject Teacher" : "Subject Teacher",
          teacherRemark: u1ForSubj[0]?.teacher_remark || "",
          teacherInitials: "",
          learningOutcomes,
        };
      });

      const summary = summarizeCBCSubjects(subjectsCBC);

      return {
        studentId: student.id,
        name: `${student.first_name} ${student.last_name}`,
        studentNumber: student.student_number || "",
        gender: student.gender,
        photoUrl: student.photo_url,
        className,
        subjects: subjectsCBC as any,
        totalMarks: summary.totalMarkSum ?? 0,
        maxMarks: summary.recordedSubjects * 100,
        average: summary.overallAverage ?? 0,
        isComplete: summary.isComplete,
        recordedSubjects: summary.recordedSubjects,
        position: 0,
        division: summary.averageGrade,
        classTeacherComment: "",
        hmComment: "",
        feeBalance: getStudentFeeBalance(student.id),
      } as StudentReport;
    });

    const rankedReports = rankCompleteReports(reportList);
    rankedReports.forEach((r) => {
      r.classTeacherComment = getAutoComment(r.position);
      r.hmComment = getAutoComment(r.position);
    });

    const missing = reportList.some((r) => r.subjects.some((s: any) => s.isMissing));
    return { reports: rankedReports, missingMarks: missing, offline: fetched.offline };
  }

  const persistReportCards = async (
    reportList: StudentReport[],
    classId: string,
    gradesFromCache = false,
  ): Promise<{ savedCount: number; failedNames: string[]; queued: boolean }> => {
    if (isDemo) return { savedCount: 0, failedNames: [], queued: false };
    const persistableReports = reportList.filter((report) => report.isComplete !== false);
    const incompleteNames = reportList.filter((report) => report.isComplete === false).map((report) => report.name);
    const cardPayloads = persistableReports.map((rpt) => {
      const subjectsJson = rpt.subjects.map((s) => ({
        name: s.name,
        score: s.isMissing ? null : s.score,
        grade: s.grade,
        gradeColor: s.gradeColor,
        competencyLevel: s.competencyLevel,
        competencyNotes: s.competencyNotes,
        isMissing: s.isMissing,
        ...(reportFormat === "cbc"
          ? {
              u1Average: (s as any).u1Average ?? null,
              u2Average: (s as any).u2Average ?? null,
              averageIdentifier: (s as any).averageIdentifier ?? null,
              formativeScore: (s as any).formativeScore ?? null,
              eotScore: (s as any).eotScore ?? null,
              summativeScore: (s as any).summativeScore ?? null,
              learningOutcomes: (s as any).learningOutcomes ?? [],
            }
          : {}),
      }));
      const rptBest4 =
        rpt.recordedSubjects !== undefined
          ? rpt.subjects
              .map((subject) => subject.uganda?.agg)
              .filter((points): points is number => points != null)
              .sort((left, right) => left - right)
              .slice(0, 4)
          : [...rpt.subjects.map((subject) => subject.score)].sort((left, right) => right - left).slice(0, 4);
      return {
        school_id: school?.id,
        student_id: rpt.studentId,
        class_id: classId,
        academic_year: academicYear,
        term: currentTerm,
        report_format: reportFormat === "cbc" ? "cbc" : reportFormat === "competency" ? "competency" : "numerical",
        subjects: subjectsJson,
        aggregate: rpt.recordedSubjects !== undefined ? (rpt.aggregate ?? null) : rptBest4.reduce((a, b) => a + b, 0),
        division: rpt.division,
        best4: rptBest4,
        generated_at: new Date().toISOString(),
        generated_by: user?.full_name || user?.id || "system",
        _name: rpt.name,
      };
    });

    // Offline (or grades served from cache after a timeout): queue cards into
    // IndexedDB (synced by Sync Center on reconnect) instead of burning a
    // timeout per row against a dead network.
    if (gradesFromCache || (typeof navigator !== "undefined" && !navigator.onLine)) {
      const { offlineDB } = await import("@/lib/offline");
      let queued = 0;
      const failedNames: string[] = [...incompleteNames];
      for (const payload of cardPayloads) {
        try {
          const { _name, ...row } = payload as Record<string, unknown> & { _name?: string };
          void _name;
          await offlineDB.save("report_cards", row);
          queued++;
        } catch {
          failedNames.push(String((payload as { _name?: string })._name || "unknown"));
        }
      }
      return { savedCount: queued, failedNames, queued: true };
    }

    const { supabase: sb } = await import("@/lib/supabase");

    let savedCount = 0;
    const failedNames: string[] = [...incompleteNames];

    for (let i = 0; i < cardPayloads.length; i++) {
      const rpt = persistableReports[i];
      const { _name, ...cardPayload } = cardPayloads[i] as Record<string, unknown> & { _name?: string };
      void _name;
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

    return { savedCount, failedNames, queued: false };
  };

  const handleGenerate = async () => {
    if (generating || generatingAll) return;
    if (!selectedClass) {
      toast.error("Please select a class first");
      return;
    }
    if (filteredStudents.length === 0 && !isDemo) {
      toast.error("No students in this class");
      return;
    }

    setGenerating(true);
    try {
      const {
        reports: reportList,
        missingMarks,
        offline,
      } = await generateReportsForClass(selectedClass, selectedClassName, filteredStudents);

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
      setOfflinePreview(offline);

      const { savedCount, failedNames, queued } = await persistReportCards(reportList, selectedClass, offline);

      if (isDemo) {
        toast.info(`Demo preview generated for ${reportList.length} students. No school records were saved.`);
      } else if (queued) {
        toast.info(
          `Offline — ${savedCount} card${savedCount === 1 ? "" : "s"} queued on this device, will upload on reconnect. Print works now.`,
        );
      } else if (failedNames.length > 0) {
        toast.warning(
          `Saved ${savedCount}/${reportList.length} report cards. Incomplete or unsaved: ${failedNames.slice(0, 3).join(", ")}${
            failedNames.length > 3 ? ` and ${failedNames.length - 3} more` : ""
          }`,
        );
      } else {
        toast.success(`Report cards generated for ${savedCount} students`);
      }
    } catch (err) {
      logger.error("Error generating report cards:", err);
      toast.error("Failed to generate report cards");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (generating || generatingAll) return;
    if (classes.length === 0) {
      toast.error("No classes available");
      return;
    }

    setGeneratingAll(true);
    setOfflinePreview(false);
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
    let totalQueued = 0;

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
        const { reports: classReports, offline: classOffline } = await generateReportsForClass(
          c.id,
          className,
          studentsForClass,
        );

        allReports.push(...classReports);
        totalStudents += classReports.length;
        setGenerationProgress((prev) => ({
          ...prev,
          studentsProcessed: totalStudents,
        }));

        if (classOffline) {
          // Offline: queue into IndexedDB (synced on reconnect), skip the
          // per-row live saves — each would burn a timeout.
          const queued = await persistReportCards(classReports, c.id, true);
          totalQueued += queued.savedCount;
          totalFailed += queued.failedNames.length;
          setOfflinePreview(true);
        } else {
          const { savedCount, failedNames } = await persistReportCards(classReports, c.id, false);
          totalSaved += savedCount;
          totalFailed += failedNames.length;
        }
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

      if (isDemo) {
        toast.info(`Demo preview generated for ${allReports.length} students. No school records were saved.`);
      } else if (totalQueued > 0) {
        toast.info(
          `Offline — ${totalQueued} cards queued on this device across ${classes.length} classes, will upload on reconnect. Print works now.`,
        );
      } else if (totalFailed > 0) {
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

  // Term attendance + next-term start for the Uganda print layout. Best
  // effort: any failure yields blanks ("—"), never zeros or thrown errors.
  // Batched per class so print-all pays one attendance query, not hundreds.
  const fetchUgandaBatch = async (
    classId: string,
  ): Promise<{ byStudent: Map<string, { present: number; total: number }>; nextTermBegins: string | null }> => {
    const empty = {
      byStudent: new Map<string, { present: number; total: number }>(),
      nextTermBegins: null as string | null,
    };
    if (isDemo || !school?.id || !classId) return empty;
    try {
      const { supabase: sb } = await import("@/lib/supabase");
      const termsRes = await withTimeout(
        sb
          .from("academic_terms")
          .select("term_number,start_date,end_date")
          .eq("school_id", school.id)
          .eq("academic_year", academicYear)
          .then((r) => {
            if (r.error) throw r.error;
            return r.data ?? [];
          }),
        8000,
        null,
      );
      if (!termsRes) return empty;
      const current = (termsRes as { term_number: number; start_date: string; end_date: string }[]).find(
        (t) => Number(t.term_number) === Number(currentTerm),
      );
      const following = (termsRes as { term_number: number; start_date: string }[]).find(
        (t) => Number(t.term_number) === Number(currentTerm) + 1,
      );
      const nextTermBegins = following?.start_date
        ? new Date(`${following.start_date}T00:00:00`).toLocaleDateString("en-GB")
        : null;
      if (!current?.start_date || !current?.end_date) return { byStudent: empty.byStudent, nextTermBegins };
      const attRes = await withTimeout(
        sb
          .from("attendance")
          .select("student_id,date,status")
          .eq("class_id", classId)
          .gte("date", current.start_date)
          .lte("date", current.end_date)
          .limit(10000)
          .then((r) => {
            if (r.error) throw r.error;
            return (r.data ?? []) as { student_id: string; date: string; status: string }[];
          }),
        12000,
        null,
      );
      if (!attRes) return { byStudent: empty.byStudent, nextTermBegins };
      const days = new Set(attRes.map((r) => r.date)).size;
      const byStudent = new Map<string, { present: number; total: number }>();
      for (const row of attRes) {
        if (row.status !== "present") continue;
        const entry = byStudent.get(row.student_id) ?? { present: 0, total: days };
        entry.present += 1;
        byStudent.set(row.student_id, entry);
      }
      return { byStudent, nextTermBegins };
    } catch (err) {
      logger.warn("Uganda report context unavailable, printing with blanks:", err);
      return { byStudent: new Map(), nextTermBegins: null };
    }
  };

  const buildUgandaBody = async (
    report: StudentReport,
    ctx: { byStudent: Map<string, { present: number; total: number }>; nextTermBegins: string | null },
  ): Promise<string> => {
    const studentComment = comments[report.studentId] || { classTeacher: "", hm: "" };
    const ordered = orderUgandaSubjects(
      report.subjects.map((s) => ({
        name: s.name,
        bot: s.uganda?.mid ?? null,
        mot: s.uganda?.mot ?? null,
        eot: s.uganda?.end ?? null,
        avg: s.uganda?.avg ?? null,
        agg: s.uganda?.agg ?? null,
        grade: s.uganda?.grade ?? "—",
        remarks: s.competencyNotes || "",
      })),
    );
    const totals = sumUgandaTotals(
      ordered.map((subject) => ({ mid: subject.bot, end: subject.eot, avg: subject.avg, agg: subject.agg })),
    );
    const att = ctx.byStudent.get(report.studentId);
    return generateUgandaPrimaryBody({
      school: {
        name: school?.name || "SCHOOL NAME",
        address: (school as any)?.address || "",
        phone: (school as any)?.phone || school?.email || "",
        motto: (school as any)?.school_motto || (school as any)?.motto || "",
        logoUrl: school?.logo_url || "",
        sigClassUrl: (school as any)?.signature_class_teacher_url || "",
        sigHeadUrl: (school as any)?.signature_headteacher_url || "",
      },
      pupil: {
        name: report.name,
        studentNumber: report.studentNumber,
        gender: report.gender === "M" ? "Male" : report.gender === "F" ? "Female" : report.gender || "",
        className: report.className,
        photoUrl: report.photoUrl || "",
        term: currentTerm,
        year: academicYear,
        attendancePresent: att?.present ?? null,
        attendanceTotal: att && att.total > 0 ? att.total : null,
      },
      subjects: ordered,
      totals:
        report.recordedSubjects === undefined
          ? totals
          : { ...totals, aggSum: report.aggregate ?? null, division: report.division },
      comments: { classTeacher: studentComment.classTeacher, hm: studentComment.hm },
      showBot,
      feeBalance: report.feeBalance,
      nextTermBegins: ctx.nextTermBegins,
    });
  };

  const openUgandaPrintWindow = async (title: string, bodyHtml: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.title = title;
    printWindow.document.write(ugandaDocumentShell(title, bodyHtml));
    printWindow.document.close();
    await Promise.all(
      Array.from(printWindow.document.images).map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.onload = () => resolve();
              image.onerror = () => resolve();
              setTimeout(resolve, 5000);
            }),
      ),
    );
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintUganda = async (report: StudentReport) => {
    const ctx = await fetchUgandaBatch(selectedClass);
    await openUgandaPrintWindow(`Progress Report - ${report.name}`, await buildUgandaBody(report, ctx));
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
            ? `<td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.isMissing ? "—" : s.score}</td>
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

    const printWindow = openPrintWindow();
    if (!printWindow) {
      toast.error("Your browser blocked the print window. Allow pop-ups for this site and try again.");
      return;
    }

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
        <div class="summary-card"><div class="summary-value">${report.maxMarks ? `${report.totalMarks}/${report.maxMarks}` : "—"}</div><div class="summary-label">Total</div></div>
        <div class="summary-card"><div class="summary-value">${report.maxMarks ? `${report.average}%` : "—"}</div><div class="summary-label">Average (recorded subjects)</div></div>
        <div class="summary-card"><div class="summary-value">${report.position || "—"}</div><div class="summary-label">Position</div></div>
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

    // Was document.open() + body.innerHTML, which threw because Chrome leaves
    // document.body null after open() -- the popup stayed blank and print() was
    // never reached, so this produced an empty tab and no PDF.
    writePrintDocument(printWindow, `Report Card - ${report.name}`, printCardBody, {
      styles: printCardStyles,
    });
    void printWhenReady(printWindow);
  };

  const handlePrintCBCReport = (report: StudentReport) => {
    const student = classStudents.find((s) => s.id === report.studentId);
    if (!student) return;
    const classTeacherName = (selectedClassObj as any)?.class_teacher_name || "Class Teacher";
    const studentComment = comments[report.studentId] || { classTeacher: "", hm: "" };
    const cbcSubjects: CBCSubjectEntry[] = report.subjects.map((subject) => {
      const details = subject as typeof subject & Partial<CBCSubjectEntry>;
      return {
        name: subject.name,
        teacherName: details.teacherName || "Subject Teacher",
        teacherRemark: details.teacherRemark || "",
        teacherInitials: details.teacherInitials || "",
        learningOutcomes: details.learningOutcomes || [],
        u1Average: details.u1Average ?? null,
        u2Average: details.u2Average ?? null,
        averageIdentifier: details.averageIdentifier ?? null,
        formativeScore: details.formativeScore ?? null,
        eotScore: details.eotScore ?? null,
        summativeScore: details.summativeScore ?? null,
        totalMark: subject.isMissing ? null : subject.score,
        grade: subject.grade,
      };
    });

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
      subjects: cbcSubjects,
      summary: summarizeCBCSubjects(cbcSubjects),
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
      nextTermOpens: "—",
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

  const handlePrintAll = async () => {
    if (displayedReports.length === 0) return;

    if (reportFormat === "cbc") {
      toast.info("Print individual reports using the print button per student");
      return;
    }

    // Uganda progress reports for the whole list, one attendance batch.
    const ctx = await fetchUgandaBatch(selectedClass);
    const pages: string[] = [];
    for (const [index, report] of displayedReports.entries()) {
      const body = await buildUgandaBody(report, ctx);
      pages.push(`<div class="${index > 0 ? "page-break" : ""}">${body}</div>`);
    }
    openUgandaPrintWindow(`Progress Reports - ${selectedClassName} (${displayedReports.length})`, pages.join(""));
  };

  /* Bulk print uses the Uganda layout in handlePrintAll above; the old builder was removed. */

  const handleSendSms = async (report: StudentReport) => {
    if (report.isComplete === false) {
      toast.warning("Complete missing or invalid marks before sending results.");
      return;
    }
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
    <div className="flex flex-wrap gap-2">
      {generated && reports.length > 0 && (
        <Button
          variant="ghost"
          onClick={handlePrintAll}
          className="border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
        >
          <MaterialIcon icon="print_connect" style={{ fontSize: "18px" }} />
          Print visible ({displayedReports.length})
        </Button>
      )}
      {classes.length > 0 && (
        <Button
          variant="ghost"
          onClick={handleGenerateAll}
          disabled={generatingAll || generating}
          className="border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
        >
          <MaterialIcon icon="select_all" style={{ fontSize: "18px" }} />
          Generate All Classes
        </Button>
      )}
      <Button
        onClick={handleGenerate}
        disabled={generatingAll || generating}
        loading={generating}
        className="bg-indigo-600 shadow-indigo-600/20"
      >
        <MaterialIcon icon="bolt" style={{ fontSize: "18px" }} />
        Generate Now
      </Button>
    </div>
  );

  return (
    <PageErrorBoundary>
      <div className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
        <PageHeader title="Report Cards" subtitle="Generate and manage student report cards" actions={actions} />

        {offlinePreview && generated && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <MaterialIcon icon="cloud_off" style={{ fontSize: "20px" }} />
            <div>
              <span className="font-semibold">Offline preview.</span> These cards were computed from marks saved on this
              device — you can print them now. Reconnect and re-generate to save official copies.
            </div>
          </div>
        )}

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
                    disabled={generating || generatingAll}
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setGenerated(false);
                      setReports([]);
                      setSearchQuery("");
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
                <label htmlFor="report-card-format" className="block text-sm font-medium mb-2 text-[var(--on-surface)]">
                  Report Format
                </label>
                <select
                  id="report-card-format"
                  disabled={generating || generatingAll}
                  value={reportFormat}
                  onChange={(event) => {
                    setReportFormat(event.target.value as "numerical" | "competency" | "both" | "cbc");
                    setGenerated(false);
                    setReports([]);
                    setComments({});
                    setSearchQuery("");
                  }}
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
                Averages use recorded subjects only. Missing or invalid marks show as —. Incomplete reports are
                provisional: they are not ranked, sent by SMS, or saved as official results.
              </div>
            </div>
          </div>
        )}

        {generated && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
            <Card>
              <CardBody className="text-center">
                <div className="text-xs font-semibold text-[var(--t3)] mb-1">Class Average</div>
                <div className="text-2xl font-bold text-[var(--primary)]">
                  {stats.avgTotal === null ? "—" : `${stats.avgTotal}%`}
                </div>
                <p className="mt-1 text-xs text-[var(--t3)]">Completed reports only</p>
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

        {generated && (
          <Card>
            <CardBody>
              <div className="mb-4 space-y-2">
                <SearchField
                  label="Search report cards"
                  placeholder="Student name or number…"
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
                <p role="status" className="text-xs text-[var(--t3)]">
                  Showing {displayedReports.length} of {reports.length} report cards
                </p>
              </div>
              {displayedReports.length > 0 ? (
                <div className="overflow-x-auto" role="region" aria-label="Report card results" tabIndex={0}>
                  <table className="block w-full border-collapse md:table md:min-w-[1180px]">
                    <thead className="hidden md:table-header-group">
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
                    <tbody className="grid gap-4 md:table-row-group md:divide-y md:divide-[var(--border)]">
                      {displayedReports.map((report) => {
                        const studentComment = comments[report.studentId] || {
                          classTeacher: "",
                          hm: "",
                        };
                        return (
                          <tr
                            key={report.studentId}
                            className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--border)] p-4 md:table-row md:border-0 md:p-0 md:hover:bg-[var(--surface-container)] transition-colors"
                          >
                            <td className="col-span-2 min-w-0 md:px-6 md:py-4">
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
                                <div className="min-w-0">
                                  <div className="break-words font-semibold text-sm text-[var(--primary)]">
                                    {report.name}
                                  </div>
                                  <div className="break-all text-xs text-[var(--t3)] font-mono">
                                    {report.studentNumber}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="md:px-4 md:py-4 md:text-center">
                              <span className="block text-xs text-[var(--t3)] md:hidden">Total marks</span>
                              <span className="font-bold text-lg text-[var(--primary)]">
                                {report.maxMarks ? report.totalMarks : "—"}
                              </span>
                              {report.maxMarks > 0 && (
                                <span className="text-xs text-[var(--t3)]">/{report.maxMarks}</span>
                              )}
                            </td>
                            <td className="md:px-4 md:py-4 md:text-center font-semibold">
                              <span className="block text-xs font-normal text-[var(--t3)] md:hidden">Average</span>
                              <span data-report-average="">{report.maxMarks ? `${report.average}%` : "—"}</span>
                              {report.isComplete === false && (
                                <span className="block text-xs font-normal text-amber-700">
                                  Provisional · {report.recordedSubjects}/{report.subjects.length} subjects
                                </span>
                              )}
                            </td>
                            <td className="md:px-4 md:py-4 md:text-center">
                              <span className="mb-1 block text-xs text-[var(--t3)] md:hidden">Position</span>
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-sm">
                                {report.position || "—"}
                              </span>
                            </td>
                            <td className="md:px-4 md:py-4 md:text-center">
                              <span className="mb-1 block text-xs text-[var(--t3)] md:hidden">Division</span>
                              <span
                                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${report.isComplete === false ? "bg-amber-100 text-amber-800" : ["Division 1", "Division I"].includes(report.division) ? "bg-green-100 text-green-700" : ["Division 2", "Division II"].includes(report.division) ? "bg-blue-100 text-blue-700" : "bg-[var(--surface-container)] text-[var(--t2)]"}`}
                              >
                                {report.division}
                              </span>
                            </td>
                            <td className="col-span-2 md:px-4 md:py-4">
                              <span className="mb-1 block text-xs text-[var(--t3)] md:hidden">Fee balance</span>
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
                            <td className="col-span-2 min-w-0 md:px-4 md:py-4">
                              <div className="space-y-2 md:max-w-[260px]">
                                <div>
                                  <label
                                    htmlFor={`teacher-comment-${report.studentId}`}
                                    className="text-xs font-semibold text-[var(--t3)]"
                                  >
                                    Class Teacher
                                  </label>
                                  <input
                                    id={`teacher-comment-${report.studentId}`}
                                    type="text"
                                    value={studentComment.classTeacher}
                                    onChange={(e) =>
                                      handleCommentChange(report.studentId, "classTeacher", e.target.value)
                                    }
                                    className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                                    placeholder="Class teacher comment..."
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`hm-comment-${report.studentId}`}
                                    className="text-xs font-semibold text-[var(--t3)]"
                                  >
                                    Headteacher
                                  </label>
                                  <input
                                    id={`hm-comment-${report.studentId}`}
                                    type="text"
                                    value={studentComment.hm}
                                    onChange={(e) => handleCommentChange(report.studentId, "hm", e.target.value)}
                                    className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                                    placeholder="HM comment..."
                                  />
                                </div>
                                <button
                                  onClick={() => handleSuggestComment(report.studentId, report.position)}
                                  type="button"
                                  className="min-h-11 text-xs font-semibold text-[var(--primary)] hover:underline"
                                >
                                  Auto-suggest
                                </button>
                              </div>
                            </td>
                            <td className="col-span-2 md:px-6 md:py-4">
                              <div className="flex flex-wrap gap-1.5 md:justify-end">
                                {reportFormat !== "cbc" && (
                                  <button
                                    onClick={() => handlePrintUganda(report)}
                                    title="Print Uganda progress report"
                                    aria-label={`Print Uganda progress report for ${report.name}`}
                                    className="p-2 rounded-lg hover:bg-[var(--surface-container)] text-[var(--t3)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                                  >
                                    <MaterialIcon className="text-xl">print</MaterialIcon>
                                  </button>
                                )}
                                <button
                                  onClick={() => handlePrintReport(report)}
                                  title={reportFormat === "cbc" ? "Print CBC report" : "Print standard card"}
                                  aria-label={`${reportFormat === "cbc" ? "Print CBC report" : "Print standard card"} for ${report.name}`}
                                  className="p-2 rounded-lg hover:bg-[var(--surface-container)] text-[var(--t3)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                                >
                                  <MaterialIcon className="text-xl">description</MaterialIcon>
                                </button>
                                <button
                                  onClick={() => handleSendSms(report)}
                                  disabled={sendingSms || report.isComplete === false}
                                  title="Send SMS"
                                  aria-label={`Send results by SMS for ${report.name}`}
                                  className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-[var(--surface-container)] text-[var(--t3)] disabled:opacity-40"
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
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center">
                  <EmptyState
                    icon="filter_alt_off"
                    title={reports.length ? "No matching report cards" : "No report cards generated"}
                    description={
                      reports.length
                        ? "Try another name or number, or clear the fee filter."
                        : "Choose a class with students and generate its report cards."
                    }
                  />
                  {reports.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearchQuery("");
                        setHideWithFees(false);
                      }}
                    >
                      Clear report filters
                    </Button>
                  )}
                </div>
              )}
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
      </div>
    </PageErrorBoundary>
  );
}
