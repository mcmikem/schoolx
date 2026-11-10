/** @jest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetUser = jest.fn(async (..._args: unknown[]) => ({ data: { user: { id: "auth-user-1" } }, error: null }));
const mockFrom = jest.fn((...args: unknown[]) => queryFor(String(args[0])));
const mockCreateClient = jest.fn((..._args: unknown[]) => ({ auth: { getUser: mockGetUser }, from: mockFrom }));

jest.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => mockCreateClient(...args) }));

function queryFor(table: string) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "or"]) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(async () => {
    if (table === "users") return { data: { role: "school_admin", school_id: "school-1" }, error: null };
    return { data: null, error: null };
  });
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve({ data: [{ id: "scheme-1", school_id: "school-1" }], error: null }));
  query.insert = jest.fn(() => query);
  query.single = jest.fn(async () => ({ data: { id: "scheme-1" }, error: null }));
  return query;
}

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(url, init);
}

describe("grading scheme service-role tenant boundaries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
    mockFrom.mockImplementation((...args: unknown[]) => queryFor(String(args[0])));
  });

  it("rejects unauthenticated reads before querying grading schemes", async () => {
    const { GET } = await import("@/app/api/grading-schemes/route");
    const response = await GET(request("http://localhost/api/grading-schemes?school_id=school-1"));

    expect(response?.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalledWith("grading_schemes");
  });

  it("rejects a signed-in user reading another school's scheme", async () => {
    const { GET } = await import("@/app/api/grading-schemes/route");
    const response = await GET(
      request("http://localhost/api/grading-schemes?school_id=school-2", {
        headers: { authorization: "Bearer valid-token" },
      }),
    );

    expect(response?.status).toBe(403);
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockFrom).not.toHaveBeenCalledWith("grading_schemes");
  });

  it("rejects a parent trying to create a grading scheme", async () => {
    mockFrom.mockImplementation((...args: unknown[]) => {
      const table = String(args[0]);
      const query = queryFor(table);
      if (table === "users") {
        query.maybeSingle = jest.fn(async () => ({ data: { role: "parent", school_id: "school-1" }, error: null }));
      }
      return query;
    });
    const { POST } = await import("@/app/api/grading-schemes/route");
    const response = await POST(
      request("http://localhost/api/grading-schemes", {
        method: "POST",
        headers: { authorization: "Bearer valid-token", "content-type": "application/json" },
        body: JSON.stringify({ school_id: "school-1", min_score: 0, max_score: 100, grade: "A" }),
      }),
    );

    expect(response?.status).toBe(403);
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockFrom).not.toHaveBeenCalledWith("grading_schemes");
  });
});
