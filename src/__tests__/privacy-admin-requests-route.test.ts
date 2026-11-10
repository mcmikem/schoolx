/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockGetUser: any = jest.fn();
const mockCreateClient: any = jest.fn();
const mockOptions: any = jest.fn();
const calls: Array<{ table: string; update?: unknown; filters: Array<[string, unknown]> }> = [];

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock("@/lib/api-utils", () => ({
  supabaseClientOptions: (...args: unknown[]) => mockOptions(...args),
}));

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/super-admin/privacy-requests/", {
    method: "PATCH",
    headers: { authorization: "Bearer valid-token", "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function configureClient() {
  calls.length = 0;
  mockGetUser.mockResolvedValue({ data: { user: { id: "auth-super-admin" } }, error: null });
  mockOptions.mockReturnValue({});
  mockCreateClient.mockReturnValue({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      const call = { table, filters: [] as Array<[string, unknown]>, update: undefined as unknown };
      calls.push(call);
      const builder: Record<string, any> = {};
      builder.select = jest.fn(() => builder);
      builder.eq = jest.fn((column: string, value: unknown) => {
        call.filters.push([column, value]);
        return builder;
      });
      builder.update = jest.fn((payload: unknown) => {
        call.update = payload;
        return builder;
      });
      builder.maybeSingle = jest.fn(async () => ({
        data:
          table === "users"
            ? { id: "privacy-operator", role: "super_admin" }
            : { id: "request-1", reference_code: "SM-PR-123", status: "completed" },
        error: null,
      }));
      return builder;
    },
  });
}

describe("privacy request closure evidence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureClient();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it.each(["completed", "declined"] as const)("requires a resolution note for %s", async (status) => {
    const { PATCH } = await import("@/app/api/super-admin/privacy-requests/route");
    const response = await PATCH(makeRequest({ id: "request-1", status, resolutionNote: "   " }));
    expect(response.status).toBe(400);
    expect(calls.find((call) => call.table === "privacy_requests")?.update).toBeUndefined();
  });

  it("records the operator's explanation when completing a request", async () => {
    const { PATCH } = await import("@/app/api/super-admin/privacy-requests/route");
    const response = await PATCH(
      makeRequest({
        id: "request-1",
        status: "completed",
        resolutionNote: "The requester was sent their account export.",
      }),
    );
    expect(response.status).toBe(200);
    expect(calls.find((call) => call.table === "privacy_requests")?.update).toEqual(
      expect.objectContaining({
        status: "completed",
        resolution_note: "The requester was sent their account export.",
        resolved_at: expect.any(String),
      }),
    );
  });
});
