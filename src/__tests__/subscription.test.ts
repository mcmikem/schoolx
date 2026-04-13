import {
  PLANS,
  PLAN_PRICES,
  canUseFeature,
  getFeatureLimit,
  formatPrice,
  getUpgradeMessage,
} from "../lib/subscription";
import { PlanType } from "../lib/payments/subscription-client";

describe("Subscription - Plan Features", () => {
  describe("PLANS", () => {
    test("starter has basic features", () => {
      expect(PLANS.starter.maxStudents).toBe(200);
      expect(PLANS.starter.offlineMode).toBe(true);
      expect(PLANS.starter.parentPortal).toBe(false);
    });

    test("growth has moderate features", () => {
      expect(PLANS.growth.maxStudents).toBe(500);
      expect(PLANS.growth.parentPortal).toBe(true);
      expect(PLANS.growth.syllabus).toBe(true);
    });

    test("enterprise has most features", () => {
      expect(PLANS.enterprise.maxStudents).toBe(999999);
      expect(PLANS.enterprise.parentPortal).toBe(true);
      expect(PLANS.enterprise.unebRegistration).toBe(true);
    });

    test("lifetime has all features", () => {
      expect(PLANS.lifetime.maxStudents).toBe(999999);
      expect(PLANS.lifetime.whiteLabel).toBe(true);
      expect(PLANS.lifetime.sourceCode).toBe(true);
    });
  });

  describe("PLAN_PRICES", () => {
    test("starter is UGX 2,000", () => {
      expect(PLAN_PRICES.starter.term).toBe(2000);
    });

    test("growth is UGX 3,500", () => {
      expect(PLAN_PRICES.growth.term).toBe(3500);
    });

    test("enterprise is UGX 5,500", () => {
      expect(PLAN_PRICES.enterprise.term).toBe(5500);
    });

    test("lifetime is one-time", () => {
      expect(PLAN_PRICES.lifetime.oneTime).toBeGreaterThan(0);
    });
  });
});

describe("Subscription - Feature Access", () => {
  test("starter cannot access parent portal", () => {
    expect(canUseFeature("starter", "parentPortal")).toBe(false);
  });

  test("growth can access parent portal", () => {
    expect(canUseFeature("growth", "parentPortal")).toBe(true);
  });

  test("enterprise can access UNEB registration", () => {
    expect(canUseFeature("enterprise", "unebRegistration")).toBe(true);
  });

  test("lifetime has white label", () => {
    expect(canUseFeature("lifetime", "whiteLabel")).toBe(true);
  });
});

describe("Subscription - getFeatureLimit", () => {
  test("returns student limits per plan", () => {
    expect(getFeatureLimit("starter", "maxStudents")).toBe(200);
    expect(getFeatureLimit("growth", "maxStudents")).toBe(500);
    expect(getFeatureLimit("enterprise", "maxStudents")).toBe(999999);
  });
});
