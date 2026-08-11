"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import Image from "next/image";
import { OwlLoader } from "@/components/loaders";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/app-name";
import {
  School,
  UserRow,
  PlatformStats,
  SubscriptionStatus,
  type Tab,
  PLAN_COLORS,
  PLAN_LABELS,
  ROLE_COLORS,
  adminAction,
  parseApiResponse,
  fmtDate,
  timeSince,
} from "./_shared";
import { Toggle, Badge, PlanBadge, StatCard, ConfirmDialog } from "./_atoms";
import { SchoolDetailSheet } from "./_school-detail-sheet";
import { RegisterSchoolForm } from "./_register-school-form";
import { UserActions } from "./_user-actions";
import { MarketersTab } from "./_marketers-tab";
import { AuditLogTab } from "./_audit-log-tab";
import { AppActivityTab } from "./_activity-tab";

export default function SuperAdminPage() {
  const { user, authInitialized, signOut } = useAuth();
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
  const [pendingModules, setPendingModules] = useState<any[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [stats, setStats] = useState<PlatformStats>({
    totalSchools: 0,
    activeSchools: 0,
    trialSchools: 0,
    expiredSchools: 0,
    totalStudents: 0,
    totalUsers: 0,
    newThisMonth: 0,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [testerFilter, setTesterFilter] = useState<"all" | "tester" | "normal">("all");
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [planBreakdown, setPlanBreakdown] = useState<{ plan: string; count: number }[]>([]);
  const [settings, setSettings] = useState({
    demo_mode: false,
    sms_enabled: true,
    payment_enabled: true,
    support_email: "support@omuto.org",
    support_phone: "+256 700 287 030",
    trial_days: 30,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    body: string;
    label: string;
    danger?: boolean;
    action: () => Promise<void>;
  }>({ open: false, title: "", body: "", label: "", action: async () => {} });
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (authInitialized && user && user.role !== "super_admin") router.replace("/dashboard");
    if (authInitialized && !user) router.replace("/login");
  }, [authInitialized, user, router]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("platform_settings");
      if (saved) setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch (error) {
      logger.error("Failed to load platform settings from localStorage:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await fetch("/api/super-admin/data");
      const body = await parseApiResponse(res);
      if (!res.ok || !body.success) {
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }

      const schoolList: School[] = Array.isArray(body.schools) ? (body.schools as School[]) : [];
      const userList: UserRow[] = Array.isArray(body.users) ? (body.users as UserRow[]) : [];
      const schoolNameMap: Record<string, string> = {};
      schoolList.forEach((s) => {
        schoolNameMap[s.id] = s.name;
      });
      const enrichedUsers = userList.map((u) => ({
        ...u,
        school_name: u.school_id ? schoolNameMap[u.school_id] || "Unknown" : "\u2014",
      }));

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const active = schoolList.filter((s) => s.subscription_status === "active").length;
      const trial = schoolList.filter((s) => s.subscription_status === "trial").length;
      const expired = schoolList.filter((s) =>
        ["expired", "canceled", "suspended", "past_due", "unpaid"].includes(s.subscription_status),
      ).length;
      const newMonth = schoolList.filter((s) => new Date(s.created_at) >= monthStart).length;
      const totalStudents = schoolList.reduce((sum, s) => sum + (Number(s.student_count) || 0), 0);

      const planMap: Record<string, number> = {};
      schoolList.forEach((s) => {
        const p = s.subscription_plan || "free_trial";
        planMap[p] = (planMap[p] || 0) + 1;
      });
      setPlanBreakdown(Object.entries(planMap).map(([plan, count]) => ({ plan, count })));
      setSchools(schoolList);
      setUsers(enrichedUsers);
      setStats({
        totalSchools: schoolList.length,
        activeSchools: active,
        trialSchools: trial,
        expiredSchools: expired,
        totalStudents,
        totalUsers: userList.length,
        newThisMonth: newMonth,
      });
    } catch (e: any) {
      const message = typeof e?.message === "string" ? e.message : "Unknown load error";
      toast.error("Failed to load data. Check your connection.");
      if (message.includes("Unexpected response from server") || message.includes("unexpected error page")) {
        logger.warn("[SuperAdmin] loadData degraded mode:", message);
      } else {
        logger.error("[SuperAdmin] loadData error:", e);
      }
    } finally {
      setDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.role === "super_admin") loadData();
  }, [user, loadData]);

  const filteredSchools = schools.filter((s) => {
    const q = schoolSearch.toLowerCase();
    const matchSearch =
      !schoolSearch ||
      s.name.toLowerCase().includes(q) ||
      s.district.toLowerCase().includes(q) ||
      (s.school_code || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || s.subscription_status === statusFilter;
    const matchPlan = planFilter === "all" || s.subscription_plan === planFilter;
    const matchTester = testerFilter === "all" || (testerFilter === "tester" ? s.is_tester : !s.is_tester);
    return matchSearch && matchStatus && matchPlan && matchTester;
  });

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.school_name?.toLowerCase().includes(q)
    );
  });

  const doConfirm = (title: string, body: string, label: string, action: () => Promise<void>, danger = false) =>
    setConfirm({ open: true, title, body, label, action, danger });

  const runConfirm = async () => {
    setConfirmLoading(true);
    try {
      await confirm.action();
      setConfirm((c) => ({ ...c, open: false }));
    } finally {
      setConfirmLoading(false);
    }
  };

  const suspendSchool = (s: School) =>
    doConfirm(
      `Suspend ${s.name}?`,
      "The school will lose access until reactivated. All data is preserved.",
      "Suspend School",
      async () => {
        await adminAction("update_school", {
          id: s.id,
          fields: { subscription_status: "suspended" },
        });
        setSchools((prev) =>
          prev.map((x) => (x.id === s.id ? { ...x, subscription_status: "suspended" as SubscriptionStatus } : x)),
        );
        toast.success(`${s.name} suspended`);
      },
      true,
    );

  const reactivateSchool = async (s: School) => {
    try {
      await adminAction("update_school", {
        id: s.id,
        fields: { subscription_status: "active" },
      });
      setSchools((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, subscription_status: "active" as SubscriptionStatus } : x)),
      );
      toast.success("School reactivated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reactivate");
    }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      localStorage.setItem("platform_settings", JSON.stringify(settings));
      toast.success("Platform settings saved");
    } catch (err) {
      logger.warn("Failed to save platform settings:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!authInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <OwlLoader size={100} text={APP_NAME} subtext="Loading admin panel..." />
      </div>
    );
  }
  if (user?.role !== "super_admin") return null;

  const alerts: { color: string; icon: string; title: string; sub: string }[] = [];
  schools.forEach((s) => {
    if (s.subscription_status === "trial" && s.trial_ends_at) {
      const daysLeft = Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / 86400000);
      if (daysLeft <= 5 && daysLeft >= 0)
        alerts.push({
          color: "#b45309",
          icon: "schedule",
          title: s.name,
          sub: `Trial expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        });
    }
    if (s.subscription_status === "expired")
      alerts.push({
        color: "#dc2626",
        icon: "error",
        title: s.name,
        sub: "Subscription expired",
      });
    if (s.subscription_status === "suspended")
      alerts.push({
        color: "#b45309",
        icon: "block",
        title: s.name,
        sub: "Account suspended",
      });
  });

  const maxPlan = Math.max(...planBreakdown.map((p) => p.count), 1);
  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.full_name?.trim().split(" ")[0] || "Admin";

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "dashboard" },
    { id: "schools", label: `Schools (${stats.totalSchools})`, icon: "school" },
    {
      id: "users",
      label: `Users (${stats.totalUsers})`,
      icon: "manage_accounts",
    },
    { id: "register", label: "Register School", icon: "add_business" },
    { id: "marketers", label: "Marketers", icon: "campaign" },
    { id: "audit", label: "Audit Log", icon: "history" },
    { id: "activity", label: "App Activity", icon: "insights" },
    { id: "modules", label: "Modules", icon: "extension" },
    { id: "settings", label: "Settings", icon: "tune" },
  ];

  return (
    <PageErrorBoundary>
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        body={confirm.body}
        confirmLabel={confirm.label}
        danger={confirm.danger}
        loading={confirmLoading}
        onConfirm={runConfirm}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />

      {selectedSchool && (
        <SchoolDetailSheet
          school={selectedSchool}
          onClose={() => setSelectedSchool(null)}
          onUpdated={(updated) => {
            setSchools((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            setSelectedSchool(null);
          }}
          onDeleted={(id) => {
            setSchools((prev) => prev.filter((s) => s.id !== id));
            setSelectedSchool(null);
          }}
        />
      )}

      <div className="min-h-screen bg-[var(--bg)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md border border-[var(--border)]"
              style={{ background: "var(--navy)" }}
            >
              <MaterialIcon icon="shield" style={{ fontSize: 28, color: "white" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-['Sora'] text-xl font-bold text-[var(--t1)] leading-tight">
                {greeting}, {firstName}
              </h1>
              <p className="text-[12px] text-[var(--t3)] mt-0.5">
                {APP_NAME} \u00b7 Super Admin \u00b7{" "}
                {new Date().toLocaleDateString("en-UG", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={dataLoading}
              title="Refresh data"
              className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] text-[var(--t3)] transition-colors disabled:opacity-40"
            >
              <MaterialIcon icon="refresh" style={{ fontSize: 18 }} className={dataLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-red-50 hover:border-red-200 text-[var(--t2)] hover:text-red-600 text-[12px] font-semibold transition-colors"
            >
              <MaterialIcon icon="logout" style={{ fontSize: 16 }} />
              Sign Out
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-[var(--primary)] text-white shadow-sm" : "bg-[var(--surface)] border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--bg)]"}`}
              >
                <MaterialIcon icon={t.icon} style={{ fontSize: 15 }} />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Total Schools"
                  value={dataLoading ? "\u2026" : stats.totalSchools}
                  sub={`${stats.activeSchools} active \u00b7 ${stats.trialSchools} trial`}
                  icon="school"
                  color="var(--navy)"
                />
                <StatCard
                  label="Total Students"
                  value={dataLoading ? "\u2026" : stats.totalStudents.toLocaleString()}
                  sub="Across all schools"
                  icon="groups"
                  color="#0d9488"
                />
                <StatCard
                  label="System Users"
                  value={dataLoading ? "\u2026" : stats.totalUsers.toLocaleString()}
                  sub="Staff + admin accounts"
                  icon="manage_accounts"
                  color="#7c3aed"
                />
                <StatCard
                  label="New This Month"
                  value={dataLoading ? "\u2026" : stats.newThisMonth}
                  sub="School registrations"
                  icon="add_business"
                  color="#f59e0b"
                />
              </div>

              {alerts.length > 0 && (
                <div className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MaterialIcon icon="warning" style={{ fontSize: 16, color: "#b45309" }} />
                    <span className="text-[12px] font-bold text-[#b45309]">Needs Attention ({alerts.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {alerts.slice(0, 6).map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl bg-white border border-[#fde68a] px-3 py-2.5"
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${a.color}18`, color: a.color }}
                        >
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
                    <button
                      onClick={() => setTab("schools")}
                      className="text-[11px] text-[var(--navy)] font-semibold hover:underline flex items-center gap-1"
                    >
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
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSchool(s)}
                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg)] transition-colors text-left group"
                          >
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold overflow-hidden"
                              style={{
                                background: s.primary_color || "var(--navy)",
                              }}
                            >
                              {s.logo_url ? (
                                <Image src={s.logo_url} alt={s.name} className="w-full h-full object-cover" />
                              ) : (
                                s.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-semibold text-[var(--t1)] truncate group-hover:text-[var(--navy)]">
                                  {s.name}
                                </span>
                                {s.is_tester && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
                                    TESTER
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[var(--t3)]">
                                {s.district} \u00b7 {s.school_type}
                                {s.student_count ? ` \u00b7 ${s.student_count.toLocaleString()} students` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Badge status={s.subscription_status} />
                              <PlanBadge plan={s.subscription_plan} />
                            </div>
                            <div className="text-[10px] text-[var(--t4)] flex-shrink-0 ml-1">
                              {timeSince(s.created_at)}
                            </div>
                          </button>
                        ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-4">Subscription Mix</div>
                    {!dataLoading && planBreakdown.length === 0 && (
                      <p className="text-[12px] text-[var(--t3)]">No data yet</p>
                    )}
                    <div className="space-y-3">
                      {planBreakdown.map(({ plan, count }) => (
                        <div key={plan}>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: PLAN_COLORS[plan] || "#64748b" }}
                            >
                              {PLAN_LABELS[plan] || plan}
                            </span>
                            <span className="text-[12px] font-bold text-[var(--t1)]">{count}</span>
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
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-3">School Status</div>
                    <div className="space-y-2">
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
                          color: "#1d4ed8",
                          bg: "#dbeafe",
                          icon: "schedule",
                        },
                        {
                          label: "Expired/Suspended",
                          value: stats.expiredSchools,
                          color: "#dc2626",
                          bg: "#fee2e2",
                          icon: "error",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                          style={{ background: item.bg }}
                        >
                          <MaterialIcon icon={item.icon} style={{ fontSize: 15, color: item.color }} />
                          <span className="text-[12px] font-semibold flex-1" style={{ color: item.color }}>
                            {item.label}
                          </span>
                          <span className="text-[15px] font-extrabold font-['Sora']" style={{ color: item.color }}>
                            {dataLoading ? "\u2026" : item.value}
                          </span>
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
                    {
                      label: "Manage Schools",
                      desc: "View, edit, suspend",
                      icon: "domain",
                      color: "var(--navy)",
                      action: () => setTab("schools"),
                    },
                    {
                      label: "Manage Users",
                      desc: "All staff & admin accounts",
                      icon: "manage_accounts",
                      color: "#7c3aed",
                      action: () => setTab("users"),
                    },
                    {
                      label: "Register School",
                      desc: "Create & provision a school",
                      icon: "add_business",
                      color: "#16a34a",
                      action: () => setTab("register"),
                    },
                    {
                      label: "Platform Settings",
                      desc: "Global config & flags",
                      icon: "tune",
                      color: "#0284c7",
                      action: () => setTab("settings"),
                    },
                  ].map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.action}
                      className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex gap-3 items-start transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${a.color}18`, color: a.color }}
                      >
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
                Logged in as <strong className="text-[var(--t1)]">{user.full_name}</strong> \u00b7 Super Admin \u00b7
                Full platform access
              </div>
            </div>
          )}

          {tab === "schools" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <MaterialIcon
                    icon="search"
                    style={{
                      fontSize: 16,
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--t3)",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search by name, district, code\u2026"
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] pl-9 pr-4 py-2.5 text-[13px] outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[12px] text-[var(--t2)] outline-none focus:border-[var(--primary)]"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                  <option value="past_due">Past Due</option>
                  <option value="canceled">Canceled</option>
                </select>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[12px] text-[var(--t2)] outline-none focus:border-[var(--primary)]"
                >
                  <option value="all">All Plans</option>
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="lifetime">Lifetime</option>
                  <option value="free_trial">Free Trial</option>
                </select>
                <select
                  value={testerFilter}
                  onChange={(e) => setTesterFilter(e.target.value as "all" | "tester" | "normal")}
                  className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[12px] text-[var(--t2)] outline-none focus:border-[var(--primary)]"
                >
                  <option value="all">All Accounts</option>
                  <option value="tester">Testers Only</option>
                  <option value="normal">Normal Only</option>
                </select>
                <div className="text-[12px] text-[var(--t3)] flex items-center px-2">
                  {filteredSchools.length} of {schools.length}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {dataLoading ? (
                  <div className="py-16 flex justify-center">
                    <div className="w-7 h-7 border-[3px] border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredSchools.length === 0 ? (
                  <div className="py-16 text-center text-[13px] text-[var(--t3)]">No schools match your filters</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                          {["School", "District", "Plan", "Status", "Students", "Joined", "Actions"].map((h) => (
                            <th
                              key={h}
                              className={`px-4 py-3 text-[10px] font-bold text-[var(--t3)] uppercase tracking-wide ${h === "Students" ? "text-right" : h === "Actions" ? "text-center" : "text-left"}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {filteredSchools.map((s) => (
                          <tr key={s.id} className="hover:bg-[var(--bg)] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden"
                                  style={{
                                    background: s.primary_color || "var(--navy)",
                                  }}
                                >
                                  {s.logo_url ? (
                                    <Image src={s.logo_url} alt={s.name} className="w-full h-full object-cover" />
                                  ) : (
                                    s.name.slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[12px] font-semibold text-[var(--t1)] truncate max-w-[160px]">
                                    {s.name}
                                  </div>
                                  <div className="text-[10px] text-[var(--t3)]">
                                    {s.school_code} \u00b7 {s.school_type}
                                  </div>
                                </div>
                                {s.is_tester && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
                                    TESTER
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[12px] text-[var(--t2)]">{s.district}</td>
                            <td className="px-4 py-3">
                              <PlanBadge plan={s.subscription_plan} />
                            </td>
                            <td className="px-4 py-3">
                              <Badge status={s.subscription_status} />
                            </td>
                            <td className="px-4 py-3 text-right text-[12px] font-semibold text-[var(--t1)]">
                              {s.student_count?.toLocaleString() ?? "\u2014"}
                            </td>
                            <td className="px-4 py-3 text-[11px] text-[var(--t3)]">{fmtDate(s.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  title="Edit / Manage"
                                  onClick={() => setSelectedSchool(s)}
                                  className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--t2)] transition-colors"
                                >
                                  <MaterialIcon icon="edit" style={{ fontSize: 15 }} />
                                </button>
                                {s.subscription_status !== "suspended" ? (
                                  <button
                                    type="button"
                                    title="Suspend"
                                    onClick={() => suspendSchool(s)}
                                    className="p-1.5 rounded-lg hover:bg-[#fee2e2] text-[#dc2626] transition-colors"
                                  >
                                    <MaterialIcon icon="block" style={{ fontSize: 15 }} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    title="Reactivate"
                                    onClick={() => reactivateSchool(s)}
                                    className="p-1.5 rounded-lg hover:bg-[#ccfbf1] text-[#0d9488] transition-colors"
                                  >
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
                  <MaterialIcon
                    icon="search"
                    style={{
                      fontSize: 16,
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--t3)",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search by name, phone, role, school\u2026"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] pl-9 pr-4 py-2.5 text-[13px] outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[12px] text-[var(--t2)] outline-none focus:border-[var(--primary)]"
                >
                  <option value="all">All Roles</option>
                  {[
                    "super_admin",
                    "school_admin",
                    "headmaster",
                    "bursar",
                    "teacher",
                    "dean_of_studies",
                    "secretary",
                    "dorm_master",
                    "parent",
                    "student",
                  ].map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <div className="text-[12px] text-[var(--t3)] flex items-center px-2">
                  {filteredUsers.length} of {users.length}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {dataLoading ? (
                  <div className="py-16 flex justify-center">
                    <div className="w-7 h-7 border-[3px] border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-16 text-center text-[13px] text-[var(--t3)]">No users found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                          {["User", "Role", "School", "Joined", "Status", "Actions"].map((h) => (
                            <th
                              key={h}
                              className={`px-4 py-3 text-[10px] font-bold text-[var(--t3)] uppercase tracking-wide ${h === "Status" || h === "Actions" ? "text-center" : "text-left"}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {filteredUsers.map((u) => {
                          const rc = ROLE_COLORS[u.role] || "#64748b";
                          return (
                            <tr
                              key={u.id}
                              className={`transition-colors hover:bg-[var(--bg)] ${!u.is_active ? "opacity-50" : ""}`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                                    style={{ background: rc }}
                                  >
                                    {u.full_name?.slice(0, 1).toUpperCase() || "?"}
                                  </div>
                                  <div>
                                    <div className="text-[12px] font-semibold text-[var(--t1)]">
                                      {u.full_name || "\u2014"}
                                    </div>
                                    <div className="text-[10px] text-[var(--t3)]">{u.phone}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                                  style={{ background: `${rc}18`, color: rc }}
                                >
                                  {u.role.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[12px] text-[var(--t2)] max-w-[160px] truncate">
                                {u.school_name || "\u2014"}
                              </td>
                              <td className="px-4 py-3 text-[11px] text-[var(--t3)]">{fmtDate(u.created_at)}</td>
                              <td className="px-4 py-3 text-center">
                                {u.is_active ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ccfbf1] text-[#0d9488]">
                                    Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f1f5f9] text-[#64748b]">
                                    Inactive
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <UserActions
                                  user={u}
                                  onUpdated={(patch) =>
                                    setUsers((prev) => prev.map((x) => (x.id === patch.id ? { ...x, ...patch } : x)))
                                  }
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
                <p className="text-[12px] text-[var(--t3)] mt-0.5">
                  The school will be created on trial by default. Adjust plan and duration below.
                </p>
              </div>
              <RegisterSchoolForm
                onDone={() => {
                  loadData();
                  setTab("schools");
                }}
              />
            </div>
          )}

          {tab === "modules" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">Module Approvals</h2>
                  <p className="text-[12px] text-[var(--t3)] mt-0.5">
                    Review and approve pending module requests from schools.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setModulesLoading(true);
                    try {
                      const res = await fetch("/api/modules/entitlements/?scope=all_pending");
                      const body = await res.json();
                      setPendingModules(body.data?.requests || []);
                    } catch (err) {
                      logger.warn("Modules refresh failed:", err);
                      toast.error("Failed to load pending requests");
                    } finally {
                      setModulesLoading(false);
                    }
                  }}
                  disabled={modulesLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] text-[var(--t2)] text-[12px] font-semibold transition-colors disabled:opacity-40"
                >
                  <MaterialIcon
                    icon="refresh"
                    style={{ fontSize: 15 }}
                    className={modulesLoading ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>

              {pendingModules.length === 0 && !modulesLoading && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                  <MaterialIcon icon="check_circle" style={{ fontSize: 36, color: "var(--t3)" }} />
                  <p className="text-[13px] text-[var(--t3)] mt-2">No pending module requests.</p>
                </div>
              )}

              {modulesLoading && (
                <div className="flex items-center justify-center py-12">
                  <OwlLoader />
                </div>
              )}

              {pendingModules.length > 0 && (
                <div className="space-y-3">
                  {pendingModules.map((req: any) => (
                    <div
                      key={`${req.school_id}-${req.module_key}`}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] truncate">
                            {req.school_name}
                          </span>
                          <span className="text-[10px] text-[var(--t3)]">{req.school_code}</span>
                        </div>
                        <p className="text-[12px] text-[var(--t2)] mt-0.5">
                          Requesting <strong>{req.module_name}</strong>
                          {req.district && <> &middot; {req.district}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/modules/entitlements/", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  schoolId: req.school_id,
                                  moduleKey: req.module_key,
                                  action: "approve",
                                }),
                              });
                              if (!res.ok) throw new Error("Approval failed");
                              toast.success(`${req.module_name} approved for ${req.school_name}`);
                              setPendingModules((prev) =>
                                prev.filter(
                                  (r: any) => !(r.school_id === req.school_id && r.module_key === req.module_key),
                                ),
                              );
                            } catch (err) {
                              logger.warn("Module approval failed:", err);
                              toast.error("Failed to approve module");
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/modules/entitlements/", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  schoolId: req.school_id,
                                  moduleKey: req.module_key,
                                  action: "reject",
                                }),
                              });
                              if (!res.ok) throw new Error("Rejection failed");
                              toast.success(`Request for ${req.module_name} rejected`);
                              setPendingModules((prev) =>
                                prev.filter(
                                  (r: any) => !(r.school_id === req.school_id && r.module_key === req.module_key),
                                ),
                              );
                            } catch (err) {
                              logger.warn("Module rejection failed:", err);
                              toast.error("Failed to reject request");
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 text-[11px] font-bold hover:bg-red-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "marketers" && <MarketersTab />}

          {tab === "audit" && <AuditLogTab />}

          {tab === "activity" && <AppActivityTab />}

          {tab === "settings" && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">Platform Settings</h2>
                <p className="text-[12px] text-[var(--t3)] mt-0.5">Global configuration for the SkoolMate platform.</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {[
                  {
                    key: "demo_mode" as const,
                    label: "Demo Mode",
                    desc: "Allow demo accounts for sales demos",
                    icon: "science",
                    color: "#7c3aed",
                  },
                  {
                    key: "sms_enabled" as const,
                    label: "Bulk SMS Gateway",
                    desc: "Enable platform-wide SMS functionality",
                    icon: "sms",
                    color: "#0284c7",
                  },
                  {
                    key: "payment_enabled" as const,
                    label: "Mobile Money Payments",
                    desc: "Enable fee collection via MoMo / Airtel",
                    icon: "payments",
                    color: "#0d9488",
                  },
                ].map((item, idx, arr) => (
                  <div
                    key={item.key}
                    className={`flex items-center gap-4 px-5 py-4 ${idx < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `${item.color}18`,
                        color: item.color,
                      }}
                    >
                      <MaterialIcon icon={item.icon} style={{ fontSize: 18 }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[var(--t1)]">{item.label}</div>
                      <div className="text-[11px] text-[var(--t3)]">{item.desc}</div>
                    </div>
                    <Toggle
                      value={settings[item.key]}
                      onChange={(v) => setSettings((s) => ({ ...s, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
                <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-1">Support Contact</div>
                {[
                  {
                    label: "Support Email",
                    key: "support_email" as const,
                    type: "email",
                    placeholder: "support@omuto.org",
                  },
                  {
                    label: "Support Phone",
                    key: "support_phone" as const,
                    type: "tel",
                    placeholder: "+256 700 287 030",
                  },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      value={settings[f.key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
                    Default Trial Duration (days)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    value={settings.trial_days}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        trial_days: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={saveSettings}
                disabled={settingsSaving}
                className="w-full rounded-xl bg-[var(--primary)] text-white font-bold text-[13px] py-3 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {settingsSaving ? "Saving\u2026" : "Save Platform Settings"}
              </button>
            </div>
          )}
        </div>
      </div>
    </PageErrorBoundary>
  );
}
