/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockGetUser: any = jest.fn();
const mockFrom: any = jest.fn();
const mockCreateClient: any = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

type Role = "student" | "parent" | "teacher" | "headmaster" | "school_admin" | "admin";

function configureRole(role: Role) {
  const profile = {
    id: `profile-${role}`,
    full_name: `Test ${role}`,
    phone: "0700000000",
    email: `${role}@example.test`,
    role,
    created_at: "2026-01-01T00:00:00.000Z",
    school_id: "school-a",
  };
  const student = {
    id: "learner-own",
    first_name: "Own",
    last_name: "Learner",
    student_number: "S001",
    gender: "F",
    date_of_birth: "2015-01-01",
    class_id: "class-a",
    status: "active",
    admission_date: "2025-01-01",
  };
  const tableCalls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  mockGetUser.mockResolvedValue({ data: { user: { id: "auth-user-a" } }, error: null });
  mockCreateClient.mockReturnValue({ auth: { getUser: mockGetUser }, from: mockFrom });
  mockFrom.mockImplementation((table: string) => {
    const call = { table, filters: [] as Array<[string, unknown]> };
    tableCalls.push(call);
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn((column: string, value: unknown) => {
      call.filters.push([column, value]);
      return builder;
    });
    builder.maybeSingle = jest.fn(async () => ({
      data: table === "users" ? profile : table === "students" && role === "student" ? student : null,
      error: null,
    }));
    builder.order = jest.fn(() => builder);
    builder.limit = jest.fn(() => builder);
    builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({
        data:
          table === "attendance"
            ? [{ date: "2026-02-01", status: "present" }]
            : table === "grades"
              ? [{ score: 80, max_score: 100, term: 1, academic_year: "2026" }]
              : table === "fee_payments"
                ? [{ amount_paid: 1000, payment_method: "cash", payment_date: "2026-02-01" }]
                : [],
        error: null,
      }).then(resolve, reject);
    return builder;
  });
  return { profile, student, tableCalls };
}

function request(): NextRequest {
  return new Request("http://localhost/api/privacy/export/", {
    headers: { authorization: "Bearer valid-token" },
  }) as unknown as NextRequest;
}

describe("personal data export scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it.each([
    "parent",
    "teacher",
    "headmaster",
    "school_admin",
    "admin",
  ] as const)("does not include learner or school data for %s", async (role) => {
    const { tableCalls } = configureRole(role);
    const { GET } = await import("@/app/api/privacy/export/route");
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.scope).toContain("own profile");
    expect(body.learner_record).toBeUndefined();
    expect(body.attendance).toBeUndefined();
    expect(body.grades).toBeUndefined();
    expect(body.fee_payments).toBeUndefined();
    expect(tableCalls.map((call) => call.table)).toEqual(["users"]);
  });

  it("exports only the student's learner row and own linked records", async () => {
    const { tableCalls } = configureRole("student");
    const { GET } = await import("@/app/api/privacy/export/route");
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.learner_record.id).toBe("learner-own");
    expect(body.attendance).toHaveLength(1);
    expect(body.grades).toHaveLength(1);
    expect(body.fee_payments).toHaveLength(1);
    expect(tableCalls.find((call) => call.table === "students")?.filters).toEqual([
      ["user_id", "profile-student"],
      ["school_id", "school-a"],
    ]);
    for (const table of ["attendance", "grades", "fee_payments"]) {
      expect(tableCalls.find((call) => call.table === table)?.filters).toContainEqual(["student_id", "learner-own"]);
    }
  });
});
