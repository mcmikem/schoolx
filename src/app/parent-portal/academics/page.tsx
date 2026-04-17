"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";

export default function ParentAcademicsPage() {
  const { user, isDemo } = useAuth();
  const { isAuthorized, isChecking } = useParentPortalGuard();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [terms, setTerms] = useState<string[]>([]);

  const fetchChildren = useCallback(async () => {
    if (isDemo) {
      const demo = [
        {
          id: "child-1",
          first_name: "Isaac",
          last_name: "Mugisha",
          class_name: "P.5 Blue",
        },
      ];
      setChildren(demo);
      setSelectedChild(demo[0]);
      return;
    }
    if (!user?.id) return;
    const { data } = await supabase
      .from("parent_students")
      .select(
        "student:students(id, first_name, last_name, class:classes(name))",
      )
      .eq("parent_id", user.id);
    const list = (data || []).map((d: any) => ({
      ...d.student,
      class_name: d.student.class?.name || "—",
    }));
    setChildren(list);
    if (list.length > 0) setSelectedChild(list[0]);
  }, [user?.id, isDemo]);

  const fetchGrades = useCallback(
    async (child: any) => {
      if (!child) return;
      setLoading(true);
      if (isDemo) {
        const demoGrades = [
          {
            id: "1",
            subject_name: "Mathematics",
            score: 82,
            max_score: 100,
            grade: "B2",
            term: "Term 1",
            exam_type: "End of Term",
            teacher_comment: "Good performance, keep it up!",
          },
          {
            id: "2",
            subject_name: "English Language",
            score: 74,
            max_score: 100,
            grade: "C3",
            term: "Term 1",
            exam_type: "End of Term",
            teacher_comment: "Needs improvement in composition.",
          },
          {
            id: "3",
            subject_name: "Science",
            score: 91,
            max_score: 100,
            grade: "D1",
            term: "Term 1",
            exam_type: "End of Term",
            teacher_comment: "Excellent! Top of class.",
          },
          {
            id: "4",
            subject_name: "Social Studies",
            score: 68,
            max_score: 100,
            grade: "C4",
            term: "Term 1",
            exam_type: "Mid-Term",
            teacher_comment: null,
          },
          {
            id: "5",
            subject_name: "Mathematics",
            score: 88,
            max_score: 100,
            grade: "D1",
            term: "Term 2",
            exam_type: "End of Term",
            teacher_comment: "Outstanding improvement!",
          },
        ];
        setGrades(demoGrades);
        setTerms(Array.from(new Set(demoGrades.map((g) => g.term))));
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("grades")
        .select(
          "id, score, max_score, grade, term, exam_type, teacher_comment, subjects(name)",
        )
        .eq("student_id", child.id)
        .order("created_at", { ascending: false });
      const mapped = (data || []).map((g: any) => ({
        ...g,
        subject_name: g.subjects?.name || "Unknown",
      }));
      setGrades(mapped);
      setTerms(
        Array.from(new Set(mapped.map((g: any) => g.term).filter(Boolean))),
      );
      setLoading(false);
    },
    [isDemo],
  );

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);
  useEffect(() => {
    if (selectedChild) fetchGrades(selectedChild);
  }, [selectedChild, fetchGrades]);

  if (isChecking || !isAuthorized) {
    return null;
  }

  const filtered =
    selectedTerm === "all"
      ? grades
      : grades.filter((g) => g.term === selectedTerm);
  const avgScore =
    filtered.length > 0
      ? Math.round(
          filtered.reduce(
            (s, g) => s + (g.score / (g.max_score || 100)) * 100,
            0,
          ) / filtered.length,
        )
      : 0;

  const gradeColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 65) return "text-blue-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Academics"
        subtitle="View your child's grades and performance"
      />

      {children.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChild(c)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${selectedChild?.id === c.id ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"}`}
            >
              {c.first_name} {c.last_name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
          Filter by Term:
        </span>
        {["all", ...terms].map((t) => (
          <button
            key={t}
            onClick={() => setSelectedTerm(t)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${selectedTerm === t ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"}`}
          >
            {t === "all" ? "All Terms" : t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody className="text-center">
            <p className={`text-4xl font-black ${gradeColor(avgScore)}`}>
              {avgScore}%
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)] mt-1">
              Average Score
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
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
          <h2 className="font-bold text-[var(--on-surface)] mb-4">
            Grade Records
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
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
              {filtered.map((g) => {
                const pct = Math.round((g.score / (g.max_score || 100)) * 100);
                return (
                  <div
                    key={g.id}
                    className="p-4 bg-[var(--surface-container-low)] rounded-2xl"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-[var(--on-surface)]">
                          {g.subject_name}
                        </p>
                        <p className="text-[10px] text-[var(--on-surface-variant)]">
                          {g.exam_type} · {g.term}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-black ${gradeColor(pct)}`}>
                          {g.score}
                          <span className="text-sm font-normal text-[var(--on-surface-variant)]">
                            /{g.max_score || 100}
                          </span>
                        </p>
                        {g.grade && (
                          <span className="text-xs font-black text-[var(--on-surface-variant)]">
                            {g.grade}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--surface-container-highest)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 65 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {g.teacher_comment && (
                      <p className="text-xs text-[var(--on-surface-variant)] mt-2 italic">
                        "{g.teacher_comment}"
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
