"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionPlan = "starter" | "growth" | "enterprise" | "lifetime" | "free_trial";
type SubscriptionStatus = "active" | "trial" | "expired" | "past_due" | "canceled" | "unpaid" | "suspended";
type FeatureStage = "core" | "academic" | "finance" | "full";

interface School {
  id: string;
  name: string;
  school_code: string;
  district: string;
  school_type: string;
  ownership: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  primary_color: string;
  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  student_count?: number;
  trial_ends_at?: string;
  feature_stage?: FeatureStage;
  created_at: string;
  // Customization fields
  address?: string;
  motto?: string;
  principal_name?: string;
  report_header?: string;
  report_footer?: string;
  id_card_style?: string;
}

interface UserRow {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  school_id: string | null;
  is_active: boolean;
  created_at: string;
  school_name?: string;
}

interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  trialSchools: number;
  expiredSchools: number;
  totalStudents: number;
  totalUsers: number;
  newThisMonth: number;
}

type Tab = "overview" | "schools" | "users" | "register" | "settings";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  starter:    "#3b82f6",
  growth:     "#0d9488",
  enterprise: "#f59e0b",
  lifetime:   "#7c3aed",
  free_trial: "#64748b",
};

const PLAN_LABELS: Record<string, string> = {
  starter:    "Starter",
  growth:     "Growth",
  enterprise: "Enterprise",
  lifetime:   "Lifetime",
  free_trial: "Free Trial",
};

const PLAN_PRICES: Record<string, string> = {
  starter:    "UGX 2,000/student/term",
  growth:     "UGX 3,500/student/term",
  enterprise: "UGX 5,000/student/term",
  lifetime:   "One-time license",
  free_trial: "Free",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg: "#ccfbf1", text: "#0d9488",  label: "Active"     },
  trial:     { bg: "#dbeafe", text: "#1d4ed8",  label: "Trial"      },
  expired:   { bg: "#fee2e2", text: "#dc2626",  label: "Expired"    },
  past_due:  { bg: "#fef3c7", text: "#b45309",  label: "Past Due"   },
  suspended: { bg: "#fef3c7", text: "#b45309",  label: "Suspended"  },
  canceled:  { bg: "#f1f5f9", text: "#64748b",  label: "Canceled"   },
  unpaid:    { bg: "#fef3c7", text: "#b45309",  label: "Unpaid"     },
};

const FEATURE_STAGE_LABELS: Record<FeatureStage, string> = {
  core:     "Core Only",
  academic: "Academic",
  finance:  "Finance",
  full:     "Full Access",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin:     "#7c3aed",
  school_admin:    "#0d9488",
  admin:           "#0d9488",
  headmaster:      "#0369a1",
  bursar:          "#b45309",
  teacher:         "#16a34a",
  dean_of_studies: "#c026d3",
  secretary:       "#64748b",
  dorm_master:     "#0891b2",
  parent:          "#f59e0b",
  student:         "#64748b",
};

const ALL_ROLES = [
  "school_admin", "headmaster", "dean_of_studies", "bursar",
  "teacher", "secretary", "dorm_master", "parent", "student",
];

// ─── API helper ───────────────────────────────────────────────────────────────

async function adminAction(action: string, params: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/super-admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) throw new Error(data.error || "Operation failed");
}

async function adminActionResult<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/super-admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) throw new Error(data.error || "Operation failed");
  return data as T;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-UG", {
    day: "numeric", month: "short", year: "numeric",
  });
}
function timeSince(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary)] ${value ? "bg-[var(--primary)]" : "bg-[#cbd5e1]"}`}
      role="switch"
      aria-checked={value}
    >
      <span
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
        style={{ left: value ? "calc(100% - 20px)" : "4px" }}
      />
    </button>
  );
}

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] || "#64748b";
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
      style={{ background: `${c}18`, color: c }}
    >
      {PLAN_LABELS[plan] || plan}
    </span>
  );
}

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: string; color: string; sub?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-accent" style={{ background: color }} />
      <div className="stat-inner">
        <div className="stat-meta">
          <div className="stat-label">{label}</div>
          <div className="stat-icon-box" style={{ background: `${color}18`, color }}>
            <MaterialIcon icon={icon} style={{ fontSize: 20 }} />
          </div>
        </div>
        <div className="stat-val" style={{ color }}>{value}</div>
        {sub && <div className="text-[12px] text-[var(--t3)] mt-1.5 font-medium">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  open, title, body, confirmLabel, danger, loading, onConfirm, onCancel,
}: {
  open: boolean; title: string; body: string; confirmLabel: string;
  danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-sm p-6">
        <h3 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)] mb-2">{title}</h3>
        <p className="text-[13px] text-[var(--t2)] mb-5 leading-relaxed">{body}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-[13px] font-semibold border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--bg)] transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-[var(--primary)] hover:opacity-90"}`}
          >
            {loading ? "Working\u2026" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── School Detail Sheet ──────────────────────────────────────────────────────

function SchoolDetailSheet({ school, onClose, onUpdated, onDeleted }: {
  school: School;
  onClose: () => void;
  onUpdated: (s: School) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();

  const [name, setName] = useState(school.name);
  const [district, setDistrict] = useState(school.district);
  const [phone, setPhone] = useState(school.phone || "");
  const [email, setEmail] = useState(school.email || "");
  const [color, setColor] = useState(school.primary_color || "#001F3F");
  const [plan, setPlan]   = useState(school.subscription_plan);
  const [status, setStatus] = useState(school.subscription_status);
  const [stage, setStage] = useState<FeatureStage>(school.feature_stage || "full");
  const [trialDays, setTrialDays] = useState(14);
  const [saving, setSaving] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Customization
  const [address, setAddress] = useState(school.address || "");
  const [motto, setMotto] = useState(school.motto || "");
  const [principalName, setPrincipalName] = useState(school.principal_name || "");
  const [reportHeader, setReportHeader] = useState(school.report_header || "");
  const [reportFooter, setReportFooter] = useState(school.report_footer || "");
  const [idCardStyle, setIdCardStyle] = useState(school.id_card_style || "standard");
  const [activeSection, setActiveSection] = useState<"details" | "subscription" | "customize">("details");

  const save = async () => {
    if (!name.trim()) { toast.error("School name is required"); return; }
    setSaving(true);
    try {
      await adminAction("update_school", {
        id: school.id,
        fields: {
          name: name.trim(),
          district: district.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          primary_color: color,
          subscription_plan: plan,
          subscription_status: status,
          feature_stage: stage,
          address: address.trim() || null,
          motto: motto.trim() || null,
          principal_name: principalName.trim() || null,
          report_header: reportHeader.trim() || null,
          report_footer: reportFooter.trim() || null,
          id_card_style: idCardStyle,
        },
      });
      onUpdated({
        ...school,
        name: name.trim(),
        district: district.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        primary_color: color,
        subscription_plan: plan,
        subscription_status: status,
        feature_stage: stage,
        address: address.trim() || undefined,
        motto: motto.trim() || undefined,
        principal_name: principalName.trim() || undefined,
        report_header: reportHeader.trim() || undefined,
        report_footer: reportFooter.trim() || undefined,
        id_card_style: idCardStyle,
      });
      toast.success("School updated");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const extendTrial = async () => {
    setSaving(true);
    try {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + trialDays);
      await adminAction("update_school", {
        id: school.id,
        fields: { subscription_status: "trial", trial_ends_at: newDate.toISOString() },
      });
      onUpdated({ ...school, subscription_status: "trial", trial_ends_at: newDate.toISOString() });
      toast.success(`Trial extended by ${trialDays} days`);
      setStatus("trial");
    } catch (e: any) {
      toast.error(e?.message || "Failed to extend trial");
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    setSaving(true);
    try {
      await adminAction("update_school", { id: school.id, fields: { subscription_status: "active" } });
      onUpdated({ ...school, subscription_status: "active" });
      setStatus("active");
      toast.success("School activated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to activate");
    } finally {
      setSaving(false);
    }
  };

  const doSuspend = async () => {
    setSaving(true);
    try {
      await adminAction("update_school", { id: school.id, fields: { subscription_status: "suspended" } });
      onDeleted(school.id);
      toast.success(`${school.name} suspended`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
      setShowSuspendConfirm(false);
    }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      await adminAction("delete_school", { id: school.id });
      onDeleted(school.id);
      toast.success(`${school.name} permanently deleted`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const ic = "w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-[12px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors";
  const sectionBtn = (id: typeof activeSection, label: string) => (
    <button type="button" onClick={() => setActiveSection(id)}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${activeSection === id ? "bg-[var(--primary)] text-white" : "text-[var(--t2)] hover:bg-[var(--bg)]"}`}>
      {label}
    </button>
  );

  return (
    <>
      <ConfirmDialog open={showSuspendConfirm} title={`Suspend "${school.name}"?`}
        body="The school will lose access until reactivated. All data is preserved."
        confirmLabel="Suspend School" danger loading={saving}
        onConfirm={doSuspend} onCancel={() => setShowSuspendConfirm(false)} />
      <ConfirmDialog open={showDeleteConfirm} title={`Permanently delete "${school.name}"?`}
        body="This will delete ALL school data including students, grades, fees, and staff. This CANNOT be undone."
        confirmLabel="Delete Everything" danger loading={saving}
        onConfirm={doDelete} onCancel={() => setShowDeleteConfirm(false)} />

      <div className="fixed inset-0 z-40 flex items-center justify-end p-4">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-md h-full max-h-[90vh] overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0 overflow-hidden" style={{ background: color }}>
              {school.logo_url ? <img src={school.logo_url} alt={school.name} className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] truncate">{name || school.name}</div>
              <div className="text-[10px] text-[var(--t3)]">{school.school_code} · {fmtDate(school.created_at)}</div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-[var(--t3)] hover:bg-[var(--bg)] transition-colors">
              <MaterialIcon icon="close" style={{ fontSize: 18 }} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-5 py-3 border-b border-[var(--border)]">
            {sectionBtn("details", "Details")}
            {sectionBtn("subscription", "Subscription")}
            {sectionBtn("customize", "Reports & IDs")}
          </div>

          <div className="flex-1 p-5 space-y-5 overflow-y-auto">

            {/* ── Details section ── */}
            {activeSection === "details" && (
              <>
                <div>
                  <div className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-2.5">School Details</div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">Name <span className="text-red-500">*</span></label>
                      <input className={ic} value={name} onChange={(e) => setName(e.target.value)} placeholder="School name" />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">District</label>
                        <input className={ic} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">Brand Colour</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-9 h-9 rounded-lg border border-[var(--border)] cursor-pointer flex-shrink-0" />
                          <span className="text-[11px] text-[var(--t3)] font-mono">{color}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">Phone</label>
                        <input className={ic} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256 700 000 000" type="tel" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">Email</label>
                        <input className={ic} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@school.ug" type="email" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Type",      value: school.school_type },
                    { label: "Ownership", value: school.ownership   },
                    { label: "Students",  value: school.student_count?.toLocaleString() ?? "—" },
                    { label: "Code",      value: school.school_code },
                  ].map((row) => (
                    <div key={row.label} className="rounded-xl bg-[var(--bg)] px-3 py-2.5">
                      <div className="text-[10px] text-[var(--t3)] font-semibold uppercase tracking-wide mb-0.5">{row.label}</div>
                      <div className="text-[12px] font-semibold text-[var(--t1)] truncate">{row.value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Subscription section ── */}
            {activeSection === "subscription" && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-2">Subscription Plan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["starter", "growth", "enterprise", "lifetime", "free_trial"] as SubscriptionPlan[]).map((p) => (
                      <button key={p} type="button" onClick={() => setPlan(p)}
                        className="rounded-xl border-2 px-2 py-2 text-center transition-all"
                        style={{ borderColor: plan === p ? PLAN_COLORS[p] : "var(--border)", background: plan === p ? `${PLAN_COLORS[p]}12` : "var(--bg)" }}>
                        <div className="text-[11px] font-bold" style={{ color: plan === p ? PLAN_COLORS[p] : "var(--t2)" }}>{PLAN_LABELS[p]}</div>
                        <div className="text-[9px] text-[var(--t3)] mt-0.5">{PLAN_PRICES[p]}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-2">Subscription Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["active", "trial", "expired", "suspended", "past_due", "canceled"] as SubscriptionStatus[]).map((st) => {
                      const sty = STATUS_STYLES[st];
                      return (
                        <button key={st} type="button" onClick={() => setStatus(st)}
                          className="rounded-xl border-2 px-2 py-2 text-center text-[11px] font-bold transition-all"
                          style={{ borderColor: status === st ? sty.text : "var(--border)", background: status === st ? sty.bg : "var(--bg)", color: status === st ? sty.text : "var(--t3)" }}>
                          {sty.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-2">Feature Access Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["core", "academic", "finance", "full"] as FeatureStage[]).map((fs) => (
                      <button key={fs} type="button" onClick={() => setStage(fs)}
                        className="rounded-xl border-2 px-3 py-2 text-[11px] font-bold transition-all text-left"
                        style={{ borderColor: stage === fs ? "var(--primary)" : "var(--border)", background: stage === fs ? "var(--primary-soft)" : "var(--bg)", color: stage === fs ? "var(--primary)" : "var(--t3)" }}>
                        {FEATURE_STAGE_LABELS[fs]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-[#fffbeb] border border-[#fef3c7] p-4">
                  <div className="text-[12px] font-bold text-[#b45309] mb-3">Extend / Activate Trial</div>
                  <div className="flex gap-2 items-center">
                    <select value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))}
                      className="flex-1 rounded-lg bg-white border border-[#fde68a] px-3 py-2 text-[12px] text-[#92400e]">
                      <option value={7}>+7 days</option>
                      <option value={14}>+14 days</option>
                      <option value={30}>+30 days</option>
                      <option value={60}>+60 days</option>
                      <option value={90}>+90 days</option>
                    </select>
                    <button type="button" disabled={saving} onClick={extendTrial}
                      className="px-4 py-2 rounded-lg bg-[#f59e0b] text-white text-[12px] font-bold hover:bg-[#d97706] transition-colors disabled:opacity-60">
                      Extend
                    </button>
                    <button type="button" disabled={saving} onClick={activate}
                      className="px-4 py-2 rounded-lg bg-[#0d9488] text-white text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60">
                      Activate
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                  <div className="text-[12px] font-bold text-red-700">Danger Zone</div>
                  <p className="text-[11px] text-red-600">Suspending blocks all access. Data is preserved and can be restored.</p>
                  <button type="button" disabled={saving} onClick={() => setShowSuspendConfirm(true)}
                    className="w-full px-4 py-2 rounded-lg bg-red-600 text-white text-[12px] font-bold hover:bg-red-700 transition-colors disabled:opacity-60">
                    Suspend School
                  </button>
                  <p className="text-[11px] text-red-600 pt-1">Permanent delete removes ALL data — students, fees, grades, staff. Cannot be undone.</p>
                  <button type="button" disabled={saving} onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-2 rounded-lg bg-red-900 text-white text-[12px] font-bold hover:bg-red-800 transition-colors disabled:opacity-60">
                    Delete School Permanently
                  </button>
                </div>
              </>
            )}

            {/* ── Customize section ── */}
            {activeSection === "customize" && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-[var(--primary-soft,#e0f2f1)] border border-[var(--primary)]/20">
                  <p className="text-[11px] text-[var(--t2)] leading-relaxed">
                    Customization fields appear on <strong>Report Cards</strong> and <strong>Student ID Cards</strong> for this school. These override the defaults.
                  </p>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-3">School Identity</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">Physical Address</label>
                      <input className={ic} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="P.O. Box 123, Kampala, Uganda" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">School Motto</label>
                      <input className={ic} value={motto} onChange={(e) => setMotto(e.target.value)} placeholder="e.g. Excellence Through Integrity" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">Head Teacher / Principal Name</label>
                      <input className={ic} value={principalName} onChange={(e) => setPrincipalName(e.target.value)} placeholder="e.g. Mr. John Okello" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-3">Report Card Layout</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                        Report Header Text
                        <span className="ml-1 normal-case text-[var(--t4)]">(appears at top of report card)</span>
                      </label>
                      <textarea className={`${ic} resize-none`} rows={3} value={reportHeader}
                        onChange={(e) => setReportHeader(e.target.value)}
                        placeholder="e.g. ST. MARY'S PRIMARY SCHOOL\nP.O. Box 1234, Kampala\nTel: +256 700 000 000" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                        Report Footer Text
                        <span className="ml-1 normal-case text-[var(--t4)]">(appears at bottom of report card)</span>
                      </label>
                      <textarea className={`${ic} resize-none`} rows={2} value={reportFooter}
                        onChange={(e) => setReportFooter(e.target.value)}
                        placeholder="e.g. This report was generated by SkoolMate. Powered by Omuto Foundation." />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-3">ID Card Style</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "standard",  label: "Standard",  desc: "Classic layout" },
                      { value: "modern",    label: "Modern",    desc: "Photo-forward" },
                      { value: "minimal",   label: "Minimal",   desc: "Clean & simple" },
                    ].map((style) => (
                      <button key={style.value} type="button" onClick={() => setIdCardStyle(style.value)}
                        className="rounded-xl border-2 px-3 py-3 text-center transition-all"
                        style={{ borderColor: idCardStyle === style.value ? "var(--primary)" : "var(--border)", background: idCardStyle === style.value ? "var(--primary-soft,#e0f2f1)" : "var(--bg)" }}>
                        <div className="text-[12px] font-bold mb-1" style={{ color: idCardStyle === style.value ? "var(--primary)" : "var(--t1)" }}>{style.label}</div>
                        <div className="text-[10px]" style={{ color: "var(--t3)" }}>{style.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview strip */}
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="px-3 py-2 bg-[var(--bg)] text-[10px] font-bold text-[var(--t3)] uppercase tracking-wide border-b border-[var(--border)]">
                    Preview — Report Card Header
                  </div>
                  <div className="p-4 text-center" style={{ borderTop: `3px solid ${color}` }}>
                    <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold overflow-hidden" style={{ background: color }}>
                      {school.logo_url ? <img src={school.logo_url} alt="" className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-[13px] font-bold text-[var(--t1)] whitespace-pre-line">{reportHeader || name}</div>
                    {motto && <div className="text-[10px] text-[var(--t3)] italic mt-1">"{motto}"</div>}
                    {address && <div className="text-[10px] text-[var(--t4)] mt-0.5">{address}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 pb-5 pt-3 border-t border-[var(--border)]">
            <button type="button" disabled={saving} onClick={save}
              className="w-full rounded-xl bg-[var(--primary)] text-white font-bold text-[13px] py-3 hover:opacity-90 transition-opacity disabled:opacity-60">
              {saving ? "Saving…" : "Save All Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Register School Form ─────────────────────────────────────────────────────

function RegisterSchoolForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", school_code: "", district: "",
    school_type: "primary" as "primary" | "secondary" | "combined",
    ownership: "private" as "private" | "government" | "government_aided",
    phone: "", email: "", primary_color: "#001F3F",
    subscription_plan: "starter" as SubscriptionPlan,
    feature_stage: "full" as FeatureStage,
    trial_days: "30",
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.district.trim() || !form.school_code.trim()) {
      toast.error("Name, code, and district are required");
      return;
    }
    setSaving(true);
    try {
      await adminAction("create_school", {
        name:              form.name.trim(),
        school_code:       form.school_code.trim().toUpperCase(),
        district:          form.district.trim(),
        school_type:       form.school_type,
        ownership:         form.ownership,
        phone:             form.phone.trim() || null,
        email:             form.email.trim() || null,
        primary_color:     form.primary_color,
        subscription_plan: form.subscription_plan,
        feature_stage:     form.feature_stage,
        trial_days:        Number(form.trial_days) || 30,
      });
      toast.success(`School "${form.name}" registered successfully`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Failed to register school");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "School Name", name: "name",        required: true,  placeholder: "e.g. St. Mary's Primary" },
          { label: "School Code", name: "school_code", required: true,  placeholder: "e.g. SMC001"              },
          { label: "District",    name: "district",    required: true,  placeholder: "e.g. Kampala"             },
          { label: "Phone",       name: "phone",       tp: "tel",       placeholder: "+256 700 000 000"         },
          { label: "Email",       name: "email",       tp: "email",     placeholder: "admin@school.ug"          },
        ].map((f) => (
          <div key={f.name}>
            <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
              {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
              type={(f as any).tp || "text"}
              value={(form as any)[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              required={f.required}
              className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">School Type <span className="text-red-500">*</span></label>
          <select value={form.school_type} onChange={(e) => set("school_type", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]">
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="combined">Combined</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">Ownership <span className="text-red-500">*</span></label>
          <select value={form.ownership} onChange={(e) => set("ownership", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]">
            <option value="private">Private</option>
            <option value="government">Government</option>
            <option value="government_aided">Government Aided</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">Subscription Plan</label>
          <select value={form.subscription_plan} onChange={(e) => set("subscription_plan", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]">
            <option value="starter">Starter \u2014 UGX 2,000/student/term</option>
            <option value="growth">Growth \u2014 UGX 3,500/student/term</option>
            <option value="enterprise">Enterprise \u2014 UGX 5,000/student/term</option>
            <option value="lifetime">Lifetime License</option>
            <option value="free_trial">Free Trial</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">Feature Access</label>
          <select value={form.feature_stage} onChange={(e) => set("feature_stage", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]">
            <option value="core">Core Only</option>
            <option value="academic">Academic</option>
            <option value="finance">Finance</option>
            <option value="full">Full Access</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">Trial Duration (days)</label>
          <input type="number" min={1} max={365} value={form.trial_days} onChange={(e) => set("trial_days", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]" />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">School Brand Colour</label>
        <div className="flex items-center gap-3">
          <input type="color" value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)}
            className="w-10 h-10 rounded-lg border border-[var(--border)] cursor-pointer" />
          <span className="text-[12px] text-[var(--t3)] font-mono">{form.primary_color}</span>
        </div>
      </div>
      <div className="pt-2">
        <button type="submit" disabled={saving}
          className="w-full rounded-xl bg-[var(--primary)] text-white font-bold text-[13px] py-3 hover:opacity-90 transition-opacity disabled:opacity-60">
          {saving ? "Registering school\u2026" : "Register School"}
        </button>
      </div>
    </form>
  );
}

// ─── User Row Actions ─────────────────────────────────────────────────────────

function UserActions({ user: u, onUpdated, onDeleted }: {
  user: UserRow;
  onUpdated: (patch: Partial<UserRow> & { id: string }) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState<{ open: boolean; type: "deactivate" | "delete" | null }>({ open: false, type: null });

  const doUpdate = async (fields: Record<string, unknown>, msg: string) => {
    setBusy(true);
    try {
      await adminAction("update_user", { id: u.id, fields });
      onUpdated({ id: u.id, ...fields } as Partial<UserRow> & { id: string });
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message || "Operation failed");
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await adminAction("delete_user", { id: u.id });
      onDeleted(u.id);
      toast.success(`${u.full_name} deleted permanently`);
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally { setBusy(false); setConfirm({ open: false, type: null }); }
  };

  const doResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      await adminAction("reset_user_password", { id: u.id, new_password: newPassword });
      toast.success(`Password reset for ${u.full_name}`);
      setShowResetPwd(false);
      setNewPassword("");
    } catch (e: any) {
      toast.error(e?.message || "Password reset failed");
    } finally { setBusy(false); }
  };

  if (u.role === "super_admin") {
    return <span className="text-[10px] text-[var(--t4)] italic">Protected</span>;
  }

  return (
    <>
      <ConfirmDialog
        open={confirm.open}
        title={confirm.type === "delete" ? `Delete ${u.full_name}?` : `Deactivate ${u.full_name}?`}
        body={confirm.type === "delete"
          ? "This permanently deletes the user and their login. Cannot be undone."
          : "This user will lose the ability to sign in. You can reactivate them later."}
        confirmLabel={confirm.type === "delete" ? "Delete Permanently" : "Deactivate"}
        danger loading={busy}
        onConfirm={() => { if (confirm.type === "delete") doDelete(); else doUpdate({ is_active: false }, `${u.full_name} deactivated`); setConfirm({ open: false, type: null }); }}
        onCancel={() => setConfirm({ open: false, type: null })}
      />

      {/* Password Reset Modal */}
      {showResetPwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowResetPwd(false)} />
          <div className="relative bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-xs p-6">
            <h3 className="font-['Sora'] text-[14px] font-bold text-[var(--t1)] mb-1">Reset Password</h3>
            <p className="text-[12px] text-[var(--t3)] mb-4">{u.full_name}</p>
            <form onSubmit={doResetPassword} className="space-y-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                minLength={8}
                required
                className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--primary)]"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowResetPwd(false)} className="flex-1 py-2 rounded-xl border border-[var(--border)] text-[12px] font-semibold text-[var(--t2)] hover:bg-[var(--bg)]">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2 rounded-xl bg-[var(--primary)] text-white text-[12px] font-semibold disabled:opacity-60">
                  {busy ? "Saving…" : "Set Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 justify-center flex-wrap">
        {u.is_active ? (
          <button type="button" disabled={busy} onClick={() => setConfirm({ open: true, type: "deactivate" })}
            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#fef3c7] text-[#b45309] hover:opacity-80 disabled:opacity-40">
            Deactivate
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => doUpdate({ is_active: true }, `${u.full_name} reactivated`)}
            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#ccfbf1] text-[#0d9488] hover:opacity-80 disabled:opacity-40">
            Reactivate
          </button>
        )}
        <div className="relative">
          <button type="button" disabled={busy} title="Change role" onClick={() => setShowRoleMenu((v) => !v)}
            className="p-1 rounded-lg text-[var(--t3)] hover:bg-[var(--bg)] transition-colors disabled:opacity-40">
            <MaterialIcon icon="manage_accounts" style={{ fontSize: 14 }} />
          </button>
          {showRoleMenu && (
            <div className="absolute right-0 top-7 z-30 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl min-w-[160px] py-1">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--t3)] uppercase tracking-wide border-b border-[var(--border)]">Change Role</div>
              {ALL_ROLES.map((r) => (
                <button key={r} type="button"
                  onClick={() => { setShowRoleMenu(false); doUpdate({ role: r }, `Role changed to ${r.replace(/_/g, " ")}`); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-[var(--bg)] ${u.role === r ? "text-[var(--primary)]" : "text-[var(--t1)]"}`}>
                  {r.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" disabled={busy} title="Reset password" onClick={() => setShowResetPwd(true)}
          className="p-1 rounded-lg text-[var(--t3)] hover:bg-[var(--bg)] transition-colors disabled:opacity-40">
          <MaterialIcon icon="key" style={{ fontSize: 14 }} />
        </button>
        <button type="button" disabled={busy} title="Delete user" onClick={() => setConfirm({ open: true, type: "delete" })}
          className="p-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40">
          <MaterialIcon icon="delete" style={{ fontSize: 14 }} />
        </button>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  };

  const [tab, setTab] = useState<Tab>("overview");
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<PlatformStats>({
    totalSchools: 0, activeSchools: 0, trialSchools: 0, expiredSchools: 0,
    totalStudents: 0, totalUsers: 0, newThisMonth: 0,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [planBreakdown, setPlanBreakdown] = useState<{ plan: string; count: number }[]>([]);
  const [settings, setSettings] = useState({
    demo_mode: false, sms_enabled: true, payment_enabled: true,
    support_email: "support@omuto.org", support_phone: "+256 700 287 030", trial_days: 30,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [confirm, setConfirm] = useState<{
    open: boolean; title: string; body: string; label: string; danger?: boolean; action: () => Promise<void>;
  }>({ open: false, title: "", body: "", label: "", action: async () => {} });
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && user.role !== "super_admin") router.replace("/dashboard");
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("platform_settings");
      if (saved) setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await fetch("/api/super-admin/data");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      if (!body.success) throw new Error(body.error || "Unknown error");

      const schoolList: School[] = body.schools || [];
      const userList: UserRow[] = body.users || [];
      const schoolNameMap: Record<string, string> = {};
      schoolList.forEach((s) => { schoolNameMap[s.id] = s.name; });
      const enrichedUsers = userList.map((u) => ({
        ...u, school_name: u.school_id ? (schoolNameMap[u.school_id] || "Unknown") : "\u2014",
      }));

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const active  = schoolList.filter((s) => s.subscription_status === "active").length;
      const trial   = schoolList.filter((s) => s.subscription_status === "trial").length;
      const expired = schoolList.filter((s) => ["expired","canceled","suspended","past_due","unpaid"].includes(s.subscription_status)).length;
      const newMonth = schoolList.filter((s) => new Date(s.created_at) >= monthStart).length;
      const totalStudents = schoolList.reduce((sum, s) => sum + (Number(s.student_count) || 0), 0);

      const planMap: Record<string, number> = {};
      schoolList.forEach((s) => { const p = s.subscription_plan || "free_trial"; planMap[p] = (planMap[p] || 0) + 1; });
      setPlanBreakdown(Object.entries(planMap).map(([plan, count]) => ({ plan, count })));
      setSchools(schoolList);
      setUsers(enrichedUsers);
      setStats({ totalSchools: schoolList.length, activeSchools: active, trialSchools: trial, expiredSchools: expired, totalStudents, totalUsers: userList.length, newThisMonth: newMonth });
    } catch (e: any) {
      toast.error("Failed to load data. Check your connection.");
      console.error("[SuperAdmin] loadData error:", e);
    } finally {
      setDataLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (user?.role === "super_admin") loadData(); }, [user, loadData]);

  const filteredSchools = schools.filter((s) => {
    const q = schoolSearch.toLowerCase();
    const matchSearch = !schoolSearch || s.name.toLowerCase().includes(q) || s.district.toLowerCase().includes(q) || (s.school_code || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || s.subscription_status === statusFilter;
    const matchPlan   = planFilter   === "all" || s.subscription_plan   === planFilter;
    return matchSearch && matchStatus && matchPlan;
  });

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q) || u.school_name?.toLowerCase().includes(q);
  });

  const doConfirm = (title: string, body: string, label: string, action: () => Promise<void>, danger = false) =>
    setConfirm({ open: true, title, body, label, action, danger });

  const runConfirm = async () => {
    setConfirmLoading(true);
    try { await confirm.action(); setConfirm((c) => ({ ...c, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const suspendSchool = (s: School) => doConfirm(
    `Suspend ${s.name}?`,
    "The school will lose access until reactivated. All data is preserved.",
    "Suspend School",
    async () => {
      await adminAction("update_school", { id: s.id, fields: { subscription_status: "suspended" } });
      setSchools((prev) => prev.map((x) => x.id === s.id ? { ...x, subscription_status: "suspended" as SubscriptionStatus } : x));
      toast.success(`${s.name} suspended`);
    }, true,
  );

  const reactivateSchool = async (s: School) => {
    try {
      await adminAction("update_school", { id: s.id, fields: { subscription_status: "active" } });
      setSchools((prev) => prev.map((x) => x.id === s.id ? { ...x, subscription_status: "active" as SubscriptionStatus } : x));
      toast.success("School reactivated");
    } catch (e: any) { toast.error(e?.message || "Failed to reactivate"); }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      localStorage.setItem("platform_settings", JSON.stringify(settings));
      toast.success("Platform settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-[3px] border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user?.role !== "super_admin") return null;

  const alerts: { color: string; icon: string; title: string; sub: string }[] = [];
  schools.forEach((s) => {
    if (s.subscription_status === "trial" && s.trial_ends_at) {
      const daysLeft = Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / 86400000);
      if (daysLeft <= 5 && daysLeft >= 0) alerts.push({ color: "#b45309", icon: "schedule", title: s.name, sub: `Trial expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}` });
    }
    if (s.subscription_status === "expired") alerts.push({ color: "#dc2626", icon: "error", title: s.name, sub: "Subscription expired" });
    if (s.subscription_status === "suspended") alerts.push({ color: "#b45309", icon: "block", title: s.name, sub: "Account suspended" });
  });

  const maxPlan = Math.max(...planBreakdown.map((p) => p.count), 1);
  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.full_name?.trim().split(" ")[0] || "Admin";

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "overview",  label: "Overview",                        icon: "dashboard"       },
    { id: "schools",   label: `Schools (${stats.totalSchools})`, icon: "school"          },
    { id: "users",     label: `Users (${stats.totalUsers})`,     icon: "manage_accounts" },
    { id: "register",  label: "Register School",                 icon: "add_business"    },
    { id: "settings",  label: "Settings",                        icon: "tune"            },
  ];

  return (
    <PageErrorBoundary>
      <ConfirmDialog
        open={confirm.open} title={confirm.title} body={confirm.body}
        confirmLabel={confirm.label} danger={confirm.danger} loading={confirmLoading}
        onConfirm={runConfirm} onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />

      {selectedSchool && (
        <SchoolDetailSheet
          school={selectedSchool}
          onClose={() => setSelectedSchool(null)}
          onUpdated={(updated) => { setSchools((prev) => prev.map((s) => s.id === updated.id ? updated : s)); setSelectedSchool(null); }}
          onDeleted={(id) => { setSchools((prev) => prev.filter((s) => s.id !== id)); setSelectedSchool(null); }}
        />
      )}

      <div className="min-h-screen bg-[var(--bg)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md border border-[var(--border)]" style={{ background: "var(--navy)" }}>
              <MaterialIcon icon="shield" style={{ fontSize: 28, color: "white" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-['Sora'] text-xl font-bold text-[var(--t1)] leading-tight">{greeting}, {firstName}</h1>
              <p className="text-[12px] text-[var(--t3)] mt-0.5">
                SkoolMate OS \u00b7 Super Admin \u00b7 {new Date().toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <button onClick={loadData} disabled={dataLoading} title="Refresh data"
              className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] text-[var(--t3)] transition-colors disabled:opacity-40">
              <MaterialIcon icon="refresh" style={{ fontSize: 18 }} className={dataLoading ? "animate-spin" : ""} />
            </button>
            <button onClick={handleSignOut} title="Sign out"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-red-50 hover:border-red-200 text-[var(--t2)] hover:text-red-600 text-[12px] font-semibold transition-colors">
              <MaterialIcon icon="logout" style={{ fontSize: 16 }} />
              Sign Out
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-[var(--primary)] text-white shadow-sm" : "bg-[var(--surface)] border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--bg)]"}`}>
                <MaterialIcon icon={t.icon} style={{ fontSize: 15 }} />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Schools"  value={dataLoading ? "\u2026" : stats.totalSchools} sub={`${stats.activeSchools} active \u00b7 ${stats.trialSchools} trial`} icon="school" color="var(--navy)" />
                <StatCard label="Total Students" value={dataLoading ? "\u2026" : stats.totalStudents.toLocaleString()} sub="Across all schools" icon="groups" color="#0d9488" />
                <StatCard label="System Users"   value={dataLoading ? "\u2026" : stats.totalUsers.toLocaleString()} sub="Staff + admin accounts" icon="manage_accounts" color="#7c3aed" />
                <StatCard label="New This Month" value={dataLoading ? "\u2026" : stats.newThisMonth} sub="School registrations" icon="add_business" color="#f59e0b" />
              </div>

              {alerts.length > 0 && (
                <div className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MaterialIcon icon="warning" style={{ fontSize: 16, color: "#b45309" }} />
                    <span className="text-[12px] font-bold text-[#b45309]">Needs Attention ({alerts.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {alerts.slice(0, 6).map((a, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl bg-white border border-[#fde68a] px-3 py-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}18`, color: a.color }}>
                          <MaterialIcon icon={a.icon} style={{ fontSize: 14 }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-[var(--t1)] truncate">{a.title}</div>
                          <div className="text-[10px] text-[var(--t3)] truncate">{a.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">Recent Schools</div>
                    <button onClick={() => setTab("schools")} className="text-[11px] text-[var(--navy)] font-semibold hover:underline flex items-center gap-1">
                      View all <MaterialIcon icon="arrow_forward" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {dataLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                            <div className="w-8 h-8 rounded-xl bg-[var(--bg)] flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3 w-36 bg-[var(--bg)] rounded" />
                              <div className="h-2.5 w-24 bg-[var(--bg)] rounded" />
                            </div>
                          </div>
                        ))
                      : schools.slice(0, 8).map((s) => (
                          <button key={s.id} type="button" onClick={() => setSelectedSchool(s)}
                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg)] transition-colors text-left group">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold overflow-hidden" style={{ background: s.primary_color || "var(--navy)" }}>
                              {s.logo_url ? <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" /> : s.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-semibold text-[var(--t1)] truncate group-hover:text-[var(--navy)]">{s.name}</div>
                              <div className="text-[10px] text-[var(--t3)]">{s.district} \u00b7 {s.school_type}{s.student_count ? ` \u00b7 ${s.student_count.toLocaleString()} students` : ""}</div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Badge status={s.subscription_status} />
                              <PlanBadge plan={s.subscription_plan} />
                            </div>
                            <div className="text-[10px] text-[var(--t4)] flex-shrink-0 ml-1">{timeSince(s.created_at)}</div>
                          </button>
                        ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-4">Subscription Mix</div>
                    {!dataLoading && planBreakdown.length === 0 && <p className="text-[12px] text-[var(--t3)]">No data yet</p>}
                    <div className="space-y-3">
                      {planBreakdown.map(({ plan, count }) => (
                        <div key={plan}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold" style={{ color: PLAN_COLORS[plan] || "#64748b" }}>{PLAN_LABELS[plan] || plan}</span>
                            <span className="text-[12px] font-bold text-[var(--t1)]">{count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round((count / maxPlan) * 100)}%`, background: PLAN_COLORS[plan] || "#64748b" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-3">School Status</div>
                    <div className="space-y-2">
                      {[
                        { label: "Active",            value: stats.activeSchools,  color: "#0d9488", bg: "#ccfbf1", icon: "check_circle" },
                        { label: "On Trial",          value: stats.trialSchools,   color: "#1d4ed8", bg: "#dbeafe", icon: "schedule"     },
                        { label: "Expired/Suspended", value: stats.expiredSchools, color: "#dc2626", bg: "#fee2e2", icon: "error"        },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: item.bg }}>
                          <MaterialIcon icon={item.icon} style={{ fontSize: 15, color: item.color }} />
                          <span className="text-[12px] font-semibold flex-1" style={{ color: item.color }}>{item.label}</span>
                          <span className="text-[15px] font-extrabold font-['Sora']" style={{ color: item.color }}>{dataLoading ? "\u2026" : item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[12px] font-bold text-[var(--t1)] mb-3 uppercase tracking-wide">Quick Actions</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[
                    { label: "Manage Schools",   desc: "View, edit, suspend",         icon: "domain",          color: "var(--navy)", action: () => setTab("schools")  },
                    { label: "Manage Users",      desc: "All staff & admin accounts",  icon: "manage_accounts", color: "#7c3aed",      action: () => setTab("users")    },
                    { label: "Register School",   desc: "Create & provision a school", icon: "add_business",    color: "#16a34a",      action: () => setTab("register") },
                    { label: "Platform Settings", desc: "Global config & flags",       icon: "tune",            color: "#0284c7",      action: () => setTab("settings") },
                  ].map((a) => (
                    <button key={a.label} type="button" onClick={a.action}
                      className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex gap-3 items-start transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] text-left">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}18`, color: a.color }}>
                        <MaterialIcon icon={a.icon} style={{ fontSize: 20 }} />
                      </div>
                      <div>
                        <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">{a.label}</div>
                        <div className="text-[11px] text-[var(--t3)] mt-0.5">{a.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[12px] text-[var(--t3)]">
                <MaterialIcon icon="verified_user" style={{ fontSize: 15, color: "var(--green)" }} />
                Logged in as <strong className="text-[var(--t1)]">{user.full_name}</strong> \u00b7 Super Admin \u00b7 Full platform access
              </div>
            </div>
          )}

          {tab === "schools" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <MaterialIcon icon="search" style={{ fontSize: 16, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }} />
                  <input type="text" placeholder="Search by name, district, code\u2026" value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)}
                    className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] pl-9 pr-4 py-2.5 text-[13px] outline-none focus:border-[var(--primary)] transition-colors" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[12px] text-[var(--t2)] outline-none focus:border-[var(--primary)]">
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                  <option value="past_due">Past Due</option>
                  <option value="canceled">Canceled</option>
                </select>
                <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
                  className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[12px] text-[var(--t2)] outline-none focus:border-[var(--primary)]">
                  <option value="all">All Plans</option>
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="lifetime">Lifetime</option>
                  <option value="free_trial">Free Trial</option>
                </select>
                <div className="text-[12px] text-[var(--t3)] flex items-center px-2">{filteredSchools.length} of {schools.length}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {dataLoading ? (
                  <div className="py-16 flex justify-center"><div className="w-7 h-7 border-[3px] border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
                ) : filteredSchools.length === 0 ? (
                  <div className="py-16 text-center text-[13px] text-[var(--t3)]">No schools match your filters</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                          {["School", "District", "Plan", "Status", "Students", "Joined", "Actions"].map((h) => (
                            <th key={h} className={`px-4 py-3 text-[10px] font-bold text-[var(--t3)] uppercase tracking-wide ${h === "Students" ? "text-right" : h === "Actions" ? "text-center" : "text-left"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {filteredSchools.map((s) => (
                          <tr key={s.id} className="hover:bg-[var(--bg)] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden" style={{ background: s.primary_color || "var(--navy)" }}>
                                  {s.logo_url ? <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" /> : s.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[12px] font-semibold text-[var(--t1)] truncate max-w-[160px]">{s.name}</div>
                                  <div className="text-[10px] text-[var(--t3)]">{s.school_code} \u00b7 {s.school_type}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[12px] text-[var(--t2)]">{s.district}</td>
                            <td className="px-4 py-3"><PlanBadge plan={s.subscription_plan} /></td>
                            <td className="px-4 py-3"><Badge status={s.subscription_status} /></td>
                            <td className="px-4 py-3 text-right text-[12px] font-semibold text-[var(--t1)]">{s.student_count?.toLocaleString() ?? "\u2014"}</td>
                            <td className="px-4 py-3 text-[11px] text-[var(--t3)]">{fmtDate(s.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button type="button" title="Edit / Manage" onClick={() => setSelectedSchool(s)}
                                  className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--t2)] transition-colors">
                                  <MaterialIcon icon="edit" style={{ fontSize: 15 }} />
                                </button>
                                {s.subscription_status !== "suspended" ? (
                                  <button type="button" title="Suspend" onClick={() => suspendSchool(s)}
                                    className="p-1.5 rounded-lg hover:bg-[#fee2e2] text-[#dc2626] transition-colors">
                                    <MaterialIcon icon="block" style={{ fontSize: 15 }} />
                                  </button>
                                ) : (
                                  <button type="button" title="Reactivate" onClick={() => reactivateSchool(s)}
                                    className="p-1.5 rounded-lg hover:bg-[#ccfbf1] text-[#0d9488] transition-colors">
                                    <MaterialIcon icon="check_circle" style={{ fontSize: 15 }} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <MaterialIcon icon="search" style={{ fontSize: 16, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }} />
                  <input type="text" placeholder="Search by name, phone, role, school\u2026" value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] pl-9 pr-4 py-2.5 text-[13px] outline-none focus:border-[var(--primary)] transition-colors" />
                </div>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[12px] text-[var(--t2)] outline-none focus:border-[var(--primary)]">
                  <option value="all">All Roles</option>
                  {["super_admin","school_admin","headmaster","bursar","teacher","dean_of_studies","secretary","dorm_master","parent","student"].map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <div className="text-[12px] text-[var(--t3)] flex items-center px-2">{filteredUsers.length} of {users.length}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {dataLoading ? (
                  <div className="py-16 flex justify-center"><div className="w-7 h-7 border-[3px] border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-16 text-center text-[13px] text-[var(--t3)]">No users found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                          {["User", "Role", "School", "Joined", "Status", "Actions"].map((h) => (
                            <th key={h} className={`px-4 py-3 text-[10px] font-bold text-[var(--t3)] uppercase tracking-wide ${h === "Status" || h === "Actions" ? "text-center" : "text-left"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {filteredUsers.map((u) => {
                          const rc = ROLE_COLORS[u.role] || "#64748b";
                          return (
                            <tr key={u.id} className={`transition-colors hover:bg-[var(--bg)] ${!u.is_active ? "opacity-50" : ""}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold" style={{ background: rc }}>
                                    {u.full_name?.slice(0, 1).toUpperCase() || "?"}
                                  </div>
                                  <div>
                                    <div className="text-[12px] font-semibold text-[var(--t1)]">{u.full_name || "\u2014"}</div>
                                    <div className="text-[10px] text-[var(--t3)]">{u.phone}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: `${rc}18`, color: rc }}>
                                  {u.role.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[12px] text-[var(--t2)] max-w-[160px] truncate">{u.school_name || "\u2014"}</td>
                              <td className="px-4 py-3 text-[11px] text-[var(--t3)]">{fmtDate(u.created_at)}</td>
                              <td className="px-4 py-3 text-center">
                                {u.is_active
                                  ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ccfbf1] text-[#0d9488]">Active</span>
                                  : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f1f5f9] text-[#64748b]">Inactive</span>}
                              </td>
                              <td className="px-4 py-3">
                                <UserActions
                                  user={u}
                                  onUpdated={(patch) => setUsers((prev) => prev.map((x) => x.id === patch.id ? { ...x, ...patch } : x))}
                                  onDeleted={(id) => setUsers((prev) => prev.filter((x) => x.id !== id))}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "register" && (
            <div className="space-y-5">
              <div>
                <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">Register New School</h2>
                <p className="text-[12px] text-[var(--t3)] mt-0.5">The school will be created on trial by default. Adjust plan and duration below.</p>
              </div>
              <RegisterSchoolForm onDone={() => { loadData(); setTab("schools"); }} />
            </div>
          )}

          {tab === "settings" && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">Platform Settings</h2>
                <p className="text-[12px] text-[var(--t3)] mt-0.5">Global configuration for the SkoolMate platform.</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {[
                  { key: "demo_mode"       as const, label: "Demo Mode",             desc: "Allow demo accounts for sales demos",     icon: "science",  color: "#7c3aed" },
                  { key: "sms_enabled"     as const, label: "Bulk SMS Gateway",      desc: "Enable platform-wide SMS functionality",  icon: "sms",      color: "#0284c7" },
                  { key: "payment_enabled" as const, label: "Mobile Money Payments", desc: "Enable fee collection via MoMo / Airtel", icon: "payments", color: "#0d9488" },
                ].map((item, idx, arr) => (
                  <div key={item.key} className={`flex items-center gap-4 px-5 py-4 ${idx < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}18`, color: item.color }}>
                      <MaterialIcon icon={item.icon} style={{ fontSize: 18 }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[var(--t1)]">{item.label}</div>
                      <div className="text-[11px] text-[var(--t3)]">{item.desc}</div>
                    </div>
                    <Toggle value={settings[item.key]} onChange={(v) => setSettings((s) => ({ ...s, [item.key]: v }))} />
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
                <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-1">Support Contact</div>
                {[
                  { label: "Support Email", key: "support_email" as const, type: "email", placeholder: "support@omuto.org" },
                  { label: "Support Phone", key: "support_phone" as const, type: "tel",   placeholder: "+256 700 287 030" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">{f.label}</label>
                    <input type={f.type} value={settings[f.key]} onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))} placeholder={f.placeholder}
                      className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors" />
                  </div>
                ))}
                <div>
                  <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">Default Trial Duration (days)</label>
                  <input type="number" min={1} max={365} value={settings.trial_days} onChange={(e) => setSettings((s) => ({ ...s, trial_days: Number(e.target.value) }))}
                    className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors" />
                </div>
              </div>
              <button type="button" onClick={saveSettings} disabled={settingsSaving}
                className="w-full rounded-xl bg-[var(--primary)] text-white font-bold text-[13px] py-3 hover:opacity-90 transition-opacity disabled:opacity-60">
                {settingsSaving ? "Saving\u2026" : "Save Platform Settings"}
              </button>
            </div>
          )}

        </div>
      </div>
    </PageErrorBoundary>
  );
}
