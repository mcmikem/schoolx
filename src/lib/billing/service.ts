// ═══════════════════════════════════════════════════════════════════════════
// Billing service (server-only)
//
// One place that mutates subscription state. API routes (mobile-money webhook,
// verify, capture, manual payment confirmation, cron) must go through these
// functions — never update schools.subscription_* directly — so that
// last_payment_at, next_payment_date, scheduled changes and the ledger stay
// consistent no matter which rail paid.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  BILLING_CYCLES,
  PLANS_CONFIG,
  PLATFORM_PROMO_PERCENT,
  PLAN_ORDER,
  isPlanUpgrade,
  planName,
  prorationCreditForUpgrade,
  quoteAddOnPurchase,
  quotePlanPurchase,
  type CycleKey,
  type PlanKey,
  type Quote,
  type SchoolSizeBand,
} from "./config";
import { resolveModuleKey, type ModuleKey } from "@/lib/modules/catalog";

type Admin = SupabaseClient<any, "public", any>;

export type PaymentIntentType = "renew" | "upgrade" | "module";

export interface PaymentIntent {
  type: PaymentIntentType;
  plan?: PlanKey;
  cycle?: CycleKey;
  months?: number;
  moduleKeys?: ModuleKey[];
  studentCount?: number;
  credit?: number;
  promoCode?: string | null;
}

export interface SchoolBillingContext {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  school_code: string;
  subscription_plan: PlanKey | string | null;
  subscription_status: string | null;
  billing_mode: string;
  school_size_band: SchoolSizeBand | null;
  student_count: number;
  last_payment_at: string | null;
  next_payment_date: string | null;
  trial_ends_at: string | null;
}

export class BillingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ─── Context loading ────────────────────────────────────────────────────────

export async function loadSchoolBillingContext(admin: Admin, schoolId: string): Promise<SchoolBillingContext> {
  const { data: school, error } = await admin
    .from("schools")
    .select(
      "id, name, email, phone, school_code, subscription_plan, subscription_status, billing_mode, school_size_band, last_payment_at, next_payment_date, trial_ends_at",
    )
    .eq("id", schoolId)
    .maybeSingle();

  if (error || !school) {
    throw new BillingError("School not found", 404);
  }

  // Actual student count beats any estimated column.
  const { count } = await admin
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .neq("status", "inactive");

  return {
    ...(school as any),
    student_count: typeof count === "number" ? count : 0,
  };
}

// ─── Promo codes ────────────────────────────────────────────────────────────

export interface ResolvedPromo {
  code: string;
  percentOff: number;
  label: string;
}

export async function resolvePromoCode(
  admin: Admin,
  rawCode: string | null | undefined,
  plan: string,
): Promise<ResolvedPromo | null> {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) return null;

  const { data: promo, error } = await admin
    .from("promo_codes")
    .select("code, percent_off, applies_to_plan, description")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error || !promo) {
    throw new BillingError(`Promo code "${code}" is not valid`, 400);
  }

  if (
    promo.applies_to_plan &&
    promo.applies_to_plan !== plan &&
    !(plan === "lifetime" && promo.applies_to_plan === "enterprise")
  ) {
    throw new BillingError(`Promo code "${code}" applies only to the ${planName(promo.applies_to_plan)} plan`, 400);
  }

  // Single-use windows / validity
  const { data: row } = await admin
    .from("promo_codes")
    .select("valid_from, valid_until, max_redemptions, times_redeemed")
    .eq("code", code)
    .maybeSingle();

  if (row) {
    const now = Date.now();
    if (row.valid_from && new Date(row.valid_from).getTime() > now) {
      throw new BillingError(`Promo code "${code}" is not active yet`, 400);
    }
    if (row.valid_until && new Date(row.valid_until).getTime() < now) {
      throw new BillingError(`Promo code "${code}" has expired`, 400);
    }
    if (row.max_redemptions != null && row.times_redeemed >= row.max_redemptions) {
      throw new BillingError(`Promo code "${code}" has been fully redeemed`, 400);
    }
  }

  return { code: promo.code, percentOff: promo.percent_off, label: promo.description || "" };
}

export async function recordPromoRedemption(admin: Admin, code: string) {
  if (!code) return;
  const { data, error } = await admin.rpc("increment_promo_redemption", { p_code: code });
  if (error) {
    // Non-fatal: the quote already succeeded. Fall back to a direct read-modify.
    const { data: row } = await admin.from("promo_codes").select("times_redeemed").eq("code", code).maybeSingle();
    if (row) {
      await admin
        .from("promo_codes")
        .update({ times_redeemed: (row.times_redeemed || 0) + 1 })
        .eq("code", code);
    }
    return;
  }
  if (typeof data === "number" && data === 0) {
    logger.warn(`Promo code ${code} reached its redemption cap; payment still activated.`);
  }
}

// ─── Quotes ─────────────────────────────────────────────────────────────────

export interface QuoteParams {
  schoolId: string;
  /** "renew" | "upgrade" for plans; "module" for add-on bundles. */
  action: PaymentIntentType;
  plan?: string;
  cycle?: CycleKey;
  moduleKeys?: string[];
  promoCode?: string | null;
}

export interface BuiltQuote {
  intent: PaymentIntent;
  quote: Quote;
  context: SchoolBillingContext;
  promo: ResolvedPromo | null;
  /** How many students the plan allows — clients surface over-limit warnings. */
  overLimit: boolean;
}

export async function buildQuote(admin: Admin, params: QuoteParams): Promise<BuiltQuote> {
  const context = await loadSchoolBillingContext(admin, params.schoolId);
  const now = new Date();
  const sizeBand: SchoolSizeBand = context.school_size_band || "small";
  const currentPlan = (
    PLAN_ORDER_FALLBACK.has(String(context.subscription_plan)) ? String(context.subscription_plan) : "free_trial"
  ) as PlanKey;

  // ── Module bundle quote ─────────────────────────────────────────────────
  if (params.action === "module") {
    const moduleKeys = (params.moduleKeys || []).map((k) => resolveModuleKey(k)) as ModuleKey[];
    if (moduleKeys.length === 0) throw new BillingError("Select at least one module", 400);

    const promo = await resolvePromoCode(admin, params.promoCode, "addon");
    const quote = quoteAddOnPurchase({
      moduleKeys,
      sizeBand,
      plan: currentPlan,
      billingMode: (context.billing_mode as any) || "full_suite",
      promo: promo ? { code: promo.code, percentOff: promo.percentOff, label: promo.label } : undefined,
      now,
    });

    if (quote.totalDue <= 0) {
      throw new BillingError("Nothing to pay for the selected modules", 400);
    }

    return {
      intent: { type: "module", moduleKeys, months: 12, promoCode: promo?.code ?? null },
      quote,
      context,
      promo,
      overLimit: false,
    };
  }

  // ── Plan quote ──────────────────────────────────────────────────────────
  const rawPlan = String(params.plan || "");
  if (rawPlan === "free_trial") throw new BillingError("The free trial cannot be purchased", 400);
  const plan = (rawPlan || currentPlan) as Exclude<PlanKey, "free_trial">;
  if (!(plan in PLANS_CONFIG) || !PLAN_ORDER.includes(plan as PlanKey)) {
    throw new BillingError("Invalid plan", 400);
  }
  if (plan === "lifetime" && params.action === "upgrade") {
    // lifetime is one-time; treat as an upgrade with its own flow
  }

  const cycle: CycleKey = params.cycle === "annual" ? "annual" : "term";
  const overLimit = PLANS_CONFIG[plan].maxStudents >= 0 && context.student_count > PLANS_CONFIG[plan].maxStudents;
  if (overLimit) {
    throw new BillingError(
      `Your school has ${context.student_count} students — the ${planName(plan)} plan allows ${PLANS_CONFIG[plan].maxStudents}`,
      400,
    );
  }

  const promo = await resolvePromoCode(admin, params.promoCode, plan);

  let upgradeCredit: { label: string; amount: number } | null = null;
  if (params.action === "upgrade" && isPlanUpgrade(currentPlan, plan)) {
    // Anchor the credit on the most recent completed payment.
    const { data: lastPaid } = await admin
      .from("subscription_payments")
      .select("amount, paid_at, intent")
      .eq("school_id", context.id)
      .eq("payment_status", "completed")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPaid?.paid_at) {
      const lastIntent = (lastPaid.intent || {}) as PaymentIntent;
      upgradeCredit = prorationCreditForUpgrade({
        amountPaid: Number(lastPaid.amount) || 0,
        paidAt: lastPaid.paid_at,
        nextPaymentDate: context.next_payment_date,
        cycleMonths:
          typeof lastIntent.months === "number" && lastIntent.months > 0
            ? lastIntent.months
            : BILLING_CYCLES[currentPlan === "lifetime" ? "annual" : "term"].months,
        now,
      });
    }
  }

  const quote = quotePlanPurchase({
    plan,
    cycle,
    studentCount: context.student_count,
    platformPromoPercent: PLATFORM_PROMO_PERCENT,
    promo: promo ? { code: promo.code, percentOff: promo.percentOff, label: promo.label } : undefined,
    now,
    upgradeCredit,
  });

  const months = BILLING_CYCLES[cycle].months;

  return {
    intent: {
      type:
        params.action === "upgrade" && !isPlanUpgrade(currentPlan, plan)
          ? "renew"
          : (params.action as PaymentIntentType),
      plan,
      cycle,
      months,
      studentCount: context.student_count,
      credit: upgradeCredit ? upgradeCredit.amount : 0,
      promoCode: promo?.code ?? null,
    },
    quote,
    context,
    promo,
    overLimit: false,
  };
}

const PLAN_ORDER_FALLBACK = new Set([
  "free_trial",
  "starter",
  "growth",
  "enterprise",
  "lifetime",
  "basic",
  "premium",
  "max",
]);

// ─── Ledger: creating pending payments ──────────────────────────────────────

export interface CreatePendingPaymentParams {
  schoolId: string;
  provider: "cash" | "bank" | "mtn" | "airtel" | "paypal" | "stripe";
  phone_number?: string | null;
  quote: Quote;
  intent: PaymentIntent;
  /** Existing transaction ref, otherwise generated. */
  transactionId?: string;
  createdById?: string | null;
}

export function generateTransactionRef(prefix = "SKM"): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

/**
 * Creates a pending ledger row holding the agreed quote + what to do when
 * it is confirmed. Every rail funnels through here:
 *  • manual (cash/bank): super-admin confirms via confirmSubscriptionPayment
 *  • momo/mobile: webhook flips payment_status → completed then applies intent
 *  • stripe/paypal: existing capture/webhook paths map onto the same intent
 */
export async function createPendingSubscriptionPayment(admin: Admin, params: CreatePendingPaymentParams) {
  const transactionId = params.transactionId || generateTransactionRef();
  const description =
    params.intent.type === "module"
      ? `Add-ons: ${(params.intent.moduleKeys || []).join(", ")}`
      : `${planName(String(params.intent.plan))} plan · ${BILLING_CYCLES[params.intent.cycle || "term"].label}`;

  const { data, error } = await admin
    .from("subscription_payments")
    .insert({
      school_id: params.schoolId,
      plan: normalizePlanForLedger(params.intent.plan),
      amount: params.quote.totalDue,
      currency: "UGX",
      provider: params.provider,
      transaction_id: transactionId,
      payment_status: "pending",
      customer_id: params.createdById || null,
      phone_number: params.phone_number || null,
      description,
      line_items: params.quote as unknown as object,
      intent: params.intent as unknown as object,
    })
    .select()
    .single();

  if (error) throw new BillingError(`Failed to record payment: ${error.message}`, 500);
  return data;
}

function normalizePlanForLedger(plan: string | undefined): string {
  switch (plan) {
    case "growth":
      return "premium";
    case "enterprise":
      return "max";
    case "starter":
      return "basic";
    case "lifetime":
      return "lifetime";
    default:
      return plan || "starter";
  }
}
// Legacy ledger rows used basic/premium/max; resolve back to canonical names.
export function denormalizeLedgerPlan(plan: string): PlanKey {
  switch (plan) {
    case "basic":
      return "starter";
    case "premium":
      return "growth";
    case "max":
      return "enterprise";
    default:
      return (plan as PlanKey) || "starter";
  }
}

// ─── Activation core ────────────────────────────────────────────────────────

export interface AppliedActivation {
  school: { id: string; subscription_plan: string; subscription_status: string; next_payment_date: string | null };
  payment: Record<string, unknown> | null;
}

/**
 * Mark a pending payment completed and apply its intent.
 * Idempotent: a payment that is already completed (or applied) returns the
 * existing result instead of extending the plan again.
 */
export async function applyCompletedPayment(
  admin: Admin,
  transactionId: string,
  opts: {
    provider?: "cash" | "bank" | "mtn" | "airtel" | "paypal" | "stripe";
    confirmedBy?: string | null;
    paidAt?: string;
    skipSchoolUpdate?: boolean;
  } = {},
): Promise<{ applied: boolean; result?: AppliedActivation; reason?: string }> {
  const { data: payment, error: paymentError } = await admin
    .from("subscription_payments")
    .select("*")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (paymentError || !payment) {
    throw new BillingError(`Unknown transaction ${transactionId}`, 404);
  }
  if (payment.payment_status === "completed") {
    return { applied: false, reason: "already applied" };
  }

  const paidAt = opts.paidAt || new Date().toISOString();
  const intent = (payment.intent || {}) as PaymentIntent;
  const quote = (payment.line_items || {}) as Quote;

  // 1) Apply to the school + entitlements FIRST. If this throws, the ledger
  //    row stays pending so a retry can re-attempt activation instead of
  //    leaving a "completed but never activated" payment stuck forever.
  const result = await applyIntent(admin, payment.school_id, intent, {
    amountPaid: Number(payment.amount) || 0,
    paidAt,
    quote,
    skipSchoolUpdate: opts.skipSchoolUpdate,
  });

  // 2) Flip the ledger row only after the intent applied successfully.
  const { data: finalized, error: finalizeError } = await admin
    .from("subscription_payments")
    .update({
      payment_status: "completed",
      provider: opts.provider || payment.provider,
      paid_at: paidAt,
      customer_id: opts.confirmedBy || payment.customer_id,
    })
    .eq("transaction_id", transactionId)
    .select()
    .single();
  if (finalizeError) throw new BillingError(`Failed to finalize payment: ${finalizeError.message}`, 500);
  result.payment = finalized as unknown as Record<string, unknown>;

  // 3) Promo redemption + audit (non-blocking).
  const promoCode = intent.promoCode || null;
  if (promoCode) await recordPromoRedemption(admin, promoCode);
  const promo = (quote?.credits || []).find((c: any) => c?.id === "promo");
  if (!promoCode && promo?.label) {
    const code = String(promo.label).match(/Promo code ([^ ]+)/)?.[1];
    if (code) await recordPromoRedemption(admin, code);
  }
  await logBillingAudit(
    admin,
    payment.school_id,
    opts.confirmedBy || null,
    `Payment ${transactionId} applied: ${intent.type} ${intent.plan || (intent.moduleKeys || []).join(",") || ""}`,
  );

  return { applied: true, result };
}

async function applyIntent(
  admin: Admin,
  schoolId: string,
  intent: PaymentIntent,
  opts: { amountPaid: number; paidAt: string; quote?: Quote; skipSchoolUpdate?: boolean },
): Promise<AppliedActivation> {
  const months = typeof intent.months === "number" && intent.months > 0 ? intent.months : 4;

  if (intent.type === "module") {
    // Extend or create entitlements for each module, stacking on any
    // unexpired end date so renewals never shorten coverage.
    const moduleKeys = (intent.moduleKeys || []).map((k) => resolveModuleKey(k));
    const now = new Date();

    for (const key of moduleKeys) {
      const { data: existing } = await admin
        .from("school_module_entitlements")
        .select("id, starts_at, ends_at")
        .eq("school_id", schoolId)
        .eq("module_key", key)
        .maybeSingle();

      let startBase = new Date(now);
      if (existing?.ends_at && new Date(existing.ends_at).getTime() > now.getTime()) {
        startBase = new Date(existing.ends_at); // stack renewals, never truncate
      }

      const newEnd = new Date(startBase);
      newEnd.setMonth(newEnd.getMonth() + months);

      if (existing) {
        await admin
          .from("school_module_entitlements")
          .update({
            status: "active",
            starts_at: (existing.starts_at as string) || now.toISOString(),
            ends_at: newEnd.toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await admin.from("school_module_entitlements").upsert(
          {
            school_id: schoolId,
            module_key: key,
            status: "active",
            starts_at: now.toISOString(),
            ends_at: newEnd.toISOString(),
          },
          { onConflict: "school_id,module_key" },
        );
      }
    }

    // Purchases can breathe life back into an expired school deal for that
    // module only; school plan untouched.
    return {
      school: { id: schoolId, subscription_plan: "", subscription_status: "", next_payment_date: null },
      payment: null,
    };
  }

  // renew / upgrade
  const plan = denormalizeLedgerPlan(String(intent.plan || "starter")) as Exclude<PlanKey, "free_trial">;
  const now = new Date();

  const { data: school } = await admin
    .from("schools")
    .select("subscription_plan, next_payment_date, subscription_status, scheduled_plan, scheduled_plan_change_at")
    .eq("id", schoolId)
    .maybeSingle();
  if (!school) throw new BillingError("School not found", 404);

  // Extend from the later of (today, existing next payment date) so renewing
  // early never shortens coverage.
  const currentEnd = school.next_payment_date ? new Date(school.next_payment_date) : null;
  const startAnchor = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const newEnd = new Date(startAnchor);
  newEnd.setMonth(newEnd.getMonth() + months);

  // An upgrade bought mid-cycle: plan switches now, but stays paid until the
  // end of the paid period unless the credit consumed the remainder.
  const nextPaymentDate = opts.quote?.coverageUntil
    ? new Date(Math.max(new Date(opts.quote.coverageUntil).getTime(), newEnd.getTime()))
    : newEnd;

  if (opts.skipSchoolUpdate) {
    return {
      school: {
        id: schoolId,
        subscription_plan: plan,
        subscription_status: "active",
        next_payment_date: nextPaymentDate.toISOString(),
      },
      payment: null,
    };
  }

  const { data: updated, error: updateError } = await admin
    .from("schools")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      last_payment_at: opts.paidAt,
      next_payment_date: nextPaymentDate.toISOString(),
      scheduled_plan: null,
      scheduled_plan_change_at: null,
    })
    .eq("id", schoolId)
    .select("id, subscription_plan, subscription_status, next_payment_date")
    .single();
  if (updateError) throw new BillingError(`Failed to activate: ${updateError.message}`, 500);

  await logBillingAudit(
    admin,
    schoolId,
    null,
    `Subscription activated: ${plan} (${intent.cycle || "term"}), valid until ${nextPaymentDate.toISOString().slice(0, 10)}`,
  );

  return { school: updated as any, payment: null };
}

// ─── Manual payment flow (manual-first rail) ────────────────────────────────

export interface ManualSubmissionResult {
  payment: Record<string, unknown>;
  instructions: string;
}

export async function submitManualPayment(
  admin: Admin,
  params: {
    schoolId: string;
    method: "cash" | "bank";
    reference: string;
    note?: string;
    quoteParams: QuoteParams;
    createdById: string | null;
  },
): Promise<ManualSubmissionResult> {
  if (!["cash", "bank"].includes(params.method)) {
    throw new BillingError("Invalid payment method", 400);
  }
  if (!params.reference || params.reference.trim().length < 3) {
    throw new BillingError("Enter the payment reference or receipt number", 400);
  }

  const built = await buildQuote(admin, params.quoteParams);

  const payment = await createPendingSubscriptionPayment(admin, {
    schoolId: params.schoolId,
    provider: params.method,
    quote: built.quote,
    intent: built.intent,
    transactionId: undefined,
    createdById: params.createdById,
  });

  // Re-attach the human reference so the ledger shows it.
  await admin
    .from("subscription_payments")
    .update({
      payment_method_detail: `${params.method === "bank" ? "Bank deposit" : "Cash"} · Ref: ${params.reference.trim()}${params.note ? ` · ${params.note.trim()}` : ""}`,
    })
    .eq("transaction_id", (payment as any).transaction_id);

  await logBillingAudit(
    admin,
    params.schoolId,
    params.createdById,
    `Manual payment submitted (${params.method}, ref ${params.reference.trim()}) for ${built.quote.totalDue} UGX`,
  );

  return {
    payment: payment as Record<string, unknown>,
    instructions:
      "Your submission is pending confirmation. Our team verifies bank/cash payments against your reference and activates your subscription.",
  };
}

export async function confirmManualPayment(
  admin: Admin,
  paymentId: string,
  confirmedBy: string | null,
): Promise<AppliedActivation> {
  const { data: payment } = await admin
    .from("subscription_payments")
    .select("id, school_id, payment_status, provider, transaction_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) throw new BillingError("Payment not found", 404);
  if (payment.payment_status !== "pending") {
    throw new BillingError(`Payment is already ${payment.payment_status}`, 400);
  }
  if (!["cash", "bank"].includes(payment.provider)) {
    throw new BillingError("Only manual payments are confirmed here", 400);
  }

  const applied = await applyCompletedPayment(admin, payment.transaction_id, {
    provider: payment.provider,
    confirmedBy,
  });
  if (!applied.applied) throw new BillingError("Payment already applied", 409);

  await logBillingAudit(
    admin,
    payment.school_id,
    confirmedBy,
    `Manual payment ${payment.transaction_id} confirmed and subscription activated`,
  );

  const { data: result } = await admin.from("subscription_payments").select("*").eq("id", paymentId).maybeSingle();

  return {
    school: (applied.result?.school as any) ?? {
      id: payment.school_id,
      subscription_plan: "",
      subscription_status: "",
      next_payment_date: null,
    },
    payment: result ?? null,
  };
}

export async function rejectManualPayment(admin: Admin, paymentId: string, confirmedBy: string | null, reason: string) {
  const { data: payment } = await admin.from("subscription_payments").select("*").eq("id", paymentId).maybeSingle();

  if (!payment) throw new BillingError("Payment not found", 404);
  if (payment.payment_status !== "pending") {
    throw new BillingError(`Payment is already ${payment.payment_status}`, 400);
  }
  if (!["cash", "bank"].includes(payment.provider)) {
    throw new BillingError("Only manual payments are rejected here", 400);
  }

  const { error } = await admin
    .from("subscription_payments")
    .update({
      payment_status: "failed",
      customer_id: confirmedBy,
      payment_method_detail: `${payment.payment_method_detail || ""} · Rejected: ${reason}`.trim(),
    })
    .eq("id", paymentId);
  if (error) throw new BillingError("Failed to reject payment", 500);

  await admin.from("support_tickets").insert({
    school_id: payment.school_id,
    type: "custom_package",
    title: "Subscription payment rejected",
    description: reason || "The submitted payment could not be verified.",
    priority: "high",
    status: "open",
  });

  await logBillingAudit(
    admin,
    payment.school_id,
    confirmedBy,
    `Manual payment ${payment.transaction_id} rejected: ${reason}`,
  );
}

// ─── Downgrades (scheduled, never cut paid period short) ────────────────────

export async function scheduleDowngrade(
  admin: Admin,
  schoolId: string,
  targetPlan: PlanKey,
): Promise<{ effectiveAt: string }> {
  const { data: school } = await admin
    .from("schools")
    .select("subscription_plan, next_payment_date, subscription_status")
    .eq("id", schoolId)
    .maybeSingle();
  if (!school) throw new BillingError("School not found", 404);

  if (school.subscription_status !== "active") {
    // Nothing left to protect — apply immediately.
    await admin
      .from("schools")
      .update({
        subscription_plan: targetPlan,
        scheduled_plan: null,
        scheduled_plan_change_at: null,
      })
      .eq("id", schoolId);
    return { effectiveAt: new Date().toISOString() };
  }

  const effectiveAt =
    school.next_payment_date && new Date(school.next_payment_date).getTime() > Date.now()
      ? new Date(school.next_payment_date).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin
    .from("schools")
    .update({
      scheduled_plan: targetPlan,
      scheduled_plan_change_at: effectiveAt,
    })
    .eq("id", schoolId);
  if (error) throw new BillingError("Failed to schedule downgrade", 500);

  await logBillingAudit(
    admin,
    schoolId,
    null,
    `Downgrade to ${planName(targetPlan)} scheduled for ${effectiveAt.slice(0, 10)}`,
  );
  return { effectiveAt };
}

export async function cancelScheduledChange(admin: Admin, schoolId: string) {
  const { error } = await admin
    .from("schools")
    .update({ scheduled_plan: null, scheduled_plan_change_at: null })
    .eq("id", schoolId);
  if (error) throw new BillingError("Failed to cancel scheduled change", 500);
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export async function logBillingAudit(admin: Admin, schoolId: string, userId: string | null, description: string) {
  await admin
    .from("audit_log")
    .insert({
      school_id: schoolId,
      user_id: userId,
      action: "update",
      module: "subscription",
      description,
    })
    .then(
      () => undefined,
      (err) => logger.warn("billing audit write failed:", err?.message),
    );
}
