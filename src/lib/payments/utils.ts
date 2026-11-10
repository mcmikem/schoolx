import { PLAN_PRICES, PlanType } from "../subscription";
import { createSupabaseServerClient } from "../supabase/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client for ledger reads/writes that must bypass RLS
// (payment status flips are triggered by webhooks, not by a user session).
function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export { createSupabaseAdminClient };

export const PAYMENT_PROVIDERS = {
  STRIPE: "stripe",
  PAYPAL: "paypal",
  MTN: "mtn",
  AIRTEL: "airtel",
} as const;

export type PaymentProviderType = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

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

const MIN_STUDENT_COUNT = 50;

export async function calculateTotalPrice(plan: PlanType, studentCount?: number): Promise<number> {
  const basePrice = getPlanPrice(plan);
  if (plan === "lifetime") return basePrice;
  const count = Math.max(studentCount || 1, 1);
  return basePrice * count;
}

export async function recordPayment(params: {
  schoolId: string;
  plan: PlanType;
  amount: number;
  provider: PaymentProviderType;
  transactionId: string;
  paymentStatus: "pending" | "completed" | "failed" | "refunded";
  customerId?: string;
  intent?: Record<string, unknown>;
  description?: string;
  lineItems?: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.from("subscription_payments").insert({
    school_id: params.schoolId,
    plan: params.plan,
    amount: params.amount,
    provider: params.provider,
    transaction_id: params.transactionId,
    payment_status: params.paymentStatus,
    ...(params.customerId && { customer_id: params.customerId }),
    ...(params.intent && { intent: params.intent }),
    ...(params.description && { description: params.description }),
    ...(params.lineItems && { line_items: params.lineItems }),
  });

  if (error) throw error;
  return data;
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

// Pending mobile payment record
interface PendingMobilePayment {
  id?: string;
  school_id: string;
  plan: PlanType;
  amount: number;
  provider: string;
  phone_number: string;
  reference: string;
  status: "pending" | "completed" | "failed" | "expired";
  expires_at?: string;
  created_at?: string;
}

// Save pending mobile payment
export async function savePendingMobilePayment(params: {
  schoolId: string;
  plan: PlanType;
  amount: number;
  provider: string;
  phone: string;
  reference: string;
}) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("pending_mobile_payments")
    .insert({
      school_id: params.schoolId,
      plan: params.plan,
      amount: params.amount,
      provider: params.provider,
      phone_number: params.phone,
      reference: params.reference,
      status: "pending",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get pending mobile payment by reference
export async function getPendingMobilePayment(reference: string): Promise<PendingMobilePayment | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("pending_mobile_payments")
    .select("*")
    .eq("reference", reference)
    .single();

  if (error) return null;
  return data;
}

// Update pending mobile payment status with atomic compare-and-swap
// Returns null if the row was not updated (e.g., already completed by another request)
export async function updatePendingMobilePayment(
  reference: string,
  status: "pending" | "completed" | "failed" | "expired",
  expectedCurrentStatus?: string,
) {
  const supabase = await createSupabaseServerClient();

  const currentStatus = expectedCurrentStatus || "pending";

  const { data, error } = await supabase
    .from("pending_mobile_payments")
    .update({ status })
    .eq("reference", reference)
    .eq("status", currentStatus)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }
  return data;
}

// Update payment status in subscription history
export async function updatePaymentStatus(
  transactionId: string,
  status: "pending" | "completed" | "failed" | "refunded",
  extra?: { paid_at?: string },
) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subscription_payments")
    .update({
      payment_status: status,
      ...(extra?.paid_at && { paid_at: extra.paid_at }),
    })
    .eq("transaction_id", transactionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Activate school subscription
//
// Uses the new billing service semantics: see if the ledger row carries a
// payment intent (stored by /api/billing + mobile-money checkouts); extend
// next_payment_date from the later of (today, current anchor) so renewing
// early never shortens coverage. Falls back to a 4-month term anchor for
// legacy rows with no intent (lifetime anchors ~100 years).
export async function activateSchoolSubscription(
  schoolId: string,
  plan: PlanType,
  provider: string,
  transactionId: string,
) {
  const admin = createSupabaseAdminClient();

  let legacyPaymentClaimed = false;
  if (transactionId) {
    const { data: ledger, error: ledgerError } = await admin
      .from("subscription_payments")
      .select("id, school_id, intent, payment_status")
      .eq("transaction_id", transactionId)
      .maybeSingle();
    if (ledgerError) throw ledgerError;

    if (ledger?.school_id && ledger.school_id !== schoolId) {
      throw new Error("Payment school does not match the subscription being activated");
    }

    if (ledger?.intent) {
      const { applyCompletedPayment } = await import("@/lib/billing/service");
      const applied = await applyCompletedPayment(admin, transactionId, {
        provider: (provider as any) || "cash",
      });
      if (applied.applied && applied.result?.school) return applied.result.school;
      if (applied.reason === "already applied") {
        const { data: currentSchool, error } = await admin
          .from("schools")
          .select("id, subscription_plan, subscription_status, next_payment_date")
          .eq("id", schoolId)
          .maybeSingle();
        if (error) throw error;
        if (currentSchool) return currentSchool;
      }
      throw new Error(`Payment activation did not complete: ${applied.reason || "unknown result"}`);
    }

    if (ledger && ["failed", "refunded"].includes(ledger.payment_status)) {
      throw new Error("A failed or refunded payment cannot activate a subscription");
    }

    if (ledger?.payment_status === "completed") {
      const { data: currentSchool, error } = await admin
        .from("schools")
        .select("id, subscription_plan, subscription_status, next_payment_date")
        .eq("id", schoolId)
        .maybeSingle();
      if (error) throw error;
      if (currentSchool) return currentSchool;
      throw new Error("School not found for completed payment");
    }

    if (ledger) {
      // Claim legacy rows before updating the plan. A replay must not extend a
      // school's paid period a second time if the provider retries a callback.
      const { data: claimed, error: claimError } = await admin
        .from("subscription_payments")
        .update({ payment_status: "processing" })
        .eq("transaction_id", transactionId)
        .eq("payment_status", "pending")
        .select("id")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) throw new Error("Payment is already being processed or is no longer pending");
      legacyPaymentClaimed = true;
    }
  }

  const TERM_MONTHS = 4;
  const LIFETIME_YEARS = 100;

  const { data: school, error: schoolReadError } = await admin
    .from("schools")
    .select("next_payment_date, subscription_plan, subscription_status")
    .eq("id", schoolId)
    .maybeSingle();
  if (schoolReadError) {
    if (legacyPaymentClaimed) {
      await admin
        .from("subscription_payments")
        .update({ payment_status: "pending" })
        .eq("transaction_id", transactionId)
        .eq("payment_status", "processing");
    }
    throw schoolReadError;
  }
  if (!school) {
    if (legacyPaymentClaimed) {
      await admin
        .from("subscription_payments")
        .update({ payment_status: "pending" })
        .eq("transaction_id", transactionId)
        .eq("payment_status", "processing");
    }
    throw new Error("School not found");
  }

  const now = new Date();
  const currentEnd = school?.next_payment_date ? new Date(school.next_payment_date) : null;
  const anchor = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const nextPaymentDate = new Date(anchor);
  if (plan === "lifetime") {
    nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + LIFETIME_YEARS);
  } else {
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + TERM_MONTHS);
  }

  const { data, error } = await admin
    .from("schools")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      last_payment_at: now.toISOString(),
      next_payment_date: nextPaymentDate.toISOString(),
    })
    .eq("id", schoolId)
    .select("id, subscription_plan, subscription_status, next_payment_date")
    .maybeSingle();

  if (error || !data) {
    if (legacyPaymentClaimed) {
      await admin
        .from("subscription_payments")
        .update({ payment_status: "pending" })
        .eq("transaction_id", transactionId)
        .eq("payment_status", "processing");
    }
    if (error) throw error;
    throw new Error("Subscription activation did not update the school");
  }

  if (legacyPaymentClaimed) {
    const { error: finalizeError } = await admin
      .from("subscription_payments")
      .update({ payment_status: "completed", paid_at: now.toISOString(), provider })
      .eq("transaction_id", transactionId)
      .eq("payment_status", "processing");
    if (finalizeError) throw finalizeError;
  }
  return data;
}

// Get school payment history
export async function getSchoolPaymentHistory(schoolId: string, limit?: number) {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("subscription_payments")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}
