/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockGetUser: any = jest.fn();
const mockFrom: any = jest.fn();
const mockCreateClient: any = jest.fn();
const mockRateLimitAsync: any = jest.fn();
const mockAdmin: any = jest.fn();
const mockUser = {
  id: "user-1",
  school_id: "school-1",
  full_name: "Amina Teacher",
  role: "teacher",
};
const mockRequestRow = {
  reference_code: "SM-PR-A1B2C3D4E5",
  request_type: "access",
  status: "open",
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));
jest.mock("@/lib/api-utils", () => ({
  rateLimitAsync: (...args: unknown[]) => mockRateLimitAsync(...args),
  supabaseClientOptions: (...args: unknown[]) => mockAdmin(...args),
}));

function configureClient() {
  const calls: Array<{ table: string; filters: Array<[string, unknown]>; insert?: unknown }> = [];
  mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
  mockRateLimitAsync.mockResolvedValue({ success: true });
  mockAdmin.mockReturnValue({});
  mockCreateClient.mockReturnValue({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      const call = { table, filters: [] as Array<[string, unknown]>, insert: undefined as unknown };
      calls.push(call);
      const builder: Record<string, any> = {};
      builder.select = jest.fn(() => builder);
      builder.eq = jest.fn((column: string, value: unknown) => {
        call.filters.push([column, value]);
        return builder;
      });
      builder.order = jest.fn(() => builder);
      builder.limit = jest.fn(() => builder);
      builder.insert = jest.fn((payload: unknown) => {
        call.insert = payload;
        return builder;
      });
      builder.maybeSingle = jest.fn(async () => ({ data: mockUser, error: null }));
      builder.single = jest.fn(async () => ({ data: mockRequestRow, error: null }));
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: [mockRequestRow], error: null }).then(resolve, reject);
      return builder;
    },
  });
  return calls;
}

function makeRequest(method: "GET" | "POST", body?: unknown): NextRequest {
  return new Request("http://localhost/api/privacy/requests/", {
    method,
    headers: {
      authorization: "Bearer valid-token",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }) as unknown as NextRequest;
}

describe("privacy request ownership and reference flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    configureClient();
  });

  it("returns only the signed-in requester's status records", async () => {
    const calls = configureClient();
    const { GET } = await import("@/app/api/privacy/requests/route");
    const response = await GET(makeRequest("GET"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.requests).toEqual([mockRequestRow]);
    expect(calls.find((call) => call.table === "privacy_requests")?.filters).toEqual([["requester_user_id", "user-1"]]);
  });

  it("binds request ownership and school from the authenticated profile", async () => {
    const calls = configureClient();
    const { POST } = await import("@/app/api/privacy/requests/route");
    const response = await POST(
      makeRequest("POST", {
        requestType: "access",
        details: "Please provide my account data.",
        requester_user_id: "someone-else",
        school_id: "another-school",
        status: "completed",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.request.reference_code).toBe(mockRequestRow.reference_code);
    expect(calls.find((call) => call.table === "privacy_requests")?.insert).toEqual({
      requester_user_id: "user-1",
      school_id: "school-1",
      request_type: "access",
      details: "Please provide my account data.",
    });
  });

  it("rejects invalid request types and oversized details", async () => {
    const { POST } = await import("@/app/api/privacy/requests/route");
    const invalidType = await POST(makeRequest("POST", { requestType: "export_everyone", details: "" }));
    expect(invalidType.status).toBe(400);
    const tooLong = await POST(makeRequest("POST", { requestType: "other", details: "x".repeat(2001) }));
    expect(tooLong.status).toBe(400);
  });
});
