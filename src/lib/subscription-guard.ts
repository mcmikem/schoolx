import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toLegacyModuleKey } from "./modules/catalog";

type SubscriptionStatus = "active" | "trial" | "past_due" | "expired" | "canceled" | "suspended" | "unpaid";

type PlanTier = "starter" | "growth" | "enterprise" | "lifetime";
type BillingMode = "full_suite" | "modular";

const PLAN_TIER_LEVELS: Record<PlanTier, number> = {
  starter: 1,
  growth: 2,
  enterprise: 3,
  lifetime: 4,
};

// Days after expiry during which an expired school keeps working (with a
// renewal warning) instead of hitting a hard lockout mid-term.
export const GRACE_PERIOD_DAYS = 14;

export async function requireActiveSubscription(params: {
  supabase: any;
  schoolId: string;
  requiredPlan?: PlanTier;
}): Promise<{ ok: true; school: any; warning?: string } | { ok: false; response: NextResponse }> {
  const { supabase, schoolId, requiredPlan } = params;

  const { data: school, error } = await supabase
    .from("schools")
    .select("id, name, subscription_status, subscription_plan, trial_ends_at, next_payment_date")
    .eq("id", schoolId)
    .maybeSingle();

  if (error || !school) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "School not found" }, { status: 404 }),
    };
  }

  const status = school.subscription_status as SubscriptionStatus;
  const plan = school.subscription_plan as PlanTier;

  // Tester schools bypass all subscription checks
  if (school.is_tester) {
    return { ok: true, school };
  }

  if (status === "active" || status === "trial") {
    if (requiredPlan) {
      const currentTier = PLAN_TIER_LEVELS[plan] ?? 0;
      const requiredTier = PLAN_TIER_LEVELS[requiredPlan] ?? 0;
      if (currentTier < requiredTier) {
        return {
          ok: false,
          response: NextResponse.json(
            {
              success: false,
              error: `This feature requires a ${requiredPlan} plan or higher. Your current plan is ${plan}.`,
              currentPlan: plan,
              requiredPlan,
            },
            { status: 403 },
          ),
        };
      }
    }
    return { ok: true, school };
  }

  if (status === "past_due") {
    if (requiredPlan) {
      const currentTier = PLAN_TIER_LEVELS[plan] ?? 0;
      const requiredTier = PLAN_TIER_LEVELS[requiredPlan] ?? 0;
      if (currentTier < requiredTier) {
        return {
          ok: false,
          response: NextResponse.json(
            {
              success: false,
              error: `Your subscription has a payment issue and requires a ${requiredPlan} plan. Please update your payment method.`,
              currentPlan: plan,
              requiredPlan,
            },
            { status: 402 },
          ),
        };
      }
    }
    return {
      ok: true,
      school,
      warning:
        "Your subscription payment is past due. Please update your payment method to avoid service interruption.",
    };
  }

  const deniedMessages: Record<string, string> = {
    canceled: "Your subscription has been canceled. Please resubscribe to continue.",
    suspended: "Your subscription has been suspended. Please contact support.",
    unpaid: "Your subscription payment is unpaid. Please settle your balance.",
  };

  // Grace period: a recently-expired school (trial or paid) keeps working for
  // GRACE_PERIOD_DAYS after expiry with a warning, instead of a hard lockout
  // mid-term. Anchored on next_payment_date (paid) else trial_ends_at (trial);
  // no anchor (legacy rows) still denies as before — never fail open.
  if (status === "expired") {
    const anchorRaw = school.next_payment_date || school.trial_ends_at;
    const anchorMs = anchorRaw ? new Date(anchorRaw).getTime() : NaN;
    if (Number.isFinite(anchorMs)) {
      const daysSinceExpiry = Math.floor((Date.now() - anchorMs) / (1000 * 60 * 60 * 24));
      const daysLeft = GRACE_PERIOD_DAYS - daysSinceExpiry;
      if (daysLeft >= 0) {
        if (requiredPlan) {
          const currentTier = PLAN_TIER_LEVELS[plan] ?? 0;
          const requiredTier = PLAN_TIER_LEVELS[requiredPlan] ?? 0;
          if (currentTier < requiredTier) {
            return {
              ok: false,
              response: NextResponse.json(
                {
                  success: false,
                  error: `This feature requires a ${requiredPlan} plan or higher. Your current plan is ${plan}.`,
                  currentPlan: plan,
                  requiredPlan,
                },
                { status: 403 },
              ),
            };
          }
        }
        return {
          ok: true,
          school,
          warning: `Your subscription expired ${daysSinceExpiry} day${daysSinceExpiry === 1 ? "" : "s"} ago. ${daysLeft} grace day${daysLeft === 1 ? "" : "s"} remaining — please renew to avoid interruption.`,
        };
      }
    }
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Your subscription has expired. Please renew to continue.",
          subscriptionStatus: status,
        },
        { status: 403 },
      ),
    };
  }

  const message = deniedMessages[status] || "Your subscription is not active.";

  return {
    ok: false,
    response: NextResponse.json({ success: false, error: message, subscriptionStatus: status }, { status: 403 }),
  };
}

export async function requireModuleEntitlement(params: {
  supabase: any;
  schoolId: string;
  moduleKey: string;
}): Promise<{ ok: true; school: any } | { ok: false; response: NextResponse }> {
  const { supabase, schoolId, moduleKey } = params;

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("id, billing_mode")
    .eq("id", schoolId)
    .maybeSingle();

  // If modular schema is missing during rollout, fail open for compatibility.
  if (schoolError && ["42P01", "42703"].includes(schoolError.code || "")) {
    return { ok: true, school: { id: schoolId, billing_mode: "full_suite" } };
  }

  if (schoolError || !school) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "School not found" }, { status: 404 }),
    };
  }

  const billingMode = (school.billing_mode || "full_suite") as BillingMode;
  if (billingMode === "full_suite") {
    return { ok: true, school };
  }

  // Check both new unified key and legacy DB key for backward compat
  const legacyKey = toLegacyModuleKey(moduleKey);
  const moduleKeys = legacyKey ? [moduleKey, legacyKey] : [moduleKey];

  const { data: entitlement, error: entitlementError } = await supabase
    .from("school_module_entitlements")
    .select("status, ends_at")
    .eq("school_id", schoolId)
    .in("module_key", moduleKeys)
    .maybeSingle();

  if (entitlementError && ["42P01", "42703"].includes(entitlementError.code || "")) {
    return { ok: true, school };
  }

  if (entitlementError) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Failed to verify module entitlement" }, { status: 500 }),
    };
  }

  const isActiveState = entitlement?.status === "active" || entitlement?.status === "trial";
  const hasValidEndDate = !entitlement?.ends_at || new Date(entitlement.ends_at).getTime() > Date.now();

  if (isActiveState && hasValidEndDate) {
    return { ok: true, school };
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        success: false,
        error: `This feature requires the ${moduleKey} module in modular billing mode.`,
        moduleKey,
      },
      { status: 403 },
    ),
  };
}

export function getPlanTierLevel(plan: PlanTier): number {
  return PLAN_TIER_LEVELS[plan] ?? 0;
}

export function meetsPlanRequirement(currentPlan: PlanTier, requiredPlan: PlanTier): boolean {
  return getPlanTierLevel(currentPlan) >= getPlanTierLevel(requiredPlan);
}
