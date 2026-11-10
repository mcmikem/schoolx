/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
const mockScheduleDowngrade: any = jest.fn();
const mockCancelScheduledChange: any = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));
jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "Internal server error" }, { status: 500 }),
  requireAuthenticatedUser: async () => ({ ok: true, context: { authUserId: "auth-1" } }),
  supabaseClientOptions: () => ({}),
}));
jest.mock("@/lib/billing/service", () => ({
  BillingError: class BillingError extends Error {},
  cancelScheduledChange: (...args: unknown[]) => mockCancelScheduledChange(...args),
  loadSchoolBillingContext: jest.fn(),
  scheduleDowngrade: (...args: unknown[]) => mockScheduleDowngrade(...args),
}));

let callerRole = "teacher";
let queries: string[] = [];

function setup() {
  queries = [];
  mockFrom.mockImplementation((table: string) => {
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(async () => {
      queries.push(table);
      if (table === "users") return { data: { id: "user-1", role: callerRole, school_id: "school-1" }, error: null };
      return { data: null, error: null };
    });
    return builder;
  });
}

function makeRequest(action: string) {
  return new NextRequest("https://skoolmate.test/api/billing/change-plan", {
    method: "POST",
    headers: { authorization: "Bearer valid-token", "content-type": "application/json" },
    body: JSON.stringify({ action, plan: "starter" }),
  });
}

describe("billing change-plan access", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://school.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    callerRole = "teacher";
    jest.clearAllMocks();
    setup();
  });

  it.each([
    "teacher",
    "parent",
    "student",
    "bursar",
    "secretary",
  ])("denies %s before billing queries or mutations", async (role) => {
    callerRole = role;
    const { POST } = await import("@/app/api/billing/change-plan/route");

    const response = await POST(makeRequest("schedule-downgrade"));

    expect(response.status).toBe(403);
    expect(queries).toEqual(["users"]);
    expect(mockScheduleDowngrade).not.toHaveBeenCalled();
    expect(mockCancelScheduledChange).not.toHaveBeenCalled();
  });
});
