import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type SubscriptionStatus =
  | "active"
  | "trial"
  | "past_due"
  | "expired"
  | "canceled"
  | "suspended"
  | "unpaid";

type PlanTier = "starter" | "growth" | "enterprise" | "lifetime";
type BillingMode = "full_suite" | "modular";

const PLAN_TIER_LEVELS: Record<PlanTier, number> = {
  starter: 1,
  growth: 2,
  enterprise: 3,
  lifetime: 4,
};

export async function requireActiveSubscription(params: {
  supabase: any;
  schoolId: string;
  requiredPlan?: PlanTier;
}): Promise<
  | { ok: true; school: any; warning?: string }
  | { ok: false; response: NextResponse }
> {
  const { supabase, schoolId, requiredPlan } = params;

  const { data: school, error } = await supabase
    .from("schools")
    .select("id, name, subscription_status, subscription_plan")
    .eq("id", schoolId)
    .maybeSingle();

  if (error || !school) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 },
      ),
    };
  }

  const status = school.subscription_status as SubscriptionStatus;
  const plan = school.subscription_plan as PlanTier;

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
    expired: "Your subscription has expired. Please renew to continue.",
    canceled: "Your subscription has been canceled. Please resubscribe to continue.",
    suspended: "Your subscription has been suspended. Please contact support.",
    unpaid: "Your subscription payment is unpaid. Please settle your balance.",
  };

  const message =
    deniedMessages[status] || "Your subscription is not active.";

  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: message, subscriptionStatus: status },
      { status: 403 },
    ),
  };
}

export async function requireModuleEntitlement(params: {
  supabase: any;
  schoolId: string;
  moduleKey: string;
}): Promise<
  | { ok: true; school: any }
  | { ok: false; response: NextResponse }
> {
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
      response: NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 },
      ),
    };
  }

  const billingMode = (school.billing_mode || "full_suite") as BillingMode;
  if (billingMode === "full_suite") {
    return { ok: true, school };
  }

  const { data: entitlement, error: entitlementError } = await supabase
    .from("school_module_entitlements")
    .select("status, ends_at")
    .eq("school_id", schoolId)
    .eq("module_key", moduleKey)
    .maybeSingle();

  if (entitlementError && ["42P01", "42703"].includes(entitlementError.code || "")) {
    return { ok: true, school };
  }

  if (entitlementError) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Failed to verify module entitlement" },
        { status: 500 },
      ),
    };
  }

  const isActiveState = entitlement?.status === "active" || entitlement?.status === "trial";
  const hasValidEndDate = entitlement?.ends_at
    ? new Date(entitlement.ends_at).getTime() > Date.now()
    : false;

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

export function meetsPlanRequirement(
  currentPlan: PlanTier,
  requiredPlan: PlanTier,
): boolean {
  return getPlanTierLevel(currentPlan) >= getPlanTierLevel(requiredPlan);
}
