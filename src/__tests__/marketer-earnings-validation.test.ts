/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const inserted: any[] = [];
let schoolOwner: string | null = "marketer-1";

jest.mock("@/lib/api-utils", () => ({
  createServiceRoleClientOrThrow: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  requireAuthenticatedUser: async () => ({ ok: true, context: { authUserId: "super-admin-auth" } }),
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
    builder.maybeSingle = jest.fn(async () => {
      if (table === "users" && filters.auth_id) return { data: { id: "super-1", role: "super_admin" }, error: null };
      if (table === "users" && filters.id === "marketer-1")
        return { data: { id: "marketer-1", role: "marketer" }, error: null };
      if (table === "schools") return { data: { id: "school-1", onboarded_by: schoolOwner }, error: null };
      return { data: null, error: null };
    });
    builder.insert = jest.fn((value: unknown) => {
      inserted.push(value);
      return builder;
    });
    builder.single = jest.fn(async () => ({ data: inserted.at(-1), error: null }));
    return builder;
  });
}

function makeRequest(body: unknown) {
  return new NextRequest("https://skoolmate.test/api/marketers/earnings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("marketer earnings record validation", () => {
  beforeEach(() => {
    schoolOwner = "marketer-1";
    inserted.length = 0;
    setup();
  });

  it.each([0, -1, "NaN", "Infinity", 10_000_000_000])("rejects invalid amount %s", async (amount) => {
    const { POST } = await import("@/app/api/marketers/earnings/route");
    const response = await POST(makeRequest({ marketer_id: "marketer-1", amount, earning_type: "adjustment" }));
    expect(response.status).toBe(400);
    expect(inserted).toHaveLength(0);
  });

  it("rejects a school that was not onboarded by the selected marketer", async () => {
    schoolOwner = "another-marketer";
    const { POST } = await import("@/app/api/marketers/earnings/route");
    const response = await POST(
      makeRequest({
        marketer_id: "marketer-1",
        school_id: "school-1",
        amount: 1000,
        earning_type: "adjustment",
      }),
    );
    expect(response.status).toBe(400);
    expect(inserted).toHaveLength(0);
  });

  it("stores new earnings as pending even if the caller requests paid", async () => {
    const { POST } = await import("@/app/api/marketers/earnings/route");
    const response = await POST(
      makeRequest({
        marketer_id: "marketer-1",
        school_id: "school-1",
        amount: "1250.50",
        earning_type: "subscription_commission",
        status: "paid",
      }),
    );
    expect(response.status).toBe(200);
    expect(inserted[0]).toMatchObject({
      marketer_id: "marketer-1",
      school_id: "school-1",
      amount: 1250.5,
      status: "pending",
    });
  });
});
