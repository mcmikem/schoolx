/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextRequest } from "next/server";

const mockCreateSupabaseAdminClient = jest.fn((..._args: unknown[]) => ({}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "auth-user", email: "admin@example.org" } }, error: null }) },
  }),
}));
jest.mock("@/lib/server/user-provisioning", () => ({
  createSupabaseAdminClient: (...args: unknown[]) => mockCreateSupabaseAdminClient(...args),
}));
jest.mock("@/lib/api-utils", () => ({
  apiError: (error: string, status: number) => Response.json({ error }, { status }),
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  handleApiError: (error: unknown) => Response.json({ error: String(error) }, { status: 500 }),
  rateLimit: () => ({ success: true }),
}));

function request(body: Record<string, unknown>): NextRequest {
  return new Request("http://localhost/api/register/oauth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("Google school registration legal acceptance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires explicit acceptance of the current agreement and privacy notice before provisioning", async () => {
    const { POST } = await import("@/app/api/register/oauth/route");
    const response = await POST(
      request({
        schoolName: "Kampala Primary School",
        district: "Kampala",
        subcounty: "Nakawa",
        schoolType: "primary",
        ownership: "private",
        adminName: "Test Admin",
        adminPhone: "0700000000",
        acceptedSchoolAgreement: true,
        termsVersion: "old-terms",
        privacyNoticeVersion: "old-privacy",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
