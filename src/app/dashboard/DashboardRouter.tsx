"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardSkeleton } from "@/components/Skeletons";
import { logger } from "@/lib/logger";

const HeadmasterDashboard = dynamic(() => import("./dashboards/HeadmasterDashboard"), { loading: () => <DashboardSkeleton /> });
const DeanDashboard = dynamic(() => import("./dashboards/DeanDashboard"), { loading: () => <DashboardSkeleton /> });
const BursarDashboard = dynamic(() => import("./dashboards/BursarDashboard"), { loading: () => <DashboardSkeleton /> });
const TeacherDashboard = dynamic(() => import("./dashboards/TeacherDashboard"), { loading: () => <DashboardSkeleton /> });
const SuperAdminDashboard = dynamic(() => import("./dashboards/SuperAdminDashboard"), { loading: () => <DashboardSkeleton /> });

function getFirstName(fullName?: string | null) {
  return fullName?.trim().split(" ").filter(Boolean)[0] || "User";
}

function SecretaryDashboard() {
  const { user, school } = useAuth();
  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12
      ? "Good Morning"
      : currentDate.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

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
          <Link href="/dashboard/messages?tab=notices" className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8f9b]">Notices</span>
              <span className="material-symbols-outlined text-[#1f4a67]">campaign</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-[#1d3a4e]">School notices</p>
            <p className="mt-1 text-xs text-[#6f8794]">View announcements and visitor log updates.</p>
          </Link>

          <Link href="/dashboard/messages" className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white">
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
    currentDate.getHours() < 12
      ? "Good Morning"
      : currentDate.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

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
          <Link href="/dashboard/dorm" className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8f9b]">Management</span>
              <span className="material-symbols-outlined text-[#1f4a67]">bed</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-[#1d3a4e]">Dorm rooms</p>
            <p className="mt-1 text-xs text-[#6f8794]">Assignments, beds, and boarding allocations.</p>
          </Link>

          <Link href="/dashboard/dorm-attendance" className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8f9b]">Night check</span>
              <span className="material-symbols-outlined text-[#0b7a68]">nightlight</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-[#1d3a4e]">Dorm attendance</p>
            <p className="mt-1 text-xs text-[#6f8794]">Track student presence and absences nightly.</p>
          </Link>

          <Link href="/dashboard/health" className="rounded-2xl border border-[#d8e7ea] bg-white/90 p-4 transition hover:bg-white">
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
  const { user, school, loading, authInitialized } = useAuth();
  const router = useRouter();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const requiresSetup =
    !!user &&
    user.role !== "super_admin" &&
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

  if (loading && !loadingTimedOut) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <DashboardSkeleton />;
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
    default:
      logger.warn(
        "[DashboardRouter] Unknown role:",
        role,
        "- defaulting to TeacherDashboard",
      );
      return <TeacherDashboard />;
  }
}
