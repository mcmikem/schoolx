/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
let ownedSchool: boolean;

jest.mock("@/lib/api-utils", () => ({
  createServiceRoleClientOrThrow: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
  apiSuccess: (data: unknown, message?: string, status = 200) =>
    Response.json({ success: true, data, message }, { status }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  requireAuthenticatedUser: async () => ({ ok: true, context: { authUserId: "marketer-auth" } }),
}));

function setup() {
  mockFrom.mockImplementation((table: string) => {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, any> = {};
    for (const method of ["select", "eq", "or", "order", "limit"]) {
      builder[method] = jest.fn((...args: unknown[]) => {
        calls.push({ table, method, args });
        if (method === "eq") filters[String(args[0])] = args[1];
        return builder;
      });
    }
    builder.maybeSingle = jest.fn(async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      if (table === "users") return { data: { id: "marketer-1", role: "marketer" }, error: null };
      if (table === "schools") return { data: ownedSchool ? { id: "school-1" } : null, error: null };
      return { data: null, error: null };
    });
    builder.insert = jest.fn((...args: unknown[]) => {
      calls.push({ table, method: "insert", args });
      return builder;
    });
    builder.single = jest.fn(async () => ({ data: { id: "lead-1" }, error: null }));
    builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return builder;
  });
}

function getRequest(path: string) {
  return new NextRequest(`https://skoolmate.test/api/marketers/leads?${path}`);
}

function postRequest(body: unknown) {
  return new NextRequest("https://skoolmate.test/api/marketers/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("marketer lead scope and filter validation", () => {
  beforeEach(() => {
    ownedSchool = false;
    calls.length = 0;
    setup();
  });

  it("rejects linking a school the marketer did not onboard", async () => {
    const { POST } = await import("@/app/api/marketers/leads/route");
    const response = await POST(postRequest({ school_name: "Other school", school_id: "school-1" }));
    expect(response.status).toBe(404);
    expect(calls.some((call) => call.table === "marketer_leads" && call.method === "insert")).toBe(false);
  });

  it("rejects unsupported status filters before querying leads", async () => {
    const { GET } = await import("@/app/api/marketers/leads/route");
    const response = await GET(getRequest("status=anything"));
    expect(response.status).toBe(400);
    expect(calls.some((call) => call.table === "marketer_leads")).toBe(false);
  });

  it("removes PostgREST filter grammar from user search input and retains marketer scope", async () => {
    const { GET } = await import("@/app/api/marketers/leads/route");
    const response = await GET(getRequest("search=foo%25%2Cstatus.eq.converted%28%29"));
    expect(response.status).toBe(200);
    const orCall = calls.find((call) => call.table === "marketer_leads" && call.method === "or");
    expect(orCall?.args[0]).not.toContain("status.eq");
    expect(orCall?.args[0]).not.toContain("(");
    expect(calls).toContainEqual({ table: "marketer_leads", method: "eq", args: ["marketer_id", "marketer-1"] });
  });
});
