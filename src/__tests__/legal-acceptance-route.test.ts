/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { PRIVACY_NOTICE_VERSION, SCHOOL_TERMS_VERSION } from "@/lib/legal-versions";

const mockRole: { value: string } = { value: "school_admin" };
const mockFrom: any = jest.fn();
const mockInsert: any = jest.fn();
let latest: Record<string, unknown> | null = null;

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown, _message?: string, status = 200) => Response.json({ success: true, data }, { status }),
  apiError: (message: string, status: number) => Response.json({ success: false, error: message }, { status }),
  handleApiError: () => Response.json({ success: false, error: "Internal server error" }, { status: 500 }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: { schoolId: "school-a", user: { id: "signatory-a", role: mockRole.value } },
  }),
  assertUserRoleOrDeny: ({ userRole, allowedRoles }: { userRole: string; allowedRoles: string[] }) =>
    allowedRoles.includes(userRole)
      ? { ok: true }
      : { ok: false, response: Response.json({ success: false, error: "Forbidden" }, { status: 403 }) },
  createServiceRoleClientOrThrow: () => ({ from: mockFrom }),
}));

function configureDatabase() {
  mockInsert.mockReset();
  mockFrom.mockImplementation((table: string) => {
    if (table !== "school_agreement_acceptances") throw new Error(`Unexpected table: ${table}`);
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.order = jest.fn(() => builder);
    builder.limit = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(async () => ({ data: latest, error: null }));
    builder.insert = jest.fn((payload: unknown) => {
      mockInsert(payload);
      return builder;
    });
    builder.single = jest.fn(async () => ({
      data: {
        terms_version: SCHOOL_TERMS_VERSION,
        privacy_notice_version: PRIVACY_NOTICE_VERSION,
        accepted_at: "2026-11-09T10:00:00.000Z",
        accepted_by_user_id: "signatory-a",
      },
      error: null,
    }));
    return builder;
  });
}

function req(method: "GET" | "POST", body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/legal/acceptance", {
    method,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
}

describe("versioned school agreement acceptance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole.value = "school_admin";
    latest = null;
    configureDatabase();
  });

  it("reports current required versions and an out-of-date school record", async () => {
    latest = { terms_version: "2025-01-01", privacy_notice_version: "2025-01-01", accepted_at: "2025-01-02" };
    const { GET } = await import("@/app/api/legal/acceptance/route");
    const response = await GET(req("GET"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.current).toEqual({
      termsVersion: SCHOOL_TERMS_VERSION,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    });
    expect(body.data.upToDate).toBe(false);
  });

  it("records acceptance with authenticated school and signatory identity", async () => {
    const { POST } = await import("@/app/api/legal/acceptance/route");
    const response = await POST(
      req("POST", {
        accepted: true,
        termsVersion: SCHOOL_TERMS_VERSION,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        school_id: "school-b",
      }),
    );
    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith({
      school_id: "school-a",
      accepted_by_user_id: "signatory-a",
      terms_version: SCHOOL_TERMS_VERSION,
      privacy_notice_version: PRIVACY_NOTICE_VERSION,
    });
  });

  it("rejects stale versions and roles without signatory authority", async () => {
    const { POST } = await import("@/app/api/legal/acceptance/route");
    const stale = await POST(req("POST", { accepted: true, termsVersion: "old", privacyNoticeVersion: "old" }));
    expect(stale.status).toBe(400);
    mockRole.value = "teacher";
    const forbidden = await POST(
      req("POST", {
        accepted: true,
        termsVersion: SCHOOL_TERMS_VERSION,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      }),
    );
    expect(forbidden.status).toBe(403);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("does not duplicate an already-current school acceptance", async () => {
    latest = { terms_version: SCHOOL_TERMS_VERSION, privacy_notice_version: PRIVACY_NOTICE_VERSION };
    const { POST } = await import("@/app/api/legal/acceptance/route");
    const response = await POST(
      req("POST", {
        accepted: true,
        termsVersion: SCHOOL_TERMS_VERSION,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      }),
    );
    expect(response.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
