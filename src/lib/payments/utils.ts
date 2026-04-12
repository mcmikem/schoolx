import { PLAN_PRICES, PlanType } from "../subscription";
import { createSupabaseServerClient } from "../supabase/server";

export const PAYMENT_PROVIDERS = {
  STRIPE: "stripe",
  PAYPAL: "paypal",
  MTN: "mtn",
  AIRTEL: "airtel",
} as const;

export type PaymentProviderType =
  (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

// Updated pricing for Uganda market (per student/term)
export const PAYMENT_PRICES_UGX = {
  starter: PLAN_PRICES.starter.term,
  growth: PLAN_PRICES.growth.term,
  enterprise: PLAN_PRICES.enterprise.term,
  lifetime: PLAN_PRICES.lifetime.oneTime || 12000000,
};

export const STRIPE_PRICE_IDS: Record<PlanType, string | undefined> = {
  free_trial: undefined,
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
};

export function getPlanFromAmount(amount: number): PlanType {
  if (amount >= 8000000) return "lifetime";
  if (amount >= PLAN_PRICES.enterprise.term) return "enterprise";
  if (amount >= PLAN_PRICES.growth.term) return "growth";
  if (amount >= PLAN_PRICES.starter.term) return "starter";
  return "free_trial";
}

export function getPlanPrice(plan: PlanType): number {
  if (plan === "lifetime") return PLAN_PRICES.lifetime.oneTime || 12000000;
  return PLAN_PRICES[plan]?.term || 0;
}

export function validatePaymentAmount(amount: number, plan: PlanType): boolean {
  const expectedAmount = getPlanPrice(plan);
  return amount >= expectedAmount;
}

export async function recordPayment(params: {
  schoolId: string;
  plan: PlanType;
  amount: number;
  provider: PaymentProviderType;
  transactionId: string;
  paymentStatus: "pending" | "completed" | "failed" | "refunded";
  customerId?: string;
}) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.from("subscription_history").insert({
    school_id: params.schoolId,
    plan: params.plan,
    amount_paid: params.amount,
    payment_method: params.provider,
    transaction_id: params.transactionId,
    payment_status: params.paymentStatus,
  });

  if (error) throw error;
  return data;
}

// Helper to calculate total based on student count
export function calculateTotalPrice(
  plan: PlanType,
  studentCount: number,
): number {
  const perStudent = PLAN_PRICES[plan]?.term || 0;
  return perStudent * studentCount;
}

// Payment intent for mobile money (MTN/Airtel)
export interface MobileMoneyPaymentIntent {
  schoolId: string;
  plan: PlanType;
  amount: number;
  studentCount: number;
  phone: string;
  provider: "mtn" | "airtel";
}

export async function createMobileMoneyPaymentIntent(
  params: MobileMoneyPaymentIntent,
): Promise<{ reference: string; expiresAt: Date }> {
  // In production, this would call MTN/Airtel API
  const reference = `SMX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  return { reference, expiresAt };
}
