/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const mockCanAccessClass: any = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => ({
    auth: { getUser: async () => ({ data: { user: { id: "auth-user" } }, error: null }) },
    from: (...fromArgs: unknown[]) => mockFrom(...fromArgs),
  }),
}));
jest.mock("@/lib/server/class-scope", () => ({ canAccessClass: (...args: unknown[]) => mockCanAccessClass(...args) }));

function setup(options: { subjectSchoolId?: string | null; assigned?: boolean; classTeacherId?: string | null } = {}) {
  const queries: Array<{ table: string; method: string }> = [];
  mockFrom.mockImplementation((table: string) => {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, any> = {};
    for (const method of ["select", "eq", "in", "is", "gt", "limit"]) {
      builder[method] = jest.fn((...args: unknown[]) => {
        if (method === "eq") filters[String(args[0])] = args[1];
        return builder;
      });
    }
    builder.maybeSingle = jest.fn(async () => {
      queries.push({ table, method: "maybeSingle" });
      if (table === "users") return { data: { id: "teacher-1", school_id: "school-1", role: "teacher" }, error: null };
      if (table === "schools") return { data: { billing_mode: "standard" }, error: null };
      if (table === "classes") {
        return { data: { school_id: "school-1", class_teacher_id: options.classTeacherId ?? null }, error: null };
      }
      if (table === "subjects") return { data: { school_id: options.subjectSchoolId ?? "school-1" }, error: null };
      if (table === "teacher_subjects")
        return { data: options.assigned === false ? null : { id: "assignment-1" }, error: null };
      return { data: null, error: null };
    });
    builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      queries.push({ table, method: "then" });
      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    };
    builder.update = jest.fn(() => {
      queries.push({ table, method: "update" });
      return builder;
    });
    return builder;
  });
  mockCanAccessClass.mockResolvedValue(true);
  return queries;
}

function request() {
  return new NextRequest("http://localhost/api/grades/workflow", {
    method: "POST",
    headers: { authorization: "Bearer valid-token", "content-type": "application/json" },
    body: JSON.stringify({
      class_id: "class-1",
      subject_id: "subject-1",
      next_status: "submitted",
      term: 1,
      academic_year: "2026",
    }),
  });
}

describe("grade workflow subject scope", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://school.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    jest.clearAllMocks();
  });

  it("rejects a subject from another school before reading or updating grades", async () => {
    const queries = setup({ subjectSchoolId: "school-2" });
    const { POST } = await import("@/app/api/grades/workflow/route");
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(queries.some((query) => query.table === "grades")).toBe(false);
  });

  it("rejects a teacher who is not assigned to the class and subject", async () => {
    const queries = setup({ assigned: false });
    const { POST } = await import("@/app/api/grades/workflow/route");
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(queries.some((query) => query.table === "grades")).toBe(false);
  });

  it("allows the assigned teacher to update the workflow", async () => {
    const queries = setup({ assigned: true });
    const { POST } = await import("@/app/api/grades/workflow/route");
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(queries).toContainEqual({ table: "grades", method: "update" });
  });
});
