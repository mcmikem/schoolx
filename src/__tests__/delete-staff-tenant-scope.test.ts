/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

let callerSchoolId: string | null = "school-1";
const mockEq: any = jest.fn();
const mockMaybeSingle: any = jest.fn();
const mockCreateServiceRoleClient: any = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown, message?: string) => Response.json({ success: true, data, message }),
  apiError: (error: string, status: number) => Response.json({ success: false, error }, { status }),
  handleApiError: () => Response.json({ success: false, error: "safe failure" }, { status: 500 }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: {
      user: { id: "admin-user", role: "school_admin" },
      schoolId: callerSchoolId,
    },
  }),
  assertUserRoleOrDeny: ({ userRole, allowedRoles }: { userRole: string; allowedRoles: string[] }) =>
    allowedRoles.includes(userRole)
      ? { ok: true }
      : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) },
  assertSchoolScopeOrDeny: ({
    userSchoolId,
    requestedSchoolId,
  }: {
    userSchoolId: string | null;
    requestedSchoolId: unknown;
  }) =>
    userSchoolId && requestedSchoolId === userSchoolId
      ? { ok: true, schoolId: userSchoolId }
      : { ok: false, response: Response.json({ error: "School context required" }, { status: 403 }) },
  createServiceRoleClientOrThrow: () => mockCreateServiceRoleClient(),
}));
jest.mock("@/lib/logger", () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

function makeRequest() {
  return new NextRequest("https://skoolmate.test/api/admin/delete-staff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "target-user" }),
  });
}

describe("staff deletion tenant scope", () => {
  beforeEach(() => {
    callerSchoolId = "school-1";
    jest.clearAllMocks();
    const query: any = {};
    query.select = jest.fn(() => query);
    query.eq = (...args: unknown[]) => {
      mockEq(...args);
      return query;
    };
    query.maybeSingle = (...args: unknown[]) => mockMaybeSingle(...args);
    query.delete = jest.fn(() => query);
    query.update = jest.fn(() => query);
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCreateServiceRoleClient.mockReturnValue({
      from: jest.fn(() => query),
      auth: { admin: { deleteUser: jest.fn() } },
    });
  });

  it("looks up the target inside the caller's school and returns not found for foreign IDs", async () => {
    const { POST } = await import("@/app/api/admin/delete-staff/route");

    const response = await POST(makeRequest());

    expect(response.status).toBe(404);
    expect(mockEq).toHaveBeenCalledWith("id", "target-user");
    expect(mockEq).toHaveBeenCalledWith("school_id", "school-1");
  });

  it("refuses a school role with no school before creating a service-role client", async () => {
    callerSchoolId = null;
    const { POST } = await import("@/app/api/admin/delete-staff/route");

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(mockCreateServiceRoleClient).not.toHaveBeenCalled();
  });
});
