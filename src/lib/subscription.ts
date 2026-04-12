// Subscription plans - matches landing page pricing
// Starter: UGX 2,000/student/term
// Growth: UGX 3,500/student/term
// Enterprise: UGX 5,500/student/term
// Lifetime: UGX 8-15M one-time

export type PlanType =
  | "starter"
  | "growth"
  | "enterprise"
  | "lifetime"
  | "free_trial";

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
    pricePerStudent: 2000,
    priceFrequency: "term",
    maxStudents: 500,
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
    pricePerStudent: 3500,
    priceFrequency: "term",
    maxStudents: 2000,
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
    pricePerStudent: 5500,
    priceFrequency: "term",
    maxStudents: Infinity,
    adminUsers: Infinity,
    smsQuota: Infinity,
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
    maxStudents: Infinity,
    adminUsers: Infinity,
    smsQuota: Infinity,
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
  starter: { term: 2000, oneTime: null },
  growth: { term: 3500, oneTime: null },
  enterprise: { term: 5500, oneTime: null },
  lifetime: { term: null, oneTime: 12000000 }, // UGX 12M average
};

export function canUseFeature(
  plan: PlanType,
  feature: keyof PlanFeatures,
): boolean {
  const value = PLANS[plan][feature];
  return value === true || value === Infinity;
}

export function getFeatureLimit(
  plan: PlanType,
  feature: keyof PlanFeatures,
): number {
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
export function calculateMonthlyCost(
  plan: PlanType,
  studentCount: number,
): number {
  const pricePerStudent = PLANS[plan].pricePerStudent;
  // 3 terms per year
  return (pricePerStudent * studentCount * 3) / 12;
}

export function getPlanForSchoolType(
  schoolType: "primary" | "secondary" | "combined",
): PlanType {
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

    const { data, error } = await supabase
      .from("schools")
      .update(updates)
      .eq("id", schoolId);

    if (error) {
      console.error("Error updating school subscription:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in updateSchoolSubscription:", error);
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
    const supabase = await createSupabaseServerClient();

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, email, phone, school_code")
      .eq("id", schoolId)
      .single();

    if (schoolError) {
      console.error("Error fetching school for receipt:", schoolError);
      throw schoolError;
    }

    const formattedAmount = new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
    }).format(paymentData.amount);

    console.log(`Sending payment receipt to ${school.email}:`, {
      subject: `Payment Receipt - ${school.name}`,
      amount: formattedAmount,
      plan: paymentData.plan,
    });

    if (school.phone) {
      const smsMessage = `Payment confirmed for ${school.name}. Amount: ${formattedAmount}. Plan: ${paymentData.plan}. Thank you!`;
      console.log(`Sending SMS to ${school.phone}:`, smsMessage);
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending payment receipt:", error);
    throw error;
  }
}

export async function handleSubscriptionChange(
  schoolId: string,
  changeData: {
    status:
      | "active"
      | "past_due"
      | "canceled"
      | "unpaid"
      | "trial"
      | "suspended";
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

    console.log(
      `Subscription changed for school ${schoolId}:`,
      subscriptionStatus,
    );

    return { success: true };
  } catch (error) {
    console.error("Error handling subscription change:", error);
    throw error;
  }
}

export function determinePlanFromAmount(
  amount: number,
  isOneTime: boolean = false,
): PlanType {
  if (isOneTime) {
    if (amount >= 8000000) return "lifetime";
    return "lifetime";
  }

  // Per-term pricing
  if (amount <= 2000) return "starter";
  if (amount <= 3500) return "growth";
  return "enterprise";
}

const subscriptionApi = {
  updateSchoolSubscription,
  sendPaymentReceipt,
  handleSubscriptionChange,
  determinePlanFromAmount,
};

export default subscriptionApi;
