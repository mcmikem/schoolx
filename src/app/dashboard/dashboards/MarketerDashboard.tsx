"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/app-name";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchoolRow {
  id: string;
  name: string;
  school_code: string;
  district: string;
  school_type: string;
  subscription_plan: string;
  subscription_status: string;
  student_count: number;
  created_at: string;
  trial_ends_at?: string;
}

interface EarningsRow {
  id: string;
  marketer_id: string;
  school_id: string | null;
  earning_type: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  schools?: { name: string; school_code: string } | null;
}

interface PayoutRow {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

interface DashboardData {
  schools: SchoolRow[];
  earnings: EarningsRow[];
  payouts: PayoutRow[];
  summary: { totalEarned: number; pendingEarnings: number; totalPaid: number; mySchools: number; balance: number };
}

interface LeadRow {
  id: string;
  school_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  district: string | null;
  status: string;
  notes: string | null;
  next_follow_up: string | null;
  created_at: string;
}

interface ReferralRow {
  id: string;
  code: string;
  label: string | null;
  clicks: number;
  conversions: number;
  is_active: boolean;
  created_at: string;
}

interface OutreachRow {
  id: string;
  type: string;
  recipient_name: string | null;
  recipient_contact: string | null;
  subject: string | null;
  content: string | null;
  status: string;
  sent_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "register", label: "Register", icon: "add_business" },
  { id: "leads", label: "Leads", icon: "group" },
  { id: "outreach", label: "Outreach", icon: "campaign" },
  { id: "resources", label: "Resources", icon: "library_books" },
  { id: "referrals", label: "Referrals", icon: "share" },
  { id: "earnings", label: "Earnings", icon: "account_balance" },
  { id: "settings", label: "Settings", icon: "settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const LEAD_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: "#dbeafe", text: "#1d4ed8", label: "New" },
  contacted: { bg: "#fef3c7", text: "#b45309", label: "Contacted" },
  interested: { bg: "#ccfbf1", text: "#0d9488", label: "Interested" },
  not_interested: { bg: "#fee2e2", text: "#dc2626", label: "Not Interested" },
  converted: { bg: "#d1fae5", text: "#059669", label: "Converted" },
  lost: { bg: "#f1f5f9", text: "#64748b", label: "Lost" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#ccfbf1", text: "#0d9488", label: "Active" },
  trial: { bg: "#dbeafe", text: "#1d4ed8", label: "Trial" },
  expired: { bg: "#fee2e2", text: "#dc2626", label: "Expired" },
  past_due: { bg: "#fef3c7", text: "#b45309", label: "Past Due" },
  suspended: { bg: "#fee2e2", text: "#dc2626", label: "Suspended" },
  canceled: { bg: "#f1f5f9", text: "#64748b", label: "Canceled" },
  unpaid: { bg: "#fef3c7", text: "#b45309", label: "Unpaid" },
  free_trial: { bg: "#dbeafe", text: "#1d4ed8", label: "Free Trial" },
};

const EARNING_TYPE_LABELS: Record<string, string> = {
  onboarding_bonus: "Onboarding Bonus",
  subscription_commission: "Subscription Commission",
  performance_bonus: "Performance Bonus",
  adjustment: "Adjustment",
};

const EARNING_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#b45309" },
  approved: { bg: "#dbeafe", text: "#1d4ed8" },
  paid: { bg: "#ccfbf1", text: "#0d9488" },
  cancelled: { bg: "#fee2e2", text: "#dc2626" },
};

const RESOURCES = [
  { title: "Pricing & Plans", desc: "View all subscription plans and pricing", icon: "sell", href: "/pricing" },
  { title: "Feature Overview", desc: "Complete feature breakdown by plan", icon: "checklist", href: "/features" },
  {
    title: "Demo Video",
    desc: "Watch a full product demo walkthrough",
    icon: "play_circle",
    href: "https://www.youtube.com/@SkoolMate",
  },
  {
    title: "Brochure",
    desc: "Marketing brochure — view or print as PDF",
    icon: "description",
    href: "/resources/brochure",
  },
  { title: "FAQ", desc: "Frequently asked questions from schools", icon: "help", href: "/faq" },
  {
    title: "Case Studies",
    desc: "Success stories from schools using the platform",
    icon: "stars",
    href: "/case-studies",
  },
  {
    title: "WhatsApp Support",
    desc: "Reach the support team on WhatsApp",
    icon: "chat",
    href: "https://wa.me/256727790003",
  },
  { title: "Compare Plans", desc: "Side-by-side plan comparison", icon: "compare_arrows", href: "/pricing#compare" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
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

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 relative overflow-hidden">
      <div className="flex items-start justify-between mb-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, color }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {icon}
          </span>
        </div>
      </div>
      <div className="text-[22px] font-bold text-[var(--t1)] tracking-tight">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-[11px] font-medium text-[var(--t3)] mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-[var(--t4)] mt-1">{sub}</div>}
    </div>
  );
}

function getFirstName(name?: string | null) {
  return name?.trim().split(" ").filter(Boolean)[0] || "Marketer";
}
function formatCurrency(amount: number) {
  return `UGX ${amount.toLocaleString()}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: string; label: string; icon: string }[];
  active: string;
  onChange: (id: any) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
            active === t.id
              ? "bg-[var(--primary)] text-white shadow-sm"
              : "border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--bg)]"
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [search, setSearch] = useState("");

  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch("/api/marketers/data/");
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || `HTTP ${res.status}`);
      setData(body.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      logger.error("[MarketerDashboard] Failed to load:", msg);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const schools = data?.schools || [];
  const summary = data?.summary || { totalEarned: 0, pendingEarnings: 0, totalPaid: 0, mySchools: 0, balance: 0 };
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const pipelineStats = {
    total: schools.length,
    active: schools.filter((s) => s.subscription_status === "active").length,
    trial: schools.filter((s) => s.subscription_status === "trial").length,
    expired: schools.filter((s) => ["expired", "past_due", "suspended"].includes(s.subscription_status)).length,
    newThisMonth: schools.filter((s) => new Date(s.created_at) >= firstOfMonth).length,
    onboardingIncomplete: schools.filter(
      (s) => s.subscription_status === "trial" && (!s.student_count || s.student_count === 0),
    ).length,
  };

  const filteredSchools = schools.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.district?.toLowerCase().includes(q) ||
      s.school_code?.toLowerCase().includes(q)
    );
  });

  const recentSchools = filteredSchools.slice(0, 10);
  const recentEarnings = (data?.earnings || []).slice(0, 10);
  const recentPayouts = (data?.payouts || []).slice(0, 10);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)" }}
        >
          <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>
            campaign
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-['Sora'] text-xl font-bold text-[var(--t1)] leading-tight">
            {greeting}, {getFirstName(user?.full_name)}
          </h1>
          <p className="text-[12px] text-[var(--t3)] mt-0.5">
            {APP_NAME} · Field Marketing ·{" "}
            {now.toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] text-[var(--t3)] transition-colors disabled:opacity-40"
        >
          <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`} style={{ fontSize: 18 }}>
            refresh
          </span>
        </button>
      </div>

      {/* Tab Bar */}
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Error banner */}
      {fetchError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 flex-shrink-0" style={{ fontSize: 20 }}>
            error
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-red-800">Failed to load data</p>
            <p className="text-[12px] text-red-600 mt-0.5">{fetchError}</p>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-[11px] font-bold hover:bg-red-200 transition-colors flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tab Content */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {activeTab === "overview" && (
            <OverviewTab
              pipelineStats={pipelineStats}
              schools={recentSchools}
              search={search}
              setSearch={setSearch}
              filteredCount={filteredSchools.length}
            />
          )}
          {activeTab === "register" && <RegisterTab />}
          {activeTab === "leads" && <LeadsTab />}
          {activeTab === "outreach" && <OutreachTab />}
          {activeTab === "resources" && <ResourcesTab />}
          {activeTab === "referrals" && <ReferralsTab />}
          {activeTab === "earnings" && (
            <EarningsTab summary={summary} earnings={recentEarnings} payouts={recentPayouts} />
          )}
          {activeTab === "settings" && <SettingsTab />}
        </>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  pipelineStats,
  schools,
  search,
  setSearch,
  filteredCount,
}: {
  pipelineStats: {
    total: number;
    active: number;
    trial: number;
    expired: number;
    newThisMonth: number;
    onboardingIncomplete: number;
  };
  schools: SchoolRow[];
  search: string;
  setSearch: (v: string) => void;
  filteredCount: number;
}) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Schools" value={pipelineStats.total} icon="school" color="#1e3a5f" />
        <StatCard
          label="Active"
          value={pipelineStats.active}
          icon="check_circle"
          color="#0d9488"
          sub={`${pipelineStats.total ? Math.round((pipelineStats.active / pipelineStats.total) * 100) : 0}% conversion`}
        />
        <StatCard label="On Trial" value={pipelineStats.trial} icon="science" color="#3b82f6" />
        <StatCard label="Expired / At Risk" value={pipelineStats.expired} icon="warning" color="#dc2626" />
        <StatCard
          label="New This Month"
          value={pipelineStats.newThisMonth}
          icon="trending_up"
          color="#7c3aed"
          sub={`${pipelineStats.onboardingIncomplete} need onboarding`}
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
          <h2 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">All Schools</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search schools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[12px] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
            <span className="text-[11px] text-[var(--t4)]">{filteredCount} schools</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">School</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">District</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Plan</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Students</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Created</th>
              </tr>
            </thead>
            <tbody>
              {schools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[var(--t4)]">
                    {search ? "No matches" : "No schools found"}
                  </td>
                </tr>
              ) : (
                schools.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[var(--t1)]">{s.name}</div>
                      <div className="text-[10px] text-[var(--t4)]">{s.school_code}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--t2)]">{s.district || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-semibold capitalize text-[var(--t2)]">
                        {s.subscription_plan?.replace(/_/g, " ") || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={s.subscription_status} />
                    </td>
                    <td className="px-4 py-2.5 text-[var(--t2)]">{s.student_count ?? 0}</td>
                    <td className="px-4 py-2.5 text-[var(--t3)]">{formatDate(s.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Register Tab ─────────────────────────────────────────────────────────────

function RegisterTab() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    schoolName: "",
    district: "",
    subcounty: "",
    parish: "",
    village: "",
    schoolType: "primary" as "primary" | "secondary" | "combined",
    ownership: "private" as "private" | "government" | "government_aided",
    selectedPackage: "starter",
    adminName: "",
    adminPhone: "",
    password: "",
    phone: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; schoolCode?: string } | null>(null);

  const handleChange = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/marketers/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setResult({ success: true, message: "School registered successfully!", schoolCode: body.data?.schoolCode });
        setForm({
          schoolName: "",
          district: "",
          subcounty: "",
          parish: "",
          village: "",
          schoolType: "primary",
          ownership: "private",
          selectedPackage: "starter",
          adminName: "",
          adminPhone: "",
          password: "",
          phone: "",
          email: "",
        });
      } else {
        setResult({ success: false, message: body.error || "Registration failed" });
      }
    } catch {
      setResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 max-w-2xl">
      <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)] mb-1">Register a New School</h2>
      <p className="text-[12px] text-[var(--t3)] mb-6">
        Fill in the school details and admin account. The school admin will receive login credentials.
      </p>

      {result && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-[12px] font-medium ${result.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
        >
          {result.message}
          {result.schoolCode && <div className="mt-1 font-bold">School Code: {result.schoolCode}</div>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--t1)] mb-3">School Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">School Name *</label>
              <input
                value={form.schoolName}
                onChange={(e) => handleChange("schoolName", e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">District *</label>
              <input
                value={form.district}
                onChange={(e) => handleChange("district", e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Subcounty *</label>
              <input
                value={form.subcounty}
                onChange={(e) => handleChange("subcounty", e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Parish</label>
              <input
                value={form.parish}
                onChange={(e) => handleChange("parish", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Village</label>
              <input
                value={form.village}
                onChange={(e) => handleChange("village", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">School Type</label>
              <select
                value={form.schoolType}
                onChange={(e) => handleChange("schoolType", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="combined">Combined</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Ownership</label>
              <select
                value={form.ownership}
                onChange={(e) => handleChange("ownership", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              >
                <option value="private">Private</option>
                <option value="government">Government</option>
                <option value="government_aided">Government Aided</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Subscription Plan</label>
              <select
                value={form.selectedPackage}
                onChange={(e) => handleChange("selectedPackage", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              >
                <option value="starter">Starter (UGX 2,000/student/term)</option>
                <option value="growth">Growth (UGX 3,500/student/term)</option>
                <option value="enterprise">Enterprise (UGX 5,500/student/term)</option>
                <option value="free_trial">Free Trial</option>
              </select>
            </div>
          </div>
        </div>

        <hr className="border-[var(--border)]" />

        <div>
          <h3 className="text-[13px] font-bold text-[var(--t1)] mb-3">School Contact (Optional)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">School Phone</label>
              <input
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="0700000000"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">School Email</label>
              <input
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="school@example.com"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
          </div>
        </div>

        <hr className="border-[var(--border)]" />

        <div>
          <h3 className="text-[13px] font-bold text-[var(--t1)] mb-3">Admin Account</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Admin Name *</label>
              <input
                value={form.adminName}
                onChange={(e) => handleChange("adminName", e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Admin Phone *</label>
              <input
                value={form.adminPhone}
                onChange={(e) => handleChange("adminPhone", e.target.value)}
                required
                placeholder="0700000000"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">
                Password * (min 8 chars, 1 uppercase, 1 number)
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white font-bold text-[13px] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Registering..." : "Register School"}
        </button>
      </form>
    </div>
  );
}

// ─── Leads Tab ────────────────────────────────────────────────────────────────

function LeadsTab() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [leadForm, setLeadForm] = useState({
    school_name: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    district: "",
    notes: "",
  });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketers/leads/");
      const body = await res.json();
      if (body.success) setLeads(body.data?.leads || []);
      else setError(body.error || "Failed to load");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/marketers/leads/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadForm),
      });
      const body = await res.json();
      if (body.success) {
        setLeadForm({
          school_name: "",
          contact_name: "",
          contact_phone: "",
          contact_email: "",
          district: "",
          notes: "",
        });
        setShowForm(false);
        fetchLeads();
      } else setError(body.error || "Failed to create");
    } catch {
      setError("Network error");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/marketers/leads/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchLeads();
    } catch {
      setError("Failed to update");
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    try {
      await fetch(`/api/marketers/leads/${id}/`, { method: "DELETE" });
      fetchLeads();
    } catch {
      setError("Failed to delete");
    }
  };

  const leadCounts = {
    total: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    interested: leads.filter((l) => l.status === "interested").length,
    converted: leads.filter((l) => l.status === "converted").length,
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={leadCounts.total} icon="group" color="#1e3a5f" />
        <StatCard label="New" value={leadCounts.new} icon="fiber_new" color="#3b82f6" />
        <StatCard label="Interested" value={leadCounts.interested} icon="sentiment_satisfied" color="#0d9488" />
        <StatCard label="Converted" value={leadCounts.converted} icon="check_circle" color="#059669" />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
          <h2 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">Leads</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold hover:opacity-90 transition-opacity"
          >
            {showForm ? "Cancel" : "+ New Lead"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={createLead} className="p-4 border-b border-[var(--border)] bg-[var(--bg)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <input
                  value={leadForm.school_name}
                  onChange={(e) => setLeadForm((f) => ({ ...f, school_name: e.target.value }))}
                  required
                  placeholder="School name *"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-[12px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                />
              </div>
              <input
                value={leadForm.contact_name}
                onChange={(e) => setLeadForm((f) => ({ ...f, contact_name: e.target.value }))}
                placeholder="Contact name"
                className="px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-[12px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
              <input
                value={leadForm.contact_phone}
                onChange={(e) => setLeadForm((f) => ({ ...f, contact_phone: e.target.value }))}
                placeholder="Contact phone"
                className="px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-[12px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
              <input
                value={leadForm.contact_email}
                onChange={(e) => setLeadForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder="Contact email"
                className="px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-[12px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
              <input
                value={leadForm.district}
                onChange={(e) => setLeadForm((f) => ({ ...f, district: e.target.value }))}
                placeholder="District"
                className="px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-[12px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
              <div className="sm:col-span-2">
                <textarea
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-[12px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white text-[12px] font-bold hover:opacity-90"
            >
              Create Lead
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">School</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Contact</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">District</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Created</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[var(--t4)]">
                    No leads yet. Click "+ New Lead" to start.
                  </td>
                </tr>
              ) : (
                leads.map((l) => {
                  const st = LEAD_STATUS_STYLES[l.status] || LEAD_STATUS_STYLES.new;
                  return (
                    <tr key={l.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-[var(--t1)]">{l.school_name}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        {l.contact_name && <div className="font-medium text-[var(--t2)]">{l.contact_name}</div>}
                        {l.contact_phone && <div className="text-[10px] text-[var(--t4)]">{l.contact_phone}</div>}
                        {l.contact_email && <div className="text-[10px] text-[var(--t4)]">{l.contact_email}</div>}
                        {!l.contact_name && !l.contact_phone && <span className="text-[var(--t4)]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--t2)]">{l.district || "—"}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={l.status}
                          onChange={(e) => updateStatus(l.id, e.target.value)}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold border-0 cursor-pointer"
                          style={{ background: st.bg, color: st.text }}
                        >
                          {Object.entries(LEAD_STATUS_STYLES).map(([k, v]) => (
                            <option key={k} value={k} style={{ background: "#fff", color: "#000" }}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--t3)]">{formatDate(l.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => deleteLead(l.id)}
                          className="text-[var(--t4)] hover:text-red-500 transition-colors p-1"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            delete
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Outreach Tab ─────────────────────────────────────────────────────────────

function OutreachTab() {
  const [outreach, setOutreach] = useState<OutreachRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOutreach = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketers/outreach/");
      const body = await res.json();
      if (body.success) setOutreach(body.data?.messages || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutreach();
  }, [fetchOutreach]);

  const typeIcons: Record<string, string> = {
    email: "mail",
    sms: "sms",
    call: "call",
    whatsapp: "chat",
    meeting: "event",
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h2 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">Communication History</h2>
        <p className="text-[11px] text-[var(--t4)] mt-0.5">
          Log your calls, emails, SMS, and meetings with school contacts.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
              <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Type</th>
              <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Recipient</th>
              <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Subject / Notes</th>
              <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Date</th>
            </tr>
          </thead>
          <tbody>
            {outreach.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-[var(--t4)]">
                  No outreach logged yet. Contact leads from the Leads tab.
                </td>
              </tr>
            ) : (
              outreach.map((m) => (
                <tr key={m.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[var(--t3)]" style={{ fontSize: 16 }}>
                        {typeIcons[m.type] || "chat"}
                      </span>
                      <span className="font-medium capitalize text-[var(--t2)]">{m.type}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {m.recipient_name && <div className="font-medium text-[var(--t1)]">{m.recipient_name}</div>}
                    {m.recipient_contact && <div className="text-[10px] text-[var(--t4)]">{m.recipient_contact}</div>}
                    {!m.recipient_name && <span className="text-[var(--t4)]">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {m.subject && <div className="font-medium text-[var(--t1)]">{m.subject}</div>}
                    {m.content && <div className="text-[10px] text-[var(--t4)] line-clamp-2">{m.content}</div>}
                    {!m.subject && !m.content && <span className="text-[var(--t4)]">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--t3)]">{formatDate(m.sent_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Resources Tab ────────────────────────────────────────────────────────────

function ResourcesTab() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">Marketing Resource Center</h2>
        <p className="text-[12px] text-[var(--t3)] mt-0.5">
          Use these resources to help schools understand the value of the platform.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {RESOURCES.map((r) => (
          <a
            key={r.title}
            href={r.href}
            target={r.href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:shadow-md hover:border-[var(--primary)]/30 transition-all group"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br from-[#ec4899]/10 to-[#8b5cf6]/10 text-[#8b5cf6] group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {r.icon}
              </span>
            </div>
            <h3 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-1">{r.title}</h3>
            <p className="text-[11px] text-[var(--t3)] leading-relaxed">{r.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Referrals Tab ────────────────────────────────────────────────────────────

function ReferralsTab() {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketers/referrals/");
      const body = await res.json();
      if (body.success) setReferrals(body.data?.referrals || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const createReferral = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/marketers/referrals/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || null }),
      });
      const body = await res.json();
      if (body.success) {
        setLabel("");
        fetchReferrals();
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    const url = `${baseUrl}/api/marketers/referrals/${code}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        alert("Referral link copied to clipboard!");
      })
      .catch(() => {
        // Fallback
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        alert("Referral link copied!");
      });
  };

  const totalClicks = referrals.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = referrals.reduce((s, r) => s + r.conversions, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Referral Codes" value={referrals.length} icon="share" color="#8b5cf6" />
        <StatCard label="Total Clicks" value={totalClicks} icon="ads_click" color="#3b82f6" />
        <StatCard
          label="Conversions"
          value={totalConversions}
          icon="conversion_path"
          color="#059669"
          sub={totalClicks > 0 ? `${Math.round((totalConversions / totalClicks) * 100)}% conversion rate` : undefined}
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
          <h2 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">My Referral Links</h2>
          <div className="flex gap-2 items-center">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Kampala tour)"
              className="w-40 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[12px] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
            <button
              onClick={createReferral}
              disabled={creating}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white text-[11px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              + Generate
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Code</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Label</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Clicks</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Conversions</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Created</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[var(--t4)]">
                    No referral codes yet. Generate your first one!
                  </td>
                </tr>
              ) : (
                referrals.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                    <td className="px-4 py-2.5">
                      <code className="px-2 py-0.5 rounded bg-[var(--bg)] font-bold text-[var(--primary)] text-[11px]">
                        {r.code}
                      </code>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--t2)]">{r.label || "—"}</td>
                    <td className="px-4 py-2.5 font-semibold text-[var(--t1)]">{r.clicks}</td>
                    <td className="px-4 py-2.5 font-semibold text-[var(--t1)]">{r.conversions}</td>
                    <td className="px-4 py-2.5 text-[var(--t3)]">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => copyToClipboard(r.code)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--bg)] text-[var(--t2)] hover:text-[var(--primary)] transition-colors text-[10px] font-bold"
                      >
                        Copy Link
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Earnings Tab ─────────────────────────────────────────────────────────────

function EarningsTab({
  summary,
  earnings,
  payouts,
}: {
  summary: DashboardData["summary"];
  earnings: EarningsRow[];
  payouts: PayoutRow[];
}) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Earned"
          value={formatCurrency(summary.totalEarned)}
          icon="account_balance"
          color="#059669"
        />
        <StatCard
          label="Pending"
          value={formatCurrency(summary.pendingEarnings)}
          icon="hourglass_bottom"
          color="#d97706"
        />
        <StatCard label="Paid Out" value={formatCurrency(summary.totalPaid)} icon="payments" color="#0284c7" />
        <StatCard
          label="My Schools"
          value={summary.mySchools}
          icon="school"
          color="#7c3aed"
          sub={`Balance: ${formatCurrency(summary.balance)}`}
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">Recent Earnings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Type</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">School</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Amount</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Date</th>
              </tr>
            </thead>
            <tbody>
              {earnings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-[var(--t4)]">
                    No earnings yet
                  </td>
                </tr>
              ) : (
                earnings.map((e) => {
                  const st = EARNING_STATUS_STYLES[e.status] || EARNING_STATUS_STYLES.pending;
                  return (
                    <tr key={e.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-[var(--t1)]">
                          {EARNING_TYPE_LABELS[e.earning_type] || e.earning_type}
                        </span>
                        {e.notes && <div className="text-[10px] text-[var(--t4)]">{e.notes}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--t2)]">{e.schools?.name || "—"}</td>
                      <td className="px-4 py-2.5 font-semibold text-[var(--t1)]">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                          style={{ background: st.bg, color: st.text }}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--t3)]">
                        {new Date(e.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "short" })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payouts.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">Payout History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Amount</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Date</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-[var(--t1)]">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === "paid" ? "bg-green-100 text-green-700" : p.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--t3)]">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/marketers/profile/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, phone }),
      });
      const body = await res.json();
      if (body.success) setMessage({ type: "success", text: "Profile updated successfully!" });
      else setMessage({ type: "error", text: body.error || "Failed to update" });
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)] mb-1">Profile Settings</h2>
        <p className="text-[12px] text-[var(--t3)] mb-6">Update your personal information.</p>

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl text-[12px] font-medium ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Email (read-only)</label>
            <input
              value={user?.email || ""}
              disabled
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t4)] cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Role</label>
            <input
              value="Field Marketer"
              disabled
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t4)] cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white font-bold text-[13px] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
