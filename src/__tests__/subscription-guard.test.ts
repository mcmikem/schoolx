/**
 * @jest-environment node
 */
import { requireActiveSubscription, GRACE_PERIOD_DAYS } from "../lib/subscription-guard";

function mockSupabase(school: Record<string, unknown> | null) {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: school, error: null }),
        }),
      }),
    }),
  };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe("Subscription guard — expiry grace period", () => {
  test("expired school within grace keeps access with a warning", async () => {
    const res = await requireActiveSubscription({
      supabase: mockSupabase({
        id: "s1",
        name: "Test",
        subscription_status: "expired",
        subscription_plan: "starter",
        trial_ends_at: daysAgo(3),
        next_payment_date: null,
      }) as any,
      schoolId: "s1",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.warning).toMatch(/grace/i);
  });

  test("expired school past grace is denied", async () => {
    const res = await requireActiveSubscription({
      supabase: mockSupabase({
        id: "s1",
        name: "Test",
        subscription_status: "expired",
        subscription_plan: "starter",
        trial_ends_at: daysAgo(GRACE_PERIOD_DAYS + 5),
        next_payment_date: null,
      }) as any,
      schoolId: "s1",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });

  test("expired school with no expiry anchor still denies (never fail open)", async () => {
    const res = await requireActiveSubscription({
      supabase: mockSupabase({
        id: "s1",
        name: "Test",
        subscription_status: "expired",
        subscription_plan: "starter",
        trial_ends_at: null,
        next_payment_date: null,
      }) as any,
      schoolId: "s1",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });

  test("grace still enforces plan tier for gated features", async () => {
    const res = await requireActiveSubscription({
      supabase: mockSupabase({
        id: "s1",
        name: "Test",
        subscription_status: "expired",
        subscription_plan: "starter",
        trial_ends_at: daysAgo(2),
        next_payment_date: null,
      }) as any,
      schoolId: "s1",
      requiredPlan: "enterprise",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });

  test("grace prefers next_payment_date anchor for paid expiries", async () => {
    const res = await requireActiveSubscription({
      supabase: mockSupabase({
        id: "s1",
        name: "Test",
        subscription_status: "expired",
        subscription_plan: "growth",
        trial_ends_at: daysAgo(200),
        next_payment_date: daysAgo(1),
      }) as any,
      schoolId: "s1",
    });
    expect(res.ok).toBe(true);
  });

  test("active and trial schools unaffected", async () => {
    for (const status of ["active", "trial"]) {
      const res = await requireActiveSubscription({
        supabase: mockSupabase({
          id: "s1",
          name: "Test",
          subscription_status: status,
          subscription_plan: "starter",
        }) as any,
        schoolId: "s1",
      });
      expect(res.ok).toBe(true);
    }
  });
});
