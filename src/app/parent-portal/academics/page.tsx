"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";
import {
  buildReportCardSummaries,
  getUniqueTerms,
  mapParentStudentLinks,
  normalizeGrades,
  ParentPortalChild,
  ParentPortalGradeRecord,
  resolveSelectedChild,
} from "@/lib/parent-portal";
import { getDemoChildren, getDemoGrades } from "@/lib/parent-portal-demo";

const PERFORMANCE_STYLES = {
  excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  good: "bg-blue-50 text-blue-700 border-blue-200",
  fair: "bg-amber-50 text-amber-700 border-amber-200",
  attention: "bg-red-50 text-red-700 border-red-200",
} as const;

export default function ParentAcademicsPage() {
  const { user, isDemo } = useAuth();
  const { isAuthorized, isChecking } = useParentPortalGuard();
  const [children, setChildren] = useState<ParentPortalChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentPortalChild | null>(
    null,
  );
  const [grades, setGrades] = useState<ParentPortalGradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [terms, setTerms] = useState<string[]>([]);

  const fetchChildren = useCallback(async () => {
    if (isDemo) {
      setChildren(getDemoChildren());
      return;
    }
    const parentId = user?.id;
    if (!parentId) return;
    const { data } = await supabase
      .from("parent_students")
      .select(
        "student:students(id, first_name, last_name, school_id, class_id, class:classes(name))",
      )
      .eq("parent_id", parentId);
    setChildren(mapParentStudentLinks(data || []));
  }, [user?.id, isDemo]);

  useEffect(() => {
    setSelectedChild((current) => resolveSelectedChild(children, current?.id));
  }, [children]);

  const fetchGrades = useCallback(
    async (child: ParentPortalChild | null) => {
      const scopedChild = resolveSelectedChild(children, child?.id);
      if (!scopedChild) return;
      setLoading(true);

      if (isDemo) {
        const demoGrades = getDemoGrades(scopedChild.id);
        setGrades(demoGrades);
        setTerms(getUniqueTerms(demoGrades));
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("grades")
        .select(
          "id, score, max_score, grade, term, exam_type, teacher_comment, subjects(name)",
        )
        .eq("student_id", scopedChild.id)
        .order("created_at", { ascending: false });

      const mapped = normalizeGrades(data || []);
      setGrades(mapped);
      setTerms(getUniqueTerms(mapped));
      setLoading(false);
    },
    [isDemo, children],
  );

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    if (selectedChild) {
      fetchGrades(selectedChild);
    }
  }, [selectedChild, fetchGrades]);

  const filtered =
    selectedTerm === "all"
      ? grades
      : grades.filter((grade) => grade.term === selectedTerm);

  const avgScore =
    filtered.length > 0
      ? Math.round(
          filtered.reduce(
            (sum, grade) => sum + (grade.score / (grade.max_score || 100)) * 100,
            0,
          ) / filtered.length,
        )
      : 0;

  const reportCards = useMemo(
    () => buildReportCardSummaries(grades),
    [grades],
  );

  const gradeColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 65) return "text-blue-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  if (isChecking || !isAuthorized) {
    return null;
  }

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="Academics"
          subtitle="View grades, teacher feedback, and term-by-term report snapshots"
          variant="premium"
        />

        {children.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all border ${
                  selectedChild?.id === child.id
                    ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent shadow-[0_12px_24px_rgba(0,92,230,0.18)]"
                    : "bg-white text-[var(--on-surface-variant)] border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                }`}
              >
                {child.first_name} {child.last_name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardBody className="text-center bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)]">
              <p className={`text-4xl font-black ${gradeColor(avgScore)}`}>
                {avgScore}%
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)] mt-1">
                Average Score
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)]">
              <p className="text-4xl font-black text-[var(--on-surface)]">
                {filtered.length}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)] mt-1">
                Subjects Recorded
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                Filter by Term:
              </span>
              {["all", ...terms].map((term) => (
                <button
                  key={term}
                  onClick={() => setSelectedTerm(term)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all border ${
                    selectedTerm === term
                      ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent"
                      : "bg-white text-[var(--on-surface-variant)] border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                  }`}
                >
                  {term === "all" ? "All Terms" : term}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {reportCards.map((reportCard) => (
            <Card key={reportCard.term}>
              <CardBody className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-[var(--on-surface)]">
                      {reportCard.term} Report Card
                    </p>
                    <p className="text-sm text-[var(--on-surface-variant)]">
                      {reportCard.subjectCount} subjects · strongest in{" "}
                      {reportCard.strongestSubject}
                    </p>
                  </div>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                      PERFORMANCE_STYLES[reportCard.performanceBand]
                    }`}
                  >
                    {reportCard.performanceBand}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-[18px] bg-[var(--surface-container-low)] p-3 border border-[var(--border)]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                      Average
                    </p>
                    <p className={`text-2xl font-black ${gradeColor(reportCard.averagePercent)}`}>
                      {reportCard.averagePercent}%
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-[var(--surface-container-low)] p-3 border border-[var(--border)]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                      Exam
                    </p>
                    <p className="text-sm font-bold text-[var(--on-surface)]">
                      {reportCard.latestExamType || "Recorded"}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-[var(--surface-container-low)] p-3 border border-[var(--border)]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                      Top Subject
                    </p>
                    <p className="text-sm font-bold text-[var(--on-surface)]">
                      {reportCard.strongestSubject}
                    </p>
                  </div>
                </div>

                <div className="rounded-[20px] border border-[var(--border)] p-4 bg-[var(--surface-container-low)]">
                  <div className="flex items-center gap-2 mb-2">
                    <MaterialIcon icon="description" className="text-[var(--primary)]" />
                    <p className="text-sm font-bold text-[var(--on-surface)]">
                      Teacher remark
                    </p>
                  </div>
                  <p className="text-sm text-[var(--on-surface-variant)] italic">
                    {reportCard.teacherComment ||
                      "Teacher remarks will appear here once they are recorded."}
                  </p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardBody>
            <h2 className="font-bold text-[var(--on-surface)] mb-4">
              Grade Records
            </h2>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 bg-[var(--surface-container)] rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-[var(--on-surface-variant)] py-8">
                No grade records found
              </p>
            ) : (
              <div className="space-y-3">
                {filtered.map((grade) => {
                  const pct = Math.round(
                    (grade.score / (grade.max_score || 100)) * 100,
                  );
                  return (
                    <div
                      key={grade.id}
                      className="p-4 bg-[var(--surface-container-low)] rounded-[20px] border border-[var(--border)]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-[var(--on-surface)]">
                            {grade.subject_name}
                          </p>
                          <p className="text-[10px] text-[var(--on-surface-variant)]">
                            {grade.exam_type} · {grade.term}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-black ${gradeColor(pct)}`}>
                            {grade.score}
                            <span className="text-sm font-normal text-[var(--on-surface-variant)]">
                              /{grade.max_score || 100}
                            </span>
                          </p>
                          {grade.grade && (
                            <span className="text-xs font-black text-[var(--on-surface-variant)]">
                              {grade.grade}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--surface-container-highest)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 80
                              ? "bg-emerald-500"
                              : pct >= 65
                                ? "bg-blue-500"
                                : pct >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {grade.teacher_comment && (
                        <p className="text-xs text-[var(--on-surface-variant)] mt-2 italic">
                          "{grade.teacher_comment}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </PageErrorBoundary>
  );
}
