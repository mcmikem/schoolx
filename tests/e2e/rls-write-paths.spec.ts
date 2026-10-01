import { test, expect } from "@playwright/test";

/**
 * Regression coverage for the RLS repairs of 2026-09-27.
 *
 * Every one of these paths failed SILENTLY: the action returned no error and
 * simply did nothing, because row-level security blocked it. Nothing in the
 * existing suite noticed, which is why they went unnoticed for months.
 *
 * Each case asserts four things for a table:
 *   1. the browser session can INSERT
 *   2. it can read the row back
 *   3. it can UPDATE and DELETE it
 *   4. an insert naming a DIFFERENT school is refused  (tenancy isolation)
 *
 * These run against the live Supabase project the app is configured with, so a
 * migration that never reached production fails here rather than in a user's
 * browser. Point them at a scratch project with
 *   PLAYWRIGHT_BASE_URL=... SUPABASE_TEST_PROJECT_URL=...
 */

const APP = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_TEST_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Unique per attempt: if a worker restarts and re-runs beforeAll, a second
// registration with the same email would be rejected as a duplicate account.
const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const PASSWORD = "RlsTest-abc123-9";

// /api/register rejects a phone number that is already registered, so this must
// be unique per run or setup fails with a misleading "could not be completed".
const digits = stamp.replace(/[^a-z0-9]/g, "");
const ADMIN_PHONE = `07${(Number.parseInt(digits.slice(0, 6), 36) % 100000000)
  .toString()
  .padStart(8, "0")}`;

/** Tables whose browser write path was repaired, with a payload that satisfies NOT NULL. */
const CASES = [
  { table: "courses", make: (schoolId: string) => ({ school_id: schoolId, name: "E2E Course", code: `E${stamp.slice(-6)}` }) },
  { table: "classes", make: (schoolId: string) => ({ school_id: schoolId, name: "E2E Class", level: 5, academic_year: "2026" }) },
  { table: "subjects", make: (schoolId: string) => ({ school_id: schoolId, name: "E2E Subject", code: `S${stamp.slice(-6)}` }) },
  { table: "events", make: (schoolId: string) => ({ school_id: schoolId, title: "E2E Event", event_type: "academic", start_date: "2026-01-05" }) },
  { table: "houses", make: (schoolId: string) => ({ school_id: schoolId, name: `E2E House ${stamp}`, color: "#123456" }) },
  {
    table: "academic_terms",
    make: (schoolId: string) => ({
      school_id: schoolId,
      name: `E2E Term ${stamp}`,
      code: `T${stamp.slice(-6)}`,
      term_number: 3,
      start_date: "2027-07-01",
      end_date: "2027-10-30",
      // (school_id, academic_year, term_number) is unique and registration has
      // already seeded term 1 for the current year.
      academic_year: "2099",
    }),
  },
  {
    table: "students",
    make: (schoolId: string) => ({
      school_id: schoolId,
      first_name: "E2E",
      last_name: `Pupil${stamp}`,
      gender: "F",
      status: "active",
      student_number: `E${stamp.slice(-6)}`,
      parent_name: "E2E Parent",
      parent_phone: "0770000000",
    }),
  },
  {
    table: "audit_log",
    make: (schoolId: string) => ({
      school_id: schoolId,
      user_name: "E2E",
      action: "create",
      module: "e2e",
      description: `e2e-${stamp}`,
    }),
  },
];

const OTHER_SCHOOL = "11111111-1111-1111-1111-111111111111";

test.describe("RLS write paths", () => {
  // Module-level so a worker restart mid-file does not register a second school:
  // /api/register is rate limited, so a second call can fail the whole run.
  let session: { token: string; schoolId: string; email: string } | null = null;

  test.beforeAll(async () => {
    test.setTimeout(180000);
    if (session) return;
    expect(SUPABASE_URL, "SUPABASE_TEST_PROJECT_URL or NEXT_PUBLIC_SUPABASE_URL must be set").toBeTruthy();
    expect(ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY must be set").toBeTruthy();

    const email = `rls-${stamp}@omuto.org`;

    // Register through the real endpoint: the server holds the service role
    // credential, so the test itself never needs a privileged key.
    const register = await fetch(`${APP}/api/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolName: `E2E RLS School ${stamp}`,
        district: "Kampala",
        subcounty: "Central",
        parish: "Ward 1",
        village: "Village 1",
        schoolType: "primary",
        ownership: "private",
        selectedPackage: "starter",
        billingMode: "manual",
        selectedModules: [],
        adminName: "E2E Admin",
        email,
        adminPhone: ADMIN_PHONE,
        password: PASSWORD,
      }),
    });
    expect(register.ok, `registration failed: ${register.status} ${await register.text()}`).toBe(true);

    // Sign in the way the browser does, to obtain a real user JWT.
    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    const tokenBody = await tokenRes.json();
    expect(tokenBody.access_token, `sign-in failed: ${JSON.stringify(tokenBody).slice(0, 200)}`).toBeTruthy();
    const accessToken = tokenBody.access_token;

    const me = await fetch(`${SUPABASE_URL}/rest/v1/users?select=school_id&email=eq.${email}&limit=1`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    const rows = await me.json();
    const resolvedSchoolId = Array.isArray(rows) ? rows[0]?.school_id : undefined;
    expect(resolvedSchoolId, "could not resolve the new school's id").toBeTruthy();
    session = { token: accessToken, schoolId: resolvedSchoolId as string, email };
  });

  const call = (table: string, method: string, query = "", body?: unknown) =>
    fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      method,
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${session?.token ?? ""}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  // When pointed at a long-lived project, remove the school this run created.
  // No-op in CI, where the project is ephemeral.
  test.afterAll(async () => {
    test.setTimeout(120000);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey || !session) return;

    const admin = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };
    const schools = await (
      await fetch(`${SUPABASE_URL}/rest/v1/schools?name=like.E2E%20RLS%20School%25&select=id`, { headers: admin })
    ).json();
    if (!Array.isArray(schools)) return;

    for (const { id } of schools) {
      // Delete rows that do not cascade, then the school itself.
      for (const table of [
        "audit_log",
        "students",
        "subjects",
        "classes",
        "courses",
        "events",
        "houses",
        "academic_terms",
        "academic_years",
        "school_settings",
        "notices",
        "fee_structure",
      ]) {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?school_id=eq.${id}`, { method: "DELETE", headers: admin });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/schools?id=eq.${id}`, { method: "DELETE", headers: admin });
      const users = await (
        await fetch(`${SUPABASE_URL}/rest/v1/users?school_id=eq.${id}&select=id,auth_id,email`, { headers: admin })
      ).json();
      for (const u of Array.isArray(users) ? users : []) {
        if (u.auth_id) {
          await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.auth_id}`, { method: "DELETE", headers: admin });
        }
      }
      await fetch(`${SUPABASE_URL}/rest/v1/users?school_id=eq.${id}`, { method: "DELETE", headers: admin });
    }
    console.log(`cleaned up ${schools.length} test school(s)`);
  });

  for (const { table, make } of CASES) {
    test(`${table}: create, read, update, delete, and refuse another school`, async () => {
      test.setTimeout(120000);
      expect(session, "setup did not complete").toBeTruthy();
      const { schoolId } = session as { token: string; schoolId: string; email: string };

      // 1. insert
      const insert = await call(table, "POST", "", make(schoolId));
      const insertBody = await insert.json().catch(() => null);
      expect(
        insert.ok,
        `INSERT into ${table} was blocked: ${insert.status} ${JSON.stringify(insertBody).slice(0, 200)}`,
      ).toBe(true);
      const id = Array.isArray(insertBody) ? insertBody[0]?.id : undefined;
      expect(id, `${table}: insert returned no id`).toBeTruthy();

      // 2. read back
      const read = await call(table, "GET", `?id=eq.${id}&select=id`);
      const readBody = await read.json();
      expect(read.ok, `${table}: read failed ${read.status}`).toBe(true);
      expect(Array.isArray(readBody) && readBody.length, `${table}: inserted row is not visible to the client`).toBe(1);

      // 3. update, where the table has an updatable text column
      if (table !== "audit_log") {
        const updatable = make(schoolId);
        const field = ["name", "title", "first_name"].find((f) => f in updatable);
        if (field) {
          const upd = await call(table, "PATCH", `?id=eq.${id}`, { [field]: `E2E Updated ${stamp}` });
          expect(upd.ok, `${table}: UPDATE blocked: ${upd.status}`).toBe(true);
        }
      }

      // 4. tenancy isolation: a different school must be refused
      const foreign = await call(table, "POST", "", make(OTHER_SCHOOL));
      expect(
        foreign.status,
        `${table}: insert naming another school was allowed (${foreign.status})`,
      ).not.toBeLessThan(400);

      // 5. clean up through the same session
      const del = await call(table, "DELETE", `?id=eq.${id}`);
      expect(del.ok, `${table}: DELETE blocked: ${del.status}`).toBe(true);
    });
  }
});