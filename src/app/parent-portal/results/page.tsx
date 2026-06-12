"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import { ParentPortalChild, mapParentStudentLinks, resolveSelectedChild } from "@/lib/parent-portal";

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

export default function ParentResultsPage() {
  const { user, isDemo } = useAuth();
  const [children, setChildren] = useState<ParentPortalChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentPortalChild | null>(null);
  const [reports, setReports] = useState<ReportCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [years, setYears] = useState<string[]>([]);

  const fetchChildren = useCallback(async () => {
    if (isDemo) return;
    const parentId = user?.id;
    if (!parentId) return;
    const { data } = await supabase
      .from("parent_students")
      .select("student:students(id, first_name, last_name, school_id, class_id, class:classes(name))")
      .eq("parent_id", parentId);
    setChildren(mapParentStudentLinks(data || []));
  }, [user?.id, isDemo]);

  useEffect(() => {
    setSelectedChild((current) => resolveSelectedChild(children, current?.id));
  }, [children]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const fetchReports = useCallback(async (child: ParentPortalChild | null) => {
    const scoped = resolveSelectedChild(children, child?.id);
    if (!scoped) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("report_cards")
      .select("*")
      .eq("student_id", scoped.id)
      .order("academic_year", { ascending: false })
      .order("term", { ascending: false });
    if (!error && data) {
      setReports(data);
      const uniqueYears = [...new Set(data.map((r) => r.academic_year).filter(Boolean))] as string[];
      setYears(uniqueYears);
    }
    setLoading(false);
  }, [children]);

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
      D1: "text-green-600", D2: "text-green-500",
      C3: "text-blue-600", C4: "text-blue-500",
      C5: "text-yellow-600", C6: "text-yellow-500",
      P7: "text-orange-500", P8: "text-orange-400",
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
              const avgScore = subjects.length > 0
                ? Math.round(subjects.reduce((s: number, sub: any) => s + (sub.finalScore || sub.score || 0), 0) / subjects.length)
                : report.aggregate || 0;

              return (
                <Card key={report.id}>
                  <CardBody className="space-y-4">
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
                        <p className={`text-3xl font-black ${getDivisionColor(report.division || "")}`}>
                          {report.division || "-"}
                        </p>
                        <p className="text-xs text-[var(--t3)]">Division</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-[18px] bg-[var(--surface-container-low)] p-3 border border-[var(--border)]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">Average</p>
                        <p className={`text-2xl font-black ${avgScore >= 80 ? "text-emerald-600" : avgScore >= 50 ? "text-blue-600" : "text-red-600"}`}>
                          {avgScore}%
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[var(--surface-container-low)] p-3 border border-[var(--border)]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">Subjects</p>
                        <p className="text-2xl font-black text-[var(--on-surface)]">{subjects.length}</p>
                      </div>
                      <div className="rounded-[18px] bg-[var(--surface-container-low)] p-3 border border-[var(--border)]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">Attendance</p>
                        <p className="text-2xl font-black text-[var(--on-surface)]">
                          {report.attendance_rate ? `${Math.round(report.attendance_rate)}%` : "-"}
                        </p>
                      </div>
                    </div>

                    {subjects.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border)]">
                              <th className="text-left py-2 text-[10px] font-black uppercase tracking-widest text-[var(--t3)]">Subject</th>
                              <th className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-[var(--t3)]">Score</th>
                              <th className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-[var(--t3)]">Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjects.map((sub: any, idx: number) => (
                              <tr key={idx} className="border-b border-[var(--border)]/50">
                                <td className="py-2 font-medium">{sub.name || sub.subject_name || `Subject ${idx + 1}`}</td>
                                <td className="py-2 text-center font-mono">{sub.finalScore ?? sub.score ?? "-"}</td>
                                <td className={`py-2 text-center font-black ${getGradeColor(sub.grade || "")}`}>
                                  {sub.grade || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
