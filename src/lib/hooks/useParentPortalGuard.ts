"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function useParentPortalGuard() {
  const { user, loading, isDemo } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user && !isDemo) {
      router.replace("/parent/login");
      return;
    }

    if (user && !isDemo && user.role !== "parent") {
      router.replace("/dashboard");
    }
  }, [user, loading, isDemo, router]);

  const isAuthorized = isDemo || user?.role === "parent";
  const isChecking = loading || (!isDemo && !isAuthorized);

  return { isAuthorized, isChecking };
}
