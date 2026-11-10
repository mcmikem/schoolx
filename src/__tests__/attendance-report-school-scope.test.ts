/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom = jest.fn();
const mockOps: Array<[string, string, unknown]> = [];
const mockCreateServiceClient = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: (error: unknown) => Response.json({ error: String(error) }, { status: 500 }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: { schoolId: "school-a", user: { id: "admin-a", role: "school_admin" } },
  }),
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
  assertUserRoleOrDeny: ({ userRole, allowedRoles }: { userRole: string; allowedRoles: string[] }) =>
    allowedRoles.includes(userRole)
      ? { ok: true }
      : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) },
  createServiceRoleClientOrThrow: (...args: unknown[]) => mockCreateServiceClient(...args),
}));

jest.mock("@/lib/server/class-scope", () => ({
  canAccessClass: async () => true,
  isClassScopedRole: () => false,
}));

function queryFor(table: string) {
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      mockOps.push([table, "eq:" + column, value]);
      return query;
    },
    in: (column: string, value: unknown) => {
      mockOps.push([table, "in:" + column, value]);
      return query;
    },
    gte: () => query,
    lte: () => query,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: table === "classes" ? [{ id: "class-a" }] : [], error: null }).then(resolve, reject),
  };
  return query;
}

describe("attendance report school scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOps.length = 0;
    mockFrom.mockImplementation((...args: unknown[]) => queryFor(String(args[0])));
    mockCreateServiceClient.mockReturnValue({ from: mockFrom });
  });

  it("anchors attendance and student reads to classes and learners in the caller's school", async () => {
    const { GET } = await import("@/app/api/attendance/report/route");
    const response = await GET(new NextRequest("http://localhost/api/attendance/report?school_id=school-a"));

    expect(response.status).toBe(200);
    expect(mockOps).toContainEqual(["classes", "eq:school_id", "school-a"]);
    expect(mockOps).toContainEqual(["attendance", "in:class_id", ["class-a"]]);
  });

  it("rejects a class from another school before reading attendance", async () => {
    const { GET } = await import("@/app/api/attendance/report/route");
    const response = await GET(new NextRequest("http://localhost/api/attendance/report?class_id=foreign-class"));

    expect(response.status).toBe(404);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("classes");
  });
});
