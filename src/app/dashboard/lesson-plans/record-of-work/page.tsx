"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface LessonRecord {
  id: string;
  lesson_title: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  status: string;
  lesson_date: string;
  topic: string;
  evaluation?: string;
  teacher_name?: string;
  class_name?: string;
  subject_name?: string;
}

export default function RecordOfWorkPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [evaluationText, setEvaluationText] = useState("");

  const isAdmin = ["headmaster", "dean_of_studies", "admin", "school_admin"].includes(user?.role || "");

  const fetchRecords = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("lesson_plans")
        .select("*, classes(name), subjects(name), users:teacher_id(full_name)")
        .eq("school_id", school.id);

      // Teachers only see their own records
      if (!isAdmin) {
        query = query.eq("teacher_id", user?.id);
      }

      const { data, error } = await query.order("lesson_date", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        lesson_title: row.lesson_title || "Untitled Lesson",
        class_id: row.class_id,
        subject_id: row.subject_id,
        teacher_id: row.teacher_id,
        status: row.status || "draft",
        lesson_date: row.lesson_date || row.created_at,
        topic: row.topic || "N/A",
        evaluation: row.assessment || "",
        teacher_name: row.users?.full_name,
        class_name: row.classes?.name,
        subject_name: row.subjects?.name,
      }));

      setRecords(mapped);
    } catch (err) {
      console.error("Failed to fetch record of work:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id, user?.id, isAdmin]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleMarkAsTaught = async (id: string) => {
    if (!evaluationText.trim()) {
      toast.error("Please provide a short evaluation/remarks of the lesson");
      return;
    }

    setMarkingId(id);
    try {
      const { error } = await supabase
        .from("lesson_plans")
        .update({
          status: "completed",
          assessment: evaluationText,
          lesson_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Lesson marked as taught and recorded!");
      setEvaluationText("");
      setMarkingId(null);
      fetchRecords();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update record");
      setMarkingId(null);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => (activeTab === "completed" ? r.status === "completed" : r.status !== "completed"));
  }, [records, activeTab]);

  if (loading && records.length === 0) {
    return (
      <div className="p-8">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Record of Work"
          subtitle={isAdmin ? "Monitor teaching accountability across the school" : "Digitally sign off your taught lessons"}
        />

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "pending" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-white text-[var(--t3)] hover:bg-indigo-50"
            }`}
          >
            {isAdmin ? "Pending Lessons" : "My Draft Lessons"}
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "completed" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-white text-[var(--t3)] hover:bg-indigo-50"
            }`}
          >
            {isAdmin ? "Verified Record of Work" : "My Completed Records"}
          </button>
        </div>

        {filteredRecords.length === 0 ? (
          <EmptyState
            icon="history_edu"
            title={activeTab === "pending" ? "No lessons waiting" : "No completed records found"}
            description={activeTab === "pending" ? "All scheduled lessons have been recorded." : "Start marking your lessons as taught to see them here."}
          />
        ) : (
          <div className="space-y-4">
            {filteredRecords.map((record) => (
              <Card key={record.id} className={`overflow-hidden border-l-4 ${record.status === 'completed' ? 'border-emerald-500' : 'border-amber-500'}`}>
                <CardBody className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[var(--surface-container)] text-[var(--t2)]">
                          {record.subject_name} • {record.class_name}
                        </span>
                        <span className="text-xs text-[var(--t3)]">
                          {new Date(record.lesson_date).toLocaleDateString("en-UG", { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[var(--primary)] mb-1 truncate">
                        {record.lesson_title}
                      </h3>
                      <p className="text-sm text-[var(--t2)] font-medium mb-3">
                        <span className="text-[var(--t3)]">Topic:</span> {record.topic}
                      </p>

                      {record.status === "completed" ? (
                        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                          <p className="text-[10px] uppercase font-black text-emerald-700 tracking-widest mb-1">Teacher's Evaluation</p>
                          <p className="text-sm text-emerald-900 italic">"{record.evaluation || "No remarks provided"}"</p>
                          {isAdmin && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                              <MaterialIcon icon="verified" className="text-sm" />
                              Taught by {record.teacher_name}
                            </div>
                          )}
                        </div>
                      ) : !isAdmin && markingId === record.id ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                          <textarea
                            placeholder="Briefly state lesson evaluation (e.g., 'Objectives met', 'Pupils struggled with fractions', 'Rescheduled due to rain')"
                            className="w-full p-3 rounded-xl border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={evaluationText}
                            onChange={(e) => setEvaluationText(e.target.value)}
                            rows={2}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleMarkAsTaught(record.id)}>Confirm Record</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setMarkingId(null); setEvaluationText(""); }}>Cancel</Button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {record.status !== "completed" && !isAdmin && markingId !== record.id && (
                      <Button
                        variant="secondary"
                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        onClick={() => { setMarkingId(record.id); setEvaluationText(record.evaluation || ""); }}
                      >
                        <MaterialIcon icon="edit_note" />
                        Sign Off Lesson
                      </Button>
                    )}
                    
                    {isAdmin && record.status === "completed" && (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase">
                          <MaterialIcon icon="check_circle" className="text-sm" />
                          Verified
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
