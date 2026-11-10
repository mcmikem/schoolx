/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockCreateClient: any = jest.fn();
const mockOptions: any = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock("@/lib/api-utils", () => ({
  supabaseClientOptions: (...args: unknown[]) => mockOptions(...args),
}));

function request(authorization?: string): NextRequest {
  return new Request("http://localhost/api/health/", {
    headers: authorization ? { authorization } : {},
  }) as unknown as NextRequest;
}

describe("health endpoint diagnostic disclosure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mockOptions.mockReturnValue({});

    mockCreateClient.mockReturnValue({
      from: () => {
        const builder: Record<string, any> = {};
        builder.select = jest.fn(() => builder);
        builder.limit = jest.fn(() => builder);
        builder.insert = jest.fn(() => builder);
        builder.delete = jest.fn(() => builder);
        builder.eq = jest.fn(() => builder);
        builder.maybeSingle = jest.fn(async () => ({ error: null, data: { id: "health-row" } }));
        builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ error: null, count: 42, data: null }).then(resolve, reject);
        return builder;
      },
    });
  });

  it("returns only the public status when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ status: "ok" }));
    expect(body).not.toHaveProperty("database");
    expect(body).not.toHaveProperty("env");
    expect(body).not.toHaveProperty("memory");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns only the public status for an invalid secret", async () => {
    process.env.CRON_SECRET = "configured-cron-secret";
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(request("Bearer wrong-secret"));
    const body = await response.json();
    expect(body).not.toHaveProperty("database");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("runs diagnostics only with the configured cron secret", async () => {
    process.env.CRON_SECRET = "configured-cron-secret";
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(request("Bearer configured-cron-secret"));
    const body = await response.json();
    expect(body.database).toEqual({ read: "ok", write: "ok" });
    expect(body.totalUsers).toBe(42);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });
});
