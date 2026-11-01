// Billing config math — the core money tests for the billing overhaul.
// If these numbers change, the change must be deliberate: they are the prices
// schools are actually charged.
import {
  BILLING_CYCLES,
  PLANS_CONFIG,
  PLATFORM_PROMO_PERCENT,
  formatCompactUgx,
  formatUgx,
  isPlanUpgrade,
  planLevel,
  planName,
  prorationCreditForUpgrade,
  quoteAddOnPurchase,
  quotePlanPurchase,
} from "@/lib/billing/config";

const DAY = 24 * 60 * 60 * 1000;

describe("billing config — plan definitions", () => {
  test("starter allows 200 students; growth 500; enterprise unlimited", () => {
    expect(PLANS_CONFIG.starter.maxStudents).toBe(200);
    expect(PLANS_CONFIG.growth.maxStudents).toBe(500);
    expect(PLANS_CONFIG.enterprise.maxStudents).toBe(-1);
  });

  test("enterprise and lifetime unlock the full module stage", () => {
    expect(PLANS_CONFIG.enterprise.featureStage).toBe("full");
    expect(PLANS_CONFIG.lifetime.featureStage).toBe("full");
    expect(PLANS_CONFIG.growth.featureStage).toBe("academic");
  });

  test("plan hierarchy ordering", () => {
    expect(planLevel("free_trial")).toBeLessThan(planLevel("starter"));
    expect(planLevel("starter")).toBeLessThan(planLevel("growth"));
    expect(planLevel("growth")).toBeLessThan(planLevel("enterprise"));
    expect(isPlanUpgrade("starter", "growth")).toBe(true);
    expect(isPlanUpgrade("enterprise", "starter")).toBe(false);
    expect(planName("growth")).toBe("Growth");
  });
});

describe("quotePlanPurchase", () => {
  test("term renewal applies platform promo to raw per-student price", () => {
    const quote = quotePlanPurchase({ plan: "starter", cycle: "term", studentCount: 100 });
    expect(quote.subtotal).toBe(140000); // 2000 × 100 = 200k → −30% = 140k
    expect(quote.totalDue).toBe(140000);
    expect(quote.lines[0].label).toContain("100 students");
  });

  test("annual cycle multiplies by 3 terms then discounts 10%", () => {
    const quote = quotePlanPurchase({ plan: "growth", cycle: "annual", studentCount: 100 });
    const afterPromo = Math.round(3500 * 100 * (1 - PLATFORM_PROMO_PERCENT / 100)); // 245,000
    const base = afterPromo * 3; // 735,000
    expect(quote.subtotal).toBe(base);
    const discount = Math.round(base * (BILLING_CYCLES.annual.discountPercent / 100));
    expect(quote.discountTotal).toBe(discount);
    expect(quote.totalDue).toBe(base - discount);
    expect(quote.coverageUntil).toBeTruthy();
  });

  test("promo code discounts on top of platform promo", () => {
    const quote = quotePlanPurchase({
      plan: "starter",
      cycle: "term",
      studentCount: 100,
      platformPromoPercent: 0,
      promo: { code: "RURAL", percentOff: 10 },
    });
    expect(quote.subtotal).toBe(200000);
    expect(quote.discountTotal).toBe(20000);
    expect(quote.totalDue).toBe(180000);
    expect(quote.credits.find((c) => c.id === "promo")?.label).toContain("RURAL");
  });

  test("upgrade credit is clamped to the remaining total", () => {
    const quote = quotePlanPurchase({
      plan: "enterprise",
      cycle: "term",
      studentCount: 10,
      upgradeCredit: { label: "credit", amount: 999_999_999 },
    });
    expect(quote.totalDue).toBe(0);
  });

  test("single student minimum is enforced", () => {
    const quote = quotePlanPurchase({ plan: "starter", cycle: "term", studentCount: 0 });
    expect(quote.lines[0].label).toContain("1 student");
    expect(quote.subtotal).toBe(1400);
  });
});

describe("prorationCreditForUpgrade", () => {
  test("half the cycle remaining yields half the credit", () => {
    const now = new Date();
    const credit = prorationCreditForUpgrade({
      amountPaid: 140000,
      paidAt: new Date(now.getTime() - 2 * 30 * DAY).toISOString(),
      nextPaymentDate: new Date(now.getTime() + 2 * 30 * DAY).toISOString(),
      cycleMonths: 4,
      now,
    });
    expect(credit).not.toBeNull();
    expect(credit!.amount).toBe(70000);
    expect(credit!.label).toContain("days");
  });

  test("no credit when the paid period is over", () => {
    const now = new Date();
    const credit = prorationCreditForUpgrade({
      amountPaid: 140000,
      paidAt: new Date(now.getTime() - 6 * 30 * DAY).toISOString(),
      nextPaymentDate: new Date(now.getTime() - 2 * 30 * DAY).toISOString(),
      cycleMonths: 4,
      now,
    });
    expect(credit).toBeNull();
  });

  test("falls back to term length when no next payment date exists", () => {
    const now = new Date();
    const credit = prorationCreditForUpgrade({
      amountPaid: 140000,
      paidAt: new Date(now.getTime() - 2 * 30 * DAY).toISOString(),
      nextPaymentDate: null,
      cycleMonths: 4,
      now,
    });
    expect(credit).not.toBeNull();
    expect(credit!.amount).toBe(70000);
  });
});

describe("quoteAddOnPurchase", () => {
  test("quotes billable modules at size-band price", () => {
    const quote = quoteAddOnPurchase({
      moduleKeys: ["library", "transport"],
      sizeBand: "small",
      billingMode: "modular",
    });
    // small band: library 50k + transport 50k
    expect(quote.totalDue).toBe(100000);
    expect(quote.lines).toHaveLength(2);
  });

  test("plan-included modules are not charged", () => {
    const quote = quoteAddOnPurchase({
      moduleKeys: ["marks", "finance"],
      sizeBand: "small",
      plan: "growth", // academic stage includes marks
      billingMode: "full_suite",
    });
    expect(quote.lines.find((l) => l.id === "module:finance")).toBeTruthy();
    expect(quote.lines.find((l) => l.id === "module:marks")).toBeUndefined();
    expect(quote.credits.find((c) => c.id === "included:marks")).toBeUndefined();
    expect(quote.totalDue).toBe(200000); // finance small = 200k
  });

  test("free modules produce nothing to pay", () => {
    const quote = quoteAddOnPurchase({
      moduleKeys: ["dashboard", "attendance"],
      sizeBand: "small",
      billingMode: "modular",
    });
    expect(quote.totalDue).toBe(0);
    expect(quote.lines).toHaveLength(0);
  });
});

describe("formatting", () => {
  test("formatUgx adds separators and skips zero", () => {
    expect(formatUgx(140000)).toBe("UGX 140,000");
    expect(formatUgx(0)).toBe("Free");
  });

  test("formatCompactUgx collapses large sums", () => {
    expect(formatCompactUgx(12_000_000)).toBe("UGX 12M");
    expect(formatCompactUgx(250_000)).toBe("UGX 250k");
  });
});
