"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Billing & Plans panel — renders EVERYTHING from @/lib/billing/config.
// No UGX figure is hardcoded in this file: plan cards, add-on prices, quotes
// and labels all derive from the canonical config, so the UI can never drift
// from what the API charges.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import {
  BILLING_CYCLES,
  PLANS_CONFIG,
  PLATFORM_PROMO_PERCENT,
  formatCompactUgx,
  formatDate,
  formatUgx,
  planName,
  planLevel,
  type CycleKey,
  type PlanKey,
} from "@/lib/billing/config";

interface SchoolRow {
  id: string;
  name: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  billing_mode: string | null;
  school_size_band: string | null;
  next_payment_date: string | null;
  last_payment_at: string | null;
  trial_ends_at: string | null;
  scheduled_plan: string | null;
  scheduled_plan_change_at: string | null;
  is_tester: boolean | null;
}

interface QuoteResponse {
  subtotal: number;
  discountTotal: number;
  totalDue: number;
  cycle: CycleKey;
  coverageUntil: string | null;
  lines: Array<{ id: string; label: string; detail?: string; amount: number }>;
  credits: Array<{ id: string; label: string; amount: number }>;
  context: { studentCount: number; billingMode: string; sizeBand: string | null };
}

type CheckoutAction = "renew" | "upgrade";

const STATUS_COPY: Record<string, string> = {
  active: "Your subscription is active",
  trial: "Your account is on a trial",
  past_due: "Your subscription has a payment due",
  expired: "Your subscription has expired — renew to continue",
  canceled: "Your subscription was canceled",
  unpaid: "Your subscription payment is unpaid",
  suspended: "Your subscription is suspended",
};

export default function SubscriptionBillingPanel({ onRefresh }: { onRefresh?: () => void }) {
  const toast = useToast();
  const { school: authSchool } = useAuth();
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // checkout modal state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanKey>("growth");
  const [checkoutAction, setCheckoutAction] = useState<CheckoutAction>("renew");
  const [cycle, setCycle] = useState<CycleKey>("term");
  const [promoCode, setPromoCode] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const currentPlanKey = (school?.subscription_plan as PlanKey) || "free_trial";
  const status = school?.subscription_status || "unknown";
  const isTester = Boolean(school?.is_tester);

  const fetchSchool = useCallback(async () => {
    if (!authSchool?.id && !school?.id) return;
    setLoadingSchool(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data, error } = await supabase
        .from("schools")
        .select(
          "id, name, subscription_plan, subscription_status, billing_mode, school_size_band, next_payment_date, last_payment_at, trial_ends_at, scheduled_plan, scheduled_plan_change_at, is_tester",
        )
        .eq("id", authSchool?.id || school?.id)
        .maybeSingle();
      if (error) throw error;
      setSchool(data as SchoolRow);
    } catch {
      toast.error("Failed to load subscription status");
    } finally {
      setLoadingSchool(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSchool?.id, toast]);

  useEffect(() => {
    fetchSchool();
  }, [fetchSchool]);

  const getQuote = useCallback(
    async (action: CheckoutAction, plan: PlanKey, cycleKey: CycleKey, code: string) => {
      setFetchingQuote(true);
      try {
        const response = await fetch("/api/billing/quote/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            plan,
            cycle: cycleKey,
            promoCode: code.trim() || null,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to calculate quote");
        }
        setQuote(result.data as QuoteResponse);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
      } catch (err) {
        setQuote(null);
        toast.error(err instanceof Error ? err.message : "Quote failed");
      } finally {
        setFetchingQuote(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [toast],
  );

  useEffect(() => {
    if (checkoutOpen) {
      getQuote(checkoutAction, checkoutPlan, cycle, promoCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen, checkoutAction, checkoutPlan, cycle, promoCode]);

  const openCheckout = (plan: PlanKey) => {
    const action: CheckoutAction = planLevel(plan) >= planLevel(currentPlanKey) ? "renew" : "upgrade";
    // Moving to a lower plan = scheduled downgrade, handled separately.
    if (planLevel(plan) < planLevel(currentPlanKey)) {
      requestDowngrade(plan);
      return;
    }
    setCheckoutAction(planLevel(plan) === planLevel(currentPlanKey) ? "renew" : "upgrade");
    setCheckoutPlan(plan);
    setCheckoutOpen(true);
  };

  const requestDowngrade = async (plan: PlanKey) => {
    try {
      const response = await fetch("/api/billing/change-plan/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule-downgrade", plan }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to schedule");
      toast.success(`Downgrade scheduled for ${formatDate(result.data?.effectiveAt)}`);
      await fetchSchool();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scheduling failed");
    }
  };

  const cancelScheduled = async () => {
    try {
      const response = await fetch("/api/billing/change-plan/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel-scheduled" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed");
      toast.success("Scheduled change cancelled");
      await fetchSchool();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    }
  };

  const payWithPayPal = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/payment/checkout/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "paypal",
          plan: checkoutPlan,
          cycle,
          promoCode: promoCode.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.url) {
        throw new Error(result.error || "PayPal payment failed");
      }
      const target = String(result.url).trim();
      const newTab = window.open(target, "_blank", "noopener,noreferrer");
      if (!newTab) window.location.assign(target);
      toast.success("Complete the payment in PayPal — your subscription activates automatically.");
      setCheckoutOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `${err.message} You can also submit a payment reference below.`
          : "PayPal payment failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitManualPayment = async () => {
    if (reference.trim().length < 3) {
      toast.error("Enter the mobile money code, receipt number or bank reference");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/billing/manual-payment/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          reference: reference.trim(),
          note: note.trim() || undefined,
          action: checkoutAction,
          plan: checkoutPlan,
          cycle,
          promoCode: promoCode.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Submission failed");
      toast.success("Payment submitted — we'll confirm and activate shortly");
      setCheckoutOpen(false);
      setReference("");
      setNote("");
      await fetchSchool();
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const payWithMobileMoney = async (provider: "mtn" | "airtel") => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/payment/mobile-money/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, plan: checkoutPlan }),
      });
      const result = await response.json();
      if (!response.ok || (!result.success && !result.paymentLink)) {
        throw new Error(result.error || "Payment request failed");
      }
      toast.success(
        provider === "mtn"
          ? "Check your phone for the MTN MoMo prompt and enter your PIN"
          : "Check your phone for the Airtel Money prompt and enter your PIN",
      );
      setCheckoutOpen(false);
      await fetchSchool();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `${err.message} You can also submit a payment reference below.`
          : "Payment request failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSchool) {
    return (
      <Card>
        <CardBody>
          <div className="text-sm text-[var(--t3)]">Loading your subscription…</div>
        </CardBody>
      </Card>
    );
  }

  const hasScheduledChange = Boolean(school?.scheduled_plan);
  const nextRenewal = school?.next_payment_date || school?.trial_ends_at;

  return (
    <>
      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--on-surface)]">SkoolMate Subscription</h2>
              <p className="text-sm text-[var(--t3)]">
                {isTester
                  ? "Test account — full access enabled"
                  : STATUS_COPY[status] || "Subscription status unavailable"}
                {isTester ? "" : nextRenewal ? ` · renews ${formatDate(nextRenewal)}` : ""}
              </p>
            </div>
            <div className="px-4 py-2 bg-[var(--green-soft)] text-[var(--green-ink)] rounded-full text-sm font-semibold">
              {planName(currentPlanKey).toUpperCase()} PLAN
            </div>
          </div>

          {hasScheduledChange && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center justify-between gap-3">
              <span>
                Downgrade to <strong>{planName(school!.scheduled_plan!)}</strong> scheduled for{" "}
                <strong>{formatDate(school!.scheduled_plan_change_at)}</strong>. You keep your current plan until then.
              </span>
              <Button variant="secondary" onClick={cancelScheduled}>
                Cancel
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(Object.values(PLANS_CONFIG) as (typeof PLANS_CONFIG)[PlanKey][])
              .filter((p) => p.key !== "free_trial" && p.key !== "lifetime")
              .sort((a, b) => a.sort - b.sort)
              .map((plan) => {
                const isCurrent = plan.key === currentPlanKey;
                const grossPerStudent = plan.pricePerStudentPerTerm;
                const netPerStudent = Math.round(grossPerStudent * (1 - PLATFORM_PROMO_PERCENT / 100));
                return (
                  <div
                    key={plan.key}
                    className={`p-6 rounded-2xl border-2 relative ${
                      plan.highlight && !isCurrent
                        ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                        : "border-[var(--border)] bg-[var(--surface-container-low)]"
                    }`}
                  >
                    {plan.highlight && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--primary)] text-white text-xs font-bold rounded-full uppercase">
                        Most Popular
                      </div>
                    )}
                    <div
                      className={`text-sm font-bold uppercase tracking-wider mb-2 ${
                        plan.highlight && !isCurrent ? "text-[var(--primary)]" : "text-[var(--t3)]"
                      }`}
                    >
                      {plan.name}
                    </div>
                    <div className="text-2xl font-bold mb-1 text-[var(--t1)]">
                      {formatUgx(netPerStudent)}{" "}
                      <span className="text-sm font-normal text-[var(--t3)]">/student/term</span>
                    </div>
                    {PLATFORM_PROMO_PERCENT > 0 && (
                      <div className="text-xs text-[var(--t3)] mb-4">
                        <s>{formatUgx(grossPerStudent)}</s> · {PLATFORM_PROMO_PERCENT}% launch promo
                      </div>
                    )}
                    <p className="text-xs text-[var(--t2)] mb-4">{plan.tagline}</p>
                    <ul className="space-y-3 mb-6">
                      {plan.highlights.map((h) => (
                        <li key={h} className="flex items-center gap-2 text-sm">
                          <MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> {h}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={plan.highlight && !isCurrent ? "primary" : "secondary"}
                      className="w-full"
                      disabled={isTester}
                      onClick={() => openCheckout(plan.key)}
                    >
                      {isCurrent
                        ? "Manage / Renew"
                        : planLevel(plan.key) < planLevel(currentPlanKey)
                          ? "Downgrade"
                          : "Select"}
                    </Button>
                  </div>
                );
              })}
          </div>

          <div className="mt-4 text-xs text-[var(--t3)]">
            Prices are per student, per term. Annual billing saves {BILLING_CYCLES.annual.discountPercent}%. Choose
            <strong> term</strong> for the shortest commitment.
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold mb-4 text-[var(--on-surface)]">Why upgrade to Enterprise?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: "inventory_2",
                title: "Full suite included",
                text: "Every module — payroll, canteen, dormitory, library, transport, assets, analytics — with no per-module fees.",
              },
              {
                icon: "smart_toy",
                title: "AI Smart Advisor",
                text: "Proactive alerts on performance drops, fee deficits, and staff workload optimization.",
              },
              {
                icon: "notifications_active",
                title: "Auto-SMS for parents",
                text: "Recover fees faster with automatic, personalised SMS nudges (up to unlimited quota).",
              },
              {
                icon: "infinity",
                title: "Unlimited students & staff",
                text: "No student cap and unlimited staff/admin logins as your school grows.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-4 rounded-xl bg-[var(--surface-container)]">
                <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] flex items-center justify-center shrink-0">
                  <MaterialIcon icon={item.icon} className="text-[var(--primary)]" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{item.title}</div>
                  <div className="text-xs text-[var(--t3)]">{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
          <div aria-hidden="true" className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-[var(--surface)] rounded-2xl p-6 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto my-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--on-surface)]">
                Billing — {checkoutAction === "upgrade" ? "Upgrade to " : "Renew "}
                {planName(checkoutPlan)}
              </h3>
              <button
                onClick={() => setCheckoutOpen(false)}
                className="text-[var(--t3)] hover:text-[var(--on-surface)]"
              >
                <MaterialIcon icon="close" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(Object.keys(BILLING_CYCLES) as CycleKey[]).map((key) => (
                <Button key={key} variant={cycle === key ? "primary" : "secondary"} onClick={() => setCycle(key)}>
                  {key === "term" ? "Per term" : `Per year (−${BILLING_CYCLES.annual.discountPercent}%)`}
                </Button>
              ))}
            </div>

            <label className="block text-xs uppercase tracking-wider text-[var(--t3)] mb-1">Promo code</label>
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Optional"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container-low)] px-3 py-2 mb-4 text-sm"
            />

            {fetchingQuote && <div className="py-4 text-sm text-[var(--t3)]">Calculating quote…</div>}

            {quote && !fetchingQuote && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] p-4 mb-4 space-y-2 text-sm">
                {quote.lines.map((line) => (
                  <div key={line.id} className="flex justify-between gap-2">
                    <span className="text-[var(--t2)]">
                      {line.label}
                      {line.detail && <span className="block text-xs text-[var(--t3)]">{line.detail}</span>}
                    </span>
                    <span className="font-semibold">{formatUgx(line.amount)}</span>
                  </div>
                ))}
                {quote.credits
                  .filter((c) => c.amount !== 0 && c.id !== "included")
                  .map((c) => (
                    <div key={c.id} className="flex justify-between gap-2 text-green-700">
                      <span>{c.label}</span>
                      <span className="font-semibold">−{formatUgx(c.amount)}</span>
                    </div>
                  ))}
                <div className="flex justify-between gap-2 pt-2 border-t border-[var(--border)] text-base">
                  <span className="font-semibold">Total due now</span>
                  <span className="font-bold">{formatUgx(quote.totalDue)}</span>
                </div>
                <div className="text-xs text-[var(--t3)]">
                  Covers your school until {formatDate(quote.coverageUntil)}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button className="w-full" loading={submitting} onClick={() => payWithMobileMoney("mtn")}>
                <MaterialIcon icon="phone_android" className="mr-1" /> Pay by MTN Mobile Money
              </Button>
              <Button variant="secondary" disabled={submitting} onClick={() => payWithMobileMoney("airtel")}>
                <MaterialIcon icon="phone_android" className="mr-1" /> Pay by Airtel Money
              </Button>
              <Button variant="secondary" disabled={submitting} onClick={payWithPayPal}>
                <MaterialIcon icon="credit_card" className="mr-1" /> Pay with PayPal (card)
              </Button>

              <div className="pt-3 border-t border-[var(--border)]">
                <div className="text-xs uppercase tracking-wider text-[var(--t3)] mb-2">
                  Already paid? Submit your proof
                </div>
                <div className="flex gap-2 mb-2">
                  <Button variant={method === "cash" ? "primary" : "secondary"} onClick={() => setMethod("cash")}>
                    Cash
                  </Button>
                  <Button variant={method === "bank" ? "primary" : "secondary"} onClick={() => setMethod("bank")}>
                    Bank deposit
                  </Button>
                </div>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={method === "bank" ? "Bank reference / slip no." : "Mobile money transaction code"}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container-low)] px-3 py-2 mb-2 text-sm"
                />
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container-low)] px-3 py-2 mb-2 text-sm"
                />
                <Button variant="secondary" className="w-full" loading={submitting} onClick={submitManualPayment}>
                  Submit for confirmation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
