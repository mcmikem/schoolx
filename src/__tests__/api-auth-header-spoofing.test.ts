/** @jest-environment node */
import { describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: new Error("No session") }) },
  }),
}));

describe("API authentication ignores client-supplied identity headers", () => {
  it("does not authenticate from a spoofed x-user-id header", async () => {
    const { requireAuthenticatedUser } = await import("@/lib/api-utils");
    const request = new NextRequest("http://localhost/api/private", {
      headers: { "x-user-id": "victim-auth-uuid" },
    });

    const result = await requireAuthenticatedUser(request);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});
