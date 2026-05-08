"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

interface PromotionStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  status: string;
  class_id: string;
  repeating?: boolean;
  classes?: { id: string; name: string; level: string };
}

type StudentAction = "promote" | "repeat" | "demote" | "skip";
interface StudentActionMap {
  [studentId: string]: {
    action: StudentAction;
    targetClassId?: string;
    reason?: string;
  };
}

interface PromotionsTabProps {
  school: any;
  user: any;
  isDemo: boolean;
  students: any[];
  classes: any[];
  academicYear: string;
  updateStudent: (id: string, data: any) => Promise<any>;
}

export default function PromotionsTab({
  school,
  user,
  isDemo,
  students,
  classes,
  academicYear,
  updateStudent,
}: PromotionsTabProps) {
  const toast = useToast();
  const [fromClass, setFromClass] = useState("");
  const [toClass, setToClass] = useState("");
  const [promotionStudents, setPromotionStudents] = useState<PromotionStudent[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [studentActions, setStudentActions] = useState<StudentActionMap>({});
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promotionHistory, setPromotionHistory] = useState<any[]>([]);
  const [showDemoteModal, setShowDemoteModal] = useState<string | null>(null);
  const [demoteReason, setDemoteReason] = useState("");
  const [demoteClass, setDemoteClass] = useState("");

  const fetchPromotionStudents = useCallback(async () => {
    if (!school?.id || !fromClass) return;
    setLoading(true);
    try {
      if (isDemo) {
        const classStudents = students.filter((s) => s.class_id === fromClass && s.status === "active");
        setPromotionStudents(classStudents as any);
        setSelectedStudents(new Set(classStudents.map((s) => s.id)));
        const defaultActions: StudentActionMap = {};
        classStudents.forEach((s) => { defaultActions[s.id] = { action: "promote" }; });
        setStudentActions(defaultActions);
      } else {
        const { data } = await supabase
          .from("students")
          .select("*, classes(*)")
          .eq("school_id", school.id)
          .eq("class_id", fromClass)
          .eq("status", "active")
          .order("first_name");
        setPromotionStudents(data || []);
        setSelectedStudents(new Set(data?.map((s) => s.id) || []));
        const defaultActions: StudentActionMap = {};
        data?.forEach((s) => { defaultActions[s.id] = { action: "promote" }; });
        setStudentActions(defaultActions);
      }
    } finally {
      setLoading(false);
    }
  }, [school?.id, fromClass, isDemo, students]);

  const fetchPromotionHistory = useCallback(async () => {
    if (!school?.id) return;
    try {
      if (isDemo) {
        setPromotionHistory([{
          id: "demo-h1",
          from_classes: { name: "P.4" },
          to_classes: { name: "P.5" },
          academic_year: academicYear,
          promotion_type: "promoted",
          promoted_at: new Date().toISOString(),
          users: { full_name: user?.full_name || "Admin" },
          student_count: 32,
        }]);
      } else {
        const { data } = await supabase
          .from("student_promotions")
          .select("*, from_classes(name), to_classes(name), users(full_name)")
          .eq("school_id", school.id)
          .order("promoted_at", { ascending: false })
          .limit(20);
        setPromotionHistory(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  }, [school?.id, isDemo, academicYear, user?.full_name]);

  useEffect(() => {
    if (fromClass) fetchPromotionStudents();
  }, [fromClass, fetchPromotionStudents]);

  useEffect(() => {
    fetchPromotionHistory();
  }, [fetchPromotionHistory]);

  const processPromotions = async () => {
    const selectedArray = Array.from(selectedStudents);
    if (selectedArray.length === 0) {
      toast.error("No students selected");
      return;
    }
    const promoteIds = selectedArray.filter(id => studentActions[id]?.action === 'promote');
    if (promoteIds.length > 0 && !toClass) {
      toast.error("Please select a target class for promoted students");
      return;
    }

    setPromoting(true);
    try {
      const now = new Date().toISOString();
      const logs: any[] = [];
      const tasks: Promise<any>[] = [];

      for (const id of selectedArray) {
        const action = studentActions[id]?.action;
        if (action === "promote") {
          tasks.push(updateStudent(id, { class_id: toClass, repeating: false }));
          logs.push({ school_id: school.id, student_id: id, from_class_id: fromClass, to_class_id: toClass, academic_year: academicYear, promotion_type: "promoted", promoted_at: now });
        } else if (action === "repeat") {
          tasks.push(updateStudent(id, { repeating: true }));
          logs.push({ school_id: school.id, student_id: id, from_class_id: fromClass, to_class_id: fromClass, academic_year: academicYear, promotion_type: "repeating", promoted_at: now });
        }
      }

      await Promise.all(tasks);
      if (!isDemo && logs.length > 0) {
        await supabase.from("student_promotions").insert(logs);
      }
      
      toast.success(`Processed ${selectedArray.length} student actions`);
      fetchPromotionStudents();
      fetchPromotionHistory();
      setSelectedStudents(new Set());
    } catch (err: any) {
      toast.error(err.message || "Failed to process promotions");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase text-blue-800 mb-2">Promote From</label>
            <select value={fromClass} onChange={(e) => setFromClass(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-white">
              <option value="">Select current class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <MaterialIcon icon="arrow_forward" className="hidden md:block mb-3 text-blue-400" />
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase text-blue-800 mb-2">Promote To</label>
            <select value={toClass} onChange={(e) => setToClass(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-white">
              <option value="">Select target class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Button onClick={processPromotions} disabled={promoting || !fromClass} loading={promoting} className="md:w-48 h-[50px]">
            Execute Promotion
          </Button>
        </div>
      </Card>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : fromClass && (
        <Card>
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold">{promotionStudents.length} Students in {classes.find(c => c.id === fromClass)?.name}</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => {
                const newActions: StudentActionMap = {};
                promotionStudents.forEach(s => newActions[s.id] = { action: 'promote' });
                setStudentActions(newActions);
              }}>Mark All Promote</Button>
              <Button variant="ghost" size="sm" onClick={() => {
                const newActions: StudentActionMap = {};
                promotionStudents.forEach(s => newActions[s.id] = { action: 'repeat' });
                setStudentActions(newActions);
              }}>Mark All Repeat</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Student</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Action</th>
                </tr>
              </thead>
              <tbody>
                {promotionStudents.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border)]">
                    <td className="p-4">
                      <div className="font-bold">{s.first_name} {s.last_name}</div>
                      <div className="text-[10px] text-[var(--t3)] uppercase font-black">{s.gender}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStudentActions(prev => ({ ...prev, [s.id]: { action: 'promote' } }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${studentActions[s.id]?.action === 'promote' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}
                        >Promote</button>
                        <button
                          onClick={() => setStudentActions(prev => ({ ...prev, [s.id]: { action: 'repeat' } }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${studentActions[s.id]?.action === 'repeat' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'}`}
                        >Repeat</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!fromClass && (
        <Card className="p-12 text-center border-dashed border-2">
          <MaterialIcon icon="upgrade" className="text-5xl text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-500">Select a class to manage promotions</h3>
          <p className="text-sm text-gray-400">Choose a class above to see students and assign promotion actions.</p>
        </Card>
      )}
    </div>
  );
}
