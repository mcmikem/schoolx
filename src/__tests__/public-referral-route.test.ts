/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom: any = jest.fn();
let allowed = true;
let referral: any = { id: "ref-1", code: "SAFE123", clicks: 4, is_active: true };

jest.mock("@/lib/api-utils", () => ({
  createServiceRoleClientOrThrow: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: () => Response.json({ error: "server error" }, { status: 500 }),
  rateLimit: () => ({ success: allowed }),
}));
jest.mock("@/lib/logger", () => ({ logger: { error: jest.fn() } }));

describe("public marketer referral route", () => {
  beforeEach(() => {
    allowed = true;
    referral = { id: "ref-1", code: "SAFE123", clicks: 4, is_active: true };
    const builder: Record<string, any> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(async () => ({ data: referral, error: null }));
    builder.update = jest.fn(() => builder);
    mockFrom.mockReturnValue(builder);
    jest.clearAllMocks();
  });

  it("normalizes a bounded code and redirects using a URL-encoded query parameter", async () => {
    const { GET } = await import("@/app/api/marketers/referrals/[code]/route");
    const response = await GET(new NextRequest("https://skoolmate.test/api/referrals/safe123"), {
      params: Promise.resolve({ code: "safe123" }),
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://skoolmate.test/register?ref=SAFE123");
    expect(mockFrom).toHaveBeenCalledWith("marketer_referral_codes");
  });

  it.each([
    "bad/code",
    "bad?next=//attacker.test",
    "x",
    "a".repeat(41),
  ])("rejects unsafe referral path %s", async (code) => {
    const { GET } = await import("@/app/api/marketers/referrals/[code]/route");
    const response = await GET(new NextRequest("https://skoolmate.test/api/referrals/x"), {
      params: Promise.resolve({ code }),
    });
    expect(response.status).toBe(404);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("does not query or update when the public rate limit is exceeded", async () => {
    allowed = false;
    const { GET } = await import("@/app/api/marketers/referrals/[code]/route");
    const response = await GET(new NextRequest("https://skoolmate.test/api/referrals/safe123"), {
      params: Promise.resolve({ code: "safe123" }),
    });
    expect(response.status).toBe(429);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
