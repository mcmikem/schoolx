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

const SUPABASE_URL = "https://gucxpmgwvnbqykevucbi.supabase.co";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Open the TopBar user-avatar dropdown that contains the Sign Out button. */
async function openUserMenu(page: Page) {
  await page.getByRole("button", { name: /user menu/i }).click();
}

/** Fill the login form using stable locators. */
async function fillLoginForm(page: Page, phone: string, password: string) {
  await page.locator("#phone").fill(phone);
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

  // Step 1 – school info
  const schoolName = page.getByLabel(/school name/i);
  await stableFill(schoolName, "Test School");
  await page.getByRole("button", { name: /next.*where/i }).click();

  // Step 2 – location
  const district = page.getByRole("textbox", { name: /^district$/i });
  await stableFill(district, "Kampala");
  const subcounty = page.getByRole("textbox", { name: /sub-county \/ division/i });
  await stableFill(subcounty, "Central Division");
  await page.getByRole("button", { name: /next.*account/i }).click();

  // Step 3 – admin credentials
  await page.getByLabel(/your full name/i).fill("Test Admin");
  await page.getByLabel(/your phone number/i).fill("0700000001");
  // Password must have uppercase + number to pass validateStep3
  await page.locator('input[type="password"]').first().fill("SecretPass1");
  await page.locator('input[type="password"]').nth(1).fill("SecretPass1");

  await page.getByRole("button", { name: /finish.*start/i }).click();
}

// ─── Route protection ────────────────────────────────────────────────────────

test.describe("Auth – route protection", () => {
  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("unauthenticated nested route redirects to /login", async ({ page }) => {
    await page.goto("/dashboard/fees");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("unauthenticated /dashboard/settings redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
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
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    await openUserMenu(page);
    await page.getByRole("button", { name: /sign out/i }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("after sign-out, revisiting /dashboard redirects to /login", async ({
    page,
  }) => {
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    await openUserMenu(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Navigate back — session is gone, must redirect again
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("sign-out clears demo session storage", async ({ page }) => {
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    await openUserMenu(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

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
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(
      page.getByText(/invalid phone|phone.*or.*password|invalid.*credentials|wrong.*password/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("wrong credentials never redirect to /dashboard", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, "0700000000", "WrongPassword1");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForTimeout(3_000);
    expect(page.url()).not.toMatch(/\/dashboard/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("rate limiter activates after 5 consecutive failures", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/login");

    for (let i = 0; i < 5; i++) {
      await fillLoginForm(page, "0700000000", "WrongPassword1");
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForTimeout(400);
    }

    await expect(
      page.getByText(/too many.*attempts|temporarily locked|try again in/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

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
    await stableFill(page.getByRole("textbox", { name: /^district$/i }), "Kampala");
    await stableFill(
      page.getByRole("textbox", { name: /sub-county \/ division/i }),
      "Central Division",
    );
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
    await stableFill(page.getByRole("textbox", { name: /^district$/i }), "Kampala");
    await stableFill(
      page.getByRole("textbox", { name: /sub-county \/ division/i }),
      "Central Division",
    );
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
    await page.route("/api/register", async (route) => {
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

    await page.route("/api/register", async (route) => {
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

    await expect(page).toHaveURL(/\/login/, {
      timeout: 25_000,
    });
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
