"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/app-name";

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
  summary: {
    totalEarned: number;
    pendingEarnings: number;
    totalPaid: number;
    mySchools: number;
    balance: number;
  };
}

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

export default function MarketerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"pipeline" | "earnings">("pipeline");

  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketers/data/");
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Failed to fetch");
      setData(body.data);
    } catch (err) {
      logger.error("[MarketerDashboard] Failed to load:", err);
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
            {new Date().toLocaleDateString("en-UG", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${activeTab === "pipeline" ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--bg)]"}`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setActiveTab("earnings")}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${activeTab === "earnings" ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--bg)]"}`}
          >
            Earnings
          </button>
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
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
        </div>
      ) : activeTab === "pipeline" ? (
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
              <h2 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">Schools</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[12px] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                />
                <span className="text-[11px] text-[var(--t4)]">{filteredSchools.length} schools</span>
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
                  {recentSchools.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[var(--t4)]">
                        {search ? "No matches" : "No schools found"}
                      </td>
                    </tr>
                  ) : (
                    recentSchools.map((s) => (
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
                        <td className="px-4 py-2.5 text-[var(--t3)]">
                          {new Date(s.created_at).toLocaleDateString("en-UG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
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
                  {recentEarnings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[var(--t4)]">
                        No earnings yet
                      </td>
                    </tr>
                  ) : (
                    recentEarnings.map((e) => {
                      const st = EARNING_STATUS_STYLES[e.status] || EARNING_STATUS_STYLES.pending;
                      return (
                        <tr
                          key={e.id}
                          className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors"
                        >
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

          {recentPayouts.length > 0 && (
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
                    {recentPayouts.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-[var(--t1)]">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === "paid" ? "bg-green-100 text-green-700" : p.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--t3)]">
                          {new Date(p.created_at).toLocaleDateString("en-UG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
