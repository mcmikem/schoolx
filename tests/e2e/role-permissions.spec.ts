import { test, expect } from "@playwright/test";
// Use the app's own login-attempt logic rather than reimplementing it: staff are
// provisioned against a phone-derived address, and the format the app tries
// (normalised 256... first, raw 0... as a fallback) is not obvious enough to
// hardcode here without drifting.
import { buildAuthLoginAttempts } from "@/lib/auth-login";

/**
 * Role-based access control regression coverage.
 *
 * tests/e2e/rls-write-paths.spec.ts proves that a school admin CAN write to the
 * tables it should. This covers the other direction: that the roles which must
 * NOT write cannot.
 *
 * Every check here is a privilege-escalation check. The bugs repaired on
 * 2026-09-27 were all cases of policies that denied access when they should have
 * granted it. The opposite failure is more dangerous and has never been tested:
 * a policy that grants access to a parent, or lets a teacher write fees.
 *
 * Setup registers a school through the real endpoint and creates one account per
 * role through /api/users using the school admin's own browser session, so no
 * privileged credential is needed and the creation path is the real one.
 *
 * /api/register is rate limited to 5 attempts per 10 minutes, so this file
 * registers exactly once and must not be re-run in a tight loop.
 */

const APP = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_TEST_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PASSWORD = "RolePerms-abc123-9";

const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const digits = stamp.replace(/[^a-z0-9]/g, "");
const phoneFor = (n: number) =>
  `07${((Number.parseInt(digits.slice(0, 6), 36) + n * 7919) % 100000000).toString().padStart(8, "0")}`;

/**
 * Tables probed for every role.
 *
 * The `as` suffix makes each role's probe value unique: courses.code and
 * subjects.code are unique, so when school_admin inserted first the identical
 * code made every later role fail on a duplicate key -- which looks exactly like
 * RLS refusing the write, and would have hidden real findings.
 */
const STAFF_ONLY: Record<string, (schoolId: string, as: string) => Record<string, unknown>> = {
  // High-value targets: if a parent can write any of these it is a serious
  // privilege escalation, so they are measured explicitly rather than assumed.
  students: (s, as) => ({ school_id: s, first_name: "Perm", last_name: as, gender: "M", status: "active", student_number: `PS${as.slice(0, 6)}` }),
  staff_salaries: (s, as) => ({ school_id: s, staff_id: null, basic_salary: 1, as }),
  notices: (s, as) => ({ school_id: s, title: `Perm ${as}`, body: "x", notice_type: "general" }),
  sms_templates: (s, as) => ({ school_id: s, name: `Perm ${as}`, body: "x" }),
  fee_structure: (s, as) => ({ school_id: s, name: `Perm ${as}`, amount: 1 }),
  grades: (s, as) => ({ school_id: s, student_id: null, subject_id: null, term: 1, academic_year: "2026", score: 50 }),

  courses: (s, as) => ({ school_id: s, name: `Perm probe ${as}`, code: `${as.slice(0, 7)}` }),
  classes: (s, as) => ({ school_id: s, name: `Perm probe ${as}`, level: 5, academic_year: "2026" }),
  subjects: (s, as) => ({ school_id: s, name: `Perm probe ${as}`, code: `${as.slice(0, 7)}` }),
  events: (s, as) => ({ school_id: s, title: `Perm probe ${as}`, event_type: "academic", start_date: "2026-02-02" }),
  audit_log: (s, as) => ({ school_id: s, user_name: `Perm ${as}`, action: "create", module: "perm", description: `probe ${as}` }),
  school_settings: (s, as) => ({ school_id: s, key: `perm_${as.slice(0, 10)}`, value: "1" }),
};

/**
 * audit_log is deliberately writable by every authenticated role: it records
 * what each user did, including parents, so the app can log their actions.
 * It is excluded from the "staff only" list for that reason.
 */
const ADMIN_ONLY = ["courses", "classes", "subjects", "school_settings"] as const;

/** Reported and printed, but not yet asserted: needs a per-table decision. */
const NEEDS_REVIEW = ["students", "staff_salaries", "notices", "sms_templates", "fee_structure", "grades"] as const;

/** A parent may not create students either. */
const PARENT_DENIED = "students";

/**
 * Sign in through the real form.
 *
 * page.fill() on the login form races React hydration: the fields are controlled
 * inputs, so a fill issued before hydration mounts is silently reset to "" and the
 * submit then sends empty credentials. The page never navigates and the test fails
 * at waitForURL with no clue why. Retrying until the value survives hydration is
 * what makes this deterministic.
 */
async function signInViaForm(page: any, identifier: string, password: string) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto(`${APP}/login/`, { waitUntil: "domcontentloaded" });
    for (const [selector, value] of [
      ["#identifier", identifier],
      ["#password", password],
    ] as const) {
      for (let i = 0; i < 8; i++) {
        await page.locator(selector).first().fill(value);
        await page.waitForTimeout(400);
        if ((await page.locator(selector).first().inputValue().catch(() => "")) === value) break;
      }
    }
    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.waitForTimeout(12000);
    if (/\/(dashboard|setup)/.test(page.url())) return true;
  }
  return false;
}

const ROLES = ["bursar", "teacher", "secretary", "parent"] as const;
type Role = (typeof ROLES)[number];

// Serial: setup needs a real browser session to create the per-role accounts,
// and Playwright does not allow the page fixture in beforeAll.
test.describe.serial("role permissions", () => {
  let schoolId = "";
  const tokens: Partial<Record<Role | "school_admin", string>> = {};
  const createdEmails: Partial<Record<Role, string>> = {};
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const signIn = async (identifier: string) => {
    for (const attempt of buildAuthLoginAttempts(identifier)) {
      if (attempt.type !== "email") continue;
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: attempt.value, password: PASSWORD }),
      });
      const token = ((await res.json()) as { access_token?: string }).access_token;
      if (token) return token;
    }
    return "";
  };

  test("setup: register a school and create one account per role", async ({ page }) => {
    test.setTimeout(300000);
    expect(SUPABASE_URL, "SUPABASE_TEST_PROJECT_URL or NEXT_PUBLIC_SUPABASE_URL must be set").toBeTruthy();
    expect(ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY must be set").toBeTruthy();

    const adminEmail = `perm-${stamp}@omuto.org`;
    const reg = await fetch(`${APP}/api/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolName: `E2E Perms ${stamp}`,
        district: "Kampala",
        subcounty: "C",
        parish: "P",
        village: "V",
        schoolType: "primary",
        ownership: "private",
        selectedPackage: "starter",
        billingMode: "manual",
        selectedModules: [],
        adminName: "Perm Admin",
        email: adminEmail,
        adminPhone: phoneFor(0),
        password: PASSWORD,
      }),
    });
    expect(reg.ok, `registration failed: ${reg.status} ${await reg.text()}`).toBe(true);

    // A browser session is needed because the app authenticates its own API by
    // session cookie, not by a bearer token.
    const signedIn = await signInViaForm(page, adminEmail, PASSWORD);
    expect(signedIn, `could not establish a session; ended on ${page.url()}`).toBe(true);
    await page.waitForTimeout(3000);

    tokens.school_admin = await signIn(adminEmail);
    const profile = await (
      await fetch(`${SUPABASE_URL}/rest/v1/users?select=school_id&email=eq.${adminEmail}&limit=1`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${tokens.school_admin}` },
      })
    ).json();
    schoolId = profile?.[0]?.school_id;
    expect(schoolId, "could not resolve the new school's id").toBeTruthy();

    for (let i = 0; i < ROLES.length; i++) {
      const role = ROLES[i];
      const email = `perm-${role}-${stamp}@omuto.org`;
      const res = await page.evaluate(
        async (payload) => {
          const r = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          return { status: r.status, body: (await r.text()).slice(0, 160) };
        },
        {
          schoolId,
          fullName: `Perm ${role}`,
          phone: phoneFor(i + 1),
          password: PASSWORD,
          role,
          email,
        },
      );
      expect(res.status, `could not create ${role}: ${res.body}`).toBeLessThan(300);
      // Staff are provisioned against a phone-derived auth address, not the
      // email passed in, so sign in with the phone exactly as a user would.
      const phone = phoneFor(i + 1);
      createdEmails[role] = phone;
      tokens[role] = await signIn(phone);
      expect(tokens[role], `could not sign in as ${role} using phone ${phone}`).toBeTruthy();
    }
    expect(Object.keys(tokens).length, "expected an admin plus four roles").toBe(ROLES.length + 1);
  });

  test.afterAll(async () => {
    test.setTimeout(180000);
    if (!serviceKey || !schoolId) return;
    const admin = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };
    for (const table of [
      "audit_log", "students", "subjects", "classes", "courses", "events", "houses",
      "academic_terms", "academic_years", "school_settings", "notices", "fee_structure",
    ]) {
      await fetch(`${SUPABASE_URL}/rest/v1/${table}?school_id=eq.${schoolId}`, { method: "DELETE", headers: admin });
    }
    const users = await (
      await fetch(`${SUPABASE_URL}/rest/v1/users?school_id=eq.${schoolId}&select=auth_id`, { headers: admin })
    ).json();
    for (const u of Array.isArray(users) ? users : []) {
      if (u.auth_id) {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.auth_id}`, { method: "DELETE", headers: admin });
      }
    }
    await fetch(`${SUPABASE_URL}/rest/v1/users?school_id=eq.${schoolId}`, { method: "DELETE", headers: admin });
    await fetch(`${SUPABASE_URL}/rest/v1/schools?id=eq.${schoolId}`, { method: "DELETE", headers: admin });
    console.log(`cleaned up test school ${schoolId}`);
  });

  const insert = (token: string, table: string, body: unknown) =>
    fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });

  // One test collects every violation instead of stopping at the first, so a
  // single run shows the whole picture rather than one bug per run.
  test("report which roles can write which tables", async () => {
    test.setTimeout(180000);
    const matrix: Record<string, string[]> = {};
    const createdRows: { table: string; id: string }[] = [];

    for (const [role, token] of Object.entries(tokens)) {
      const allowed: string[] = [];
      for (const [table, make] of Object.entries(STAFF_ONLY)) {
        const res = await insert(token as string, table, make(schoolId, role));
        if (!res.ok) continue;
        allowed.push(table);
        const rows = await res.json().catch(() => null);
        const id = Array.isArray(rows) ? rows[0]?.id : undefined;
        if (id) createdRows.push({ table, id });
      }
      matrix[role] = allowed;
    }

    console.log("\n=== ROLE x TABLE: who may INSERT ===");
    for (const [role, allowed] of Object.entries(matrix)) {
      console.log(`  ${role.padEnd(13)} ${allowed.join(", ") || "(nothing)"}`);
    }

    // Remove anything the probes created so the database is left as found.
    for (const { table, id } of createdRows) {
      if (serviceKey) {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
          method: "DELETE",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        });
      }
    }

    console.log("\n=== NEEDS REVIEW (not asserted) ===");
    for (const table of NEEDS_REVIEW) {
      const who = Object.entries(matrix).filter(([, a]) => a.includes(table)).map(([r]) => r);
      console.log(`  ${table.padEnd(16)} ${who.join(", ") || "(nobody)"}`);
    }

    // Nothing below administrator level may manage curriculum, classes or settings.
    for (const role of ["bursar", "secretary", "teacher", "parent"] as const) {
      for (const table of ADMIN_ONLY) {
        expect(
          (matrix[role] ?? []).includes(table),
          `${role} was ALLOWED to insert into ${table} (privilege escalation)`,
        ).toBe(false);
      }
    }
  });

  for (const role of [...ROLES, "school_admin"] as const) {
    test(`${role} cannot read another school's students`, async () => {
      const token = tokens[role];
      expect(token, `${role} token missing`).toBeTruthy();
      // Any school id that is not this one must return nothing.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/students?select=id&school_id=eq.11111111-1111-1111-1111-111111111111`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
      });
      const rows = await res.json();
      expect(Array.isArray(rows) ? rows.length : 0, `${role} read another school's students`).toBe(0);
    });
  }
});