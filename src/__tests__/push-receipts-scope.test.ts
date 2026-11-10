/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const mockQuery: any = { data: [], error: null };
const calls: Array<[string, unknown]> = [];

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (error: string, status: number) => Response.json({ success: false, error }, { status }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: { user: { id: "admin", role: "school_admin" }, schoolId: "school-a" },
  }),
  assertUserRoleOrDeny: () => ({ ok: true }),
  createServiceRoleClientOrThrow: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
  rateLimit: () => ({ success: true }),
}));

describe("push delivery receipts", () => {
  beforeEach(() => {
    calls.length = 0;
    mockQuery.data = [{ id: "receipt", status: "accepted_by_provider" }];
    mockQuery.error = null;
    const builder: Record<string, any> = {};
    for (const method of ["select", "eq", "order", "limit"]) {
      builder[method] = jest.fn((...args: unknown[]) => {
        calls.push([method, args]);
        return method === "limit" ? Promise.resolve(mockQuery) : builder;
      });
    }
    mockFrom.mockReturnValue(builder);
  });

  it("limits history to the authenticated school and only returns content-free fields", async () => {
    const { GET } = await import("@/app/api/push/receipts/route");
    const response = await GET(new NextRequest("https://skoolmate.test/api/push/receipts?limit=500"));

    expect(response.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("push_delivery_receipts");
    expect(calls).toContainEqual(["eq", ["school_id", "school-a"]]);
    expect(calls).toContainEqual(["limit", [100]]);
    expect(calls[0]).toEqual(["select", ["id, recipient_user_id, status, provider_status, created_at"]]);
  });

  it("does not expose receipt history when storage is unavailable", async () => {
    mockQuery.error = { code: "42P01" };
    const { GET } = await import("@/app/api/push/receipts/route");
    const response = await GET(new NextRequest("https://skoolmate.test/api/push/receipts"));
    expect(response.status).toBe(503);
  });
});
