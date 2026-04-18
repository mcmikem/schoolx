"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { useStudents } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { format } from "date-fns";
import { getErrorMessage } from "@/lib/validation";

interface BehaviorLog {
  id: string;
  student_id: string;
  date: string;
  incident_type: "positive" | "negative" | "neutral";
  category: string;
  description: string;
  action_taken?: string;
  points: number;
  created_at: string;
  students?: { first_name: string; last_name: string; classes?: { name: string } };
}

const CATEGORIES_POSITIVE = ["Academic Excellence", "Leadership", "Helpfulness", "Sportsmanship", "Punctuality"];
const CATEGORIES_NEGATIVE = ["Late Coming", "Disrespect", "Misconduct", "Bullying", "Cheating", "Truancy"];
const CATEGORIES_NEUTRAL = ["Counselling", "Parent Meeting", "Warning"];

export default function ConductManagementPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const { students } = useStudents(school?.id);

  const [activeType, setActiveType] = useState<"all" | "positive" | "negative">("all");
  const [logs, setLogs] = useState<BehaviorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    incidentType: "positive" as "positive" | "negative" | "neutral",
    category: "",
    description: "",
    actionTaken: "",
    points: 5,
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const fetchLogs = useCallback(async () => {
    if (!school?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("behavior_logs")
        .select("*, students(first_name, last_name, classes(name))")
        .eq("school_id", school.id)
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      setLogs((data as BehaviorLog[]) || []);
    } catch {
      toast.error("Failed to load conduct records");
    } finally {
      setLoading(false);
    }
  }, [school?.id, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.description) {
      toast.error("Student and description are required");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Category is required");
      return;
    }
    if (!Number.isFinite(form.points) || Math.abs(form.points) > 100) {
      toast.error("Points must be between 0 and 100");
      return;
    }

    setSubmitting(true);
    try {
      const pts = form.incidentType === "positive"
        ? Math.abs(form.points)
        : form.incidentType === "negative"
        ? -Math.abs(form.points)
        : 0;

      const { error } = await supabase.from("behavior_logs").insert({
        school_id: school!.id,
        student_id: form.studentId,
        date: form.date,
        incident_type: form.incidentType,
        category: form.category.trim(),
        description: form.description.trim(),
        action_taken: form.actionTaken.trim() || null,
        points: pts,
        recorded_by: user?.id,
      });
      if (error) throw error;
      toast.success("Conduct record logged");
      setShowModal(false);
      setForm({
        studentId: "",
        incidentType: "positive",
        category: "",
        description: "",
        actionTaken: "",
        points: 5,
        date: format(new Date(), "yyyy-MM-dd"),
      });
      fetchLogs();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to log conduct record"));
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = logs.filter((log) => {
    const matchType = activeType === "all" || log.incident_type === activeType;
    const matchSearch =
      !search ||
      `${log.students?.first_name} ${log.students?.last_name}`
        .toLowerCase()
        .includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const merits = logs.filter((l) => l.incident_type === "positive").length;
  const demerits = logs.filter((l) => l.incident_type === "negative").length;
  const totalPoints = logs.reduce((s, l) => s + (l.points || 0), 0);

  const categoryOptions =
    form.incidentType === "positive"
      ? CATEGORIES_POSITIVE
      : form.incidentType === "negative"
      ? CATEGORIES_NEGATIVE
      : CATEGORIES_NEUTRAL;

  return (
    <PageErrorBoundary>
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Conduct & Merits
          </h1>
          <p className="text-slate-500 font-medium">
            Character tracking and disciplinary management
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white rounded-2xl font-bold shadow-lg hover:scale-105 transition-all"
        >
          <MaterialIcon icon="add" />
          Log Incident
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-[32px] bg-emerald-50 border border-emerald-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600">
            <MaterialIcon icon="military_tech" style={{ fontSize: 28 }} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Total Merits</p>
            <p className="text-2xl font-black text-emerald-900">{merits}</p>
          </div>
        </div>
        <div className="p-6 rounded-[32px] bg-red-50 border border-red-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-red-600">
            <MaterialIcon icon="gavel" style={{ fontSize: 28 }} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-red-700">Active Demerits</p>
            <p className="text-2xl font-black text-red-900">{demerits}</p>
          </div>
        </div>
        <div className="p-6 rounded-[32px] bg-primary-50 border border-primary-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary-700">
            <MaterialIcon icon="emoji_events" style={{ fontSize: 28 }} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary-700">Net Points</p>
            <p className={`text-2xl font-black ${totalPoints >= 0 ? "text-emerald-800" : "text-red-800"}`}>
              {totalPoints > 0 ? "+" : ""}{totalPoints}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-wrap gap-3">
          <div className="flex gap-2">
            {["all", "positive", "negative"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  activeType === type
                    ? "bg-slate-800 text-white shadow-md"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by student..."
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary-100"
            />
            <MaterialIcon
              icon="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MaterialIcon icon="gavel" className="text-4xl mx-auto mb-2" />
            <p>No conduct records yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white">
                  {["Date", "Student", "Category", "Description", "Points", ""].map((h) => (
                    <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-800">{record.date}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                          {record.students?.first_name?.[0]}{record.students?.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {record.students?.first_name} {record.students?.last_name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {record.students?.classes?.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        record.incident_type === "positive"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          : record.incident_type === "negative"
                          ? "bg-red-50 text-red-600 border border-red-100"
                          : "bg-slate-50 text-slate-600 border border-slate-100"
                      }`}>
                        {record.category || record.incident_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[300px]">
                      <p className="text-xs text-slate-500 truncate">{record.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className={`text-sm font-black ${record.points >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {record.points > 0 ? "+" : ""}{record.points}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {/* placeholder for future edit action */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Log Conduct Incident</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Student *</label>
                  <select
                    value={form.studentId}
                    onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                    className="input w-full"
                    required
                  >
                    <option value="">Select a student</option>
                    {students.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} — {s.classes?.name || ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Type *</label>
                    <select
                      value={form.incidentType}
                      onChange={(e) => {
                        setForm({ ...form, incidentType: e.target.value as any, category: "" });
                      }}
                      className="input w-full"
                    >
                      <option value="positive">Merit</option>
                      <option value="negative">Demerit</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Points {form.incidentType === "positive" ? "(merit)" : form.incidentType === "negative" ? "(demerit)" : ""}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description *</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="input w-full min-h-[80px]"
                    required
                    placeholder="Describe the incident..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Action Taken</label>
                  <input
                    type="text"
                    value={form.actionTaken}
                    onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                    className="input w-full"
                    placeholder="Optional: what action was taken?"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Log Incident"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
