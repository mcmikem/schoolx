/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockCalls: Array<{ table: string; filters: Array<[string, unknown]>; writes: string[] }> = [];
const mockRole: { value: string } = { value: "bursar" };
const mockFrom: any = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  validateRequiredFields: () => null,
  requireUserWithSchool: async () => ({
    ok: true,
    context: { schoolId: "school-a", user: { id: "bursar-a", role: mockRole.value } },
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
  withSecurity: (handler: (...args: any[]) => any) => handler,
}));
jest.mock("@/lib/subscription-guard", () => ({ requireModuleEntitlement: async () => ({ ok: true }) }));

function configureDatabase() {
  mockCalls.length = 0;
  mockFrom.mockImplementation((table: string) => {
    const call = { table, filters: [] as Array<[string, unknown]>, writes: [] as string[] };
    mockCalls.push(call);
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn((column: string, value: unknown) => {
      call.filters.push([column, value]);
      return builder;
    });
    builder.maybeSingle = jest.fn(async () => ({ data: null, error: null }));
    builder.insert = jest.fn(() => {
      call.writes.push("insert");
      return builder;
    });
    builder.update = jest.fn(() => {
      call.writes.push("update");
      return builder;
    });
    builder.single = jest.fn(async () => ({ data: { id: "row-a" }, error: null }));
    builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return builder;
  });
}

function req(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("financial writes reject foreign-school references", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole.value = "bursar";
    configureDatabase();
  });

  it("rejects a fee structure created for a class in another school", async () => {
    const { POST } = await import("@/app/api/fees/route");
    const response = await POST(
      req("http://localhost/api/fees", "POST", {
        schoolId: "school-a",
        name: "Tuition",
        amount: 100000,
        term: 1,
        academic_year: "2026",
        class_id: "class-school-b",
      }),
    );
    expect(response.status).toBe(400);
    expect(mockCalls.find((call) => call.table === "classes")?.filters).toEqual([
      ["id", "class-school-b"],
      ["school_id", "school-a"],
    ]);
    expect(mockCalls.some((call) => call.table === "fee_structure" && call.writes.includes("insert"))).toBe(false);
  });

  it("rejects moving an existing fee structure to another school's class", async () => {
    const { PUT } = await import("@/app/api/fees/[id]/route");
    const response = await PUT(
      req("http://localhost/api/fees/fee-a", "PUT", { schoolId: "school-a", class_id: "class-school-b" }),
      { params: Promise.resolve({ id: "fee-a" }) },
    );
    expect(response.status).toBe(400);
    expect(mockCalls.find((call) => call.table === "classes")?.filters).toEqual([
      ["id", "class-school-b"],
      ["school_id", "school-a"],
    ]);
    expect(mockCalls.some((call) => call.table === "fee_structure" && call.writes.includes("update"))).toBe(false);
  });

  it("rejects linking a payment to another school's fee structure", async () => {
    const { PUT } = await import("@/app/api/fee-payments/[id]/route");
    const response = await PUT(
      req("http://localhost/api/fee-payments/payment-a", "PUT", {
        schoolId: "school-a",
        fee_id: "fee-school-b",
      }),
      { params: Promise.resolve({ id: "payment-a" }) },
    );
    expect(response.status).toBe(400);
    expect(mockCalls.find((call) => call.table === "fee_structure")?.filters).toEqual([
      ["id", "fee-school-b"],
      ["school_id", "school-a"],
    ]);
    expect(mockCalls.some((call) => call.table === "fee_payments" && call.writes.includes("update"))).toBe(false);
  });

  it("denies parents the school-wide payment-claim list while preserving parent submission", async () => {
    mockRole.value = "parent";
    const { POST } = await import("@/app/api/parent/fee-payment-claims/route");
    const response = await POST(
      req("http://localhost/api/parent/fee-payment-claims", "POST", {
        action: "list",
        status: "pending",
      }),
    );
    expect(response.status).toBe(403);
    expect(mockCalls).toHaveLength(0);
  });

  it("denies non-parents from submitting payment claims on behalf of learners", async () => {
    mockRole.value = "teacher";
    const { POST } = await import("@/app/api/parent/fee-payment-claims/route");
    const response = await POST(
      req("http://localhost/api/parent/fee-payment-claims", "POST", {
        action: "submit",
        studentId: "student-a",
        amount: 10000,
      }),
    );
    expect(response.status).toBe(403);
    expect(mockCalls).toHaveLength(0);
  });
});
