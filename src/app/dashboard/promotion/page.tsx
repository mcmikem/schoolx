"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { useClasses } from "@/lib/hooks";

interface PromotionRecord {
  id: string;
  student_name: string;
  from_class: string;
  to_class: string;
  promotion_type: "promoted" | "repeating" | "demoted";
  created_at: string;
}

export default function PromotionPage() {
  const { school } = useAuth();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [targetClass, setTargetClass] = useState("");
  const [promotionType, setPromotionType] = useState<"promoted" | "repeating" | "demoted">("promoted");
  const [promoting, setPromoting] = useState(false);
  const [history, setHistory] = useState<PromotionRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!school?.id) return;
    const { data } = await supabase
      .from("promotion_history")
      .select("*")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory(data || []);
  }, [school?.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!selectedClass || !school?.id) { setStudents([]); return; }
    setLoadingStudents(true);
    supabase
      .from("students")
      .select("id, first_name, last_name, admission_number")
      .eq("school_id", school.id)
      .eq("class_id", selectedClass)
      .order("first_name")
      .then(({ data }) => { setStudents(data || []); setLoadingStudents(false); });
  }, [selectedClass, school?.id]);

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStudents.size === students.length) setSelectedStudents(new Set());
    else setSelectedStudents(new Set(students.map((s) => s.id)));
  };

  const handlePromotion = async () => {
    if (!targetClass || selectedStudents.size === 0 || !school?.id) return;
    setPromoting(true);

    const fromClassName = classes.find((c) => c.id === selectedClass)?.name || selectedClass;
    const toClassName = classes.find((c) => c.id === targetClass)?.name || targetClass;

    // Update class_id for all selected students
    const { error: updateError } = await supabase
      .from("students")
      .update({ class_id: targetClass })
      .in("id", Array.from(selectedStudents))
      .eq("school_id", school.id);

    if (updateError) {
      toast.error("Failed to promote students: " + updateError.message);
      setPromoting(false);
      return;
    }

    // Log promotion history
    const historyRows = students
      .filter((s) => selectedStudents.has(s.id))
      .map((s) => ({
        school_id: school.id,
        student_id: s.id,
        student_name: `${s.first_name} ${s.last_name}`,
        from_class: fromClassName,
        to_class: toClassName,
        promotion_type: promotionType,
      }));

    await supabase.from("promotion_history").insert(historyRows);

    toast.success(`${selectedStudents.size} student(s) ${promotionType} successfully`);
    setSelectedStudents(new Set());
    setTargetClass("");
    fetchHistory();
    // Refresh students list
    const { data } = await supabase.from("students").select("id, first_name, last_name, admission_number").eq("school_id", school.id).eq("class_id", selectedClass).order("first_name");
    setStudents(data || []);
    setPromoting(false);
  };

  const PROMO_COLORS: Record<string, string> = {
    promoted: "bg-emerald-50 text-emerald-700",
    repeating: "bg-amber-50 text-amber-700",
    demoted: "bg-red-50 text-red-700",
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Student Promotion" subtitle="Move students to the next class or mark as repeating" />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <h2 className="font-bold text-[var(--on-surface)]">Select Class to Promote From</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">From Class</label>
                  <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudents(new Set()); }} className="select w-full">
                    <option value="">Select class...</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">To Class</label>
                  <select value={targetClass} onChange={(e) => setTargetClass(e.target.value)} className="select w-full">
                    <option value="">Select target class...</option>
                    {classes.filter((c) => c.id !== selectedClass).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">Promotion Type</label>
                <div className="flex gap-3">
                  {(["promoted", "repeating", "demoted"] as const).map((t) => (
                    <button key={t} onClick={() => setPromotionType(t)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all capitalize ${promotionType === t ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"}`}>{t}</button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {selectedClass && (
            <Card>
              <CardBody>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold text-[var(--on-surface)]">
                    Students {loadingStudents ? "…" : `(${students.length})`}
                  </h2>
                  {students.length > 0 && (
                    <button onClick={toggleAll} className="text-xs font-bold text-[var(--primary)] hover:underline">
                      {selectedStudents.size === students.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>
                {loadingStudents ? (
                  <div className="text-center py-6 text-[var(--on-surface-variant)]">Loading students…</div>
                ) : students.length === 0 ? (
                  <div className="text-center py-6 text-[var(--on-surface-variant)]">No students in this class</div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {students.map((s) => (
                      <label key={s.id} className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${selectedStudents.has(s.id) ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30" : "hover:bg-[var(--surface-container-low)]"}`}>
                        <input type="checkbox" checked={selectedStudents.has(s.id)} onChange={() => toggleStudent(s.id)} className="rounded" />
                        <div>
                          <p className="font-bold text-sm text-[var(--on-surface)]">{s.first_name} {s.last_name}</p>
                          <p className="text-[10px] text-[var(--on-surface-variant)]">{s.admission_number}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {selectedStudents.size > 0 && targetClass && (
            <Button onClick={handlePromotion} loading={promoting} className="w-full">
              <MaterialIcon icon="upgrade" />
              {promotionType === "promoted" ? "Promote" : promotionType === "repeating" ? "Mark as Repeating" : "Demote"} {selectedStudents.size} Student(s)
            </Button>
          )}
        </div>

        <div>
          <Card>
            <CardBody>
              <h2 className="font-bold text-[var(--on-surface)] mb-4">Promotion History</h2>
              {history.length === 0 ? (
                <p className="text-sm text-[var(--on-surface-variant)] text-center py-6">No promotions yet</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id} className="p-3 bg-[var(--surface-container-low)] rounded-2xl">
                      <p className="font-bold text-sm text-[var(--on-surface)]">{h.student_name}</p>
                      <p className="text-xs text-[var(--on-surface-variant)]">{h.from_class} → {h.to_class}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${PROMO_COLORS[h.promotion_type]}`}>{h.promotion_type}</span>
                        <span className="text-[10px] text-[var(--on-surface-variant)]">{new Date(h.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
