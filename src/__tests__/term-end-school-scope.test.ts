/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

let mockProfile: { role: string; school_id: string | null } = { role: "school_admin", school_id: null };
const mockFetch: any = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "auth-user" } }, error: null }) },
    from: () => {
      const builder: Record<string, any> = {};
      builder.select = jest.fn(() => builder);
      builder.eq = jest.fn(() => builder);
      builder.maybeSingle = jest.fn(async () => ({ data: mockProfile, error: null }));
      return builder;
    },
  }),
}));
jest.mock("@/lib/api-utils", () => ({
  rateLimit: () => ({ success: true }),
  supabaseClientOptions: (options: unknown) => options,
}));

function makeRequest(schoolId: unknown) {
  return new NextRequest("https://skoolmate.test/api/term-end", {
    method: "POST",
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: JSON.stringify({ schoolId }),
  });
}

describe("term-end proxy school scope", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://school.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.CRON_SECRET = "test-cron-secret";
    mockProfile = { role: "school_admin", school_id: null };
    mockFetch.mockReset();
    jest.spyOn(global, "fetch").mockImplementation(mockFetch);
  });

  it("denies a non-super-admin with no school association", async () => {
    const { POST } = await import("@/app/api/term-end/route");
    const response = await POST(makeRequest("school-other"));
    expect(response.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("denies a school admin targeting another school", async () => {
    mockProfile = { role: "school_admin", school_id: "school-a" };
    const { POST } = await import("@/app/api/term-end/route");
    const response = await POST(makeRequest("school-b"));
    expect(response.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects a missing target school before forwarding", async () => {
    const { POST } = await import("@/app/api/term-end/route");
    const response = await POST(makeRequest(""));
    expect(response.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
