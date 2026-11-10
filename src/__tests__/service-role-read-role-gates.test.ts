/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockRole: { value: string } = { value: "teacher" };
const mockCreateServiceClient: any = jest.fn();
const mockFrom: any = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: (error: unknown) => Response.json({ error: String(error) }, { status: 500 }),
  validateRequiredFields: (body: Record<string, unknown>, fields: string[]) =>
    fields.find((field) => body[field] === undefined || body[field] === null || body[field] === "")
      ? "Missing required field"
      : null,
  requireUserWithSchool: async () => ({
    ok: true,
    context: { schoolId: "school-a", user: { id: "user-a", role: mockRole.value } },
  }),
  assertUserRoleOrDeny: ({ userRole, allowedRoles }: { userRole: string; allowedRoles: string[] }) =>
    allowedRoles.includes(userRole)
      ? { ok: true }
      : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) },
  assertSchoolScopeOrDeny: ({
    userSchoolId,
    requestedSchoolId,
  }: {
    userSchoolId: string;
    requestedSchoolId: string;
  }) =>
    userSchoolId === requestedSchoolId
      ? { ok: true, schoolId: userSchoolId }
      : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) },
  createServiceRoleClientOrThrow: (...args: unknown[]) => mockCreateServiceClient(...args),
}));
jest.mock("@/lib/subscription-guard", () => ({
  requireModuleEntitlement: async () => ({ ok: true }),
}));

describe("service-role learner and payment reads enforce role gates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole.value = "teacher";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mockCreateServiceClient.mockReturnValue({ from: mockFrom });
  });

  it("denies teachers access to the unrestricted student detail endpoint before querying", async () => {
    const { GET } = await import("@/app/api/students/[id]/route");
    const request = new NextRequest("http://localhost/api/students/student-1?school_id=school-a");
    const response = await GET(request, { params: Promise.resolve({ id: "student-1" }) });
    expect(response.status).toBe(403);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it.each(["teacher", "parent", "student"])("denies %s access to school-wide fee-payment records", async (role) => {
    mockRole.value = role;
    const { GET } = await import("@/app/api/fee-payments/route");
    const request = new NextRequest("http://localhost/api/fee-payments?school_id=school-a");
    const response = await GET(request);
    expect(response.status).toBe(403);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("denies teachers access to the school-wide fee-structure endpoint", async () => {
    mockRole.value = "teacher";
    const { GET } = await import("@/app/api/fees/route");
    const request = new NextRequest("http://localhost/api/fees?school_id=school-a");
    const response = await GET(request);
    expect(response.status).toBe(403);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("denies parents access to the staff account directory", async () => {
    mockRole.value = "parent";
    const { GET } = await import("@/app/api/users/route");
    const request = new NextRequest("http://localhost/api/users?schoolId=school-a");
    const response = await GET(request);
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it.each([
    ["headmaster", "super_admin"],
    ["headmaster", "school_admin"],
    ["school_admin", "super_admin"],
  ])("prevents %s from creating a %s account", async (callerRole, targetRole) => {
    mockRole.value = callerRole;
    const { POST } = await import("@/app/api/users/route");
    const request = new NextRequest("http://localhost/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schoolId: "school-a",
        fullName: "New User",
        phone: "0700000001",
        password: "StrongPass1",
        role: targetRole,
      }),
    });
    const response = await POST(request);

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 403,
      body: { error: "You cannot assign that role" },
    });
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("denies non-parents access to the parent fee-clearance endpoint", async () => {
    mockRole.value = "student";
    const { GET } = await import("@/app/api/parent/fee-clearance/route");
    const request = new NextRequest("http://localhost/api/parent/fee-clearance?studentId=student-a");
    const response = await GET(request);
    expect(response.status).toBe(403);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });
});
