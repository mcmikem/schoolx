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
  const { user, school, loading, isDemo } = useAuth();
  const router = useRouter();
  const featureStage =
    (school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE;
  const parentPortalEnabled =
    isDemo || canUseModule(featureStage, "parentPortal");

  useEffect(() => {
    if (loading) return;

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
  }, [user, loading, isDemo, parentPortalEnabled, router]);

  const isAuthorized =
    (isDemo || user?.role === "parent") && parentPortalEnabled;
  const isChecking = loading || (!isDemo && !isAuthorized);

  return { isAuthorized, isChecking };
}
