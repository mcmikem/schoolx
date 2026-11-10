/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

let callerRole = "teacher";
const mockRequireUserWithSchool: any = jest.fn();
const mockCreateSupabaseServerClient: any = jest.fn();
const mockCreateServiceClient: any = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiError: (error: string, status: number) => Response.json({ error }, { status }),
  handleApiError: () => Response.json({ error: "safe failure" }, { status: 500 }),
  requireUserWithSchool: (...args: unknown[]) => mockRequireUserWithSchool(...args),
  assertUserRoleOrDeny: ({ userRole, allowedRoles }: { userRole: string; allowedRoles: string[] }) =>
    allowedRoles.includes(userRole)
      ? { ok: true }
      : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) },
  rateLimit: () => ({ success: true }),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) => mockCreateSupabaseServerClient(...args),
}));
jest.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => mockCreateServiceClient(...args) }));
jest.mock("@/lib/payments/paypal", () => ({ createPayPalOrder: jest.fn() }));
jest.mock("@/lib/payments/mobile-money", () => ({ createMobileMoneyPaymentLink: jest.fn() }));
jest.mock("@/lib/payments/exchange-rate", () => ({ getExchangeRate: jest.fn() }));
jest.mock("@/lib/billing/service", () => ({
  BillingError: class BillingError extends Error {
    status = 400;
  },
  buildQuote: jest.fn(),
  generateTransactionRef: jest.fn(),
  createPendingSubscriptionPayment: jest.fn(),
}));

function makeRequest(body: unknown) {
  return new NextRequest("https://skoolmate.test/api/billing/module-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("module checkout auth and input boundaries", () => {
  beforeEach(() => {
    callerRole = "teacher";
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mockRequireUserWithSchool.mockImplementation(async () => ({
      ok: true,
      context: {
        user: { id: "user-1", role: callerRole, email: "staff@example.test" },
        authUserId: "auth-user-1",
        schoolId: "school-1",
      },
    }));
  });

  it("denies non-billing roles before creating a privileged client", async () => {
    const { POST } = await import("@/app/api/billing/module-checkout/route");

    const response = await POST(makeRequest({ provider: "manual", moduleKeys: ["library"] }));

    expect(response.status).toBe(403);
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it.each([
    { provider: "other", moduleKeys: ["library"] },
    { provider: "manual", moduleKeys: ["library", "library"] },
    { provider: "manual", moduleKeys: Array(22).fill("library") },
  ])("rejects invalid or duplicate checkout selections before database access", async (body) => {
    callerRole = "school_admin";
    const { POST } = await import("@/app/api/billing/module-checkout/route");

    const response = await POST(makeRequest(body));

    expect(response.status).toBe(400);
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });
});
