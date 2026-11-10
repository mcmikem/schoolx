import { createClient } from "@supabase/supabase-js";
import { applyCompletedPayment } from "@/lib/billing/service";
import { activateSchoolSubscription } from "@/lib/payments/utils";
import { POST as retiredSubscriptionUpgrade } from "@/app/api/subscription/upgrade/route";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/billing/service", () => ({ applyCompletedPayment: jest.fn() }));

function queryResult(table: string, ledger: Record<string, unknown>, school: Record<string, unknown>) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq", "update"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.maybeSingle = jest.fn(async () => ({ data: table === "schools" ? school : ledger, error: null }));
  return builder;
}

describe("subscription activation replay", () => {
  const school = {
    id: "school-1",
    subscription_plan: "growth",
    subscription_status: "active",
    next_payment_date: "2027-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    jest.clearAllMocks();
  });

  it("retires the legacy direct-upgrade endpoint with a pointer to checkout", async () => {
    const response = await retiredSubscriptionUpgrade();
    expect(response.status).toBe(410);
  });

  it("returns after applying a billing intent instead of extending the school again", async () => {
    const paymentQuery = queryResult(
      "subscription_payments",
      {
        school_id: "school-1",
        intent: { type: "renew", plan: "growth" },
        payment_status: "pending",
      },
      school,
    );
    const schoolQuery = queryResult("schools", {}, school);
    const admin = {
      from: jest.fn((table: string) => (table === "subscription_payments" ? paymentQuery : schoolQuery)),
    };
    (createClient as jest.Mock).mockReturnValue(admin);
    (applyCompletedPayment as jest.Mock).mockResolvedValue({ applied: true, result: { school } });

    await expect(activateSchoolSubscription("school-1", "growth", "mtn", "TX-1")).resolves.toEqual(school);

    expect(applyCompletedPayment).toHaveBeenCalledTimes(1);
    expect(paymentQuery.update).not.toHaveBeenCalled();
    expect(schoolQuery.update).not.toHaveBeenCalled();
  });

  it("does not activate a payment scoped to another school", async () => {
    const paymentQuery = queryResult(
      "subscription_payments",
      {
        school_id: "another-school",
        intent: { type: "renew", plan: "growth" },
        payment_status: "pending",
      },
      school,
    );
    const admin = { from: jest.fn(() => paymentQuery) };
    (createClient as jest.Mock).mockReturnValue(admin);

    await expect(activateSchoolSubscription("school-1", "growth", "mtn", "TX-2")).rejects.toThrow(
      "Payment school does not match",
    );
    expect(applyCompletedPayment).not.toHaveBeenCalled();
  });
});
