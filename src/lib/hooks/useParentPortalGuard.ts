"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { canUseModule, DEFAULT_FEATURE_STAGE, FeatureStage } from "@/lib/featureStages";

export function useParentPortalGuard() {
  const { user, school, authInitialized, isDemo } = useAuth();
  const router = useRouter();
  const featureStage = (school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE;
  const parentPortalEnabled = isDemo || canUseModule(featureStage, "parent_portal");

  useEffect(() => {
    if (!authInitialized) return;

    if (!user && !isDemo) {
      router.replace("/login");
      return;
    }

    if (user && !isDemo && user.role !== "parent") {
      router.replace("/dashboard");
      return;
    }

    if (user && !isDemo && !parentPortalEnabled) {
      router.replace("/dashboard/no-access?reason=feature&from=%2Fparent-portal&module=parentPortal");
    }
  }, [user, authInitialized, isDemo, parentPortalEnabled, router]);

  const isAuthorized = (isDemo || user?.role === "parent") && parentPortalEnabled;
  // Only check while auth is initializing. Once initialized, isAuthorized is
  // definitive — if false, the useEffect above handles the redirect.
  const isChecking = !authInitialized;

  return { isAuthorized, isChecking };
}
