/**
 * Derived school billing state.
 *
 * Deliberately its own module with no imports. `subscription.ts` reaches for a
 * server-only Supabase client further down, so importing the helpers from there
 * into client code drags `next/headers` into the browser bundle and fails the
 * build. This one is pure and safe from either side.
 */

/**
 * A school's billing state as it actually stands right now.
 *
 * `subscription_status` is a stored string that only changes when somebody
 * updates it, so it drifts: a trial that lapsed four months ago is still
 * "trial" until a human flips it. Nothing in the app depended on that string
 * alone -- gating already compared `trial_ends_at` -- but the super-admin
 * dashboard counted schools by the raw column, so the one screen whose job is
 * to show which schools need chasing reported 10 trials and 0 expired when 6 of
 * those trials had already run out.
 *
 * Deriving it in one place keeps reporting and gating telling the same story.
 * Gating already behaved this way; only the reporting disagreed.
 */

export type DerivedSubscriptionStatus = "active" | "trial" | "expired" | string;

export interface SubscriptionStateInput {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  is_tester?: boolean | null;
}

/**
 * Statuses that mean "this school is not paying and should be chased",
 * regardless of how it got there. Mirrors the group the super-admin dashboard
 * and the entitlement checks already treat as lapsed.
 */
export const LAPSED_SUBSCRIPTION_STATUSES: readonly string[] = [
  "expired",
  "canceled",
  "suspended",
  "past_due",
  "unpaid",
];

export function resolveSubscriptionStatus(
  school: SubscriptionStateInput | null | undefined,
  now: number = Date.now(),
): DerivedSubscriptionStatus | null {
  if (!school) return null;
  const stored = (school.subscription_status || "").trim();
  // A tester is never lapsed, matching computeTrialExpired.
  if (school.is_tester) return stored || "active";
  if (stored === "trial") {
    // A trial with no end date cannot be judged, so it is taken at face value
    // rather than being silently reclassified.
    if (!school.trial_ends_at) return "trial";
    return new Date(school.trial_ends_at).getTime() < now ? "expired" : "trial";
  }
  return stored || null;
}

/** True when the school is, by the clock, no longer in good standing. */
export function isSubscriptionLapsed(school: SubscriptionStateInput | null | undefined, now?: number): boolean {
  const status = resolveSubscriptionStatus(school, now);
  if (!status) return false;
  return status === "expired" || LAPSED_SUBSCRIPTION_STATUSES.includes(status);
}
