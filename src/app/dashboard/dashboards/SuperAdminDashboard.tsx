"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";

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
  starter: "#3b82f6",
  growth: "#0d9488",
  enterprise: "#f59e0b",
  lifetime: "#7c3aed",
  free_trial: "#64748b",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
  lifetime: "Lifetime",
  free_trial: "Free Trial",
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg: "#ccfbf1", text: "#0d9488", label: "Active" },
  trial:     { bg: "#e0efff", text: "#003366", label: "Trial" },
  expired:   { bg: "#fdedec", text: "#e74c3c", label: "Expired" },
  suspended: { bg: "#fef3c7", text: "#b45309", label: "Suspended" },
  past_due:  { bg: "#fef3c7", text: "#b45309", label: "Past Due" },
  canceled:  { bg: "#f1f5f9", text: "#64748b", label: "Canceled" },
};

function formatCurrency(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Big Number Card ─────────────────────────────────────── */
function BigStatCard({
  label,
  value,
  sub,
  icon,
  color,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  color: string;
  href?: string;
}) {
  const Wrapper = href ? Link : "div";
  return (
    <Wrapper
      href={href as string}
      className={`stat-card group ${href ? "cursor-pointer" : ""}`}
    >
      <div className="stat-accent" style={{ background: color }} />
      <div className="stat-inner">
        <div className="stat-meta">
          <div className="stat-label">{label}</div>
          <div
            className="stat-icon-box"
            style={{
              background: `${color}18`,
              color,
            }}
          >
            <MaterialIcon icon={icon} style={{ fontSize: 20 }} />
          </div>
        </div>
        <div className="stat-val" style={{ color }}>
          {value}
        </div>
        {sub && (
          <div className="text-[12px] font-medium mt-2 text-[var(--t3)]">
            {sub}
          </div>
        )}
      </div>
      {href && (
        <div className="stat-footer">
          <span className="stat-foot-label">View details</span>
          <MaterialIcon
            icon="arrow_forward"
            style={{ fontSize: 14, color: "var(--t3)" }}
          />
        </div>
      )}
    </Wrapper>
  );
}

/* ── Quick Action Card ──────────────────────────────────── */
function ActionCard({
  label,
  desc,
  icon,
  color,
  href,
}: {
  label: string;
  desc: string;
  icon: string;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex gap-4 items-start transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] hover:border-[var(--border2)]"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${color}18`, color }}
      >
        <MaterialIcon icon={icon} style={{ fontSize: 22 }} />
      </div>
      <div>
        <div className="font-['Sora'] text-[14px] font-bold text-[var(--t1)] group-hover:text-[var(--navy)] transition-colors">
          {label}
        </div>
        <div className="text-[12px] text-[var(--t3)] mt-0.5 leading-5">{desc}</div>
      </div>
      <MaterialIcon
        icon="arrow_forward"
        style={{
          fontSize: 16,
          color: "var(--t4)",
          position: "absolute",
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: 0,
          transition: "opacity 0.15s",
        }}
        className="group-hover:!opacity-100"
      />
    </Link>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export default function SuperAdminDashboard() {
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
  const [planBreakdown, setPlanBreakdown] = useState<
    { plan: string; count: number }[]
  >([]);

  const fetchData = useCallback(async () => {
    try {
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
      const newMonth = schools.filter(
        (s) => new Date(s.created_at) >= monthAgo,
      ).length;
      const totalStudents = schools.reduce(
        (sum, s) => sum + (Number(s.student_count) || 0),
        0,
      );

      // Plan breakdown
      const planMap: Record<string, number> = {};
      schools.forEach((s) => {
        const p = s.subscription_plan || "starter";
        planMap[p] = (planMap[p] || 0) + 1;
      });
      setPlanBreakdown(
        Object.entries(planMap).map(([plan, count]) => ({ plan, count })),
      );

      // Alerts: expiring trials & expired subscriptions
      const alertItems: AlertItem[] = [];
      schools.forEach((s) => {
        if (s.subscription_status === "trial" && s.trial_ends_at) {
          const daysLeft = Math.ceil(
            (new Date(s.trial_ends_at).getTime() - Date.now()) / 86_400_000,
          );
          if (daysLeft <= 5 && daysLeft >= 0) {
            alertItems.push({
              id: s.id,
              type: "trial",
              label: s.name,
              sub: `Trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
              href: "/dashboard/schools",
              color: "#b45309",
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
            color: "#e74c3c",
          });
        }
        if (s.subscription_status === "suspended") {
          alertItems.push({
            id: s.id,
            type: "suspended",
            label: s.name,
            sub: "Account suspended",
            href: "/dashboard/schools",
            color: "#b45309",
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

  const greeting =
    new Date().getHours() < 12
      ? "Good Morning"
      : new Date().getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

  const firstName = user?.full_name?.trim().split(" ")[0] || "Admin";

  const maxPlan = Math.max(...planBreakdown.map((p) => p.count), 1);

  return (
    <div className="content">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-7 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md border border-[var(--border)]"
          style={{ background: "var(--navy)" }}
        >
          <MaterialIcon icon="shield" style={{ fontSize: 28, color: "white" }} />
        </div>
        <div>
          <h1 className="font-['Sora'] text-xl sm:text-2xl font-bold text-[var(--t1)] tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-[13px] text-[var(--t3)] mt-1">
            SkoolMate OS · Platform Administration ·{" "}
            {new Date().toLocaleDateString("en-UG", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="ml-auto p-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] text-[var(--t3)] transition-colors"
          title="Refresh"
        >
          <MaterialIcon icon="refresh" style={{ fontSize: 18 }} />
        </button>
      </div>

      {/* ── 4 Big Numbers ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <BigStatCard
          label="Total Schools"
          value={loading ? "…" : stats.totalSchools}
          sub={`${stats.activeSchools} active · ${stats.trialSchools} trial`}
          icon="school"
          color="var(--navy)"
          href="/dashboard/schools"
        />
        <BigStatCard
          label="Students (all)"
          value={loading ? "…" : stats.totalStudents.toLocaleString()}
          sub="Across all schools"
          icon="groups"
          color="var(--green)"
        />
        <BigStatCard
          label="System Users"
          value={loading ? "…" : stats.totalUsers.toLocaleString()}
          sub="Staff + admin accounts"
          icon="manage_accounts"
          color="#7c3aed"
          href="/dashboard/users"
        />
        <BigStatCard
          label="New This Month"
          value={loading ? "…" : stats.newThisMonth}
          sub="School registrations"
          icon="add_business"
          color="var(--amber)"
        />
      </div>

      {/* ── Alerts ──────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon
              icon="warning"
              style={{ fontSize: 16, color: "var(--amber)" }}
            />
            <span className="text-[13px] font-bold text-[var(--t1)]">
              Needs Attention
            </span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-[var(--amber-soft)] text-[var(--amber)] text-[11px] font-bold">
              {alerts.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {alerts.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:bg-[var(--bg)] transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${a.color}18`, color: a.color }}
                >
                  <MaterialIcon
                    icon={
                      a.type === "expiring"
                        ? "error"
                        : a.type === "trial"
                          ? "schedule"
                          : "block"
                    }
                    style={{ fontSize: 16 }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--t1)] truncate">
                    {a.label}
                  </div>
                  <div className="text-[11px] text-[var(--t3)] truncate">
                    {a.sub}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Main grid: Schools list + Plan breakdown ────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        {/* Recent Schools */}
        <div className="xl:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div>
              <div className="font-['Sora'] text-[14px] font-bold text-[var(--t1)]">
                Recent Schools
              </div>
              <div className="text-[11px] text-[var(--t3)] mt-0.5">
                Latest registrations on the platform
              </div>
            </div>
            <Link
              href="/dashboard/schools"
              className="text-[12px] font-semibold text-[var(--navy)] hover:underline flex items-center gap-1"
            >
              View all
              <MaterialIcon icon="arrow_forward" style={{ fontSize: 14 }} />
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg)] flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-3 w-36 bg-[var(--bg)] rounded mb-1" />
                      <div className="h-2.5 w-20 bg-[var(--bg)] rounded" />
                    </div>
                  </div>
                ))
              : recentSchools.map((s) => {
                  const badge = STATUS_BADGE[s.subscription_status] || STATUS_BADGE.active;
                  return (
                    <Link
                      key={s.id}
                      href="/dashboard/schools"
                      className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg)] transition-colors group"
                    >
                      {/* School badge/logo */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[13px] font-bold overflow-hidden"
                        style={{ background: s.primary_color || "var(--navy)" }}
                      >
                        {s.logo_url ? (
                          <Image
                            src={s.logo_url}
                            alt={s.name}
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          s.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[var(--t1)] truncate group-hover:text-[var(--navy)]">
                          {s.name}
                        </div>
                        <div className="text-[11px] text-[var(--t3)]">
                          {s.district} · {s.school_type}
                          {s.student_count ? ` · ${s.student_count} students` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            background: badge.bg,
                            color: badge.text,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                          style={{
                            background: `${PLAN_COLORS[s.subscription_plan] || "#64748b"}18`,
                            color: PLAN_COLORS[s.subscription_plan] || "#64748b",
                          }}
                        >
                          {PLAN_LABELS[s.subscription_plan] || s.subscription_plan}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--t4)] flex-shrink-0 ml-1">
                        {timeSince(s.created_at)}
                      </div>
                    </Link>
                  );
                })}
          </div>
        </div>

        {/* Right column: Plan Breakdown + Status */}
        <div className="flex flex-col gap-4">
          {/* Subscription mix */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-4">
              Subscription Mix
            </div>
            {planBreakdown.length === 0 && !loading ? (
              <p className="text-[12px] text-[var(--t3)]">No data yet</p>
            ) : (
              <div className="space-y-3">
                {planBreakdown.map(({ plan, count }) => (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[12px] font-semibold"
                        style={{ color: PLAN_COLORS[plan] || "#64748b" }}
                      >
                        {PLAN_LABELS[plan] || plan}
                      </span>
                      <span className="text-[12px] font-bold text-[var(--t1)]">
                        {count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round((count / maxPlan) * 100)}%`,
                          background: PLAN_COLORS[plan] || "#64748b",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status summary */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-4">
              School Status
            </div>
            <div className="space-y-2.5">
              {[
                {
                  label: "Active",
                  value: stats.activeSchools,
                  color: "#0d9488",
                  bg: "#ccfbf1",
                  icon: "check_circle",
                },
                {
                  label: "On Trial",
                  value: stats.trialSchools,
                  color: "#003366",
                  bg: "#e0efff",
                  icon: "schedule",
                },
                {
                  label: "Expired / Suspended",
                  value: stats.expiredSchools,
                  color: "#e74c3c",
                  bg: "#fdedec",
                  icon: "error",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: item.bg }}
                >
                  <MaterialIcon
                    icon={item.icon}
                    style={{ fontSize: 16, color: item.color, flexShrink: 0 }}
                  />
                  <span
                    className="text-[12px] font-semibold flex-1"
                    style={{ color: item.color }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="text-[15px] font-extrabold font-['Sora']"
                    style={{ color: item.color }}
                  >
                    {loading ? "…" : item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────── */}
      <div className="mb-6">
        <div className="text-[13px] font-bold text-[var(--t1)] mb-3">
          Quick Actions
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <ActionCard
            label="Manage Schools"
            desc="View, edit, suspend, or provision schools"
            icon="domain"
            color="var(--navy)"
            href="/dashboard/schools"
          />
          <ActionCard
            label="System Users"
            desc="All users, roles, and access control"
            icon="manage_accounts"
            color="#7c3aed"
            href="/dashboard/users"
          />
          <ActionCard
            label="Support Tickets"
            desc="Open requests and onboarding help"
            icon="support_agent"
            color="var(--amber)"
            href="/dashboard/feedback"
          />
          <ActionCard
            label="Audit Logs"
            desc="Full activity trail across the platform"
            icon="fact_check"
            color="var(--green)"
            href="/dashboard/audit"
          />
          <ActionCard
            label="Platform Settings"
            desc="Global config, SMS quotas, feature flags"
            icon="tune"
            color="#0284c7"
            href="/dashboard/settings"
          />
          <ActionCard
            label="Subscriptions"
            desc="Billing plans, renewals, and upgrades"
            icon="credit_card"
            color="#db2777"
            href="/dashboard/schools"
          />
          <ActionCard
            label="Register School"
            desc="Create and provision a new school account"
            icon="add_business"
            color="#16a34a"
            href="/dashboard/schools"
          />
          <ActionCard
            label="Analytics"
            desc="Platform growth, usage, and retention"
            icon="bar_chart"
            color="#d97706"
            href="/dashboard/analytics"
          />
        </div>
      </div>

      {/* ── Footer note ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[12px] text-[var(--t3)]">
        <MaterialIcon icon="info" style={{ fontSize: 16, color: "var(--green)" }} />
        Logged in as{" "}
        <strong className="text-[var(--t1)]">{user?.full_name}</strong> ·
        Super Admin · Full platform access
      </div>
    </div>
  );
}
