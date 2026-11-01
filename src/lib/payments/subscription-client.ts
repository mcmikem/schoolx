// Subscription client - matches landing page pricing
//
// WARNING: this file is a thin adapter over @/lib/billing/config.ts, the
// canonical billing configuration. The numbers and feature flags live there
// — the duplicates that used to live in this copy HAVE been removed. Exported
// names are preserved for the many call sites (`normalizePlanType`, `PLANS`,
// etc.). When adding a plan behaviour, edit billing/config.ts only.

import {
  BILLING_CYCLES,
  PLANS_CONFIG,
  PLAN_FEATURE_FLAGS,
  PLATFORM_PROMO_PERCENT,
  type PlanKey,
} from "@/lib/billing/config";

export { PLATFORM_PROMO_PERCENT as PROMO_DISCOUNT_PERCENT };

export type PlanType = PlanKey;

const LEGACY_PLAN_MAP = {
  basic: "starter",
  premium: "growth",
  max: "enterprise",
  suspended: "free_trial",
} as const;

export interface PlanFeatures {
  name: string;
  pricePerStudent: number;
  priceFrequency: "term" | "annual" | "one_time";
  maxStudents: number;
  adminUsers: number;
  smsQuota: number;
  offlineMode: boolean;
  parentPortal: boolean;
  syllabus: boolean;
  lessonPlans: boolean;
  dormManagement: boolean;
  transport: boolean;
  library: boolean;
  budgets: boolean;
  unebRegistration: boolean;
  moesExports: boolean;
  payroll: boolean;
  staffLeave: boolean;
  aiInsights: boolean;
  workflowAutomation: boolean;
  auditLogs: boolean;
  apiAccess: boolean;
  multiBranch: boolean;
}

const UNLIMITED = Infinity;

function mapPlan(key: PlanKey): PlanFeatures {
  const def = PLANS_CONFIG[key];
  const flags = PLAN_FEATURE_FLAGS[key];
  const isOneTime = key === "lifetime";
  return {
    name: def.name,
    pricePerStudent: key === "free_trial" || isOneTime ? 0 : applyPromo(def.pricePerStudentPerTerm),
    priceFrequency: isOneTime ? "one_time" : "term",
    maxStudents: def.maxStudents < 0 ? UNLIMITED : def.maxStudents,
    adminUsers: def.maxAdminUsers >= 999 ? UNLIMITED : def.maxAdminUsers,
    smsQuota: def.smsQuotaPerTerm < 0 ? UNLIMITED : def.smsQuotaPerTerm,
    ...flags,
  } as PlanFeatures;
}

export function applyPromo(amount: number): number {
  return Math.round(amount * (1 - PLATFORM_PROMO_PERCENT / 100));
}

export const PLANS: Record<PlanType, PlanFeatures> = {
  free_trial: mapPlan("free_trial"),
  starter: mapPlan("starter"),
  growth: mapPlan("growth"),
  enterprise: mapPlan("enterprise"),
  lifetime: mapPlan("lifetime"),
};

// Plan order for upgrades
export const order: PlanType[] = ["free_trial", "starter", "growth", "enterprise", "lifetime"];

export function normalizePlanType(plan?: string | null): PlanType {
  if (!plan) return "free_trial";
  if (plan in PLANS) return plan as PlanType;
  if (plan in LEGACY_PLAN_MAP) {
    return LEGACY_PLAN_MAP[plan as keyof typeof LEGACY_PLAN_MAP];
  }
  return "free_trial";
}

// Get next plan in order
export function getNextPlan(currentPlan: PlanType): PlanType | null {
  const currentIndex = order.indexOf(currentPlan);
  if (currentIndex === -1 || currentIndex === order.length - 1) return null;
  return order[currentIndex + 1];
}

// Calculate price for student count
export function calculatePrice(plan: PlanType, studentCount: number): number {
  return PLANS[plan].pricePerStudent * studentCount;
}

// Check if feature is available
export function hasFeature(plan: PlanType, feature: keyof PlanFeatures): boolean {
  const value = PLANS[plan][feature];
  return value === true || value === Infinity;
}

// Get feature limit value
export function getFeatureLimit(plan: PlanType, feature: keyof PlanFeatures): number {
  const value = PLANS[plan][feature];
  if (value === Infinity) return -1;
  return typeof value === "number" ? value : 0;
}

// Get plan usage warning message
export function getPlanUsageWarning(plan: PlanType, currentCount: number, feature: keyof PlanFeatures): string | null {
  const limit = getFeatureLimit(plan, feature);
  if (limit === -1) return null; // Unlimited
  if (currentCount >= limit) {
    return `You've reached the ${feature} limit (${limit}) for your ${plan} plan. Upgrade to unlock more.`;
  }
  return null;
}

export { BILLING_CYCLES };
