"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { canUseModule, DEFAULT_FEATURE_STAGE, FeatureStage } from "@/lib/featureStages";
import { hasAnyRole } from "@/lib/roles";

export function useParentPortalGuard() {
  const { user, school, authInitialized, isDemo } = useAuth();
  const router = useRouter();
  const featureStage = (school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE;
  const parentPortalEnabled = isDemo || canUseModule(featureStage, "parent_portal");

  /**
   * Does this person hold the parent hat?
   *
   * A teacher whose own children are in the school wears two hats, and the
   * portal belongs to the parent one. The guard used to read the PRIMARY role
   * only, so those teachers were bounced out of the portal -- told they were
   * not a parent, in a school where they plainly were.
   */
  const holdsParentHat = hasAnyRole(user?.roles?.length ? user.roles : user?.role, ["parent"]);

  useEffect(() => {
    if (!authInitialized) return;

    if (!user && !isDemo) {
      router.replace("/login");
      return;
    }

    if (user && !isDemo && !holdsParentHat) {
      router.replace("/dashboard");
      return;
    }

    if (user && !isDemo && !parentPortalEnabled) {
      router.replace("/dashboard/no-access?reason=feature&from=%2Fparent-portal&module=parentPortal");
    }
  }, [user, authInitialized, isDemo, parentPortalEnabled, holdsParentHat, router]);

  const isAuthorized = (isDemo || holdsParentHat) && parentPortalEnabled;
  // Only check while auth is initializing. Once initialized, isAuthorized is
  // definitive — if false, the useEffect above handles the redirect.
  const isChecking = !authInitialized;

  return { isAuthorized, isChecking };
}
