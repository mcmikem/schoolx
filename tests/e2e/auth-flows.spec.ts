/**
 * E2E auth-flow regression tests.
 *
 * These tests run against the dev server started by Playwright's webServer
 * config with NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES=true so that demo sessions
 * work.  They catch the regressions that have repeatedly slipped through
 * unit tests — specifically things that touch the browser's actual auth flow.
 *
 * Run locally:
 *   npx playwright test tests/e2e/auth-flows.spec.ts
 *
 * Run against an already-running server (must have NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES=true):
 *   PLAYWRIGHT_USE_EXISTING_SERVER=true npx playwright test tests/e2e/auth-flows.spec.ts
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

// The Playwright test runner does not load .env.local, so resolve the Supabase
// URL the browser actually talks to from the project env file. Mocks must match
// the real URL or they silently never intercept.
function resolveSupabaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (fromEnv) return fromEnv;
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const envPath = path.join(process.cwd(), ".env.local");
    const contents = fs.readFileSync(envPath, "utf8");
    const match = contents.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // ignore and fall back to the local default
  }
  return "http://127.0.0.1:54321";
}

const SUPABASE_URL = resolveSupabaseUrl();

// ─── helpers ────────────────────────────────────────────────────────────────

/** Open the TopBar user-avatar dropdown that contains the Sign Out button. */
async function openUserMenu(page: Page) {
  await page.getByRole("button", { name: /user menu/i }).click();
}

/** Fill the login form using stable locators. */
async function fillLoginForm(page: Page, phone: string, password: string) {
  // #identifier always exists on the current login page. Waiting for it instead
  // of a one-shot isVisible() check avoids racing a slow page load (which made
  // the legacy #phone fallback hang for the full test timeout).
  const identifierField = page.locator("#identifier").first();
  await identifierField.waitFor({ state: "visible", timeout: 10_000 });
  await identifierField.fill(phone);
  await page.locator("#password").fill(password);
}

/** Fill all 3 steps of the registration form and click the final submit. */
async function stableFill(locator: Locator, value: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await locator.click();
    await locator.fill(value);
    try {
      await expect(locator).toHaveValue(value, { timeout: 1200 });
      return;
    } catch {
      if (attempt === 3) throw new Error(`Failed to set input value to ${value}`);
    }
  }
}

async function fillAndSubmitRegisterForm(page: Page) {
  await page.goto("/register", { waitUntil: "networkidle" });
  await expect(page.getByText(/step 1 of 3/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: /next.*where/i })).toBeEnabled({ timeout: 10000 });

  // Step 1 – school info
  const schoolName = page.getByLabel(/school name/i);
  await stableFill(schoolName, "Test School");
  let advancedToStep2 = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByRole("button", { name: /next.*where/i }).click();

    const step2Label = await page
      .getByText(/step 2 of 3/i)
      .isVisible()
      .catch(() => false);
    const districtVisible = await page
      .getByRole("combobox", { name: /^district$/i })
      .isVisible()
      .catch(() => false);

    if (step2Label || districtVisible) {
      advancedToStep2 = true;
      break;
    }

    // If validation flashed, restore step-1 input and try once more.
    await stableFill(schoolName, "Test School");
  }

  expect(advancedToStep2).toBe(true);

  // Step 2 – location
  const districtCombo = page.getByRole("combobox", { name: /^district$/i });
  await expect(districtCombo).toBeVisible({ timeout: 10000 });
  if (await districtCombo.isVisible().catch(() => false)) {
    await districtCombo.selectOption("Kampala");
  } else {
    const district = page.getByRole("textbox", { name: /^district$/i });
    await stableFill(district, "Kampala");
  }

  const subcountyCombo = page.getByRole("combobox", {
    name: /sub-county \/ division/i,
  });
  await expect(subcountyCombo).toBeVisible({ timeout: 10000 });
  if (await subcountyCombo.isVisible().catch(() => false)) {
    await subcountyCombo.selectOption("Central Division");
  } else {
    const subcounty = page.getByRole("textbox", {
      name: /sub-county \/ division/i,
    });
    await stableFill(subcounty, "Central Division");
  }

  await page.getByRole("button", { name: /next.*account/i }).click();
  await expect(page.getByText(/step 3 of 3/i)).toBeVisible({ timeout: 10000 });

  // Step 3 – admin credentials
  await page.getByLabel(/your full name/i).fill("Test Admin");
  await page.getByLabel(/your phone number/i).fill("0700000001");
  // Password must have uppercase + number to pass validateStep3
  await page.locator('input[type="password"]').first().fill("SecretPass1");
  await page.locator('input[type="password"]').nth(1).fill("SecretPass1");

  await page.getByRole("button", { name: /finish.*start/i }).click();
}

async function setRegisterLocation(
  page: Page,
  districtValue: string,
  subcountyValue?: string,
) {
  const districtCombo = page.getByRole("combobox", { name: /^district$/i });
  if (await districtCombo.isVisible().catch(() => false)) {
    await districtCombo.selectOption(districtValue);
  } else {
    await stableFill(
      page.getByRole("textbox", { name: /^district$/i }),
      districtValue,
    );
  }

  if (!subcountyValue) {
    return;
  }

  const subcountyCombo = page.getByRole("combobox", {
    name: /sub-county \/ division/i,
  });
  if (await subcountyCombo.isVisible().catch(() => false)) {
    await subcountyCombo.selectOption(subcountyValue);
  } else {
    await stableFill(
      page.getByRole("textbox", { name: /sub-county \/ division/i }),
      subcountyValue,
    );
  }
}

async function resetAuthState(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function expectProtectedRouteOutcome(page: Page) {
  await page.waitForTimeout(400);
  // Unauthenticated users MUST be redirected to /login. Accepting /dashboard here
  // would make these tests pass even when the auth guard is completely broken.
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
}

async function gotoRoute(page: Page, path: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ERR_ABORTED") || attempt === 1) {
        throw error;
      }
      await page.waitForTimeout(300);
    }
  }
}

// ─── Route protection ────────────────────────────────────────────────────────

test.describe("Auth – route protection", () => {
  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await resetAuthState(page);
    await gotoRoute(page, "/dashboard");
    await expectProtectedRouteOutcome(page);
  });

  test("unauthenticated nested route redirects to /login", async ({ page }) => {
    await resetAuthState(page);
    await gotoRoute(page, "/dashboard/fees");
    await expectProtectedRouteOutcome(page);
  });

  test("unauthenticated /dashboard/settings redirects to /login", async ({
    page,
  }) => {
    await resetAuthState(page);
    await gotoRoute(page, "/dashboard/settings");
    await expectProtectedRouteOutcome(page);
  });

  test("demo session keeps /dashboard accessible (no redirect to /login)", async ({
    page,
  }) => {
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard");
    // Must NOT be redirected away
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// ─── Sign-out ────────────────────────────────────────────────────────────────

test.describe("Auth – sign-out", () => {
  test.beforeEach(async ({ page }) => {
    // Stub the Supabase logout endpoint so it doesn't depend on a live session
    await page.route(`${SUPABASE_URL}/auth/v1/logout*`, async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
  });

  test("sign out lands on /login", async ({ page }) => {
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard");
    // The demo session MUST render the TopBar user menu; if it doesn't, the
    // demo-session flow is broken and the test should fail, not self-skip.
    await expect(page.getByRole("button", { name: /user menu/i })).toBeVisible({ timeout: 20_000 });
    await openUserMenu(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expectProtectedRouteOutcome(page);
  });

  test("after sign-out, revisiting /dashboard redirects to /login", async ({
    page,
  }) => {
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /user menu/i })).toBeVisible({ timeout: 20_000 });
    await openUserMenu(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expectProtectedRouteOutcome(page);

    // Navigate back — session is gone, must redirect again
    await page.goto("/dashboard");
    await expectProtectedRouteOutcome(page);
  });

  test("sign-out clears demo session storage", async ({ page }) => {
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /user menu/i })).toBeVisible({ timeout: 20_000 });
    await openUserMenu(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expectProtectedRouteOutcome(page);

    const demoInSession = await page.evaluate(() =>
      sessionStorage.getItem("skoolmate_demo_v1"),
    );
    const demoInLocal = await page.evaluate(() =>
      localStorage.getItem("skoolmate_demo_v1"),
    );
    expect(demoInSession).toBeNull();
    expect(demoInLocal).toBeNull();
  });
});

// ─── Login form ──────────────────────────────────────────────────────────────

test.describe("Auth – login form", () => {
  test.beforeEach(async ({ page }) => {
    // All sign-in attempts return "invalid credentials"
    await page.route(`${SUPABASE_URL}/auth/v1/token*`, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      });
    });
  });

  test("wrong credentials show an error message", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, "0700000000", "WrongPassword1");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // The mocked /auth/v1/token request always returns 400 invalid_grant, so the
    // form MUST surface an error message. Wait for the sign-in to settle first
    // (button leaves "Signing in...") so the toast assertion starts inside the
    // toast's visibility window instead of racing its auto-dismiss. A fallback
    // assertion would make this test pass even when errors are swallowed.
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible({ timeout: 20_000 });
    await expect(
      page
        .getByText(
          /invalid phone number or password|invalid.*credentials|wrong.*password|invalid login details|login failed/i,
        )
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("wrong credentials never redirect to /dashboard", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, "0700000000", "WrongPassword1");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await page.waitForTimeout(3_000);
    expect(page.url()).not.toMatch(/\/dashboard/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("rate limiter activates after 5 consecutive failures", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    let tokenCalls = 0;
    await page.route(`${SUPABASE_URL}/auth/v1/token*`, async (route) => {
      tokenCalls += 1;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      });
    });

    await page.goto("/login");

    for (let i = 0; i < 5; i++) {
      await fillLoginForm(page, "0700000000", "WrongPassword1");
      await page.getByRole("button", { name: /^sign in$/i }).click();
      // Wait for error feedback
      await page.waitForTimeout(1000);
    }

    // The 5th failed attempt must flip the client-side lockout state. Wait for
    // the lockout banner to render — attempting the 6th login before it appears
    // would fire an extra auth request and make this test flaky.
    await expect(page.getByText(/too many attempts/i).first()).toBeVisible({ timeout: 10_000 });

    // 6th attempt should be blocked client-side: no additional auth request.
    const callsBeforeSixthAttempt = tokenCalls;
    await fillLoginForm(page, "0700000000", "WrongPassword1");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForTimeout(1200);

    // Lockout is client-side; once active, it should block an additional auth request.
    expect(tokenCalls).toBe(callsBeforeSixthAttempt);
    await expect(page).toHaveURL(/\/login/);
  });
});

// NOTE: Real Supabase auth E2E tests require NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES=false
// so the login form falls through to signIn() instead of /api/demo-login/.
// In the current test env (dev mode + demo routes enabled), all form logins
// hit the demo endpoint first. The fetchUserData race condition is covered
// by regression tests in src/__tests__/regression.test.ts.

// ─── Register form validation ─────────────────────────────────────────────────
// These don't hit the backend — they verify the client-side validation that
// gates the submit button and prevents bad data reaching the API.

test.describe("Auth – register validation (no backend)", () => {
  test("shows error for empty school name", async ({ page }) => {
    await page.goto("/register", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /next.*where/i }).click();
    await expect(page.getByText(/school name is required/i)).toBeVisible({ timeout: 10000 });
  });

  test("shows error for password under 8 characters", async ({ page }) => {
    // Reach step 3
    await page.goto("/register", { waitUntil: "networkidle" });
    await stableFill(page.getByRole("textbox", { name: /school name/i }), "Test School");
    await page.getByRole("button", { name: /next.*where/i }).click();
    await setRegisterLocation(page, "Kampala", "Central Division");
    await page.getByRole("button", { name: /next.*account/i }).click();

    await page.getByLabel(/your full name/i).fill("John Admin");
    await page.getByLabel(/your phone number/i).fill("0700000000");
    await page.locator('input[type="password"]').first().fill("abc");
    await page.locator('input[type="password"]').nth(1).fill("abc");
    await page.getByRole("button", { name: /finish.*start/i }).click();

    // The password input has minLength={8} so HTML5 constraint validation
    // blocks the submit before React's onSubmit fires. Verify the input is
    // in an invalid state (browser reports constraint violation).
    const isInvalid = await page
      .locator('input[type="password"]')
      .first()
      .evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test("shows error when passwords do not match", async ({ page }) => {
    await page.goto("/register", { waitUntil: "networkidle" });
    await stableFill(page.getByRole("textbox", { name: /school name/i }), "Test School");
    await page.getByRole("button", { name: /next.*where/i }).click();
    await setRegisterLocation(page, "Kampala", "Central Division");
    await page.getByRole("button", { name: /next.*account/i }).click();

    await page.getByLabel(/your full name/i).fill("John Admin");
    await page.getByLabel(/your phone number/i).fill("0700000000");
    // Must have uppercase + number to pass strength check and reach mismatch validation
    await page.locator('input[type="password"]').first().fill("SecretPass1");
    await page.locator('input[type="password"]').nth(1).fill("DifferentPass1");
    await page.getByRole("button", { name: /finish.*start/i }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("register API error stays on /register and shows error", async ({
    page,
  }) => {
    await page.route(/\/api\/register\/?$/, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Database error. Please try again." }),
      });
    });

    await fillAndSubmitRegisterForm(page);

    await expect(
      page.getByText(/database error|registration failed/i),
    ).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toMatch(/\/register/);
  });

  test("register success + both sign-in attempts fail → fallback message", async ({
    page,
  }) => {
    test.setTimeout(40_000);

    await page.route(/\/api\/register\/?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { schoolId: "test-id", userId: "test-uid", schoolCode: "TST001" },
          message: "Registration successful",
        }),
      });
    });

    // Both sign-in attempts fail
    await page.route(`${SUPABASE_URL}/auth/v1/token*`, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      });
    });

    await fillAndSubmitRegisterForm(page);

    // Real behavior (register/page.tsx): after a successful registration, auto
    // sign-in is attempted with retries. If all attempts fail the user is sent
    // to /login?registered=1 with the phone pre-filled — never left stranded on
    // /register.
    await expect(page).toHaveURL(/\/login/, { timeout: 25_000 });
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });
});
