/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const mockCanAccessClass: any = jest.fn();
const mockGetAssignedClassIds: any = jest.fn();
jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  validateRequiredFields: () => null,
  requireUserWithSchool: async () => ({
    ok: true,
    context: {
      schoolId: "school-a",
      user: { id: "teacher-a", role: "teacher" },
    },
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
  assertUserRoleOrDeny: () => ({ ok: true }),
  createServiceRoleClientOrThrow: () => ({ from: mockFrom }),
}));
jest.mock("@/lib/subscription-guard", () => ({
  requireActiveSubscription: async () => ({ ok: true }),
  requireModuleEntitlement: async () => ({ ok: true }),
}));
jest.mock("@/lib/server/class-scope", () => ({
  canAccessClass: (...args: unknown[]) => mockCanAccessClass(...args),
  getAssignedClassIds: (...args: unknown[]) => mockGetAssignedClassIds(...args),
  isClassScopedRole: (role: string) => role === "teacher" || role === "class_teacher",
}));
jest.mock("@/lib/server/fee-clearance", () => ({ loadFeeClearanceMap: async () => new Map() }));

function configureData() {
  const queriedTables: string[] = [];
  const student = {
    id: "student-1",
    school_id: "school-a",
    class_id: "class-other",
  };
  const students = [student, { id: "student-2", school_id: "school-a", class_id: "class-assigned" }];
  mockFrom.mockImplementation((table: string) => {
    queriedTables.push(table);
    let classIds: string[] | undefined;
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(async () => ({ data: table === "students" ? student : null, error: null }));
    builder.in = jest.fn((_column: string, values: string[]) => {
      classIds = values;
      return builder;
    });
    builder.limit = jest.fn(() => builder);
    builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({
        data: table === "students" ? students.filter((row) => !classIds || classIds.includes(row.class_id)) : [],
        error: null,
      }).then(resolve, reject);
    return builder;
  });
  return queriedTables;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/reports?studentId=student-1&schoolId=school-a", {
    headers: { authorization: "Bearer valid-token" },
  });
}

describe("individual report reads enforce teacher class scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessClass.mockResolvedValue(false);
    mockGetAssignedClassIds.mockResolvedValue(new Set(["class-assigned"]));
  });

  it("denies an unrelated class before reading grades", async () => {
    const queriedTables = configureData();
    const { GET } = await import("@/app/api/reports/route");
    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Not authorized to view this student report" });
    expect(mockCanAccessClass).toHaveBeenCalledWith(expect.anything(), "teacher", "teacher-a", "class-other");
    expect(queriedTables).not.toContain("grades");
  });

  it("allows an assigned class to continue to its grade query", async () => {
    mockCanAccessClass.mockResolvedValue(true);
    const queriedTables = configureData();
    const { GET } = await import("@/app/api/reports/route");
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(queriedTables).toContain("grades");
  });

  it("filters the report roster list to the teacher's assigned classes", async () => {
    const { GET } = await import("@/app/api/reports/route");
    const request = new NextRequest("http://localhost/api/reports?schoolId=school-a");
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(mockGetAssignedClassIds).toHaveBeenCalledWith(expect.anything(), "teacher-a");
    expect(body.data.students.map((row: { id: string }) => row.id)).toEqual(["student-2"]);
  });

  it("returns an empty roster without querying students when the teacher has no classes", async () => {
    mockGetAssignedClassIds.mockResolvedValue(new Set());
    const queriedTables = configureData();
    const { GET } = await import("@/app/api/reports/route");
    const response = await GET(new NextRequest("http://localhost/api/reports?schoolId=school-a"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { students: [] } });
    expect(queriedTables).not.toContain("students");
  });
});
