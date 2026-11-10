/** @jest-environment node */

import { NextRequest } from "next/server";

const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
const originalFetch = global.fetch;

afterEach(() => {
  jest.resetModules();
  global.fetch = originalFetch;
});

afterAll(() => {
  if (originalEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  if (originalEnv.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.anon;
  if (originalEnv.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.service;
});

describe("verified API sign-in session handoff", () => {
  it("returns the verified auth identity and stores it in the project-scoped cookie", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://school-test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-for-auth-route";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          user: {
            id: "auth-user-123",
            email: "teacher@example.org",
            phone: "+256700000000",
            aud: "authenticated",
            role: "authenticated",
            created_at: "2026-01-01T00:00:00.000Z",
            app_metadata: { provider: "email" },
            user_metadata: { role: "teacher", full_name: "Test Teacher" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const { POST } = await import("../app/api/auth/signin/route");
    const request = new NextRequest("https://school.example/api/auth/signin/", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.10" },
      body: JSON.stringify({ identifier: "teacher@example.org", password: "StrongPass1" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      data?: { user?: { id?: string; user_metadata?: { role?: string } } };
    };
    const cookie = response.cookies.get("sb-school-test-auth-token");

    expect(response.status).toBe(200);
    expect(payload.data?.user?.id).toBe("auth-user-123");
    expect(payload.data?.user?.user_metadata?.role).toBe("teacher");
    expect(cookie?.value).toContain("base64-");
    const encodedSession = cookie?.value.replace(/^base64-/, "");
    const session = JSON.parse(Buffer.from(encodedSession || "", "base64url").toString("utf8"));
    expect(session.user.id).toBe("auth-user-123");
    expect(session.user.user_metadata.role).toBe("teacher");
    expect(session.access_token).toBe("access-token");
    expect(JSON.stringify(payload)).not.toContain("StrongPass1");
  });
});
