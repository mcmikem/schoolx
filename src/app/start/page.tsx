"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

function getSavedDashboardPath(): string {
  try {
    const value = decodeURIComponent(
      document.cookie.match(/(?:^|;\s*)skoolmate_last_dashboard_path=([^;]*)/)?.[1] || "",
    );
    return /^\/dashboard(?:\/[a-zA-Z0-9._~-]+)*\/?$/.test(value) ? value : "/dashboard/";
  } catch {
    return "/dashboard/";
  }
}

export default function StartPage() {
  const router = useRouter();
  const { user, loading, authInitialized, isDemo } = useAuth();

  useEffect(() => {
    if (!authInitialized || loading) return;
    if (!user && !isDemo) {
      router.replace("/login/");
      return;
    }

    if (user?.role === "super_admin") {
      router.replace("/super-admin/");
    } else if (user?.role === "parent") {
      router.replace("/parent-portal/");
    } else if (user?.role === "student") {
      router.replace("/student-portal/");
    } else {
      router.replace(getSavedDashboardPath());
    }
  }, [authInitialized, isDemo, loading, router, user]);

  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg)] px-6"
      aria-busy="true"
      aria-label="Opening SkoolMate"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)]"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-[var(--t2)]">Opening SkoolMate…</p>
      </div>
    </main>
  );
}
