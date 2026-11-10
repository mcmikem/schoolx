/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
let mockCurrentStatus = "pending";
const updates: Array<{ payload: Record<string, unknown>; filters: Record<string, unknown> }> = [];

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
    let payload: Record<string, unknown> = {};
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn((column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    });
    builder.update = jest.fn((value: Record<string, unknown>) => {
      payload = value;
      if (Object.keys(value).length > 0) updates.push({ payload, filters });
      return builder;
    });
    builder.maybeSingle = jest.fn(async () => {
      if (table === "users") return { data: { role: "super_admin" }, error: null };
      if (filters.status) return { data: { id: "earning-1", status: mockCurrentStatus }, error: null };
      return { data: { id: "earning-1", status: mockCurrentStatus }, error: null };
    });
    return builder;
  });
}

function makeRequest(body: unknown) {
  return new NextRequest("https://skoolmate.test/api/marketers/earnings/earning-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("marketer earning state transitions", () => {
  beforeEach(() => {
    updates.length = 0;
    mockCurrentStatus = "pending";
    setup();
  });

  it.each([
    ["pending", "paid"],
    ["paid", "pending"],
    ["cancelled", "approved"],
  ])("rejects transition %s -> %s", async (from, to) => {
    mockCurrentStatus = from;
    const { PATCH } = await import("@/app/api/marketers/earnings/[id]/route");
    const response = await PATCH(makeRequest({ status: to }), { params: Promise.resolve({ id: "earning-1" }) });
    expect(response.status).toBe(409);
    expect(updates).toHaveLength(0);
  });

  it("allows approved earnings to become paid with a compare-and-set status guard", async () => {
    mockCurrentStatus = "approved";
    const { PATCH } = await import("@/app/api/marketers/earnings/[id]/route");
    const response = await PATCH(makeRequest({ status: "paid" }), { params: Promise.resolve({ id: "earning-1" }) });
    expect(response.status).toBe(200);
    expect(updates[0].payload).toMatchObject({ status: "paid", paid_at: expect.any(String) });
    expect(updates[0].filters).toMatchObject({ id: "earning-1", status: "approved" });
  });

  it("rejects status values outside the database enum", async () => {
    const { PATCH } = await import("@/app/api/marketers/earnings/[id]/route");
    const response = await PATCH(makeRequest({ status: "reversed" }), { params: Promise.resolve({ id: "earning-1" }) });
    expect(response.status).toBe(400);
    expect(updates).toHaveLength(0);
  });
});
