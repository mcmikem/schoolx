/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockRole: { value: string } = { value: "school_admin" };
const mockFrom: any = jest.fn();
const mockGetAssignedClassIds: any = jest.fn();
const mockCalls: Array<{ table: string; inValues?: string[]; writes: string[]; filters: Array<[string, unknown]> }> =
  [];

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  validateRequiredFields: () => null,
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
  createServiceRoleClientOrThrow: () => ({ from: mockFrom }),
}));
jest.mock("@/lib/subscription-guard", () => ({ requireModuleEntitlement: async () => ({ ok: true }) }));
jest.mock("@/lib/server/class-scope", () => ({
  isClassScopedRole: (role: string) => role === "teacher" || role === "class_teacher",
  getAssignedClassIds: (...args: unknown[]) => mockGetAssignedClassIds(...args),
}));

function configureDatabase() {
  mockCalls.length = 0;
  mockFrom.mockImplementation((table: string) => {
    const call = {
      table,
      inValues: undefined as string[] | undefined,
      writes: [] as string[],
      filters: [] as Array<[string, unknown]>,
    };
    mockCalls.push(call);
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn((column: string, value: unknown) => {
      call.filters.push([column, value]);
      return builder;
    });
    builder.order = jest.fn(() => builder);
    builder.in = jest.fn((_column: string, values: string[]) => {
      call.inValues = values;
      return builder;
    });
    builder.or = jest.fn(() => builder);
    builder.range = jest.fn(async () => ({ data: [], count: 0, error: null }));
    builder.maybeSingle = jest.fn(async () => ({ data: null, error: null }));
    builder.insert = jest.fn((_value: unknown) => {
      call.writes.push("insert");
      return builder;
    });
    builder.update = jest.fn((_value: unknown) => {
      call.writes.push("update");
      return builder;
    });
    builder.single = jest.fn(async () => ({ data: { id: "student-1", student_number: "S001" }, error: null }));
    builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return builder;
  });
}

const request = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(url, {
    method,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });

describe("student endpoints enforce school class ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole.value = "school_admin";
    mockGetAssignedClassIds.mockResolvedValue(new Set(["class-a"]));
    configureDatabase();
  });

  it("filters teacher roster requests to assigned class ids", async () => {
    mockRole.value = "teacher";
    const { GET } = await import("@/app/api/students/route");
    const response = await GET(request("http://localhost/api/students?school_id=school-a"));
    expect(response.status).toBe(200);
    expect(mockCalls.find((call) => call.table === "students")?.inValues).toEqual(["class-a"]);
  });

  it("rejects a foreign-school class when creating a student", async () => {
    const { POST } = await import("@/app/api/students/route");
    const response = await POST(
      request("http://localhost/api/students", "POST", {
        schoolId: "school-a",
        first_name: "Amina",
        last_name: "Test",
        gender: "F",
        parent_name: "Guardian",
        parent_phone: "0700000000",
        class_id: "class-from-school-b",
      }),
    );
    expect(response.status).toBe(400);
    expect(mockCalls.find((call) => call.table === "classes")?.filters).toEqual([
      ["id", "class-from-school-b"],
      ["school_id", "school-a"],
    ]);
    expect(mockCalls.some((call) => call.table === "students" && call.writes.includes("insert"))).toBe(false);
  });

  it("rejects a foreign-school class when updating a student", async () => {
    const { PUT } = await import("@/app/api/students/[id]/route");
    const response = await PUT(
      request("http://localhost/api/students/student-1", "PUT", {
        schoolId: "school-a",
        class_id: "class-from-school-b",
      }),
      { params: Promise.resolve({ id: "student-1" }) },
    );
    expect(response.status).toBe(400);
    expect(mockCalls.find((call) => call.table === "classes")?.filters).toEqual([
      ["id", "class-from-school-b"],
      ["school_id", "school-a"],
    ]);
    expect(mockCalls.some((call) => call.table === "students" && call.writes.includes("update"))).toBe(false);
  });
});
