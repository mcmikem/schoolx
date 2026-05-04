"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  canUseModule,
  DEFAULT_FEATURE_STAGE,
  FeatureStage,
} from "@/lib/featureStages";

export function useParentPortalGuard() {
  const { user, school, authInitialized, isDemo } = useAuth();
  const router = useRouter();
  const featureStage =
    (school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE;
  const parentPortalEnabled =
    isDemo || canUseModule(featureStage, "parentPortal");

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
      router.replace("/parent-portal");
    }
  }, [user, authInitialized, isDemo, parentPortalEnabled, router]);

  const isAuthorized =
    (isDemo || user?.role === "parent") && parentPortalEnabled;
  const isChecking = !authInitialized || (!isDemo && !isAuthorized);

  return { isAuthorized, isChecking };
}
