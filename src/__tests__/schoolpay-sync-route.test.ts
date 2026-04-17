describe("schoolpay sync route module safety", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterAll(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalServiceRole === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    }
  });

  test("can be imported without Supabase env vars", async () => {
    const mod = await import("../app/api/schoolpay/sync/route");

    expect(typeof mod.POST).toBe("function");
    expect(typeof mod.GET).toBe("function");
  });
});
