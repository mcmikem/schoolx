/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockCreateClient: any = jest.fn();
const mockUpsert: any = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ success: false, error: message }, { status }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: { user: { id: "signed-in-user", role: "teacher" }, schoolId: "school-a" },
  }),
  rateLimit: () => ({ success: true }),
  supabaseClientOptions: () => ({}),
}));
jest.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => mockCreateClient(...args) }));

describe("push subscription ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mockUpsert.mockResolvedValue({ error: null });
    mockCreateClient.mockReturnValue({
      from: () => ({ upsert: (...args: unknown[]) => mockUpsert(...args) }),
    });
  });

  it("ignores a body user id and binds the subscription to the authenticated user", async () => {
    const { POST } = await import("@/app/api/push/subscribe/route");
    const request = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "victim-user",
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
          keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
        },
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: "signed-in-user",
        endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
        keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
      },
      { onConflict: "user_id" },
    );
  });

  it("does not report success if persistence fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "database unavailable" } });
    const { POST } = await import("@/app/api/push/subscribe/route");
    const request = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
          keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
        },
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false });
  });

  it.each([
    { endpoint: "http://127.0.0.1/admin", keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) } },
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
      keys: { p256dh: "short", auth: "short" },
    },
  ])("rejects unsafe endpoints and malformed key material", async (subscription) => {
    const { POST } = await import("@/app/api/push/subscribe/route");
    const request = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
