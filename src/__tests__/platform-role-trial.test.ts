import {
  computeTrialExpired,
  isPlatformRole,
  isSubscriptionActiveCheck,
  PLATFORM_SCOPED_ROLES,
} from "@/lib/auth-context-types";

/**
 * A super admin is not a school.
 *
 * Their profile still carries a `school_id` -- it records where they last signed
 * in, not a tenancy -- but reading that school's billing state as if it applied
 * to them put an expired-plan notice in front of someone who has no plan and no
 * school to expire. The account under investigation sat on a school whose trial
 * ended four months earlier and was still flagged "trial".
 *
 * The rule: platform roles are never judged by an individual school's clock.
 */

const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString();
const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

const school = (over: Record<string, unknown> = {}) =>
  ({
    id: "s1",
    name: "Some School",
    is_tester: false,
    subscription_status: "trial",
    subscription_plan: "starter",
    trial_ends_at: past,
    ...over,
  }) as never;

describe("platform roles", () => {
  it("recognises the roles that are not school-scoped", () => {
    expect(isPlatformRole("super_admin")).toBe(true);
    expect(isPlatformRole("marketer")).toBe(true);
  });

  it("does not treat school roles as platform roles", () => {
    for (const role of ["teacher", "headmaster", "bursar", "admin", "school_admin", "parent"]) {
      expect(isPlatformRole(role)).toBe(false);
    }
  });

  it("handles a missing role safely", () => {
    expect(isPlatformRole(null)).toBe(false);
    expect(isPlatformRole(undefined)).toBe(false);
    expect(isPlatformRole("")).toBe(false);
  });
});

describe("a super admin is never expired by a school", () => {
  it("ignores an expired trial", () => {
    expect(computeTrialExpired(school(), "super_admin")).toBe(false);
  });

  it("ignores a school already marked expired", () => {
    expect(computeTrialExpired(school({ subscription_status: "expired" }), "super_admin")).toBe(false);
  });

  it("holds even with no school loaded at all", () => {
    // Checked before the null school, so the exemption cannot be bypassed by
    // simply not having loaded a school yet.
    expect(computeTrialExpired(null, "super_admin")).toBe(false);
  });

  it("is treated as active for plan purposes", () => {
    expect(isSubscriptionActiveCheck(school(), "super_admin")).toBe(true);
    expect(isSubscriptionActiveCheck(null, "super_admin")).toBe(true);
  });

  it("applies to every platform-scoped role", () => {
    for (const role of PLATFORM_SCOPED_ROLES) {
      expect(computeTrialExpired(school(), role)).toBe(false);
    }
  });
});

describe("school roles are unaffected", () => {
  it("still expires a headmaster whose school trial has run out", () => {
    expect(computeTrialExpired(school(), "headmaster")).toBe(true);
  });

  it("still expires a teacher on an explicitly expired school", () => {
    expect(computeTrialExpired(school({ subscription_status: "expired" }), "teacher")).toBe(true);
  });

  it("still honours a live trial", () => {
    expect(computeTrialExpired(school({ trial_ends_at: future }), "teacher")).toBe(false);
  });

  it("still reports an expired school as inactive", () => {
    expect(isSubscriptionActiveCheck(school(), "headmaster")).toBe(false);
  });

  it("keeps the tester exemption for everyone", () => {
    expect(computeTrialExpired(school({ is_tester: true, subscription_status: "expired" }), "bursar")).toBe(false);
  });

  it("keeps prior behaviour when no role is supplied", () => {
    // Callers that do not know the role keep the old school-only answer.
    expect(computeTrialExpired(school())).toBe(true);
    expect(computeTrialExpired(school({ trial_ends_at: future }))).toBe(false);
  });
});
