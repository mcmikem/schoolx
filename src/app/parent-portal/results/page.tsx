"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";

interface ReportCardRecord {
  id: string;
  student_id: string;
  class_id: string;
  academic_year: string;
  term: number;
  subjects: any[];
  aggregate: number | null;
  division: string | null;
  best4: number[] | null;
  attendance_rate: number | null;
  generated_at: string | null;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    student_number: string;
    gender: string;
    class: { id: string; name: string } | null;
  } | null;
}

function getDemoReportCards(child: {
  id: string;
  first_name: string;
  last_name: string;
  class_name?: string;
}): ReportCardRecord[] {
  const base = {
    id: "demo-report",
    student_id: child.id,
    class_id: "demo-class",
    students: {
      id: child.id,
      first_name: child.first_name,
      last_name: child.last_name,
      student_number: "OMU-2026-001",
      gender: "M",
      class: { id: "demo-class", name: child.class_name || "P.5 Blue" },
    },
  };
  const terms: Array<{ year: string; term: number; subjects: any[]; division: string; aggregate: number }> = [
    {
      year: "2026",
      term: 1,
      division: "Division 1",
      aggregate: 82,
      subjects: [
        { name: "Mathematics", finalScore: 88, grade: "D1" },
        { name: "English", finalScore: 84, grade: "D1" },
        { name: "Science", finalScore: 86, grade: "D1" },
        { name: "Social Studies", finalScore: 79, grade: "D2" },
        { name: "Kiswahili", finalScore: 81, grade: "D2" },
        { name: "CRE", finalScore: 74, grade: "C3" },
      ],
    },
    {
      year: "2025",
      term: 3,
      division: "Division 2",
      aggregate: 76,
      subjects: [
        { name: "Mathematics", finalScore: 80, grade: "D2" },
        { name: "English", finalScore: 78, grade: "D2" },
        { name: "Science", finalScore: 82, grade: "D1" },
        { name: "Social Studies", finalScore: 72, grade: "C3" },
        { name: "Kiswahili", finalScore: 75, grade: "D2" },
        { name: "CRE", finalScore: 69, grade: "C4" },
      ],
    },
  ];
  return terms.map((t, i) => ({
    ...base,
    id: `${base.id}-${i}`,
    academic_year: t.year,
    term: t.term,
    subjects: t.subjects,
    aggregate: t.aggregate,
    division: t.division,
    best4: t.subjects.slice(0, 4).map((s) => s.finalScore),
    attendance_rate: 95,
    generated_at: new Date("2026-04-20T09:00:00Z").toISOString(),
  }));
}

export default function ParentResultsPage() {
  const { isDemo } = useAuth();
  const { selectedChild } = useParentPortal();
  const [reports, setReports] = useState<ReportCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [years, setYears] = useState<string[]>([]);

  const fetchReports = useCallback(
    async (child: typeof selectedChild) => {
      if (!child) return;
      setLoading(true);
      if (isDemo) {
        setReports(getDemoReportCards(child));
        setYears(["2026", "2025"]);
        setLoading(false);
        return;
      }
      const { data, error } = await withTimeout(
        supabase
          .from("report_cards")
          .select("*")
          .eq("student_id", child.id)
          .order("academic_year", { ascending: false })
          .order("term", { ascending: false }),
        12000,
        timeoutFallback(),
      );
      if (!error && data) {
        setReports(data);
        const uniqueYears = [...new Set(data.map((r) => r.academic_year).filter(Boolean))] as string[];
        setYears(uniqueYears);
      }
      setLoading(false);
    },
    [isDemo],
  );

  useEffect(() => {
    if (selectedChild) fetchReports(selectedChild);
  }, [selectedChild, fetchReports]);

  const filtered = reports.filter((r) => {
    if (selectedYear !== "all" && r.academic_year !== selectedYear) return false;
    if (selectedTerm !== "all" && r.term !== parseInt(selectedTerm)) return false;
    return true;
  });

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      D1: "text-green-600",
      D2: "text-green-500",
      C3: "text-blue-600",
      C4: "text-blue-500",
      C5: "text-yellow-600",
      C6: "text-yellow-500",
      P7: "text-orange-500",
      P8: "text-orange-400",
      F9: "text-red-500",
    };
    return colors[grade] || "text-gray-500";
  };

  const getDivisionColor = (div: string) => {
    if (div?.includes("I") && !div?.includes("II")) return "text-green-600";
    if (div?.includes("II")) return "text-blue-600";
    if (div?.includes("III")) return "text-yellow-600";
    if (div?.includes("IV")) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <ParentPortalShell pageTitle="Results">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader title="Report Cards" subtitle="View your child's termly report cards" variant="premium" />

        <ChildSelector />

        <Card>
          <CardBody>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                Academic Year:
              </span>
              {["all", ...years].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all border ${
                    selectedYear === yr
                      ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent"
                      : "bg-white text-[var(--on-surface-variant)] border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                  }`}
                >
                  {yr === "all" ? "All" : yr}
                </button>
              ))}
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] ml-4">
                Term:
              </span>
              {["all", "1", "2", "3"].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTerm(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all border ${
                    selectedTerm === t
                      ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent"
                      : "bg-white text-[var(--on-surface-variant)] border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                  }`}
                >
                  {t === "all" ? "All" : `Term ${t}`}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 bg-[var(--surface-container)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--surface-container)] flex items-center justify-center">
              <MaterialIcon icon="description" className="text-3xl text-[var(--t3)]" />
            </div>
            <p className="text-lg font-semibold text-[var(--t1)] mb-2">No report cards found</p>
            <p className="text-sm text-[var(--t3)]">Report cards will appear here once generated by the school.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filtered.map((report) => {
              const subjects = (report.subjects || []) as any[];
              const avgScore =
                subjects.length > 0
                  ? Math.round(
                      subjects.reduce((s: number, sub: any) => s + (sub.finalScore || sub.score || 0), 0) /
                        subjects.length,
                    )
                  : report.aggregate || 0;

              return (
                <Card key={report.id} className="no-hover">
                  <CardBody className="space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-black text-[var(--on-surface)]">
                          {report.academic_year} &middot; Term {report.term}
                        </p>
                        <p className="text-sm text-[var(--on-surface-variant)]">
                          {report.students?.first_name} {report.students?.last_name}
                          {report.students?.class ? ` &middot; ${report.students.class.name}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-sm font-black border ${getDivisionColor(report.division || "")} border-current`}
                        >
                          {report.division || "-"}
                        </span>
                        <p className="text-xs text-[var(--t3)] mt-1">Division</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 rounded-[22px] bg-white/50 border border-white/70 p-4">
                      <div className="relative w-24 h-24 shrink-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="10" />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke="url(#avgRing)"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${Math.min(100, avgScore)} 100`}
                            pathLength={100}
                          />
                          <defs>
                            <linearGradient id="avgRing" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="var(--primary)" />
                              <stop offset="100%" stopColor="var(--green)" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span
                            className={`text-xl font-black leading-none ${avgScore >= 80 ? "text-emerald-600" : avgScore >= 50 ? "text-[var(--primary)]" : "text-red-600"}`}
                          >
                            {avgScore}%
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--t3)] mt-1">
                            Average
                          </span>
                        </div>
                      </div>

                      <div className="grid flex-1 grid-cols-3 gap-3">
                        <div className="rounded-[18px] bg-white/50 border border-white/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                            Subjects
                          </p>
                          <p className="text-2xl font-black text-[var(--on-surface)]">{subjects.length}</p>
                        </div>
                        <div className="rounded-[18px] bg-white/50 border border-white/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                            Best 4
                          </p>
                          <p className="text-2xl font-black text-[var(--on-surface)]">
                            {report.best4 && report.best4.length > 0
                              ? Math.round(
                                  report.best4.reduce((a: number, b: number) => a + b, 0) / report.best4.length,
                                )
                              : "-"}
                          </p>
                        </div>
                        <div className="rounded-[18px] bg-white/50 border border-white/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                            Attendance
                          </p>
                          <p className="text-2xl font-black text-[var(--on-surface)]">
                            {report.attendance_rate ? `${Math.round(report.attendance_rate)}%` : "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {subjects.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {subjects.map((sub: any, idx: number) => {
                          const score = Number(sub.finalScore ?? sub.score ?? 0);
                          const pct = Math.min(100, Math.max(0, score));
                          const barColor = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--primary)" : "var(--red)";
                          return (
                            <div key={idx} className="rounded-[18px] bg-white/50 border border-white/70 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-[var(--on-surface)] truncate">
                                  {sub.name || sub.subject_name || `Subject ${idx + 1}`}
                                </p>
                                <span className={`text-xs font-black shrink-0 ${getGradeColor(sub.grade || "")}`}>
                                  {sub.grade || "-"}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center gap-3">
                                <div className="flex-1 h-2 bg-[var(--surface-container)] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, background: barColor }}
                                  />
                                </div>
                                <span className="text-xs font-mono font-bold text-[var(--on-surface-variant)]">
                                  {score}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {report.generated_at && (
                      <p className="text-xs text-[var(--t3)]">
                        Generated: {new Date(report.generated_at).toLocaleDateString()}
                      </p>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ParentPortalShell>
  );
}
