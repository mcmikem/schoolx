/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";

const mockRequireAuthenticatedUser: any = jest.fn();
const mockFrom: any = jest.fn();
const mockCreateClient: any = jest.fn();
const mockSelectCalls: Array<{ table: string; columns: string; options?: unknown }> = [];
const mockRanges: Array<[number, number]> = [];

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock("@/lib/api-utils", () => ({
  requireAuthenticatedUser: (...args: unknown[]) => mockRequireAuthenticatedUser(...args),
  apiError: (error: string, status: number) => NextResponse.json({ error }, { status }),
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  handleApiError: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
  supabaseClientOptions: (options: unknown) => options,
}));

describe("super-admin audit route data minimization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectCalls.length = 0;
    mockRanges.length = 0;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      context: { authUserId: "auth-super-admin", user: { role: "super_admin" } },
    });
    mockCreateClient.mockReturnValue({
      from: mockFrom,
    });
    mockFrom.mockImplementation((table: string) => {
      const builder: Record<string, any> = {};
      builder.select = jest.fn((columns: string, options?: unknown) => {
        mockSelectCalls.push({ table, columns, options });
        return builder;
      });
      builder.eq = jest.fn(() => builder);
      builder.maybeSingle = jest.fn(async () => ({ data: { role: "super_admin" }, error: null }));
      builder.order = jest.fn(() => builder);
      builder.range = jest.fn((from: number, to: number) => {
        mockRanges.push([from, to]);
        return builder;
      });
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, reject);
      return builder;
    });
  });

  it("omits audit snapshots and IPs and clamps pagination", async () => {
    const { GET } = await import("@/app/api/audit/route");
    const request = new NextRequest("http://localhost/api/audit/?limit=9999&offset=-25");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const auditSelect = mockSelectCalls.find((call) => call.table === "audit_log");
    expect(auditSelect?.columns).toContain("description");
    expect(auditSelect?.columns).not.toMatch(/old_value|new_value|ip_address|record_id/);
    expect(mockRanges).toEqual([[0, 499]]);
  });

  it("uses defaults for non-numeric pagination and clamps excessively large offsets", async () => {
    const { GET } = await import("@/app/api/audit/route");
    const request = new NextRequest("http://localhost/api/audit/?limit=NaN&offset=999999999");
    await GET(request);

    expect(mockRanges).toEqual([[100_000, 100_099]]);
  });
});
