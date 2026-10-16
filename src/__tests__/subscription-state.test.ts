import {
  isSubscriptionLapsed,
  LAPSED_SUBSCRIPTION_STATUSES,
  resolveSubscriptionStatus,
} from "@/lib/subscription-state";

/**
 * `subscription_status` is a stored string that only changes when somebody
 * changes it. On the live project, 6 of 12 schools read "trial" with a
 * `trial_ends_at` in the past -- one of them four months gone, on an enterprise
 * plan. Nothing in the app trusted the string alone for gating, but the
 * super-admin dashboard counted by it, so the one screen whose job is to show
 * who needs chasing reported 10 trials and 0 expired.
 *
 * These pin the derived answer, and the real rows that produced the bug.
 */

const NOW = new Date("2026-10-16T00:00:00Z").getTime();
const past = "2026-06-11T16:22:18.002Z";
const future = "2026-12-01T00:00:00Z";

const school = (over: Record<string, unknown> = {}) => ({
  subscription_status: "trial",
  trial_ends_at: past,
  is_tester: false,
  ...over,
});

describe("resolveSubscriptionStatus", () => {
  it("reports a lapsed trial as expired", () => {
    expect(resolveSubscriptionStatus(school(), NOW)).toBe("expired");
  });

  it("reports a live trial as a trial", () => {
    expect(resolveSubscriptionStatus(school({ trial_ends_at: future }), NOW)).toBe("trial");
  });

  it("leaves active alone", () => {
    expect(resolveSubscriptionStatus(school({ subscription_status: "active" }), NOW)).toBe("active");
  });

  it("passes other lapsed statuses through", () => {
    for (const status of LAPSED_SUBSCRIPTION_STATUSES) {
      expect(resolveSubscriptionStatus(school({ subscription_status: status }), NOW)).toBe(status);
    }
  });

  it("trusts a trial with no end date rather than inventing an answer", () => {
    // Reclassifying an undated trial as expired would lock out a live school.
    expect(resolveSubscriptionStatus(school({ trial_ends_at: null }), NOW)).toBe("trial");
  });

  it("never reports a tester as expired", () => {
    expect(resolveSubscriptionStatus(school({ is_tester: true }), NOW)).toBe("trial");
    expect(resolveSubscriptionStatus(school({ subscription_status: "expired", is_tester: true }), NOW)).toBe("expired");
  });

  it("handles no school", () => {
    expect(resolveSubscriptionStatus(null, NOW)).toBeNull();
  });
});

describe("isSubscriptionLapsed", () => {
  it("flags a lapsed trial", () => {
    expect(isSubscriptionLapsed(school(), NOW)).toBe(true);
  });

  it("does not flag a live trial", () => {
    expect(isSubscriptionLapsed(school({ trial_ends_at: future }), NOW)).toBe(false);
  });

  it("does not flag an active school", () => {
    expect(isSubscriptionLapsed(school({ subscription_status: "active" }), NOW)).toBe(false);
  });

  it("does not flag a tester", () => {
    expect(isSubscriptionLapsed(school({ is_tester: true }), NOW)).toBe(false);
  });
});

describe("the counts the super-admin dashboard shows", () => {
  // Modelled on the live problem -- 12 schools, most of them reading "trial"
  // with a date already past -- but NOT a copy of it. The live rows contain no
  // suspended or canceled schools, so the fixture adds one of each to prove the
  // lapsed bucket absorbs more than just an expired trial. Live figures at the
  // time of the fix were active 2 / trial 4 / expired 6.
  const live = [
    school({ trial_ends_at: future }), // genuinely on trial
    school({ trial_ends_at: "2026-11-20T00:00:00Z" }),
    school({ subscription_status: "active" }),
    school({ subscription_status: "active" }),
    school(), // Gideon Vision, enterprise, lapsed 2026-08-22
    school(), // Test High, lapsed 2026-06-11
    school(), // lapsed 2026-06-24
    school(), // lapsed 2026-06-24
    school(), // lapsed 2026-06-25
    school(), // lapsed 2026-06-25
    school({ subscription_status: "suspended" }),
    school({ subscription_status: "canceled" }),
  ];

  it("no longer reports lapsed trials as trials", () => {
    const trial = live.filter((s) => resolveSubscriptionStatus(s, NOW) === "trial").length;
    const expired = live.filter((s) => isSubscriptionLapsed(s, NOW)).length;
    const active = live.filter((s) => resolveSubscriptionStatus(s, NOW) === "active").length;

    // Counting the raw column instead would have reported these as 2 / 10 / 0.
    expect({ active, trial, expired }).toEqual({ active: 2, trial: 2, expired: 8 });
  });

  it("every school lands in exactly one bucket", () => {
    // The old code could count a lapsed trial as neither, or as two.
    for (const s of live) {
      const status = resolveSubscriptionStatus(s, NOW);
      const isActive = status === "active";
      const isTrial = status === "trial";
      const isExpired = isSubscriptionLapsed(s, NOW);
      expect([isActive, isTrial, isExpired].filter(Boolean).length).toBe(1);
    }
  });
});
