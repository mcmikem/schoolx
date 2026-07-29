// Subscription plans - matches landing page pricing
import { logger } from "@/lib/logger";

export const PROMO_DISCOUNT_PERCENT = 30;

export function applyPromo(amount: number): number {
  return Math.round(amount * (1 - PROMO_DISCOUNT_PERCENT / 100));
}

// Starter: UGX 2,000/student/term (≤200 students, rural/primary)
// Growth: UGX 3,500/student/term (≤500 students, urban/secondary)
// Enterprise: UGX 5,500/student/term (unlimited, full features + UNEB)
// Lifetime: UGX 8-15M one-time (white-label, source code)

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
};

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

export const PLANS: Record<PlanType, PlanFeatures> = {
  free_trial: {
    name: "Free Trial",
    pricePerStudent: 0,
    priceFrequency: "term",
    maxStudents: 100,
    adminUsers: 3,
    smsQuota: 0,
    offlineMode: false,
    parentPortal: false,
    syllabus: false,
    lessonPlans: false,
    dormManagement: false,
    transport: false,
    library: false,
    budgets: false,
    unebRegistration: false,
    moesExports: false,
    payroll: false,
    staffLeave: false,
    aiInsights: false,
    workflowAutomation: false,
    auditLogs: false,
    apiAccess: false,
    multiBranch: false,
    sourceCode: false,
    onPremise: false,
    whiteLabel: false,
  },
  starter: {
    name: "Starter",
    pricePerStudent: applyPromo(2000),
    priceFrequency: "term",
    maxStudents: 200,
    adminUsers: 3,
    smsQuota: 0,
    offlineMode: true,
    parentPortal: false,
    syllabus: false,
    lessonPlans: false,
    dormManagement: false,
    transport: false,
    library: false,
    budgets: false,
    unebRegistration: false,
    moesExports: false,
    payroll: false,
    staffLeave: false,
    aiInsights: false,
    workflowAutomation: false,
    auditLogs: false,
    apiAccess: false,
    multiBranch: false,
    sourceCode: false,
    onPremise: false,
    whiteLabel: false,
  },
  growth: {
    name: "Growth",
    pricePerStudent: applyPromo(3500),
    priceFrequency: "term",
    maxStudents: 500,
    adminUsers: 10,
    smsQuota: 500,
    offlineMode: true,
    parentPortal: true,
    syllabus: true,
    lessonPlans: true,
    dormManagement: true,
    transport: true,
    library: true,
    budgets: true,
    unebRegistration: false,
    moesExports: false,
    payroll: false,
    staffLeave: false,
    aiInsights: false,
    workflowAutomation: false,
    auditLogs: false,
    apiAccess: false,
    multiBranch: false,
    sourceCode: false,
    onPremise: false,
    whiteLabel: false,
  },
  enterprise: {
    name: "Enterprise",
    pricePerStudent: applyPromo(5500),
    priceFrequency: "term",
    maxStudents: 999999,
    adminUsers: 999,
    smsQuota: 99999,
    offlineMode: true,
    parentPortal: true,
    syllabus: true,
    lessonPlans: true,
    dormManagement: true,
    transport: true,
    library: true,
    budgets: true,
    unebRegistration: true,
    moesExports: true,
    payroll: true,
    staffLeave: true,
    aiInsights: true,
    workflowAutomation: true,
    auditLogs: true,
    apiAccess: true,
    multiBranch: true,
    sourceCode: false,
    onPremise: false,
    whiteLabel: false,
  },
  lifetime: {
    name: "Lifetime",
    pricePerStudent: 0, // one-time payment
    priceFrequency: "one_time",
    maxStudents: 999999,
    adminUsers: 999,
    smsQuota: 99999,
    offlineMode: true,
    parentPortal: true,
    syllabus: true,
    lessonPlans: true,
    dormManagement: true,
    transport: true,
    library: true,
    budgets: true,
    unebRegistration: true,
    moesExports: true,
    payroll: true,
    staffLeave: true,
    aiInsights: true,
    workflowAutomation: true,
    auditLogs: true,
    apiAccess: true,
    multiBranch: true,
    sourceCode: true,
    onPremise: true,
    whiteLabel: true,
  },
};

export const PLAN_PRICES = {
  free_trial: { term: 0, oneTime: 0 },
  starter: { term: applyPromo(2000), oneTime: null },
  growth: { term: applyPromo(3500), oneTime: null },
  enterprise: { term: applyPromo(5500), oneTime: null },
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
      createSupabaseServerClient(),
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

    if (school.phone) {
      const smsResult = await receiptsModule.sendSMSReceipt(schoolId, receiptData);
      if (!smsResult.success) {
        logger.warn("SMS receipt not sent:", smsResult.message);
      }
    }

    logger.info("Payment receipt sent", {
      schoolId,
      receiptNumber,
      plan: paymentData.plan,
    });

    return { success: true, receiptNumber };
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
