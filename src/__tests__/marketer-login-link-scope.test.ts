/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const mockGenerateLink: any = jest.fn();
const mockFetch: any = jest.fn();
let ownedBy = "marketer-1";
let adminEmail: string | null = "head@school.test";

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "auth-marketer" } }, error: null }),
      admin: { generateLink: (...args: unknown[]) => mockGenerateLink(...args) },
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));
jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown, message: string) => Response.json({ success: true, data, message }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  requireAuthenticatedUser: async () => ({ ok: true, context: { authUserId: "auth-marketer" } }),
  rateLimit: () => ({ success: true }),
  supabaseClientOptions: (options: unknown) => options,
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
      if (table === "users" && filters.auth_id) {
        return { data: { id: "marketer-1", role: "marketer" }, error: null };
      }
      if (table === "schools") {
        return filters.id === "school-1"
          ? { data: { id: "school-1", name: "School <One>", onboarded_by: ownedBy }, error: null }
          : { data: null, error: null };
      }
      if (table === "users" && filters.school_id) {
        return {
          data: adminEmail
            ? { id: "admin-1", school_id: "school-1", role: "school_admin", email: adminEmail, full_name: "A <Admin>" }
            : { id: "admin-1", school_id: "school-1", role: "school_admin", email: null, full_name: "Admin" },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    return builder;
  });
}

function makeRequest(body: unknown) {
  return new NextRequest("https://skoolmate.test/api/marketers/send-admin-login-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("marketer login link is restricted to the registered school admin", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://school.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.RESEND_API_KEY = "test-resend-key";
    ownedBy = "marketer-1";
    adminEmail = "head@school.test";
    mockGenerateLink.mockResolvedValue({
      data: { properties: { action_link: "https://auth.test/?token=magic-token" } },
      error: null,
    });
    mockGenerateLink.mockClear();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true, text: async () => "" });
    jest.spyOn(global, "fetch").mockImplementation(mockFetch);
    mockFrom.mockReset();
    setup();
  });

  it("rejects a school not owned by the authenticated marketer before generating a link", async () => {
    ownedBy = "another-marketer";
    const { POST } = await import("@/app/api/marketers/send-admin-login-link/route");
    const response = await POST(makeRequest({ schoolId: "school-1" }));
    expect(response.status).toBe(404);
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });

  it("sends only to the stored admin email and escapes school/admin names in email HTML", async () => {
    const { POST } = await import("@/app/api/marketers/send-admin-login-link/route");
    const response = await POST(makeRequest({ schoolId: "school-1", email: "victim@example.com", name: "<img>" }));
    expect(response.status).toBe(200);
    expect(mockGenerateLink).toHaveBeenCalledWith(expect.objectContaining({ email: "head@school.test" }));
    const emailBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(emailBody.to).toEqual(["head@school.test"]);
    expect(emailBody.html).toContain("A &lt;Admin&gt;");
    expect(emailBody.html).toContain("School &lt;One&gt;");
    expect(emailBody.html).not.toContain("<img>");
  });

  it("does not send when the school admin has no email", async () => {
    adminEmail = null;
    const { POST } = await import("@/app/api/marketers/send-admin-login-link/route");
    const response = await POST(makeRequest({ schoolId: "school-1" }));
    expect(response.status).toBe(404);
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });
});
