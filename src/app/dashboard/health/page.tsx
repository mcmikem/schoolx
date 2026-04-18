"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";

type HealthRecord = {
  id: string;
  student_id: string;
  student_name: string;
  condition: string;
  severity: "mild" | "moderate" | "severe";
  treatment: string;
  admitted_at: string;
  discharged_at?: string;
  status: "admitted" | "discharged" | "referred";
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  mild: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  moderate: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  severe: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
};

const STATUS_BADGE: Record<string, string> = {
  admitted: "bg-blue-100 text-blue-700",
  discharged: "bg-slate-100 text-slate-600",
  referred: "bg-red-100 text-red-700",
};

export default function HealthPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [discharging, setDischarging] = useState<string | null>(null);
  const [form, setForm] = useState({
    student_id: "",
    student_name: "",
    condition: "",
    severity: "mild" as "mild" | "moderate" | "severe",
    treatment: "",
    status: "admitted" as "admitted" | "discharged" | "referred",
  });

  const fetchRecords = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("health_records")
      .select("*")
      .eq("school_id", school.id)
      .order("admitted_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Failed to load health records");
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  }, [school?.id, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const searchStudents = async (q: string) => {
    setStudentSearch(q);
    if (q.length < 2 || !school?.id) return;
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("school_id", school.id)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(8);
    setStudents(data || []);
  };

  const admitStudent = async () => {
    if (!form.condition || !school?.id) return;
    setSaving(true);
    const { error } = await supabase.from("health_records").insert({
      school_id: school.id,
      student_id: form.student_id || null,
      student_name: form.student_name || studentSearch,
      condition: form.condition,
      severity: form.severity,
      treatment: form.treatment,
      status: "admitted",
      admitted_at: new Date().toISOString(),
    });
    if (error) {
      toast.error("Failed to admit student: " + error.message);
    } else {
      toast.success("Student admitted to sick bay");
      setShowAdd(false);
      setForm({ student_id: "", student_name: "", condition: "", severity: "mild", treatment: "", status: "admitted" });
      setStudentSearch("");
      fetchRecords();
    }
    setSaving(false);
  };

  const dischargeStudent = async (id: string, referred = false) => {
    setDischarging(id);
    const { error } = await supabase
      .from("health_records")
      .update({
        status: referred ? "referred" : "discharged",
        discharged_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update record");
    } else {
      toast.success(referred ? "Student referred to hospital" : "Student discharged");
      fetchRecords();
    }
    setDischarging(null);
  };

  const admitted = records.filter((r) => r.status === "admitted");
  const discharged = records.filter((r) => r.status === "discharged");
  const referred = records.filter((r) => r.status === "referred");

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Health & Sick Bay"
        subtitle="Student welfare and medical management"
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 hover:scale-105 transition-all"
          >
            <MaterialIcon icon="add" />
            Admit Student
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Currently Admitted", value: admitted.length, color: "bg-blue-600", icon: "bed" },
          { label: "Discharged Today", value: discharged.filter(r => r.discharged_at && new Date(r.discharged_at).toDateString() === new Date().toDateString()).length, color: "bg-emerald-500", icon: "check_circle" },
          { label: "Referred to Hospital", value: referred.length, color: "bg-red-500", icon: "local_hospital" },
        ].map((s) => (
          <div key={s.label} className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center shrink-0`}>
              <MaterialIcon icon={s.icon} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{s.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Records Table */}
      <div className={cardClassName + " overflow-hidden"}>
        <div className="p-5 border-b border-slate-50 bg-slate-50/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sick Bay Records</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 font-medium">Loading records…</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <MaterialIcon icon="medical_services" className="text-5xl text-slate-200 mb-3" />
            <p className="font-bold text-slate-400">No health records yet</p>
            <p className="text-sm text-slate-300 mt-1">Admitted students will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Student</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Condition</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Severity</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Treatment</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Admitted</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800 text-sm">{r.student_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.condition}</td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${SEVERITY_STYLES[r.severity].bg} ${SEVERITY_STYLES[r.severity].text}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${SEVERITY_STYLES[r.severity].dot}`} />
                        {r.severity}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate">{r.treatment}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_BADGE[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {new Date(r.admitted_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-6 py-4">
                      {r.status === "admitted" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => dischargeStudent(r.id, false)}
                            disabled={discharging === r.id}
                            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          >
                            Discharge
                          </button>
                          <button
                            onClick={() => dischargeStudent(r.id, true)}
                            disabled={discharging === r.id}
                            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            Refer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Admit Student</h2>
                  <p className="text-sm text-slate-400 font-medium">Log a new sick bay admission</p>
                </div>
                <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <MaterialIcon icon="close" className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Student</label>
                  <input
                    value={studentSearch}
                    onChange={(e) => searchStudents(e.target.value)}
                    placeholder="Search student name..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                  />
                  {students.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-2xl border border-slate-100 shadow-xl z-10 overflow-hidden">
                      {students.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setForm({ ...form, student_id: s.id, student_name: `${s.first_name} ${s.last_name}` });
                            setStudentSearch(`${s.first_name} ${s.last_name}`);
                            setStudents([]);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-bold text-slate-800"
                        >
                          {s.first_name} {s.last_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Condition</label>
                    <input
                      value={form.condition}
                      onChange={(e) => setForm({ ...form, condition: e.target.value })}
                      placeholder="e.g. Malaria"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Severity</label>
                    <select
                      value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: e.target.value as any })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                    >
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Treatment Given</label>
                  <textarea
                    value={form.treatment}
                    onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                    rows={2}
                    placeholder="e.g. Paracetamol, rest..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none resize-none"
                  />
                </div>

                <button
                  onClick={admitStudent}
                  disabled={!form.condition || saving}
                  className="w-full py-4 bg-red-500 text-white rounded-[28px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <MaterialIcon icon="emergency" />
                      Admit to Sick Bay
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
