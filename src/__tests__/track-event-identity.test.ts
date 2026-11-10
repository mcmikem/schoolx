/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const insertedRows: any[] = [];
const mockGetUser: any = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));
jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  rateLimitAsync: async () => ({ success: true }),
  supabaseClientOptions: (options: unknown) => options,
}));

function setup() {
  mockFrom.mockImplementation((table: string) => {
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(async () => ({
      data: { id: "verified-user", school_id: "verified-school" },
      error: null,
    }));
    builder.insert = jest.fn((rows: unknown[]) => {
      insertedRows.push(...rows);
      return builder;
    });
    return builder;
  });
}

function makeRequest(body: unknown, token?: string) {
  return new NextRequest("https://skoolmate.test/api/track/event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("public telemetry identity and data minimization", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://school.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    insertedRows.length = 0;
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "verified-auth-id" } }, error: null });
    setup();
  });

  it("ignores caller-supplied identities and private metadata for anonymous events", async () => {
    const { POST } = await import("@/app/api/track/event/route");
    const response = await POST(
      makeRequest({
        events: [
          {
            event_type: "page_view",
            event_name: "/dashboard/students/123?email=parent@school.test",
            user_id: "victim-user",
            school_id: "victim-school",
            metadata: { email: "parent@school.test", search: "learner name" },
            url: "https://skoolmate.test/dashboard/students/123?reset=secret",
          },
        ],
      }),
    );
    expect(response.status).toBe(200);
    expect(insertedRows[0]).toMatchObject({
      user_id: null,
      school_id: null,
      metadata: {},
      url: "/dashboard/students/:id",
    });
    expect(insertedRows[0].event_name).toBe("/dashboard/students/:id");
    expect(JSON.stringify(insertedRows[0])).not.toContain("parent@school.test");
    expect(JSON.stringify(insertedRows[0])).not.toContain("secret");
  });

  it("uses the verified session profile instead of request body IDs", async () => {
    const { POST } = await import("@/app/api/track/event/route");
    const response = await POST(
      makeRequest(
        {
          events: [{ event_type: "feature_use", event_name: "report-cards", user_id: "forged", school_id: "forged" }],
        },
        "valid-token",
      ),
    );
    expect(response.status).toBe(200);
    expect(insertedRows[0]).toMatchObject({ user_id: "verified-user", school_id: "verified-school" });
  });

  it("rejects oversized event batches", async () => {
    const { POST } = await import("@/app/api/track/event/route");
    const response = await POST(
      makeRequest({ events: Array.from({ length: 31 }, () => ({ event_type: "page_view", event_name: "/" })) }),
    );
    expect(response.status).toBe(400);
    expect(insertedRows).toHaveLength(0);
  });
});
