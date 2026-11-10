/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const mockCreateUser: any = jest.fn();
const mockDeleteUser: any = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  createServiceRoleClientOrThrow: () => ({
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
      },
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
  apiSuccess: (data: unknown, message: string, status = 200) =>
    Response.json({ success: true, data, message }, { status }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  requireAuthenticatedUser: async () => ({ ok: true, context: { authUserId: "super-admin-auth" } }),
}));

function request() {
  return new NextRequest("https://skoolmate.test/api/marketers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ full_name: "New Marketer", phone: "+256700123456" }),
  });
}

describe("phone-based marketer creation uses a unique temporary credential", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.RESEND_API_KEY = "";
    process.env.EMAIL_FROM = "";
    mockCreateUser.mockReset();
    mockDeleteUser.mockReset();
    mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-new" } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      const filters: Record<string, unknown> = {};
      const builder: Record<string, any> = {};
      builder.select = jest.fn(() => builder);
      builder.eq = jest.fn((column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      });
      builder.maybeSingle = jest.fn(async () => ({
        data: filters.auth_id ? { role: "super_admin" } : null,
        error: null,
      }));
      builder.insert = jest.fn(() => builder);
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(resolve, reject);
      return builder;
    });
  });

  it("generates and returns a random credential instead of a shared default", async () => {
    const { POST } = await import("@/app/api/marketers/route");
    const response = await POST(request());
    const body = await response.json();
    const passwordUsed = mockCreateUser.mock.calls[0][0].password;
    expect(response.status).toBe(201);
    expect(typeof passwordUsed).toBe("string");
    expect(passwordUsed).toHaveLength(32);
    expect(passwordUsed).not.toBe("Omutofoundation");
    expect(body.data.temporaryPassword).toBe(passwordUsed);
    expect(body.message).not.toContain(passwordUsed);
  });
});
