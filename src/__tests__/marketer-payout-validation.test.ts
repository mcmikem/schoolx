/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const inserts: any[] = [];
let targetRole = "marketer";

jest.mock("@/lib/api-utils", () => ({
  createServiceRoleClientOrThrow: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  requireAuthenticatedUser: async () => ({ ok: true, context: { authUserId: "super-auth" } }),
}));

function setup() {
  mockFrom.mockImplementation((table: string) => {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn((column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    });
    builder.maybeSingle = jest.fn(async () => ({
      data: filters.auth_id ? { role: "super_admin" } : { id: "marketer-1", role: targetRole },
      error: null,
    }));
    builder.insert = jest.fn((row: unknown) => {
      inserts.push(row);
      return builder;
    });
    builder.single = jest.fn(async () => ({ data: inserts.at(-1), error: null }));
    return builder;
  });
}

function makeRequest(body: unknown) {
  return new NextRequest("https://skoolmate.test/api/marketers/payouts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("marketer payout validation", () => {
  beforeEach(() => {
    targetRole = "marketer";
    inserts.length = 0;
    setup();
  });

  it.each([0, -10, "NaN", 10_000_000_000])("rejects invalid payout amount %s", async (amount) => {
    const { POST } = await import("@/app/api/marketers/payouts/route");
    const response = await POST(makeRequest({ marketer_id: "marketer-1", amount }));
    expect(response.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("requires the payout recipient to be a marketer", async () => {
    targetRole = "school_admin";
    const { POST } = await import("@/app/api/marketers/payouts/route");
    const response = await POST(makeRequest({ marketer_id: "marketer-1", amount: 25000 }));
    expect(response.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("creates a bounded positive amount as pending", async () => {
    const { POST } = await import("@/app/api/marketers/payouts/route");
    const response = await POST(makeRequest({ marketer_id: "marketer-1", amount: "25000", status: "paid" }));
    expect(response.status).toBe(200);
    expect(inserts[0]).toMatchObject({ marketer_id: "marketer-1", amount: 25000, status: "pending" });
  });
});
