/** @jest-environment node */

import type { NextRequest } from "next/server";

type Json = Record<string, unknown>;

function makeRequest(url: string, init: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

interface MockClientConfig {
  single?: Record<string, { data: unknown; error: unknown }>;
  maybeSingle?: Record<string, { data: unknown; error: unknown }>;
  insert?: Record<string, { data: unknown; error: unknown }>;
  upsert?: Record<string, { data: unknown; error: unknown }>;
  update?: Record<string, { data: unknown; error: unknown }>;
  counts?: Record<string, number>;
  auth?: {
    createUser?: { data: unknown; error: unknown };
    deleteUser?: { data: unknown; error: unknown };
    updateUserById?: { data: unknown; error: unknown };
    resetPasswordForEmail?: { data: unknown; error: unknown };
  };
}

interface MockClient {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  eq: jest.Mock;
  gte: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  not: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  then: jest.Mock;
  auth: {
    admin: {
      createUser: jest.Mock;
      deleteUser: jest.Mock;
      updateUserById: jest.Mock;
    };
    resetPasswordForEmail: jest.Mock;
  };
}

function buildMockClient(config: MockClientConfig = {}): MockClient {
  const resolve = (table: string, lastMethod: string): { data: unknown; error: unknown; count?: number } => {
    if (lastMethod === "single") return config.single?.[table] ?? { data: null, error: null };
    if (lastMethod === "maybeSingle") return config.maybeSingle?.[table] ?? { data: null, error: null };
    if (lastMethod === "insert") return config.insert?.[table] ?? { data: null, error: null };
    if (lastMethod === "upsert") return config.upsert?.[table] ?? { data: null, error: null };
    if (lastMethod === "update") return config.update?.[table] ?? { data: null, error: null };
    if (lastMethod === "gte") return { data: null, error: null, count: config.counts?.[table] ?? 0 };
    return { data: null, error: null };
  };

  let lastMethod = "";
  const builder: MockClient = {
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue(config.auth?.createUser ?? { data: null, error: null }),
        deleteUser: jest.fn().mockResolvedValue(config.auth?.deleteUser ?? { data: { user: null }, error: null }),
        updateUserById: jest.fn().mockResolvedValue(config.auth?.updateUserById ?? { data: null, error: null }),
      },
      resetPasswordForEmail: jest
        .fn()
        .mockResolvedValue(config.auth?.resetPasswordForEmail ?? { data: {}, error: null }),
    },
  } as MockClient;

  const currentTable = { value: "" };

  const makeMethod = (name: string): jest.Mock =>
    jest.fn((...args: unknown[]) => {
      lastMethod = name;
      if (name === "from") {
        currentTable.value = String(args[0] ?? "");
        lastMethod = "from";
      }
      return builder;
    });

  builder.from = makeMethod("from");
  builder.select = makeMethod("select");
  builder.insert = makeMethod("insert");
  builder.update = makeMethod("update");
  builder.upsert = makeMethod("upsert");
  builder.eq = makeMethod("eq");
  builder.gte = makeMethod("gte");
  builder.order = makeMethod("order");
  builder.limit = makeMethod("limit");
  builder.not = makeMethod("not");
  builder.single = jest.fn(() => {
    lastMethod = "single";
    return builder;
  });
  builder.maybeSingle = jest.fn(() => {
    lastMethod = "maybeSingle";
    return builder;
  });
  builder.then = jest.fn((onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(resolve(currentTable.value, lastMethod)).then(onFulfilled, onRejected),
  );
  return builder;
}

const mockCreateClient = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

let currentClient: MockClient;
function useClient(config: MockClientConfig = {}): MockClient {
  currentClient = buildMockClient(config);
  mockCreateClient.mockReturnValue(currentClient);
  return currentClient;
}

const OK_SINGLE = (id: string) => ({ data: { id }, error: null });

const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

afterAll(() => {
  if (originalEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  if (originalEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.key;
});

describe("register route", () => {
  const validBody: Json = {
    schoolName: "Kampala Primary School",
    district: "Kampala",
    subcounty: "Nakawa",
    schoolType: "primary",
    ownership: "private",
    billingMode: "full_suite",
    adminName: "Test Admin",
    adminPhone: "0700000000",
    password: "StrongPass1",
  };

  const post = (body: Json) =>
    makeRequest("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify(body),
    });

  test("rejects missing required fields with 400", async () => {
    useClient();
    const { POST } = await import("../app/api/register/route");
    const res = await POST(post({ schoolName: "X", district: "Kampala" }));
    expect(res.status).toBe(400);
  });

  test("rejects weak passwords", async () => {
    useClient();
    const { POST } = await import("../app/api/register/route");
    const res = await POST(post({ ...validBody, password: "short" }));
    expect(res.status).toBe(400);
  });

  test("honeypot field returns 200 without touching the DB", async () => {
    const client = useClient();
    const { POST } = await import("../app/api/register/route");
    const res = await POST(post({ ...validBody, _gotcha: "filled-by-bot" }));
    expect(res.status).toBe(200);
    expect(client.auth.admin.createUser).not.toHaveBeenCalled();
    const nonRateLimitTables = client.from.mock.calls.filter(([table]) => table !== "rate_limit_log");
    expect(nonRateLimitTables).toHaveLength(0);
  });

  test("rejects already-registered phone", async () => {
    useClient({ maybeSingle: { users: { data: { id: "existing" }, error: null } } });
    const { POST } = await import("../app/api/register/route");
    const res = await POST(post(validBody));
    expect(res.status).toBe(400);
  });

  test("happy path creates auth user, school, admin profile and seeds curriculum", async () => {
    const client = useClient({
      single: {
        schools: OK_SINGLE("school-1"),
        users: OK_SINGLE("user-1"),
        academic_years: OK_SINGLE("ay-1"),
      },
    });
    client.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });

    const { POST } = await import("../app/api/register/route");
    const res = await POST(post(validBody));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.schoolId).toBe("school-1");
    expect(body.data?.schoolCode).toBeTruthy();

    expect(client.auth.admin.createUser).toHaveBeenCalledTimes(1);
    expect(client.auth.admin.deleteUser).not.toHaveBeenCalled();

    const insertTables = client.insert.mock.calls.map(([builder]) => builder).filter(Boolean);
    const fromTables = client.from.mock.calls.map(([table]) => table);
    for (const table of [
      "schools",
      "users",
      "subjects",
      "classes",
      "academic_years",
      "terms",
      "academic_terms",
      "events",
    ]) {
      expect(fromTables).toContain(table);
    }
    expect(insertTables.length).toBeGreaterThan(0);
  });

  test("rolls back (deletes auth user) when school insert fails", async () => {
    const client = useClient({
      single: { schools: { data: null, error: { message: "insert failed" } } },
    });
    client.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });

    const { POST } = await import("../app/api/register/route");
    const res = await POST(post(validBody));
    expect(res.status).toBe(500);
    expect(client.auth.admin.deleteUser).toHaveBeenCalledWith("auth-1");
  });

  test("modular billing seeds entitlements and opens a support ticket", async () => {
    const client = useClient({
      single: {
        schools: OK_SINGLE("school-1"),
        users: OK_SINGLE("user-1"),
        academic_years: OK_SINGLE("ay-1"),
      },
    });
    client.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });

    const { POST } = await import("../app/api/register/route");
    const res = await POST(post({ ...validBody, billingMode: "modular", selectedModules: ["reports", "attendance"] }));
    expect(res.status).toBe(200);

    const fromTables = client.from.mock.calls.map(([table]) => table);
    expect(fromTables).toContain("school_module_entitlements");
    expect(fromTables).toContain("support_tickets");
  });
});

describe("forgot-password route", () => {
  const post = (body: Json) =>
    makeRequest("http://localhost/api/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.20" },
      body: JSON.stringify(body),
    });

  test("silently returns 200 for empty phone (no enumeration)", async () => {
    useClient();
    const { POST } = await import("../app/api/forgot-password/route");
    const res = await POST(post({ phone: "" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("sends reset email for phone-derived address", async () => {
    const client = useClient();
    client.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const { POST } = await import("../app/api/forgot-password/route");
    const res = await POST(post({ phone: "0700000000" }));
    expect(res.status).toBe(200);
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith("0700000000@omuto.org", expect.anything());
  });

  test("returns 200 even when rate limited (anti-enumeration)", async () => {
    useClient({ counts: { rate_limit_log: 99 } });
    const { POST } = await import("../app/api/forgot-password/route");
    const res = await POST(post({ phone: "0700000000" }));
    expect(res.status).toBe(200);
  });

  test("returns 200 when the email send throws", async () => {
    const client = useClient();
    client.auth.resetPasswordForEmail.mockRejectedValue(new Error("smtp down"));
    const { POST } = await import("../app/api/forgot-password/route");
    const res = await POST(post({ phone: "0700000000" }));
    expect(res.status).toBe(200);
  });
});

describe("reset-password route", () => {
  const post = (body: Json) =>
    makeRequest("http://localhost/api/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.30" },
      body: JSON.stringify(body),
    });

  test("rejects weak password", async () => {
    useClient();
    const { POST } = await import("../app/api/reset-password/route");
    const res = await POST(post({ token: "abc", newPassword: "short" }));
    expect(res.status).toBe(400);
  });

  test("rejects invalid token", async () => {
    useClient();
    const { POST } = await import("../app/api/reset-password/route");
    const res = await POST(post({ token: "bogus", newPassword: "StrongPass1" }));
    expect(res.status).toBe(400);
  });

  test("rejects expired token and marks it used", async () => {
    const client = useClient({
      maybeSingle: {
        password_reset_tokens: {
          data: {
            id: "tok-1",
            user_id: "user-1",
            expires_at: new Date(Date.now() - 3600_000).toISOString(),
            used_at: null,
          },
          error: null,
        },
      },
    });
    const { POST } = await import("../app/api/reset-password/route");
    const res = await POST(post({ token: "expired", newPassword: "StrongPass1" }));
    expect(res.status).toBe(400);
    expect(client.update).toHaveBeenCalled();
  });

  test("rejects already-used token", async () => {
    useClient({
      maybeSingle: {
        password_reset_tokens: {
          data: {
            id: "tok-1",
            user_id: "user-1",
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            used_at: new Date().toISOString(),
          },
          error: null,
        },
      },
    });
    const { POST } = await import("../app/api/reset-password/route");
    const res = await POST(post({ token: "used", newPassword: "StrongPass1" }));
    expect(res.status).toBe(400);
  });

  test("happy path updates auth password and marks token used", async () => {
    const client = useClient({
      maybeSingle: {
        password_reset_tokens: {
          data: {
            id: "tok-1",
            user_id: "user-1",
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            used_at: null,
          },
          error: null,
        },
        users: { data: { auth_id: "auth-1" }, error: null },
      },
    });
    client.auth.admin.updateUserById.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });

    const { POST } = await import("../app/api/reset-password/route");
    const res = await POST(post({ token: "valid", newPassword: "StrongPass1" }));
    expect(res.status).toBe(200);
    expect(client.auth.admin.updateUserById).toHaveBeenCalledWith("auth-1", { password: "StrongPass1" });
    expect(client.update).toHaveBeenCalled();
  });

  test("returns 429 when rate limited", async () => {
    useClient({ counts: { rate_limit_log: 99 } });
    const { POST } = await import("../app/api/reset-password/route");
    const res = await POST(post({ token: "x", newPassword: "StrongPass1" }));
    expect(res.status).toBe(429);
  });
});

describe("cron route security gate", () => {
  const originalCron = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
  });

  const post = (headers: Record<string, string> = {}) =>
    makeRequest("http://localhost/api/automation/auto-fee-reminder", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ schoolId: "school-1" }),
    });

  test("rejects with 401 when x-cron-secret is missing", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    useClient();
    const { POST } = await import("../app/api/automation/auto-fee-reminder/route");
    const res = await POST(post());
    expect(res.status).toBe(401);
  });

  test("rejects with 401 when x-cron-secret mismatches", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    useClient();
    const { POST } = await import("../app/api/automation/auto-fee-reminder/route");
    const res = await POST(post({ "x-cron-secret": "wrong" }));
    expect(res.status).toBe(401);
  });

  test("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    useClient();
    const { POST } = await import("../app/api/automation/auto-fee-reminder/route");
    const res = await POST(post({ "x-cron-secret": "anything" }));
    expect(res.status).toBe(500);
  });
});
