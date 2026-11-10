/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockSendNotification: any = jest.fn();
const mockFrom: any = jest.fn();
const mockInsert: any = jest.fn();
let recipientSchool = "school-a";
let savedEndpoint = "https://fcm.googleapis.com/fcm/send/subscription-token";

jest.mock("web-push", () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: (...args: unknown[]) => mockSendNotification(...args) },
}));
jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown, message?: string) => Response.json({ success: true, data, message }),
  apiError: (error: string, status: number) => Response.json({ success: false, error }, { status }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: { user: { id: "sender", role: "school_admin" }, schoolId: "school-a" },
  }),
  assertUserRoleOrDeny: () => ({ ok: true }),
  createServiceRoleClientOrThrow: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
  rateLimit: () => ({ success: true }),
}));

function setQueries() {
  mockFrom.mockImplementation((table: string) => {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn((field: string, value: unknown) => {
      filters[field] = value;
      return builder;
    });
    builder.maybeSingle = jest.fn(async () => {
      if (table === "users") return { data: { id: "recipient", school_id: recipientSchool }, error: null };
      if (table === "push_subscriptions") {
        return {
          data: {
            endpoint: savedEndpoint,
            keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    builder.insert = (...args: unknown[]) => mockInsert(table, ...args);
    return builder;
  });
}

function makeRequest(extra: Record<string, unknown> = {}) {
  return new NextRequest("https://skoolmate.test/api/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipientUserId: "recipient", title: "Notice", message: "Open the app", ...extra }),
  });
}

describe("push delivery ownership and destination", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-vapid-key";
    process.env.VAPID_PRIVATE_KEY = "private-vapid-key";
    recipientSchool = "school-a";
    savedEndpoint = "https://fcm.googleapis.com/fcm/send/subscription-token";
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
    setQueries();
  });

  it("uses the registered same-school subscription and ignores supplied endpoints", async () => {
    const { POST } = await import("@/app/api/push/send/route");
    const response = await POST(
      makeRequest({ subscription: { endpoint: "http://127.0.0.1/admin", keys: { auth: "attacker" } } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { sent: true, receiptId: expect.any(String) } });
    expect(mockSendNotification).toHaveBeenCalledWith(
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
        keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
      },
      expect.stringContaining('"title":"Notice"'),
    );
    expect(mockInsert).toHaveBeenCalledWith(
      "push_delivery_receipts",
      expect.objectContaining({
        school_id: "school-a",
        sender_user_id: "sender",
        recipient_user_id: "recipient",
        status: "accepted_by_provider",
        provider_status: 201,
      }),
    );
    const receipt = mockInsert.mock.calls[0][1];
    expect(receipt).not.toHaveProperty("message");
    expect(receipt).not.toHaveProperty("endpoint");
  });

  it("denies recipients from another school before attempting delivery", async () => {
    recipientSchool = "school-b";
    const { POST } = await import("@/app/api/push/send/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(404);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("rejects arbitrary or non-HTTPS saved endpoints", async () => {
    savedEndpoint = "http://127.0.0.1/admin";
    const { POST } = await import("@/app/api/push/send/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("records expired provider subscriptions without logging endpoint or message", async () => {
    mockSendNotification.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 410 }));
    const { POST } = await import("@/app/api/push/send/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(410);
    expect(mockInsert).toHaveBeenCalledWith(
      "push_delivery_receipts",
      expect.objectContaining({
        status: "expired",
        provider_status: 410,
      }),
    );
    expect(mockInsert.mock.calls[0][1]).not.toHaveProperty("message");
    expect(mockInsert.mock.calls[0][1]).not.toHaveProperty("endpoint");
  });
});
