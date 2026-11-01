// Subscription plans - canonical values live in @/lib/billing/config.ts.
// This module adapts them to the legacy PlanFeatures shape that dashboards,
// paywall checks and tests consume. When changing plan data, edit
// src/lib/billing/config.ts only — the previous duplicate table is gone.
import { logger } from "@/lib/logger";
import {
  PLANS_CONFIG,
  PLAN_FEATURE_FLAGS,
  PLATFORM_PROMO_PERCENT,
  type PlanKey as CanonicalPlanKey,
} from "@/lib/billing/config";

export const PROMO_DISCOUNT_PERCENT = PLATFORM_PROMO_PERCENT;

export function applyPromo(amount: number): number {
  return Math.round(amount * (1 - PROMO_DISCOUNT_PERCENT / 100));
}

// Legacy feature tiers — superseded by PLAN_FEATURE_FLAGS but still read by
// hasFeatureTier()/getPlanForFeature(). Derived from the canonical flags so
// the two can never disagree.
export const FEATURE_TIERS = {
  starter: ["sms", "attendance", "grades", "fees", "basic_reports"],
  growth: [
    "sms",
    "attendance",
    "grades",
    "fees",
    "basic_reports",
    "parent_portal",
    "bulk_sms",
    "ncdc_syllabus",
    "lesson_plans",
    "dorm_transport",
    "library",
    "budget",
    "inventory",
  ],
  enterprise: [
    "sms",
    "attendance",
    "grades",
    "fees",
    "basic_reports",
    "parent_portal",
    "bulk_sms",
    "ncdc_syllabus",
    "lesson_plans",
    "dorm_transport",
    "library",
    "budget",
    "inventory",
    "uneb_registration",
    "moes_exports",
    "payroll",
    "staff_leave",
    "ai_insights",
    "automation",
    "audit_logs",
  ],
  lifetime: [
    "sms",
    "attendance",
    "grades",
    "fees",
    "basic_reports",
    "parent_portal",
    "bulk_sms",
    "ncdc_syllabus",
    "lesson_plans",
    "dorm_transport",
    "library",
    "budget",
    "inventory",
    "uneb_registration",
    "moes_exports",
    "payroll",
    "staff_leave",
    "ai_insights",
    "automation",
    "audit_logs",
    "white_label",
    "on_premise",
  ],
} as Record<"starter" | "growth" | "enterprise" | "lifetime", string[]>;

export const PLAN_TYPES = ["starter", "growth", "enterprise", "lifetime", "free_trial"] as const;

export type PlanType = (typeof PLAN_TYPES)[number];

export interface PlanFeatures {
  name: string;
  pricePerStudent: number;
  priceFrequency: "term" | "annual" | "one_time";
  maxStudents: number;
  adminUsers: number;
  smsQuota: number; // per term, 0 = none
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
  sourceCode: boolean;
  onPremise: boolean;
  whiteLabel: boolean;
}

const UNLIMITED_STUDENTS = 999999;
const UNLIMITED_ADMIN_USERS = 999;
const UNLIMITED_SMS = 99999;

function mapPlan(key: CanonicalPlanKey): PlanFeatures {
  const def = PLANS_CONFIG[key];
  const flags = PLAN_FEATURE_FLAGS[key];
  const isOneTime = key === "lifetime";
  return {
    name: def.name,
    pricePerStudent: key === "free_trial" || isOneTime ? 0 : applyPromo(def.pricePerStudentPerTerm),
    priceFrequency: isOneTime ? "one_time" : "term",
    maxStudents: def.maxStudents < 0 ? UNLIMITED_STUDENTS : def.maxStudents,
    adminUsers: def.maxAdminUsers >= UNLIMITED_ADMIN_USERS ? UNLIMITED_ADMIN_USERS : def.maxAdminUsers,
    smsQuota: def.smsQuotaPerTerm < 0 ? UNLIMITED_SMS : def.smsQuotaPerTerm,
    ...flags,
  } as PlanFeatures;
}

export const PLANS: Record<PlanType, PlanFeatures> = {
  free_trial: mapPlan("free_trial"),
  starter: mapPlan("starter"),
  growth: mapPlan("growth"),
  enterprise: mapPlan("enterprise"),
  lifetime: mapPlan("lifetime"),
};

export const PLAN_PRICES = {
  free_trial: { term: 0, oneTime: 0 },
  starter: { term: PLANS.starter.pricePerStudent, oneTime: null },
  growth: { term: PLANS.growth.pricePerStudent, oneTime: null },
  enterprise: { term: PLANS.enterprise.pricePerStudent, oneTime: null },
  lifetime: { term: null, oneTime: applyPromo(12000000) },
};

export function canUseFeature(plan: PlanType, feature: keyof PlanFeatures): boolean {
  const value = PLANS[plan][feature];
  return value === true || value === Infinity;
}

export function getFeatureLimit(plan: PlanType, feature: keyof PlanFeatures): number {
  const value = PLANS[plan][feature];
  if (value === Infinity) return -1; // -1 means unlimited
  return typeof value === "number" ? value : 0;
}

export function formatPrice(amount: number): string {
  if (amount === 0) return "Free";
  return `UGX ${amount.toLocaleString()}`;
}

export function getUpgradeMessage(feature: string): string {
  return `This feature requires a higher plan. Upgrade to unlock ${feature}.`;
}

// Calculate monthly cost based on student count
export function calculateMonthlyCost(plan: PlanType, studentCount: number): number {
  const pricePerStudent = PLANS[plan].pricePerStudent;
  // 3 terms per year
  return (pricePerStudent * studentCount * 3) / 12;
}

export function getPlanForSchoolType(schoolType: "primary" | "secondary" | "combined"): PlanType {
  switch (schoolType) {
    case "primary":
      return "starter";
    case "combined":
      return "growth";
    case "secondary":
      return "growth";
    default:
      return "starter";
  }
}

// Database functions for subscription management
import { createSupabaseServerClient } from "./supabase/server";
import { createClient } from "@supabase/supabase-js";

function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function updateSchoolSubscription(
  schoolId: string,
  updates: {
    subscription_status?: "active" | "expired" | "trial" | "past_due";
    subscription_plan?: PlanType;
    price_per_student?: number;
    payment_frequency?: "term" | "annual" | "one_time";
    admin_users_allowed?: number;
    sms_quota_monthly?: number;
    lifetime_license?: boolean;
    stripe_subscription_id?: string;
    paypal_subscription_id?: string;
    last_payment_at?: string;
    next_payment_date?: string;
    trial_ends_at?: string | null;
  },
) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.from("schools").update(updates).eq("id", schoolId);

    if (error) {
      logger.error("Error updating school subscription:", error);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error("Error in updateSchoolSubscription:", error);
    throw error;
  }
}

export async function sendPaymentReceipt(
  schoolId: string,
  paymentData: {
    amount: number;
    currency: string;
    date: string;
    plan: PlanType;
    provider: "mtn" | "airtel" | "bank" | "cash" | "card" | "paypal" | "stripe";
    transactionId: string;
  },
) {
  try {
    const [receiptsModule, supabase] = await Promise.all([
      import("@/lib/payments/receipts"),
      createServiceRoleClient(),
    ]);

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, email, phone, school_code")
      .eq("id", schoolId)
      .single();

    if (schoolError) {
      logger.error("Error fetching school for receipt:", schoolError);
      throw schoolError;
    }

    const receiptNumber = await receiptsModule.generateReceiptNumber();

    const receiptData = {
      schoolName: school.name,
      schoolCode: school.school_code,
      schoolEmail: school.email || undefined,
      schoolPhone: school.phone || undefined,
      amount: paymentData.amount,
      currency: paymentData.currency,
      plan: paymentData.plan,
      provider: paymentData.provider,
      transactionId: paymentData.transactionId,
      paymentDate: paymentData.date,
      receiptNumber,
    };

    const emailResult = await receiptsModule.sendEmailReceipt(schoolId, receiptData);
    if (!emailResult.success) {
      logger.warn("Email receipt not sent:", emailResult.message);
    }

    let smsResult: { success: boolean; message?: string } | null = null;
    if (school.phone) {
      smsResult = await receiptsModule.sendSMSReceipt(schoolId, receiptData);
      if (!smsResult.success) {
        logger.warn("SMS receipt not sent:", smsResult.message);
      }
    }

    const delivered = emailResult.success || (smsResult?.success ?? false);
    logger.info("Payment receipt delivery attempt", {
      schoolId,
      receiptNumber,
      plan: paymentData.plan,
      emailSent: emailResult.success,
      smsSent: smsResult?.success ?? false,
    });

    return { success: delivered, receiptNumber };
  } catch (error) {
    logger.error("Error sending payment receipt:", error);
    throw error;
  }
}

export async function handleSubscriptionChange(
  schoolId: string,
  changeData: {
    status: "active" | "past_due" | "canceled" | "unpaid" | "trial" | "suspended";
    plan?: PlanType;
    provider: "mtn" | "airtel" | "bank" | "paypal" | "stripe";
    subscriptionId?: string;
  },
) {
  try {
    const supabase = await createSupabaseServerClient();

    let subscriptionStatus: "active" | "expired" | "trial" | "past_due";
    switch (changeData.status) {
      case "active":
        subscriptionStatus = "active";
        break;
      case "past_due":
      case "unpaid":
        subscriptionStatus = "past_due";
        break;
      case "canceled":
        subscriptionStatus = "expired";
        break;
      default:
        subscriptionStatus = "trial";
    }

    const updates: any = {
      subscription_status: subscriptionStatus,
    };

    if (changeData.plan) {
      updates.subscription_plan = changeData.plan;
    }

    if (changeData.provider === "paypal" && changeData.subscriptionId) {
      updates.paypal_subscription_id = changeData.subscriptionId;
    }

    if (changeData.status === "canceled") {
      updates.paypal_subscription_id = null;
    }

    await updateSchoolSubscription(schoolId, updates);

    logger.debug(`Subscription changed for school ${schoolId}:`, subscriptionStatus);

    return { success: true };
  } catch (error) {
    logger.error("Error handling subscription change:", error);
    throw error;
  }
}

export function determinePlanFromAmount(amount: number, isOneTime: boolean = false): PlanType {
  if (isOneTime) {
    if (amount >= 8000000) return "lifetime";
    return "lifetime";
  }

  if (amount <= 2000) return "starter";
  if (amount <= 3500) return "growth";
  return "enterprise";
}

export function hasFeatureTier(plan: PlanType, feature: string): boolean {
  if (plan === "free_trial") return false;
  return FEATURE_TIERS[plan]?.includes(feature) ?? false;
}

export function getPlanForFeature(feature: string): PlanType | null {
  if (FEATURE_TIERS.lifetime.includes(feature)) return "lifetime";
  if (FEATURE_TIERS.enterprise.includes(feature)) return "enterprise";
  if (FEATURE_TIERS.growth.includes(feature)) return "growth";
  if (FEATURE_TIERS.starter.includes(feature)) return "starter";
  return null;
}

const subscriptionApi = {
  updateSchoolSubscription,
  sendPaymentReceipt,
  handleSubscriptionChange,
  determinePlanFromAmount,
};

export default subscriptionApi;
