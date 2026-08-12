"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardSkeleton } from "@/components/Skeletons";
import { logger } from "@/lib/logger";

const HeadmasterDashboard = dynamic(() => import("./dashboards/HeadmasterDashboard"), {
  loading: () => <DashboardSkeleton />,
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

function SecretaryDashboard() {
  const { user, school } = useAuth();
  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12 ? "Good Morning" : currentDate.getHours() < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-[28px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-4 sm:p-6">
        <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-[#b7dfd8]/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-[#d8e9fb]/60 blur-3xl" />

        <div className="relative z-10 mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4a7f76]">Office dashboard</p>
          <h1 className="mt-1 font-['Sora'] text-2xl font-semibold tracking-[-0.03em] text-[#19344a]">
            {greeting}, {getFirstName(user?.full_name)}
          </h1>
          <p className="mt-1 text-sm text-[#5f7788]">{school?.name} · Communication and front office desk</p>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            href="/dashboard/messages?tab=notices"
            className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8f9b]">Notices</span>
              <span className="material-symbols-outlined text-[#1f4a67]">campaign</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-[#1d3a4e]">School notices</p>
            <p className="mt-1 text-xs text-[#6f8794]">View announcements and visitor log updates.</p>
          </Link>

          <Link
            href="/dashboard/messages"
            className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8f9b]">Communication</span>
              <span className="material-symbols-outlined text-[#0b7a68]">chat</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-[#1d3a4e]">Messages</p>
            <p className="mt-1 text-xs text-[#6f8794]">Manage inbox, broadcasts, and office replies.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function DormMasterDashboard() {
  const { user, school } = useAuth();
  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12 ? "Good Morning" : currentDate.getHours() < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-[28px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-4 sm:p-6">
        <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-[#b7dfd8]/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-[#d8e9fb]/60 blur-3xl" />

        <div className="relative z-10 mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4a7f76]">Dorm dashboard</p>
          <h1 className="mt-1 font-['Sora'] text-2xl font-semibold tracking-[-0.03em] text-[#19344a]">
            {greeting}, {getFirstName(user?.full_name)}
          </h1>
          <p className="mt-1 text-sm text-[#5f7788]">{school?.name} · Boarding operations and student welfare</p>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/dashboard/dorm"
            className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8f9b]">Management</span>
              <span className="material-symbols-outlined text-[#1f4a67]">bed</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-[#1d3a4e]">Dorm rooms</p>
            <p className="mt-1 text-xs text-[#6f8794]">Assignments, beds, and boarding allocations.</p>
          </Link>

          <Link
            href="/dashboard/dorm-attendance"
            className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8f9b]">Night check</span>
              <span className="material-symbols-outlined text-[#0b7a68]">nightlight</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-[#1d3a4e]">Dorm attendance</p>
            <p className="mt-1 text-xs text-[#6f8794]">Track student presence and absences nightly.</p>
          </Link>

          <Link
            href="/dashboard/health"
            className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8f9b]">Welfare</span>
              <span className="material-symbols-outlined text-[#b86e00]">medical_services</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-[#1d3a4e]">Health records</p>
            <p className="mt-1 text-xs text-[#6f8794]">Medical visits, issues, and dorm health logs.</p>
          </Link>
        </div>
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

  const role = user.role as string;

  switch (role) {
    case "headmaster":
    case "school_admin":
    case "admin":
    case "board":
      return <HeadmasterDashboard />;
    case "dean_of_studies":
      return <DeanDashboard />;
    case "bursar":
      return <BursarDashboard />;
    case "teacher":
      return <TeacherDashboard />;
    case "secretary":
      return <SecretaryDashboard />;
    case "dorm_master":
      return <DormMasterDashboard />;
    case "marketer":
      return <MarketerDashboard />;
    default:
      logger.warn("[DashboardRouter] Unknown role:", role, "- defaulting to TeacherDashboard");
      return <TeacherDashboard />;
  }
}
