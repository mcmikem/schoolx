import {
  PAYMENT_PROVIDERS,
  getPlanFromAmount,
  getPlanPrice,
  validatePaymentAmount,
} from "../lib/payments/utils";
import { PLAN_PRICES } from "../lib/subscription";

describe("Payment Utils", () => {
  describe("PAYMENT_PROVIDERS", () => {
    test("has all required providers", () => {
      expect(PAYMENT_PROVIDERS.STRIPE).toBe("stripe");
      expect(PAYMENT_PROVIDERS.PAYPAL).toBe("paypal");
      expect(PAYMENT_PROVIDERS.MTN).toBe("mtn");
      expect(PAYMENT_PROVIDERS.AIRTEL).toBe("airtel");
    });
  });

  describe("getPlanFromAmount", () => {
    test("returns starter for starter price", () => {
      expect(getPlanFromAmount(PLAN_PRICES.starter.term)).toBe("starter");
    });

    test("returns growth for growth price", () => {
      expect(getPlanFromAmount(PLAN_PRICES.growth.term)).toBe("growth");
    });

    test("returns enterprise for enterprise price", () => {
      expect(getPlanFromAmount(PLAN_PRICES.enterprise.term)).toBe("enterprise");
    });

    test("returns free_trial for unknown amount", () => {
      expect(getPlanFromAmount(999999)).toBe("free_trial");
    });

    test("returns free_trial for zero", () => {
      expect(getPlanFromAmount(0)).toBe("free_trial");
    });
  });

  describe("getPlanPrice", () => {
    test("returns correct price for starter", () => {
      expect(getPlanPrice("starter")).toBe(PLAN_PRICES.starter.term);
    });

    test("returns correct price for growth", () => {
      expect(getPlanPrice("growth")).toBe(PLAN_PRICES.growth.term);
    });

    test("returns correct price for enterprise", () => {
      expect(getPlanPrice("enterprise")).toBe(PLAN_PRICES.enterprise.term);
    });

    test("returns 0 for free_trial", () => {
      expect(getPlanPrice("free_trial")).toBe(0);
    });

    test("returns 0 for invalid plan", () => {
      expect(getPlanPrice("invalid" as any)).toBe(0);
    });
  });

  describe("validatePaymentAmount", () => {
    test("validates exact amount", () => {
      expect(validatePaymentAmount(PLAN_PRICES.starter.term, "starter")).toBe(
        true,
      );
      expect(validatePaymentAmount(PLAN_PRICES.growth.term, "growth")).toBe(
        true,
      );
      expect(
        validatePaymentAmount(PLAN_PRICES.enterprise.term, "enterprise"),
      ).toBe(true);
    });

    test("validates overpayment", () => {
      expect(
        validatePaymentAmount(PLAN_PRICES.starter.term + 10000, "starter"),
      ).toBe(true);
    });

    test("rejects underpayment", () => {
      expect(
        validatePaymentAmount(PLAN_PRICES.starter.term - 10000, "starter"),
      ).toBe(false);
    });
  });
});

describe("Payment Price Consistency", () => {
  test("plan prices are positive", () => {
    expect(PLAN_PRICES.starter.term).toBeGreaterThan(0);
    expect(PLAN_PRICES.growth.term).toBeGreaterThan(0);
    expect(PLAN_PRICES.enterprise.term).toBeGreaterThan(0);
  });

  test("growth is more than starter", () => {
    expect(PLAN_PRICES.growth.term).toBeGreaterThan(PLAN_PRICES.starter.term);
  });

  test("enterprise is more than growth", () => {
    expect(PLAN_PRICES.enterprise.term).toBeGreaterThan(
      PLAN_PRICES.growth.term,
    );
  });
});
