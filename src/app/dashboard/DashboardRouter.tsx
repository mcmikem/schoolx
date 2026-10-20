"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardSkeleton } from "@/components/Skeletons";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { greetingFor } from "@/lib/utils";

const HeadmasterDashboard = dynamic(() => import("./dashboards/HeadmasterDashboard"), {
  loading: () => <HeadmasterDashboardLoading />,
});
const DeanDashboard = dynamic(() => import("./dashboards/DeanDashboard"), { loading: () => <DashboardSkeleton /> });
const BursarDashboard = dynamic(() => import("./dashboards/BursarDashboard"), { loading: () => <DashboardSkeleton /> });
const TeacherDashboard = dynamic(() => import("./dashboards/TeacherDashboard"), {
  loading: () => <DashboardSkeleton />,
});
const SuperAdminDashboard = dynamic(() => import("./dashboards/SuperAdminDashboard"), {
  loading: () => <DashboardSkeleton />,
});
const MarketerDashboard = dynamic(() => import("./dashboards/MarketerDashboard"), {
  loading: () => <DashboardSkeleton />,
});

function getFirstName(fullName?: string | null) {
  return fullName?.trim().split(" ").filter(Boolean)[0] || "User";
}

function HeadmasterDashboardLoading() {
  const { user, school } = useAuth();

  return (
    <main className="content !gap-4 overflow-x-hidden" aria-busy="true">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">School dashboard</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--t1)]">
          {greetingFor()}, {getFirstName(user?.full_name)}
        </h1>
        <p className="mt-1 text-sm text-[var(--t3)]">{school?.name || "Your school"}</p>
      </section>
      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["/dashboard/attendance", "how_to_reg", "Take attendance"],
          ["/dashboard/fees", "payments", "Record a payment"],
          ["/dashboard/students?action=add", "person_add", "Add a student"],
        ].map(([href, icon, label]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-24 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 font-semibold text-[var(--t1)]"
          >
            <span className="material-symbols-outlined text-[var(--primary)]" aria-hidden="true">
              {icon}
            </span>
            <span className="text-sm">{label}</span>
          </Link>
        ))}
      </nav>
      <p className="text-center text-xs text-[var(--t3)]">Loading your school summary…</p>
    </main>
  );
}

function RoleDashboardHeader({
  eyebrow,
  name,
  schoolName,
  context,
}: {
  eyebrow: string;
  name: string;
  schoolName: string;
  context: string;
}) {
  const greeting = greetingFor();

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 mb-4">
      {/* Brand wash. Tokens only, so it follows the theme in dark mode and
          costs nothing on low-end devices (no blur layers). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: "var(--primary-50)",
        }}
      />
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--primary)]">{eyebrow}</p>
        <h1 className="mt-1 font-headline text-xl sm:text-2xl font-bold tracking-tight text-[var(--t1)]">
          {greeting}, {name}
        </h1>
        <p className="mt-1 text-sm text-[var(--t3)]">
          {schoolName} · {context}
        </p>
      </div>
    </div>
  );
}

function RoleActionCard({
  href,
  icon,
  eyebrow,
  title,
  description,
}: {
  href: string;
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-container-low)] active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--t4)]">{eyebrow}</span>
        <span className="material-symbols-outlined text-[var(--primary)]">{icon}</span>
      </div>
      <p className="mt-2 text-base font-bold text-[var(--t1)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--t3)]">{description}</p>
    </Link>
  );
}

function SecretaryDashboard() {
  const { user, school } = useAuth();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <RoleDashboardHeader
        eyebrow="Office dashboard"
        name={getFirstName(user?.full_name)}
        schoolName={school?.name || "My School"}
        context="Communication and front office desk"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RoleActionCard
          href="/dashboard/messages?tab=notices"
          icon="campaign"
          eyebrow="Notices"
          title="School notices"
          description="View announcements and visitor log updates."
        />
        <RoleActionCard
          href="/dashboard/messages"
          icon="chat"
          eyebrow="Communication"
          title="Messages"
          description="Manage inbox, broadcasts, and office replies."
        />
      </div>
    </div>
  );
}

function DormMasterDashboard() {
  const { user, school } = useAuth();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <RoleDashboardHeader
        eyebrow="Dorm dashboard"
        name={getFirstName(user?.full_name)}
        schoolName={school?.name || "My School"}
        context="Boarding operations and student welfare"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RoleActionCard
          href="/dashboard/dorm"
          icon="bed"
          eyebrow="Management"
          title="Dorm rooms"
          description="Assignments, beds, and boarding allocations."
        />
        <RoleActionCard
          href="/dashboard/dorm-attendance"
          icon="nightlight"
          eyebrow="Night check"
          title="Dorm attendance"
          description="Track student presence and absences nightly."
        />
        <RoleActionCard
          href="/dashboard/health"
          icon="medical_services"
          eyebrow="Welfare"
          title="Health records"
          description="Medical visits, issues, and dorm health logs."
        />
      </div>
    </div>
  );
}

export default function DashboardRouter() {
  const { user, school, loading, authInitialized, profileDegraded, signOut } = useAuth();
  const router = useRouter();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [reconnectFailed, setReconnectFailed] = useState(false);

  const requiresSetup =
    !!user &&
    !profileDegraded &&
    user.role !== "super_admin" &&
    user.role !== "marketer" &&
    (!school || !school.name || school.name === "My School");

  useEffect(() => {
    if (!authInitialized || !requiresSetup) return;

    const redirectTimer = window.setTimeout(() => {
      router.replace("/dashboard/setup-wizard");
    }, 0);

    return () => window.clearTimeout(redirectTimer);
  }, [authInitialized, requiresSetup, router]);

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoadingTimedOut(true);
      logger.warn("[DashboardRouter] loading timed out, continuing with best available state");
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  // If we're stuck in degraded-with-no-school state, turn the perpetual
  // "Reconnecting..." spinner into an actionable error after a grace period.
  useEffect(() => {
    if (!profileDegraded || school) {
      setReconnectFailed(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setReconnectFailed(true);
      logger.warn("[DashboardRouter] school reconnect timed out — surfacing retry UI");
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [profileDegraded, school]);

  // Memoised so the dependency stays stable across renders. Building the
  // fallback inline made a fresh array every render, which defeated the memo
  // below and re-derived the dashboard list on every single render.
  const roles = useMemo<readonly string[]>(
    () => (user?.roles?.length ? user.roles : user?.role ? [user.role as string] : []),
    [user?.roles, user?.role],
  );

  // Which dashboard this person actually qualifies for. A headmaster who also
  // teaches is both, and should be able to pick — but only between dashboards
  // they really hold, never one they merely inherited via role equivalence.
  const eligibleDashboards = useMemo(() => {
    const available: Record<string, () => JSX.Element> = {
      headmaster: () => <HeadmasterDashboard />,
      dean_of_studies: () => <DeanDashboard />,
      bursar: () => <BursarDashboard />,
      teacher: () => <TeacherDashboard />,
      secretary: () => <SecretaryDashboard />,
      dorm_master: () => <DormMasterDashboard />,
      marketer: () => <MarketerDashboard />,
    };
    const ordered = roles.map((candidate) => String(candidate));
    if (ordered.includes("headmaster") || ordered.includes("admin") || ordered.includes("school_admin")) {
      if (!ordered.includes("headmaster")) ordered.unshift("headmaster");
    }
    return ordered.filter((candidate) => candidate in available).map((candidate) => available[candidate]);
  }, [roles]);

  if (loading && !loadingTimedOut) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <DashboardSkeleton />;
  }

  // Cold start / outage: a valid session exists but school data hasn't loaded
  // yet. Wait a grace period for the background profile heal instead of bouncing
  // the admin into the setup wizard with an empty school — but never hang on an
  // infinite spinner (cold start that never recovers, missing service-role env
  // var, or an unreachable profile endpoint).
  if (profileDegraded && !school) {
    if (reconnectFailed) {
      return (
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)]">
              <span className="material-symbols-outlined text-2xl text-[var(--amber)]">wifi_off</span>
            </div>
            <h1 className="text-xl font-bold text-[var(--t1)]">We couldn&apos;t load your school&apos;s data</h1>
            <p className="mt-2 text-sm text-[var(--t2)]">
              Your session is active, but we&apos;re still having trouble reaching your account. Check your internet
              connection and try again.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setReconnectFailed(false);
                  router.refresh();
                }}
                className="rounded-xl bg-[var(--primary)] text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--t1)] hover:bg-[var(--surface)] transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)] mx-auto mb-4" />
          <p className="text-[var(--t2)] text-sm">Reconnecting to your school&apos;s data...</p>
        </div>
      </div>
    );
  }

  // Super admin bypasses school check
  if (user.role === "super_admin") {
    return <SuperAdminDashboard />;
  }

  // Centralized setup check: ensure school is initialized
  if (requiresSetup) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)] mx-auto mb-4" />
          <p className="text-[var(--t2)] text-sm">Setting up your school...</p>
        </div>
      </div>
    );
  }

  // Their remembered choice, when it is one they are still eligible for.
  const preferred = user.preferred_dashboard ?? null;
  const canUsePreferred = preferred != null && eligibleDashboards.length > 0 && roles.map(String).includes(preferred);

  if (eligibleDashboards.length === 0) {
    return <UnknownRoleScreen role={user.role as string} onSignOut={signOut} />;
  }
  if (canUsePreferred) {
    const index = roles.map(String).indexOf(preferred);
    if (index >= 0 && index < eligibleDashboards.length) return eligibleDashboards[index]();
  }
  return eligibleDashboards[0]();
}

/**
 * Reached only when user.role is not one the app can render a dashboard for —
 * typically a role revoked in the staff table, or a profile row that never
 * synced from auth.users.
 *
 * This is deliberately NOT the teacher dashboard. Defaulting here made a broken
 * account indistinguishable from a real teacher: same nav, same class-scoped
 * data, no signal that anything was wrong. It now says what happened and offers
 * the two real ways out.
 */
function UnknownRoleScreen({ role, onSignOut }: { role: string; onSignOut: () => Promise<void> | void }) {
  const router = useRouter();

  useEffect(() => {
    logger.error("[DashboardRouter] Unrecognised role %s - showing recovery screen instead of a role dashboard", role);
  }, [role]);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)]">
          <span className="material-symbols-outlined text-2xl text-[var(--amber)]">person_alert</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--t1)]">Your access needs attention</h1>
        <p className="mt-2 text-sm text-[var(--t2)]">
          Your account has a role this app doesn&apos;t recognise
          {role ? (
            <>
              {" "}
              (<code className="rounded bg-[var(--surface-container)] px-1 py-0.5 text-xs">{role}</code>)
            </>
          ) : null}
          . Your access is paused until an administrator sets it.
        </p>
        <p className="mt-2 text-sm text-[var(--t2)]">
          Ask your headmaster or administrator to check your staff record, then sign back in.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-xl bg-[var(--primary)] text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Check again
          </button>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--t1)] hover:bg-[var(--surface)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
