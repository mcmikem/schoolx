"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import MaterialIcon from "@/components/MaterialIcon";
import { ActionLinks } from "@/components/ui/ActionLinks";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatStrip } from "@/components/ui/StatStrip";
import { APP_NAME } from "@/lib/app-name";
import { useAuth } from "@/lib/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { greetingFor } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────── */
interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  trialSchools: number;
  expiredSchools: number;
  totalStudents: number;
  totalUsers: number;
  totalRevenue: number;
  newThisMonth: number;
}

interface RecentSchool {
  id: string;
  name: string;
  district: string;
  school_type: string;
  subscription_plan: string;
  subscription_status: string;
  student_count: number;
  created_at: string;
  logo_url?: string;
  primary_color?: string;
}

interface AlertItem {
  id: string;
  type: "expiring" | "trial" | "suspended";
  label: string;
  sub: string;
  href: string;
  color: string;
}

/* ── Helpers ─────────────────────────────────────────────── */
const PLAN_COLORS: Record<string, string> = {
  starter: "var(--primary)",
  growth: "var(--secondary-600)",
  enterprise: "var(--amber)",
  lifetime: "var(--violet)",
  free_trial: "var(--slate-ink)",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
  lifetime: "Lifetime",
  free_trial: "Free Trial",
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "var(--secondary-100)", text: "var(--secondary-600)", label: "Active" },
  trial: { bg: "var(--primary-50)", text: "var(--primary-700)", label: "Trial" },
  expired: { bg: "var(--red-soft)", text: "var(--red-ink)", label: "Expired" },
  suspended: { bg: "var(--amber-soft)", text: "var(--amber-ink)", label: "Suspended" },
  past_due: { bg: "var(--amber-soft)", text: "var(--amber-ink)", label: "Past Due" },
  canceled: { bg: "var(--surface-container-low)", text: "var(--slate-ink)", label: "Canceled" },
};

const QUICK_ACTIONS = [
  { label: "Manage schools", href: "/dashboard/schools", icon: "domain" },
  { label: "System users", href: "/dashboard/users", icon: "manage_accounts" },
  { label: "Support tickets", href: "/dashboard/feedback", icon: "support_agent" },
  { label: "Audit logs", href: "/dashboard/audit", icon: "fact_check" },
  { label: "Platform settings", href: "/dashboard/settings", icon: "tune" },
  { label: "Subscriptions", href: "/dashboard/schools", icon: "credit_card" },
  { label: "Register school", href: "/dashboard/schools", icon: "add_business" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "bar_chart" },
];

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Main Component ─────────────────────────────────────── */
function SuperAdminDashboardContent() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlatformStats>({
    totalSchools: 0,
    activeSchools: 0,
    trialSchools: 0,
    expiredSchools: 0,
    totalStudents: 0,
    totalUsers: 0,
    totalRevenue: 0,
    newThisMonth: 0,
  });
  const [recentSchools, setRecentSchools] = useState<RecentSchool[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [planBreakdown, setPlanBreakdown] = useState<{ plan: string; count: number }[]>([]);
  const [configWarning, setConfigWarning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (!isSupabaseConfigured) {
        setConfigWarning("Supabase is not configured. Platform statistics are unavailable — no mock data is shown.");
        setStats({
          totalSchools: 0,
          activeSchools: 0,
          trialSchools: 0,
          expiredSchools: 0,
          totalStudents: 0,
          totalUsers: 0,
          totalRevenue: 0,
          newThisMonth: 0,
        });
        setRecentSchools([]);
        setPlanBreakdown([]);
        setAlerts([]);
        return;
      }
      setConfigWarning(null);

      const [schoolsRes, usersRes] = await Promise.all([
        supabase
          .from("schools")
          .select(
            "id, name, district, school_type, subscription_plan, subscription_status, student_count, created_at, logo_url, primary_color, trial_ends_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("users").select("id", { count: "exact", head: true }),
      ]);

      const schools = schoolsRes.data || [];

      // Platform stats
      const now = new Date();
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

      const active = schools.filter((s) => s.subscription_status === "active").length;
      const trial = schools.filter((s) => s.subscription_status === "trial").length;
      const expired = schools.filter((s) =>
        ["expired", "canceled", "suspended"].includes(s.subscription_status),
      ).length;
      const newMonth = schools.filter((s) => new Date(s.created_at) >= monthAgo).length;
      const totalStudents = schools.reduce((sum, s) => sum + (Number(s.student_count) || 0), 0);

      // Plan breakdown
      const planMap: Record<string, number> = {};
      schools.forEach((s) => {
        const p = s.subscription_plan || "starter";
        planMap[p] = (planMap[p] || 0) + 1;
      });
      setPlanBreakdown(Object.entries(planMap).map(([plan, count]) => ({ plan, count })));

      // Alerts: expiring trials & expired subscriptions
      const alertItems: AlertItem[] = [];
      schools.forEach((s) => {
        if (s.subscription_status === "trial" && s.trial_ends_at) {
          const daysLeft = Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / 86_400_000);
          if (daysLeft <= 5 && daysLeft >= 0) {
            alertItems.push({
              id: s.id,
              type: "trial",
              label: s.name,
              sub: `Trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
              href: "/dashboard/schools",
              color: "var(--amber-ink)",
            });
          }
        }
        if (s.subscription_status === "expired") {
          alertItems.push({
            id: s.id,
            type: "expiring",
            label: s.name,
            sub: "Subscription expired — needs renewal",
            href: "/dashboard/schools",
            color: "var(--red-ink)",
          });
        }
        if (s.subscription_status === "suspended") {
          alertItems.push({
            id: s.id,
            type: "suspended",
            label: s.name,
            sub: "Account suspended",
            href: "/dashboard/schools",
            color: "var(--amber-ink)",
          });
        }
      });
      setAlerts(alertItems.slice(0, 6));

      setStats({
        totalSchools: schools.length,
        activeSchools: active,
        trialSchools: trial,
        expiredSchools: expired,
        totalStudents,
        totalUsers: usersRes.count || 0,
        totalRevenue: 0, // requires payments table
        newThisMonth: newMonth,
      });
      setRecentSchools(schools.slice(0, 8));
    } catch (_e) {
      // silently fail — super admin still sees what's available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const greeting = greetingFor();

  const firstName = user?.full_name?.trim().split(" ")[0] || "Admin";

  const maxPlan = Math.max(...planBreakdown.map((p) => p.count), 1);

  return (
    <div className="content !gap-6 min-w-0">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle={`${APP_NAME} · Platform Administration · ${new Date().toLocaleDateString("en-UG", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
        actions={
          <button type="button" onClick={fetchData} className="btn-pill btn-secondary" title="Refresh">
            <MaterialIcon icon="refresh" className="text-lg" />
            Refresh
          </button>
        }
      />

      {configWarning && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--amber-border)] bg-[var(--amber-soft)] px-4 py-3">
          <MaterialIcon icon="warning" className="mt-0.5 text-lg text-[var(--amber)]" />
          <p className="text-sm text-[var(--t1)]">{configWarning}</p>
        </div>
      )}

      <StatStrip
        variant="flat"
        columns={4}
        items={[
          {
            label: "Total Schools",
            value: loading ? "…" : stats.totalSchools,
            hint: `${stats.activeSchools} active · ${stats.trialSchools} trial`,
          },
          {
            label: "Students (all)",
            value: loading ? "…" : stats.totalStudents.toLocaleString(),
            hint: "Across all schools",
          },
          {
            label: "System Users",
            value: loading ? "…" : stats.totalUsers.toLocaleString(),
            hint: "Staff + admin accounts",
            tone: "info",
          },
          {
            label: "New This Month",
            value: loading ? "…" : stats.newThisMonth,
            hint: "School registrations",
            tone: "positive",
          },
        ]}
      />

      <ActionLinks items={QUICK_ACTIONS} columns={4} label="Super admin quick actions" />

      {alerts.length > 0 && (
        <section aria-labelledby="needs-attention-title" className="min-w-0 border-t border-[var(--border)] pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="needs-attention-title"
              className="flex items-center gap-2 font-heading text-base font-bold text-[var(--t1)]"
            >
              <MaterialIcon icon="warning" className="text-lg text-[var(--amber)]" />
              Needs attention
            </h2>
            <span className="rounded-full bg-[var(--amber-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--amber-ink)]">
              {alerts.length}
            </span>
          </div>
          <div className="mt-1 divide-y divide-[var(--border)]">
            {alerts.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                className="flex min-h-14 items-center gap-3 py-2.5 transition-colors hover:text-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `color-mix(in srgb, ${a.color} 10%, transparent)`, color: a.color }}
                  aria-hidden="true"
                >
                  <MaterialIcon
                    icon={a.type === "expiring" ? "error" : a.type === "trial" ? "schedule" : "block"}
                    className="text-base"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--t1)]">{a.label}</span>
                  <span className="block truncate text-xs text-[var(--t3)]">{a.sub}</span>
                </span>
                <MaterialIcon icon="arrow_forward" className="shrink-0 text-base text-[var(--t3)]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <section
          aria-labelledby="recent-schools-title"
          className="min-w-0 border-t border-[var(--border)] pt-5 xl:col-span-2"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 id="recent-schools-title" className="font-heading text-base font-bold text-[var(--t1)]">
                Recent schools
              </h2>
              <p className="mt-1 text-xs text-[var(--t3)]">Latest registrations on the platform</p>
            </div>
            <Link
              href="/dashboard/schools"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--primary)]"
            >
              View all
              <MaterialIcon icon="arrow_forward" className="text-base" />
            </Link>
          </div>
          <div className="mt-2 divide-y divide-[var(--border)]">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--surface-container-low)]" />
                    <div className="flex-1">
                      <div className="mb-1 h-3 w-36 rounded bg-[var(--surface-container-low)]" />
                      <div className="h-2.5 w-20 rounded bg-[var(--surface-container-low)]" />
                    </div>
                  </div>
                ))
              : recentSchools.map((s) => {
                  const badge = STATUS_BADGE[s.subscription_status] || STATUS_BADGE.active;
                  return (
                    <Link
                      key={s.id}
                      href="/dashboard/schools"
                      className="group flex min-h-14 items-center gap-3 py-2.5 transition-colors hover:text-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[13px] font-bold text-white"
                        style={{ background: s.primary_color || "var(--navy)" }}
                      >
                        {s.logo_url ? (
                          <Image
                            src={s.logo_url}
                            alt={s.name}
                            width={36}
                            height={36}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          s.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--t1)]">{s.name}</span>
                        <span className="block truncate text-xs text-[var(--t3)]">
                          {s.district} · {s.school_type}
                          {s.student_count ? ` · ${s.student_count} students` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          {badge.label}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold uppercase"
                          style={{
                            background: `color-mix(in srgb, ${PLAN_COLORS[s.subscription_plan] || "var(--slate-ink)"} 10%, transparent)`,
                            color: PLAN_COLORS[s.subscription_plan] || "var(--slate-ink)",
                          }}
                        >
                          {PLAN_LABELS[s.subscription_plan] || s.subscription_plan}
                        </span>
                      </span>
                      <span className="ml-1 shrink-0 text-xs text-[var(--t4)]">{timeSince(s.created_at)}</span>
                    </Link>
                  );
                })}
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="subscription-mix-title" className="min-w-0 border-t border-[var(--border)] pt-5">
            <h2 id="subscription-mix-title" className="font-heading text-base font-bold text-[var(--t1)]">
              Subscription mix
            </h2>
            {planBreakdown.length === 0 && !loading ? (
              <p className="mt-2 text-sm text-[var(--t3)]">No data yet</p>
            ) : (
              <div className="mt-4 space-y-3">
                {planBreakdown.map(({ plan, count }) => (
                  <div key={plan}>
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: PLAN_COLORS[plan] || "var(--slate-ink)" }}
                      >
                        {PLAN_LABELS[plan] || plan}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-[var(--t1)]">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-container-low)]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round((count / maxPlan) * 100)}%`,
                          background: PLAN_COLORS[plan] || "var(--slate-ink)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="school-status-title" className="min-w-0 border-t border-[var(--border)] pt-5">
            <h2 id="school-status-title" className="font-heading text-base font-bold text-[var(--t1)]">
              School status
            </h2>
            <dl className="mt-2 divide-y divide-[var(--border)]">
              {[
                {
                  label: "Active",
                  value: stats.activeSchools,
                  color: "var(--secondary-600)",
                  icon: "check_circle",
                },
                {
                  label: "On Trial",
                  value: stats.trialSchools,
                  color: "var(--primary-700)",
                  icon: "schedule",
                },
                {
                  label: "Expired / Suspended",
                  value: stats.expiredSchools,
                  color: "var(--red-ink)",
                  icon: "error",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 py-3">
                  <MaterialIcon icon={item.icon} className="shrink-0 text-base" style={{ color: item.color }} />
                  <dt className="flex-1 text-sm font-semibold text-[var(--t2)]">{item.label}</dt>
                  <dd className="text-lg font-bold tabular-nums" style={{ color: item.color }}>
                    {loading ? "…" : item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--t3)]">
        <MaterialIcon icon="info" className="text-base text-[var(--green)]" />
        Logged in as <strong className="text-[var(--t1)]">{user?.full_name}</strong> · Super Admin · Full platform
        access
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  return (
    <ErrorBoundary>
      <SuperAdminDashboardContent />
    </ErrorBoundary>
  );
}
