/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { PRIVACY_NOTICE_VERSION, SCHOOL_TERMS_VERSION } from "@/lib/legal-versions";

const mockRole: { value: string } = { value: "super_admin" };
const mockFrom: any = jest.fn();
const queriedTables: string[] = [];

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ success: false, error: message }, { status }),
  handleApiError: () => Response.json({ success: false, error: "Internal server error" }, { status: 500 }),
  requireAuthenticatedUser: async () => ({ ok: true, context: { authUserId: "auth-a" } }),
  createServiceRoleClientOrThrow: () => ({ from: mockFrom }),
}));

function configureDatabase() {
  queriedTables.length = 0;
  mockFrom.mockImplementation((table: string) => {
    queriedTables.push(table);
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.order = jest.fn(() => builder);
    builder.in = jest.fn(() => builder);
    builder.range = jest.fn(async () => {
      if (table === "schools") {
        return {
          data: [
            { id: "school-current", name: "Current School", district: "Central" },
            { id: "school-old", name: "Old School", district: "East" },
          ],
          count: 2,
          error: null,
        };
      }
      return {
        data: [
          {
            school_id: "school-current",
            terms_version: SCHOOL_TERMS_VERSION,
            privacy_notice_version: PRIVACY_NOTICE_VERSION,
            accepted_at: "2026-11-09T10:00:00.000Z",
            accepted_by_user_id: "signatory-a",
          },
        ],
        error: null,
      };
    });
    builder.maybeSingle = jest.fn(async () => ({ data: { role: mockRole.value }, error: null }));
    return builder;
  });
}

describe("super-admin agreement acceptance report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole.value = "super_admin";
    configureDatabase();
  });

  it("shows each school's latest accepted versions and identifies gaps", async () => {
    const { GET } = await import("@/app/api/super-admin/legal-acceptances/route");
    const response = await GET(new NextRequest("http://localhost/api/super-admin/legal-acceptances"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(
      body.data.schools.map((school: { id: string; upToDate: boolean }) => ({
        id: school.id,
        upToDate: school.upToDate,
      })),
    ).toEqual([
      { id: "school-current", upToDate: true },
      { id: "school-old", upToDate: false },
    ]);
  });

  it("denies non-super-admin accounts before listing school records", async () => {
    mockRole.value = "school_admin";
    const { GET } = await import("@/app/api/super-admin/legal-acceptances/route");
    const response = await GET(new NextRequest("http://localhost/api/super-admin/legal-acceptances"));
    expect(response.status).toBe(403);
    expect(queriedTables).toEqual(["users"]);
  });
});
