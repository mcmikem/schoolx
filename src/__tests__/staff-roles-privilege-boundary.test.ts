/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockGetUser = jest.fn(async (..._args: unknown[]) => ({ data: { user: { id: "auth-teacher" } }, error: null }));
let mockCallerRole = "teacher";
const mockFrom = jest.fn((...args: unknown[]) => {
  const table = String(args[0]);
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "delete", "insert", "update"]) query[method] = jest.fn(() => query);
  query.maybeSingle = jest.fn(async () => ({
    data: table === "users" ? { id: "teacher-1", school_id: "school-1", role: mockCallerRole } : null,
    error: null,
  }));
  query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: table === "user_roles" ? [] : null, error: null }).then(resolve, reject);
  return query;
});
const mockCreateClient = jest.fn((..._args: unknown[]) => ({ auth: { getUser: mockGetUser }, from: mockFrom }));

jest.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => mockCreateClient(...args) }));

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/staff/roles", {
    method: "POST",
    headers: { authorization: "Bearer valid-token", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("staff role service-role privilege boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCallerRole = "teacher";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("denies a teacher role escalation before looking up or mutating the target", async () => {
    const { POST } = await import("@/app/api/staff/roles/route");
    const response = await POST(request({ user_id: "victim-1", roles: ["headmaster"] }));

    expect(response.status).toBe(403);
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockFrom).toHaveBeenCalledWith("user_roles");
    expect(mockFrom.mock.calls.filter(([table]) => table === "users")).toHaveLength(1);
  });

  it("denies a headmaster permission to assign the school-admin role", async () => {
    mockCallerRole = "headmaster";
    const { POST } = await import("@/app/api/staff/roles/route");
    const response = await POST(request({ user_id: "staff-1", roles: ["school_admin"] }));

    expect(response.status).toBe(403);
    expect(mockFrom.mock.calls.filter(([table]) => table === "users")).toHaveLength(1);
  });

  it("does not expose marketer as a school staff role", async () => {
    mockCallerRole = "school_admin";
    const { POST } = await import("@/app/api/staff/roles/route");
    const response = await POST(request({ user_id: "staff-1", roles: ["marketer"] }));

    expect(response.status).toBe(400);
    expect(mockFrom.mock.calls.filter(([table]) => table === "users")).toHaveLength(1);
  });
});
