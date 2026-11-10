// ═══════════════════════════════════════════════════════════════════════════
// SkoolMate Billing — canonical configuration & money math
//
// This file is THE single source of truth for:
//   • plan definitions (students caps, SMS quota, included feature stage)
//   • pricing (per student per term, raw) + payment cycles + promos
//   • add-on (module) catalogue pricing  → re-exports src/lib/modules/catalog
//   • quoting: plan renewals, upgrades (with proration credit), add-on bundles
//
// It must stay isomorphic (no server-only imports) so client components can
// render prices directly. Server code (src/lib/billing/service.ts, pricing
// /api routes) TESTS nothing here — it derives every amount via quoteFor().
// Never hardcode a UGX figure in a component; import from this file.
// ═══════════════════════════════════════════════════════════════════════════

import {
  MODULE_CATALOG,
  type BillingMode,
  type FeatureStage,
  type ModuleKey,
  type SchoolSizeBand,
  getAnnualModulePrice,
  getModuleDefinition,
  isModuleInFeatureStage,
} from "@/lib/modules/catalog";

// ─── Plans ───────────────────────────────────────────────────────────────────

export type PlanKey = "starter" | "growth" | "enterprise" | "lifetime" | "free_trial";

/** Raw per-student-per-term prices BEFORE any promo. */
export const RAW_PRICE_PER_STUDENT_PER_TERM: Record<Exclude<PlanKey, "free_trial" | "lifetime">, number> = {
  starter: 2000,
  growth: 3500,
  enterprise: 5500,
};

export const LIFETIME_ONE_TIME_UGX = 12_000_000;

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  pricePerStudentPerTerm: number; // raw, before promo
  maxStudents: number; // -1 = unlimited
  maxAdminUsers: number;
  smsQuotaPerTerm: number; // -1 = unlimited
  /** Modules bundled with the plan (via feature stage) in full-suite mode. */
  featureStage: FeatureStage;
  tagline: string;
  highlights: string[];
  highlight?: boolean; // "Most Popular" badge
  sort: number;
}

export const PLANS_CONFIG: Record<PlanKey, PlanDefinition> = {
  free_trial: {
    key: "free_trial",
    name: "Free Trial",
    pricePerStudentPerTerm: 0,
    maxStudents: 100,
    maxAdminUsers: 3,
    smsQuotaPerTerm: 50,
    featureStage: "core",
    tagline: "Everything set up, no charge",
    highlights: ["Up to 100 students", "Core modules", "30-day trial"],
    sort: 0,
  },
  starter: {
    key: "starter",
    name: "Starter",
    pricePerStudentPerTerm: RAW_PRICE_PER_STUDENT_PER_TERM.starter,
    maxStudents: 200,
    maxAdminUsers: 3,
    smsQuotaPerTerm: 100,
    featureStage: "core",
    tagline: "Small rural & primary schools",
    highlights: ["Up to 200 students", "Attendance + fee basics", "SMS messaging"],
    sort: 1,
  },
  growth: {
    key: "growth",
    name: "Growth",
    pricePerStudentPerTerm: RAW_PRICE_PER_STUDENT_PER_TERM.growth,
    maxStudents: 500,
    maxAdminUsers: 10,
    smsQuotaPerTerm: 500,
    featureStage: "academic",
    tagline: "Growing secondary schools",
    highlights: ["Up to 500 students", "Grades, exams & report cards", "Bulk SMS + parent portal"],
    highlight: true,
    sort: 2,
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    pricePerStudentPerTerm: RAW_PRICE_PER_STUDENT_PER_TERM.enterprise,
    maxStudents: -1,
    maxAdminUsers: 999,
    smsQuotaPerTerm: -1,
    featureStage: "full",
    tagline: "Everything, unlimited",
    highlights: ["Unlimited students", "Full suite — every module", "Payroll, assets & analytics"],
    sort: 3,
  },
  lifetime: {
    key: "lifetime",
    name: "Lifetime",
    pricePerStudentPerTerm: 0,
    maxStudents: -1,
    maxAdminUsers: 999,
    smsQuotaPerTerm: -1,
    featureStage: "full",
    tagline: "One payment, never pay again",
    highlights: ["Unlimited everything", "White-label", "Source code"],
    sort: 4,
  },
};

export const PLAN_ORDER: PlanKey[] = ["free_trial", "starter", "growth", "enterprise", "lifetime"];

export function planName(plan: string): string {
  return PLANS_CONFIG[plan as PlanKey]?.name ?? plan;
}

/** 0 = free_trial, 1 = starter … 4 = lifetime. */
export function planLevel(plan: string): number {
  const idx = PLAN_ORDER.indexOf(plan as PlanKey);
  return idx < 0 ? -1 : idx;
}

export function isPlanUpgrade(currentPlan: string, nextPlan: string): boolean {
  return planLevel(nextPlan) > planLevel(currentPlan);
}

// ─── Payment cycles ─────────────────────────────────────────────────────────

export type CycleKey = "term" | "annual";

export interface CycleDefinition {
  key: CycleKey;
  label: string;
  months: number; // period covered (1 term ≈ 4 months, school year = 12)
  terms: number;
  /** Extra discount for committing to the whole year. */
  discountPercent: number;
}

export const BILLING_CYCLES: Record<CycleKey, CycleDefinition> = {
  term: { key: "term", label: "per term", months: 4, terms: 1, discountPercent: 0 },
  annual: { key: "annual", label: "per year", months: 12, terms: 3, discountPercent: 10 },
};

/** Platform-wide promo currently advertised on /pricing (30% launch promo). */
export const PLATFORM_PROMO_PERCENT = 30;

// ─── Plan feature flags (shared by legacy subscription.ts/client shapes) ─────
// These booleans back the legacy `PlanFeatures` interfaces that dashboards and
// paywall checks already consume. Kept here so there is exactly one flag table.

export interface PlanFeatureFlags {
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

const ALL_FLAGS: PlanFeatureFlags = {
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
};

const ALL_FLAG_KEYS = Object.keys(ALL_FLAGS) as Array<keyof PlanFeatureFlags>;

const NO_FLAGS = ALL_FLAG_KEYS.reduce((acc, k) => ({ ...acc, [k]: false }), {} as PlanFeatureFlags);

export const PLAN_FEATURE_FLAGS: Record<PlanKey, PlanFeatureFlags> = {
  free_trial: NO_FLAGS,
  starter: { ...NO_FLAGS, offlineMode: true },
  growth: {
    ...NO_FLAGS,
    offlineMode: true,
    parentPortal: true,
    syllabus: true,
    lessonPlans: true,
    dormManagement: true,
    transport: true,
    library: true,
    budgets: true,
  },
  enterprise: { ...ALL_FLAGS, sourceCode: false, onPremise: false, whiteLabel: false },
  lifetime: ALL_FLAGS,
};

export function planFeatureFlags(plan: PlanKey): PlanFeatureFlags {
  return PLAN_FEATURE_FLAGS[plan] ?? NO_FLAGS;
}

/** "1 Nov 2026" style date used across billing UIs and SMS. */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatUgx(amount: number): string {
  if (!Number.isFinite(amount)) return "UGX 0";
  if (amount === 0) return "Free";
  return `UGX ${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatCompactUgx(amount: number): string {
  if (amount >= 1_000_000) {
    const m = Math.round(amount / 100_000) / 10;
    return `UGX ${m}M`;
  }
  if (amount >= 1_000) {
    const k = Math.round(amount / 1_000);
    return `UGX ${k}k`;
  }
  return formatUgx(amount);
}

// ─── Quoting ────────────────────────────────────────────────────────────────

export interface QuoteLine {
  id: string;
  label: string;
  detail?: string;
  amount: number; // positive charge
}

export interface QuoteCredit {
  id: string;
  label: string;
  amount: number; // positive discount
}

export interface PromoInput {
  code?: string | null;
  percentOff?: number; // resolved from promo_codes table by the API layer
  label?: string;
}

export interface Quote {
  lines: QuoteLine[];
  credits: QuoteCredit[];
  subtotal: number;
  discountTotal: number;
  totalDue: number;
  cycle: CycleKey;
  /** ISO date the purchase would keep the school covered until. */
  coverageUntil: string | null;
  currency: "UGX";
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0); // month-end rollover safety
  return d;
}

export function coverageFromNow(cycleMonths: number): Date {
  return addMonths(new Date(), cycleMonths);
}

export function quotaExceeded(students: number, plan: PlanKey): boolean {
  const max = PLANS_CONFIG[plan].maxStudents;
  if (max < 0) return false;
  return students > max;
}

/**
 * Quote for buying/renewing a plan.
 * platformPromoPercent can be 0 to disable the launch promo; promoInput
 * (from DB promo_codes) discounts on top of the platform promo.
 */
export function quotePlanPurchase(params: {
  plan: Exclude<PlanKey, "free_trial">;
  cycle: CycleKey;
  studentCount: number;
  platformPromoPercent?: number;
  promo?: PromoInput;
  /** Current date for coverage calculations (defaults to now). */
  now?: Date;
  /** Remaining-credit context for upgrades, computed by proration info below. */
  upgradeCredit?: { label: string; amount: number } | null;
}): Quote {
  const {
    plan,
    cycle,
    studentCount,
    platformPromoPercent = PLATFORM_PROMO_PERCENT,
    promo,
    now = new Date(),
    upgradeCredit = null,
  } = params;
  const cycleDef = BILLING_CYCLES[cycle];
  const def = PLANS_CONFIG[plan];
  const students = Math.max(studentCount, 1);

  const grossPerTerm = def.pricePerStudentPerTerm * students;
  const perTermAfterPlatformPromo = Math.round(grossPerTerm * (1 - platformPromoPercent / 100));
  const base = perTermAfterPlatformPromo * cycleDef.terms;

  const lines: QuoteLine[] = [
    {
      id: "plan",
      label: `${def.name} plan — ${students} student${students === 1 ? "" : "s"} × ${cycleDef.terms} term${cycleDef.terms === 1 ? "" : "s"}`,
      detail: `UGX ${def.pricePerStudentPerTerm.toLocaleString()}/student/term`,
      amount: base,
    },
  ];
  const credits: QuoteCredit[] = [];

  let runningTotal = base;

  if (cycleDef.discountPercent > 0) {
    const d = Math.round((base * cycleDef.discountPercent) / 100);
    credits.push({ id: "cycle", label: `Annual commitment discount (${cycleDef.discountPercent}%)`, amount: d });
    runningTotal -= d;
  }

  if (promo?.percentOff && promo.percentOff > 0) {
    const d = Math.round((runningTotal * promo.percentOff) / 100);
    credits.push({ id: "promo", label: `Promo code ${promo.code ?? ""} (−${promo.percentOff}%)`.trim(), amount: d });
    runningTotal -= d;
  }

  if (upgradeCredit && upgradeCredit.amount > 0) {
    credits.push({
      id: "proration",
      label: upgradeCredit.label || "Credit for unused time on current plan",
      amount: Math.min(upgradeCredit.amount, runningTotal),
    });
    runningTotal -= Math.min(upgradeCredit.amount, runningTotal);
  }

  return {
    lines,
    credits,
    subtotal: base,
    discountTotal: base - runningTotal,
    totalDue: Math.max(runningTotal, 0),
    cycle,
    coverageUntil: coverageFromNow(cycleDef.months).toISOString(),
    currency: "UGX",
  };
}

/**
 * Quote for buying add-on modules (annual license, sized to the school).
 * Only modules NOT already included by the plan's feature stage should be
 * quoted — pass the school's billing context so duplicated lines never happen.
 */
export function quoteAddOnPurchase(params: {
  moduleKeys: ModuleKey[];
  sizeBand: SchoolSizeBand;
  plan?: PlanKey; // used to detect already-included modules
  billingMode: BillingMode;
  promo?: PromoInput;
  now?: Date;
}): Quote {
  const { moduleKeys, sizeBand, plan, billingMode, promo, now = new Date() } = params;
  const planStage = plan ? PLANS_CONFIG[plan].featureStage : undefined;

  const lines: QuoteLine[] = [];
  const credits: QuoteCredit[] = [];
  let subtotal = 0;

  // A repeated key must not create duplicate charge lines if a caller bypasses
  // route-level validation or retries with an unchanged selection.
  for (const key of new Set(moduleKeys)) {
    const def = getModuleDefinition(key);
    if (!def) continue;

    if (billingMode !== "modular" && planStage && isModuleInFeatureStage(planStage, key)) {
      // Already included by the plan — no charge, no noise line.
      continue;
    }
    const price = getAnnualModulePrice(def, sizeBand);
    if (price <= 0) continue;
    subtotal += price;
    lines.push({
      id: `module:${key}`,
      label: `${def.display_name} — annual license`,
      detail: `${sizeBand} school pricing`,
      amount: price,
    });
  }

  let runningTotal = subtotal;
  if (promo?.percentOff && promo.percentOff > 0) {
    const d = Math.round((runningTotal * promo.percentOff) / 100);
    credits.push({ id: "promo", label: `Promo code ${promo.code ?? ""} (−${promo.percentOff}%)`.trim(), amount: d });
    runningTotal -= d;
  }

  return {
    lines,
    credits,
    subtotal,
    discountTotal: subtotal - runningTotal,
    totalDue: Math.max(runningTotal, 0),
    cycle: "annual",
    coverageUntil: addMonths(now, 12).toISOString(),
    currency: "UGX",
  };
}

/**
 * Proration credit when upgrading mid-cycle:
 *   remaining_time_fraction × what_was_paid_for_the_current_cycle.
 * cycleMonths: length of the paid cycle (term=4, annual=12). Pass the cycle
 * recorded on the pending/completed payment when known (new payments store
 * intent.months); falls back to a 4-month term for legacy payments.
 */
export function prorationCreditForUpgrade(params: {
  amountPaid: number;
  paidAt: string | Date;
  nextPaymentDate: string | Date | null;
  cycleMonths?: number;
  now?: Date;
}): { amount: number; label: string } | null {
  const { amountPaid, paidAt, nextPaymentDate, cycleMonths = 4, now = new Date() } = params;
  if (!amountPaid || amountPaid <= 0) return null;

  const start = new Date(paidAt).getTime();
  const end = nextPaymentDate ? new Date(nextPaymentDate).getTime() : NaN;
  const nowMs = now.getTime();
  if (!Number.isFinite(start)) return null;

  const cycleMs = cycleMonths * 30 * 24 * 60 * 60 * 1000;
  const endMs = Number.isFinite(end) ? end : start + cycleMs;
  const remaining = endMs - nowMs;
  if (remaining <= 0) return null;

  const fraction = clamp(remaining / cycleMs, 0, 1);
  const daysLeft = Math.max(1, Math.round(remaining / (24 * 60 * 60 * 1000)));
  const amount = Math.round(amountPaid * fraction);
  if (amount <= 0) return null;

  return { amount, label: `Credit for unused time on current plan (~${daysLeft} days)` };
}

// Re-exports so callers only need one import site.
export { MODULE_CATALOG, getAnnualModulePrice, getModuleDefinition };
export type { ModuleKey, SchoolSizeBand, BillingMode, FeatureStage };
