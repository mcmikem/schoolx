"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useStudents,
  useClasses,
  useSubjects,
  useExamScores,
  useExams,
} from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import {
  EXAM_TYPES,
  SECONDARY_EXAM_TYPES,
  PRIMARY_EXAM_TYPES,
  calculateWeightedGrade,
  getExamTypeLabel,
  getExamColor,
  ExamConfig,
} from "@/lib/exams";
import { getUNEBGrade, getUNEBDivision } from "@/lib/grading";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Tabs } from "@/components/ui/Tabs";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { NoData } from "@/components/EmptyState";

export default function ExamsPage() {
  const { school, isDemo } = useAuth();
  const { academicYear, currentTerm, isTermLocked } = useAcademic();
  const toast = useToast();
  const router = useRouter();

  const termLocked = isTermLocked
    ? isTermLocked(academicYear, currentTerm)
    : false;

  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id, false);
  const {
    exams,
    loading: examsLoading,
    createExam,
    deleteExam,
  } = useExams(school?.id);
  const {
    examScores,
    loading: scoresLoading,
    saveExamScore,
    deleteExamScore,
  } = useExamScores(undefined, undefined, currentTerm, academicYear);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedExamType, setSelectedExamType] = useState("eot");
  const [showAddExam, setShowAddExam] = useState(false);
  const [examTypeTab, setExamTypeTab] = useState("secondary");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showWeights, setShowWeights] = useState(false);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [customExamWeights, setCustomExamWeights] = useState<ExamConfig[]>([]);
  const [loadingWeights, setLoadingWeights] = useState(true);
  const [newExam, setNewExam] = useState({
    name: "",
    exam_type: "eot",
    class_id: "",
    subject_id: "",
    exam_date: "",
    max_score: 100,
    weight: 50,
  });

  const loadCustomWeights = useCallback(async () => {
    if (!school?.id) {
      setLoadingWeights(false);
      return;
    }
    setLoadingWeights(true);
    const { data, error } = await supabase
      .from("school_settings")
      .select("exam_weights")
      .eq("school_id", school.id)
      .single();

    if (data?.exam_weights) {
      const saved = data.exam_weights as any[];
      const configs: ExamConfig[] = saved
        .filter((e: any) => e.isActive)
        .map((e: any) => ({
          id: e.id,
          name: e.name,
          shortName: e.shortName,
          type: e.id,
          weight: e.weight,
          maxScore: 100,
          isActive: e.isActive,
        }));
      setCustomExamWeights(configs);
    }
    setLoadingWeights(false);
  }, [school]);

  useEffect(() => {
    loadCustomWeights();
  }, [loadCustomWeights]);

  const isSecondary = examTypeTab === "secondary";

  const examConfigs = isSecondary
    ? customExamWeights.length > 0
      ? customExamWeights
      : SECONDARY_EXAM_TYPES
    : customExamWeights.length > 0
      ? customExamWeights
      : PRIMARY_EXAM_TYPES;

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) =>
        (!selectedClass || s.class_id === selectedClass) &&
        (!searchQuery ||
          `${s.first_name} ${s.last_name}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          s.student_number?.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [students, selectedClass, searchQuery]);

  const studentExamScores = useMemo(() => {
    if (!selectedClass || !selectedSubject) return {};

    const scores: Record<string, Record<string, number>> = {};
    examScores
      .filter(
        (s) => s.class_id === selectedClass && s.subject_id === selectedSubject,
      )
      .forEach((score) => {
        if (!scores[score.student_id]) scores[score.student_id] = {};
        scores[score.student_id][score.exam_type] = score.score;
      });
    return scores;
  }, [examScores, selectedClass, selectedSubject]);

  const handleSaveScore = async (studentId: string, score: number) => {
    if (!selectedClass || !selectedSubject) {
      toast.error("Select class and subject first");
      return;
    }

    try {
      await saveExamScore({
        student_id: studentId,
        subject_id: selectedSubject,
        class_id: selectedClass,
        exam_type: selectedExamType,
        score,
        max_score: 100,
        term: currentTerm || 1,
        academic_year: academicYear,
      });
      toast.success("Score saved");
    } catch (err) {
      toast.error("Failed to save score");
    }
  };

  const handleAddExam = async () => {
    if (!newExam.name || !newExam.class_id || !newExam.subject_id) {
      toast.error("Fill all required fields");
      return;
    }

    try {
      await createExam({
        ...newExam,
        term: currentTerm || 1,
        academic_year: academicYear,
      });
      toast.success("Exam created");
      setShowAddExam(false);
      setNewExam({
        name: "",
        exam_type: "eot",
        class_id: "",
        subject_id: "",
        exam_date: "",
        max_score: 100,
        weight: 50,
      });
    } catch (err) {
      toast.error("Failed to create exam");
    }
  };

  const getStudentTotal = (studentId: string) => {
    const scores = studentExamScores[studentId] || {};
    const { total } = calculateWeightedGrade(scores, examConfigs);
    return total;
  };

  return (
    <PageErrorBoundary>
    <div className="content">
      <PageHeader
        title={isSecondary ? "Exam Management" : "Exams & Grades"}
        subtitle={`${academicYear} Term ${currentTerm} • ${isSecondary ? "BOT, Mid Term, EOT, Saturday Tests" : "CA, Mid Term, EOT"}`}
        actions={
          <div className="flex items-center gap-3">
            {termLocked && (
              <span className="px-3 py-1 bg-error-container text-on-error-container rounded-full text-xs font-bold uppercase flex items-center gap-1">
                <MaterialIcon icon="lock" className="text-sm" /> Term Locked
              </span>
            )}
            <Button
              onClick={() => setShowAddExam(true)}
              disabled={termLocked}
              variant="primary"
            >
              <MaterialIcon icon="add" className="text-lg" />
              Create Exam
            </Button>
          </div>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex items-start gap-4">
          <div className="bg-amber-soft text-amber p-3 rounded-2xl flex-shrink-0 animate-pulse">
            <MaterialIcon className="text-2xl">auto_awesome</MaterialIcon>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-[#002045] uppercase tracking-widest">
                Grading Assistant
              </h3>
              <div className="flex gap-2">
                {isDemo && selectedClass && selectedSubject && (
                  <button
                    onClick={() => {
                      filteredStudents.forEach((s) => {
                        handleSaveScore(
                          s.id,
                          Math.floor(Math.random() * 40) + 60,
                        );
                      });
                      toast.success("Marks autofilled for demo");
                    }}
                    className="px-3 py-1 bg-blue-soft text-blue-800 rounded-lg text-[10px] font-black uppercase border border-blue-200 hover:bg-blue-100 transition-all"
                  >
                    Autofill Marks
                  </button>
                )}
                {selectedClass && selectedSubject && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/dashboard/comments?class=${selectedClass}&subject=${selectedSubject}`,
                      )
                    }
                    className="px-3 py-1 bg-emerald-soft text-emerald-800 rounded-lg text-[10px] font-black uppercase border border-emerald-200 hover:bg-emerald-100 transition-all"
                  >
                    Auto-Comment All
                  </button>
                )}
              </div>
            </div>

            {!selectedClass || !selectedSubject ? (
              <p className="text-xs text-[var(--t3)] font-medium">
                Select a class and subject to activate the AI Insights engine.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Class Average
                  </p>
                  <p className="text-lg font-black text-slate-800">
                    {(() => {
                      const scores = filteredStudents
                        .map((s) => getStudentTotal(s.id))
                        .filter((t) => t > 0);
                      if (scores.length === 0) return "--";
                      return (
                        scores.reduce((a, b) => a + b, 0) / scores.length
                      ).toFixed(1);
                    })()}
                    %
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Performance
                  </p>
                  <p className="text-lg font-black text-emerald-600">Steady</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Pass Rate
                  </p>
                  <p className="text-lg font-black text-slate-800">
                    {(() => {
                      const totals = filteredStudents
                        .map((s) => getStudentTotal(s.id))
                        .filter((t) => t > 0);
                      if (totals.length === 0) return "0%";
                      const passed = totals.filter((t) => t >= 50).length;
                      return `${Math.round((passed / totals.length) * 100)}%`;
                    })()}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Highest Score
                  </p>
                  <p className="text-lg font-black text-blue-600">
                    {(() => {
                      const totals = filteredStudents
                        .map((s) => getStudentTotal(s.id))
                        .filter((t) => t > 0);
                      return totals.length > 0
                        ? `${Math.max(...totals).toFixed(0)}%`
                        : "--";
                    })()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="mb-5 p-4">
        <div className="flex items-start gap-3">
          <div className="bg-blue-soft text-blue p-2 rounded-lg flex-shrink-0">
            <MaterialIcon className="text-xl">help_outline</MaterialIcon>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--t1)] mb-2">
              How to Enter Scores
            </div>
            <div className="text-xs text-[var(--t3)] space-y-1">
              <p>
                • Enter the <span className="font-semibold">actual score</span>{" "}
                (e.g., 85, not 85%)
              </p>
              <p>
                • Each exam type has different{" "}
                <span className="font-semibold">weight</span> - they combine to
                make the Total
              </p>
              <p>
                • <span className="font-semibold">Pass mark is 50%</span> -
                scores below 50 show in red
              </p>
              <p>
                • The <span className="font-semibold">Grade</span> is
                auto-calculated (A, B, C, D, F9)
              </p>
              <p>• Scores are saved automatically as you type</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="mb-6">
        <Tabs
          tabs={[
            { id: "secondary", label: "Secondary", count: 4 },
            { id: "primary", label: "Primary", count: 3 },
          ]}
          activeTab={examTypeTab}
          onChange={setExamTypeTab}
        />
      </div>

      <Card className="mb-5 p-4">
        <button
          onClick={() => setShowWeights(!showWeights)}
          className="flex items-center gap-2 w-full bg-transparent border-none cursor-pointer text-left"
        >
          <div className="text-xs font-semibold text-[var(--t2)]">
            Grade Weighting
          </div>
          <MaterialIcon
            className={`text-lg text-[var(--t3)] transition-transform ${showWeights ? "rotate-180" : ""}`}
          >
            expand_more
          </MaterialIcon>
        </button>
        {showWeights && (
          <div className="flex flex-wrap gap-3 mt-3">
            {examConfigs.map((config: ExamConfig) => (
              <div
                key={config.id}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-container)] rounded-lg"
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: getExamColor(config.type) }}
                />
                <span className="text-xs font-semibold text-[var(--t1)]">
                  {config.shortName}
                </span>
                <span className="text-xs text-[var(--t3)]">
                  {config.name} ({config.weight}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-5 overflow-hidden">
        <div className="p-3.5 border-b border-[var(--border)]">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="min-w-[150px] flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)] mb-1 block">
                Class
              </label>
              {classes.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  No classes - Add classes first
                </div>
              ) : (
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedSubject("");
                  }}
                  className="input h-9 text-sm"
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="min-w-[150px] flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)] mb-1 block">
                Subject
              </label>
              {subjects.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  No subjects - Add subjects first
                </div>
              ) : (
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="input h-9 text-sm"
                  disabled={!selectedClass}
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="min-w-[150px] flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)] mb-1 block">
                Exam Type
              </label>
              <select
                value={selectedExamType}
                onChange={(e) => setSelectedExamType(e.target.value)}
                className="input h-9 text-sm"
              >
                {examConfigs.map((config: ExamConfig) => (
                  <option key={config.id} value={config.type}>
                    {config.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedClass && selectedSubject && (
            <div className="mt-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student by name or number..."
                className="input h-9 text-sm"
              />
            </div>
          )}
        </div>

        {selectedClass && selectedSubject ? (
          scoresLoading ? (
            <div className="p-10 text-center">
              <TableSkeleton rows={8} />
            </div>
          ) : (
            <div className="tbl-wrap overflow-x-auto">
              <table className="exam-scores-table w-full">
                <thead>
                  <tr>
                    <th className="min-w-[180px] sticky left-0 bg-[var(--bg)] z-10">
                      Student
                    </th>
                    {examConfigs.map((config) => (
                      <th
                        key={config.id}
                        className="text-center w-16 whitespace-nowrap"
                      >
                        {config.shortName}
                      </th>
                    ))}
                    <th className="text-center w-16 whitespace-nowrap">
                      Total
                    </th>
                    <th className="text-center w-14 whitespace-nowrap">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const scores = studentExamScores[student.id] || {};
                    const total = getStudentTotal(student.id);
                    const grade = total > 0 ? getUNEBGrade(total) : "-";

                    return (
                      <tr key={student.id}>
                        <td className="sticky left-0 bg-[var(--surface)] z-10 border-r border-[var(--border)]">
                          <div className="flex items-center justify-between gap-2 group/student">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-[var(--navy)] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                {student.first_name?.[0] || "?"}
                                {student.last_name?.[0] || ""}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-[var(--t1)] text-sm truncate max-w-[120px]">
                                  {student.first_name} {student.last_name}
                                </div>
                                <div className="text-xs text-[var(--t3)] truncate max-w-[120px]">
                                  {student.student_number || "-"}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const score = getStudentTotal(student.id);
                                alert(
                                  `AI Advice for ${student.first_name}: ${score > 80 ? "Excellent progress, keep it up!" : score > 50 ? "Solid performance, focus on improving speed." : "Needs urgent review on core concepts."}`,
                                );
                              }}
                              className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center opacity-0 group-hover/student:opacity-100 transition-all hover:bg-amber-100"
                              title="Generate AI Advice"
                            >
                              <MaterialIcon
                                icon="tips_and_updates"
                                style={{ fontSize: 16 }}
                              />
                            </button>
                          </div>
                        </td>
                        {examConfigs.map((config: ExamConfig) => {
                          const score = scores[config.type] ?? -1;
                          return (
                            <td key={config.id} className="text-center p-1">
                              <input
                                type="number"
                                min={0}
                                max={config.maxScore}
                                value={score >= 0 ? score : ""}
                                onChange={(e) =>
                                  handleSaveScore(
                                    student.id,
                                    Number(e.target.value),
                                  )
                                }
                                disabled={termLocked}
                                placeholder="-"
                                className="w-full max-w-[60px] text-center px-1 py-1.5 border border-[var(--border)] rounded text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                                style={{
                                  background:
                                    score >= 0
                                      ? score >= 50
                                        ? "var(--green-soft)"
                                        : "var(--red-soft)"
                                      : "var(--surface-container)",
                                }}
                              />
                            </td>
                          );
                        })}
                        <td className="text-center font-mono font-bold text-sm p-2">
                          {total > 0 ? total.toFixed(1) : "-"}
                        </td>
                        <td className="text-center p-2">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-xs font-bold min-w-[24px]"
                            style={{
                              background:
                                total >= 80
                                  ? "var(--green-soft)"
                                  : total >= 50
                                    ? "var(--amber-soft)"
                                    : total > 0
                                      ? "var(--red-soft)"
                                      : "var(--surface-container)",
                              color:
                                total >= 80
                                  ? "var(--green)"
                                  : total >= 50
                                    ? "var(--amber)"
                                    : total > 0
                                      ? "var(--red)"
                                      : "var(--t3)",
                            }}
                          >
                            {grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--surface-container)] flex items-center justify-center">
              <MaterialIcon className="text-3xl text-[var(--t3)]">
                assignment
              </MaterialIcon>
            </div>
            <div className="text-lg font-semibold text-[var(--t1)] mb-2">
              Enter Exam Scores
            </div>
            <div className="text-sm text-[var(--t3)] mb-6 max-w-md mx-auto">
              Follow these steps to record student scores:
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center text-sm">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  selectedClass
                    ? "bg-green-soft text-green"
                    : "bg-[var(--surface-container)] text-[var(--t3)]"
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                Select Class
              </div>
              <MaterialIcon className="text-[var(--t3)]">
                arrow_forward
              </MaterialIcon>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  selectedSubject
                    ? "bg-green-soft text-green"
                    : "bg-[var(--surface-container)] text-[var(--t3)]"
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                Select Subject
              </div>
              <MaterialIcon className="text-[var(--t3)]">
                arrow_forward
              </MaterialIcon>
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-container)] text-[var(--t3)] rounded-lg">
                <span className="w-6 h-6 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                Enter Scores
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between pb-4 border-none">
          <div>
            <div className="font-semibold text-[var(--on-surface)]">
              Exam Schedule
            </div>
            <div className="text-sm text-[var(--t3)]">Created exams</div>
          </div>
        </div>
        {examsLoading ? (
          <TableSkeleton rows={3} />
        ) : exams.length === 0 ? (
          <NoData title="No exams created yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center gap-3 p-3 bg-[var(--surface-container)] rounded-lg"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: getExamColor(exam.exam_type) }}
                />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{exam.name}</div>
                  <div className="text-xs text-[var(--t3)]">
                    {exam.classes?.name} • {exam.subjects?.name}
                  </div>
                </div>
                <div className="text-xs text-[var(--t3)]">{exam.exam_date}</div>
                <button
                  onClick={() => setExamToDelete(exam.id)}
                  className="bg-transparent border-none p-1 cursor-pointer hover:bg-error/10 rounded"
                >
                  <MaterialIcon className="text-base text-error">
                    delete
                  </MaterialIcon>
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAddExam && (
        <div className="modal-overlay" onClick={() => setShowAddExam(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="font-['Sora'] text-base font-bold">
                Create Exam
              </div>
              <button
                onClick={() => setShowAddExam(false)}
                className="bg-transparent border-none p-1 cursor-pointer"
              >
                <MaterialIcon className="text-lg text-[var(--t3)]">
                  close
                </MaterialIcon>
              </button>
            </div>
            <div className="modal-body p-5">
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">
                  Exam Name
                </label>
                <input
                  type="text"
                  value={newExam.name}
                  onChange={(e) =>
                    setNewExam({ ...newExam, name: e.target.value })
                  }
                  placeholder="e.g., End of Term 1 2026"
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">
                    Exam Type
                  </label>
                  <select
                    value={newExam.exam_type}
                    onChange={(e) =>
                      setNewExam({ ...newExam, exam_type: e.target.value })
                    }
                    className="input"
                  >
                    {examConfigs.map((config: ExamConfig) => (
                      <option key={config.id} value={config.type}>
                        {config.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">
                    Exam Date
                  </label>
                  <input
                    type="date"
                    value={newExam.exam_date}
                    onChange={(e) =>
                      setNewExam({ ...newExam, exam_date: e.target.value })
                    }
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">
                    Class
                  </label>
                  <select
                    value={newExam.class_id}
                    onChange={(e) =>
                      setNewExam({ ...newExam, class_id: e.target.value })
                    }
                    className="input"
                  >
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">
                    Subject
                  </label>
                  <select
                    value={newExam.subject_id}
                    onChange={(e) =>
                      setNewExam({ ...newExam, subject_id: e.target.value })
                    }
                    className="input"
                  >
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">
                    Max Score
                  </label>
                  <input
                    type="number"
                    value={newExam.max_score}
                    onChange={(e) =>
                      setNewExam({
                        ...newExam,
                        max_score: Number(e.target.value),
                      })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">
                    Weight (%)
                  </label>
                  <input
                    type="number"
                    value={newExam.weight}
                    onChange={(e) =>
                      setNewExam({ ...newExam, weight: Number(e.target.value) })
                    }
                    className="input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setShowAddExam(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddExam}>Create Exam</Button>
            </div>
          </div>
        </div>
      )}

      {examToDelete && (
        <div className="modal-overlay" onClick={() => setExamToDelete(null)}>
          <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="font-['Sora'] text-base font-bold text-error">
                Delete Exam
              </div>
              <button
                onClick={() => setExamToDelete(null)}
                className="bg-transparent border-none p-1 cursor-pointer"
              >
                <MaterialIcon className="text-lg text-[var(--t3)]">
                  close
                </MaterialIcon>
              </button>
            </div>
            <div className="modal-body p-5 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
                <MaterialIcon className="text-2xl text-error">
                  warning
                </MaterialIcon>
              </div>
              <div className="font-semibold text-[var(--t1)] mb-2">
                Are you sure?
              </div>
              <div className="text-sm text-[var(--t3)]">
                This will permanently delete this exam and all associated
                scores. This action cannot be undone.
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setExamToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await deleteExam(examToDelete);
                  setExamToDelete(null);
                  toast.success("Exam deleted");
                }}
              >
                Delete Exam
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
