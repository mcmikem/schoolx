"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";

interface Workflow {
  id: string;
  school_id: string;
  name: string;
  trigger_id: string;
  action_id: string;
  status: "active" | "paused";
  created_at: string;
}

const TRIGGERS = [
  { id: "student_absent", label: "Student is marked Absent", icon: "how_to_reg", color: "text-amber-500", bg: "bg-amber-50" },
  { id: "canteen_balance_low", label: "Canteen Wallet < UGX 5,000", icon: "wallet", color: "text-red-500", bg: "bg-red-50" },
  { id: "fee_payment_received", label: "Fee Payment Received", icon: "payments", color: "text-emerald-500", bg: "bg-emerald-50" },
  { id: "grade_published", label: "Exam Grades Published", icon: "school", color: "text-blue-500", bg: "bg-blue-50" },
];

const ACTIONS = [
  { id: "sms_parent", label: "Send SMS to Parent", icon: "sms" },
  { id: "push_notification_parent", label: "Push Notification via Portal", icon: "notifications_active" },
  { id: "email_bursar", label: "Email Bursar", icon: "email" },
  { id: "suspend_exam_print", label: "Suspend Exam Card Printing", icon: "block" },
];

function getTrigger(id: string) { return TRIGGERS.find((t) => t.id === id) || TRIGGERS[0]; }
function getActionLabel(id: string) { return ACTIONS.find((a) => a.id === id)?.label || "Unknown Action"; }

export default function WorkflowsBuilder() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedAction, setSelectedAction] = useState("");

  const loadWorkflows = useCallback(async () => {
    if (!school?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("school_workflows")
        .select("*")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setWorkflows(data || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, [school?.id]);

  useEffect(() => {
    if (isDemo) {
      setWorkflows([
        { id: "wf-1", school_id: "demo", name: "Absentee Alert", trigger_id: "student_absent", action_id: "sms_parent", status: "active", created_at: new Date().toISOString() },
        { id: "wf-2", school_id: "demo", name: "Low Balance Warning", trigger_id: "canteen_balance_low", action_id: "push_notification_parent", status: "active", created_at: new Date().toISOString() },
        { id: "wf-3", school_id: "demo", name: "Fee Default Limit", trigger_id: "fee_balance_high", action_id: "suspend_exam_print", status: "paused", created_at: new Date().toISOString() },
      ]);
      setLoading(false);
      return;
    }
    loadWorkflows();
  }, [isDemo, loadWorkflows]);

  const handleSaveWorkflow = async () => {
    if (!newTitle || !selectedTrigger || !selectedAction) {
      toast.error("Please fill out all workflow fields");
      return;
    }
    if (isDemo) { toast.error("Demo mode — sign in to a real account to save workflows"); return; }
    if (!school?.id) { toast.error("No school selected"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("school_workflows")
        .insert({ school_id: school.id, name: newTitle.trim(), trigger_id: selectedTrigger, action_id: selectedAction, status: "active" })
        .select()
        .single();
      if (error) throw error;
      setWorkflows((prev) => [data, ...prev]);
      setIsBuilderOpen(false);
      setNewTitle("");
      setSelectedTrigger("");
      setSelectedAction("");
      toast.success("Workflow deployed successfully");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (wf: Workflow) => {
    if (isDemo) { toast.error("Demo mode — read only"); return; }
    const nextStatus: "active" | "paused" = wf.status === "active" ? "paused" : "active";
    setWorkflows((prev) => prev.map((w) => w.id === wf.id ? { ...w, status: nextStatus } : w));
    try {
      const { error } = await supabase.from("school_workflows").update({ status: nextStatus }).eq("id", wf.id).eq("school_id", school!.id);
      if (error) throw error;
      toast.success(nextStatus === "active" ? "Workflow activated" : "Workflow paused");
    } catch (e: any) {
      setWorkflows((prev) => prev.map((w) => w.id === wf.id ? { ...w, status: wf.status } : w));
      toast.error(e?.message || "Failed to update workflow");
    }
  };

  const deleteWorkflow = async (wf: Workflow) => {
    if (isDemo) { toast.error("Demo mode — read only"); return; }
    setWorkflows((prev) => prev.filter((w) => w.id !== wf.id));
    try {
      const { error } = await supabase.from("school_workflows").delete().eq("id", wf.id).eq("school_id", school!.id);
      if (error) throw error;
      toast.success("Workflow deleted");
    } catch (e: any) {
      loadWorkflows();
      toast.error(e?.message || "Failed to delete workflow");
    }
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="glass-premium rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-l-4 border-[var(--primary)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-full -mr-32 -mt-32 blur-3xl z-0 pointer-events-none" />
        <div className="relative z-10 flex-1">
          <h1 className="text-3xl font-black tracking-tight text-[var(--t1)] flex items-center gap-3">
            <MaterialIcon icon="account_tree" className="text-[var(--primary)]" style={{ fontSize: 32 }} />
            Automation Engine
          </h1>
          <p className="text-[var(--t3)] font-medium mt-2 max-w-lg">
            Create rules to eliminate manual work. Workflows run automatically on every matching event.
          </p>
          {isDemo && (
            <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1 mt-2 inline-block">
              Demo — workflows shown for preview. Sign in to a real account to save your own.
            </p>
          )}
        </div>
        {!isDemo && (
          <button onClick={() => setIsBuilderOpen(true)}
            className="relative z-10 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white px-6 py-3 rounded-2xl shadow-xl shadow-[var(--primary)]/20 font-bold transition-all active:scale-95 flex items-center gap-2 border border-white/10 whitespace-nowrap">
            <MaterialIcon icon="add" /> Build Workflow
          </button>
        )}
      </div>

      {/* Builder Panel */}
      {isBuilderOpen && (
        <div className="glass-premium rounded-3xl p-8 border border-[var(--primary)]/30 animate-in slide-in-from-top-4 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(to right, #80808012 1px, transparent 1px), linear-gradient(to bottom, #80808012 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold text-[var(--t1)]">Visual Workflow Builder</h2>
              <button onClick={() => setIsBuilderOpen(false)} className="text-[var(--t3)] hover:text-[var(--red)] transition-colors">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <div className="mb-8">
              <label className="block text-xs font-black uppercase tracking-widest text-[var(--t3)] mb-2">Workflow Name</label>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. VIP Parent Alerts"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-5 py-4 text-base font-bold text-[var(--t1)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div className="flex flex-col md:flex-row items-center gap-8 mb-10 w-full relative">
              {/* Trigger */}
              <div className="flex-1 w-full bg-[var(--surface-container)] rounded-3xl p-6 border-2 border-dashed border-[var(--border)] relative hover:border-[var(--primary)] transition-colors">
                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-lg font-black text-[var(--t1)]">1</div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--t2)] mb-4 text-center">When this happens…</h3>
                <div className="grid gap-3">
                  {TRIGGERS.map((t) => (
                    <button key={t.id} onClick={() => setSelectedTrigger(t.id)}
                      className={`p-4 rounded-2xl flex items-center gap-3 transition-all border text-left ${selectedTrigger === t.id ? "bg-white border-2 border-[var(--primary)] shadow-lg" : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50 scale-[0.98]"}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.bg} ${t.color}`}>
                        <MaterialIcon icon={t.icon} style={{ fontSize: 20 }} />
                      </div>
                      <span className="font-bold text-[var(--t1)] text-sm">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Arrow */}
              <div className="hidden md:flex flex-col items-center justify-center relative">
                <div className="h-[2px] w-16 bg-[var(--border)] absolute" />
                <div className="w-12 h-12 rounded-full bg-[var(--bg)] border-2 border-[var(--border)] z-10 flex items-center justify-center text-[var(--primary)] shadow-inner">
                  <MaterialIcon icon="arrow_forward" style={{ fontSize: 26, fontWeight: "bold" }} />
                </div>
              </div>
              {/* Action */}
              <div className="flex-1 w-full bg-[var(--surface-container)] rounded-3xl p-6 border-2 border-dashed border-[var(--border)] relative hover:border-[var(--primary)] transition-colors">
                <div className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-lg font-black text-[var(--t1)]">2</div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--t2)] mb-4 text-center">Then do this…</h3>
                <div className="grid gap-3">
                  {ACTIONS.map((a) => (
                    <button key={a.id} onClick={() => setSelectedAction(a.id)}
                      className={`p-4 rounded-2xl flex items-center gap-3 transition-all border text-left ${selectedAction === a.id ? "bg-[var(--primary)] border-2 border-[var(--primary)] shadow-lg shadow-[var(--primary)]/30 text-white" : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50 scale-[0.98] text-[var(--t1)]"}`}>
                      <MaterialIcon icon={a.icon} />
                      <span className="font-bold text-sm tracking-tight">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)]">
              <button onClick={() => setIsBuilderOpen(false)} className="px-6 py-3 rounded-xl font-bold text-[var(--t2)] hover:bg-[var(--surface-container)] transition-colors">Cancel</button>
              <button onClick={handleSaveWorkflow} disabled={saving}
                className="bg-[var(--primary)] text-[var(--on-primary)] px-8 py-3 rounded-xl font-bold shadow-lg shadow-[var(--primary)]/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60">
                <MaterialIcon icon="done_all" />
                {saving ? "Saving…" : "Deploy Workflow"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflows Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 h-48 animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-[var(--bg)] mb-4" />
              <div className="h-4 w-3/4 bg-[var(--bg)] rounded mb-3" />
              <div className="h-3 w-1/2 bg-[var(--bg)] rounded" />
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-20 bg-[var(--surface)] rounded-3xl border border-[var(--border)]">
          <MaterialIcon icon="account_tree" className="text-[var(--t4)]" style={{ fontSize: 48 }} />
          <p className="mt-4 font-bold text-[var(--t2)]">No workflows yet</p>
          <p className="text-sm text-[var(--t3)] mt-1">Build your first automation rule above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((wf) => {
            const triggerInfo = getTrigger(wf.trigger_id);
            return (
              <div key={wf.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-[var(--primary)]/30 transition-all group flex flex-col items-start h-full">
                <div className="w-full flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${triggerInfo.bg} ${triggerInfo.color} group-hover:scale-110 transition-transform`}>
                    <MaterialIcon icon={triggerInfo.icon} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button onClick={() => toggleStatus(wf)} title={wf.status === "active" ? "Pause" : "Activate"}
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${wf.status === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-amber-100 hover:text-amber-700 hover:border-amber-200" : "bg-[var(--surface-container)] text-[var(--t3)] border-[var(--border)] hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-200"}`}>
                      {wf.status}
                    </button>
                    {!isDemo && (
                      <button onClick={() => deleteWorkflow(wf)} title="Delete" className="text-[var(--t4)] hover:text-red-500 transition-colors p-1">
                        <MaterialIcon icon="delete" style={{ fontSize: 16 }} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 w-full">
                  <h3 className="text-lg font-bold text-[var(--t1)] mb-4 tracking-tight">{wf.name}</h3>
                  <div className="bg-[var(--surface-container-low)] rounded-2xl p-4 border border-[var(--border)] relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3 z-10 relative">
                      <div className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                      <p className="text-xs font-bold text-[var(--t2)] line-clamp-1">{triggerInfo.label}</p>
                    </div>
                    <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-slate-200" />
                    <div className="flex items-center gap-2 z-10 relative">
                      <div className="w-2 h-2 rounded-full bg-[var(--primary)] shadow-[0_0_10px_var(--primary)] flex-shrink-0" />
                      <p className="text-xs font-bold text-[var(--primary)] line-clamp-1">{getActionLabel(wf.action_id)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}

  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: "wf-1",
      name: "Absentee Alert",
      trigger: "student_absent",
      action: "sms_parent",
      status: "active",
    },
    {
      id: "wf-2",
      name: "Low Balance Warning",
      trigger: "canteen_balance_low",
      action: "push_notification_parent",
      status: "active",
    },
    {
      id: "wf-3",
      name: "Fee Default Limit",
      trigger: "fee_balance_high",
      action: "suspend_exam_print",
      status: "paused",
    },
  ]);

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedAction, setSelectedAction] = useState("");

  const triggers = [
    {
      id: "student_absent",
      label: "Student is marked Absent",
      icon: "how_to_reg",
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      id: "canteen_balance_low",
      label: "Canteen Wallet < UGX 5,000",
      icon: "wallet",
      color: "text-red-500",
      bg: "bg-red-50",
    },
    {
      id: "fee_payment_received",
      label: "Fee Payment Received",
      icon: "payments",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      id: "grade_published",
      label: "Exam Grades Published",
      icon: "school",
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
  ];

  const actions = [
    { id: "sms_parent", label: "Send SMS to Parent", icon: "sms" },
    {
      id: "push_notification_parent",
      label: "Push Notification via Portal",
      icon: "notifications_active",
    },
    { id: "email_bursar", label: "Email Bursar", icon: "email" },
    {
      id: "suspend_exam_print",
      label: "Suspend Exam Card Printing",
      icon: "block",
    },
  ];

  const handleSaveWorkflow = () => {
    if (!newTitle || !selectedTrigger || !selectedAction) {
      toast.error("Please fill out all workflow node fields");
      return;
    }
    setWorkflows([
      {
        id: crypto.randomUUID(),
        name: newTitle,
        trigger: selectedTrigger,
        action: selectedAction,
        status: "active",
      },
      ...workflows,
    ]);
    setIsBuilderOpen(false);
    setNewTitle("");
    setSelectedTrigger("");
    setSelectedAction("");
    toast.success("Workflow deployed successfully to production engine");
  };

  const getTriggerLabel = (id: string) =>
    triggers.find((t) => t.id === id)?.label || "Unknown Trigger";
  const getActionLabel = (id: string) =>
    actions.find((a) => a.id === id)?.label || "Unknown Action";
  const getTriggerDisplayData = (id: string) =>
    triggers.find((t) => t.id === id) || triggers[0];

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="glass-premium rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-l-4 border-[var(--primary)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-full -mr-32 -mt-32 blur-3xl z-0 pointer-events-none" />
          <div className="relative z-10 flex-1">
            <h1 className="text-3xl font-black tracking-tight text-[var(--t1)] flex items-center gap-3">
              <MaterialIcon
                icon="account_tree"
                className="text-[var(--primary)]"
                style={{ fontSize: 32 }}
              />
              Automation Engine
            </h1>
            <p className="text-[var(--t3)] font-medium mt-2 max-w-lg">
              Create rules to eliminate manual work. The automation engine runs
              24/7 scanning for triggers and executing actions automatically.
            </p>
          </div>
          <button
            onClick={() => setIsBuilderOpen(true)}
            className="relative z-10 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white px-6 py-3 rounded-2xl shadow-xl shadow-[var(--primary)]/20 font-bold transition-all active:scale-95 flex items-center gap-2 border border-white/10 whitespace-nowrap"
          >
            <MaterialIcon icon="add" /> Build Workflow
          </button>
        </div>

        {/* Builder View */}
        {isBuilderOpen && (
          <div className="glass-premium rounded-3xl p-8 border border-[var(--primary)]/30 animate-in slide-in-from-top-4 relative overflow-hidden shadow-2xl">
            <div
              className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #80808012 1px, transparent 1px), linear-gradient(to bottom, #80808012 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative z-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-[var(--t1)]">
                  Visual Workflow Builder
                </h2>
                <button
                  onClick={() => setIsBuilderOpen(false)}
                  className="text-[var(--t3)] hover:text-[var(--red)] transition-colors"
                >
                  <MaterialIcon icon="close" />
                </button>
              </div>

              <div className="mb-8">
                <label className="block text-xs font-black uppercase tracking-widest text-[var(--t3)] mb-2">
                  Workflow Name
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. VIP Parent Alerts"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-5 py-4 text-base font-bold text-[var(--t1)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8 mb-10 w-full relative">
                {/* Trigger Selection */}
                <div className="flex-1 w-full bg-[var(--surface-container)] rounded-3xl p-6 border-2 border-dashed border-[var(--border)] relative group hover:border-[var(--primary)] transition-colors">
                  <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-lg font-black text-[var(--t1)]">
                    1
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-[var(--t2)] mb-4 text-center">
                    When this happens...
                  </h3>

                  <div className="grid gap-3">
                    {triggers.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTrigger(t.id)}
                        className={`p-4 rounded-2xl flex items-center gap-3 transition-all border text-left ${
                          selectedTrigger === t.id
                            ? `bg-white border-2 border-[var(--primary)] shadow-lg scale-100`
                            : `bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50 scale-[0.98]`
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.bg} ${t.color}`}
                        >
                          <MaterialIcon
                            icon={t.icon}
                            style={{ fontSize: 20 }}
                          />
                        </div>
                        <span className="font-bold text-[var(--t1)] text-sm">
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Connector Arrow */}
                <div className="hidden md:flex flex-col items-center justify-center relative">
                  <div className="h-[2px] w-16 bg-[var(--border)] absolute" />
                  <div className="w-12 h-12 rounded-full bg-[var(--bg)] border-2 border-[var(--border)] z-10 flex items-center justify-center text-[var(--primary)] shadow-inner">
                    <MaterialIcon
                      icon="arrow_forward"
                      style={{ fontSize: 26, fontWeight: "bold" }}
                    />
                  </div>
                </div>

                {/* Action Selection */}
                <div className="flex-1 w-full bg-[var(--surface-container)] rounded-3xl p-6 border-2 border-dashed border-[var(--border)] relative group hover:border-[var(--primary)] transition-colors">
                  <div className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-lg font-black text-[var(--t1)]">
                    2
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-[var(--t2)] mb-4 text-center">
                    Then do this...
                  </h3>

                  <div className="grid gap-3">
                    {actions.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAction(a.id)}
                        className={`p-4 rounded-2xl flex items-center gap-3 transition-all border text-left ${
                          selectedAction === a.id
                            ? `bg-[var(--primary)] border-2 border-[var(--primary)] shadow-lg shadow-[var(--primary)]/30 scale-100 text-white`
                            : `bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50 scale-[0.98] text-[var(--t1)]`
                        }`}
                      >
                        <MaterialIcon icon={a.icon} />
                        <span className="font-bold text-sm tracking-tight">
                          {a.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)]">
                <button
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-6 py-3 rounded-xl font-bold text-[var(--t2)] hover:bg-[var(--surface-container)] border border-transparent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveWorkflow}
                  className="bg-[var(--primary)] text-[var(--on-primary)] px-8 py-3 rounded-xl font-bold shadow-lg shadow-[var(--primary)]/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <MaterialIcon icon="done_all" />
                  Deploy Workflow
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Workflows Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((wf) => {
            const triggerInfo = getTriggerDisplayData(wf.trigger);
            return (
              <div
                key={wf.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-[var(--primary)]/30 transition-all group flex flex-col items-start h-full"
              >
                <div className="w-full flex justify-between items-start mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${triggerInfo.bg} ${triggerInfo.color} group-hover:scale-110 transition-transform`}
                  >
                    <MaterialIcon icon={triggerInfo.icon} />
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        wf.status === "active"
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          : "bg-[var(--surface-container)] text-[var(--t3)] border border-[var(--border)]"
                      }`}
                    >
                      {wf.status}
                    </span>
                    <button className="text-[var(--t4)] hover:text-[var(--primary)] mt-2">
                      <MaterialIcon icon="more_horiz" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <h3 className="text-lg font-bold text-[var(--t1)] mb-4 tracking-tight">
                    {wf.name}
                  </h3>

                  <div className="bg-[var(--surface-container-low)] rounded-2xl p-4 border border-[var(--border)] relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3 z-10 relative">
                      <div className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                      <p className="text-xs font-bold text-[var(--t2)] line-clamp-1">
                        {getTriggerLabel(wf.trigger)}
                      </p>
                    </div>
                    <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-slate-200" />
                    <div className="flex items-center gap-2 z-10 relative">
                      <div className="w-2 h-2 rounded-full bg-[var(--primary)] shadow-[0_0_10px_var(--primary)] flex-shrink-0" />
                      <p className="text-xs font-bold text-[var(--primary)] line-clamp-1">
                        {getActionLabel(wf.action)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageErrorBoundary>
  );
}
