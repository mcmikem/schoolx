/**
 * E2E tests for the public onboarding / school-registration flow.
 *
 * These tests cover the 3-step registration form without submitting to a real
 * backend, so they run against any environment (dev, preview, CI).
 *
 * "Lock" intent: if anyone breaks the step navigation, validation, or field
 * structure of the register page these tests will fail immediately.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

// ─── helpers ────────────────────────────────────────────────────────────────

async function reachStep2(page: Page, school = "Test School") {
  await page.goto("/register", { waitUntil: "networkidle" });
  const schoolName = page.getByRole("textbox", { name: /school name/i });
  await stableFill(schoolName, school);
  await page.getByRole("button", { name: /next.*where/i }).click();
  await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
}

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

async function reachStep3(page: Page) {
  await reachStep2(page);
  const district = page.getByRole("textbox", { name: /^district$/i });
  await district.fill("Kampala");
  await expect(district).toHaveValue("Kampala");
  const subcounty = page.getByRole("textbox", { name: /sub-county \/ division/i });
  await subcounty.fill("Central Division");
  await expect(subcounty).toHaveValue("Central Division");
  await page.getByRole("button", { name: /next.*account/i }).click();
  await expect(page.getByText(/step 3 of 3/i)).toBeVisible();
}

// ─── tests ──────────────────────────────────────────────────────────────────

test.describe("Registration / Onboarding flow", () => {
  // ── Step 1 ──

  test("register page loads with step 1 content", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText(/start your school account/i)).toBeVisible();
    await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
    await expect(page.getByLabel(/school name/i)).toBeVisible();
    await expect(page.getByLabel(/school type/i)).toBeVisible();
    await expect(page.getByLabel(/ownership/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign in/i }),
    ).toBeVisible();
  });

  test("step 1 – shows error when school name is empty", async ({ page }) => {
    await page.goto("/register", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /next.*where/i }).click();
    await expect(
      page.getByText(/school name is required/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 1 – shows error when school name is too short", async ({
    page,
  }) => {
    await page.goto("/register", { waitUntil: "networkidle" });
    await stableFill(page.getByRole("textbox", { name: /school name/i }), "AB");
    await page.getByRole("button", { name: /next.*where/i }).click();
    await expect(
      page.getByText(/at least 3 characters/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 1 – advances to step 2 with a valid school name", async ({
    page,
  }) => {
    await page.goto("/register", { waitUntil: "networkidle" });
    await stableFill(
      page.getByRole("textbox", { name: /school name/i }),
      "St. Mary Primary School",
    );
    await page.getByRole("button", { name: /next.*where/i }).click();
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible({ timeout: 10000 });
  });

  // ── Step 2 ──

  test("step 2 – shows error when district is not selected", async ({
    page,
  }) => {
    await reachStep2(page);
    await page.getByRole("button", { name: /next.*account/i }).click();
    await expect(
      page.getByText(/please select a district/i),
    ).toBeVisible();
  });

  test("step 2 – shows error when sub-county is empty", async ({ page }) => {
    await reachStep2(page);
    await page.getByRole("textbox", { name: /^district$/i }).fill("Kampala");
    await page.getByRole("button", { name: /next.*account/i }).click();
    await expect(
      page.getByText(/sub-county is required/i),
    ).toBeVisible();
  });

  test("step 2 – back button returns to step 1 and preserves school name", async ({
    page,
  }) => {
    await reachStep2(page, "Preserved School Name");

    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
    await expect(page.getByLabel(/school name/i)).toHaveValue(
      "Preserved School Name",
    );
  });

  test("step 2 – advances to step 3 with valid location data", async ({
    page,
  }) => {
    await reachStep2(page);
    await page.getByRole("textbox", { name: /^district$/i }).fill("Kampala");
    await page
      .getByRole("textbox", { name: /sub-county \/ division/i })
      .fill("Central Division");
    await page.getByRole("button", { name: /next.*account/i }).click();

    await expect(page.getByText(/step 3 of 3/i)).toBeVisible();
    await expect(page.getByLabel(/your full name/i)).toBeVisible();
    await expect(page.getByLabel(/your phone number/i)).toBeVisible();
  });

  // ── Step 3 ──

  test("step 3 – shows error when admin name is missing", async ({ page }) => {
    await reachStep3(page);
    await page.getByRole("button", { name: /finish.*start/i }).click();
    const isInvalid = await page
      .getByLabel(/your full name/i)
      .evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test("step 3 – shows error when password is too short", async ({ page }) => {
    await reachStep3(page);
    await page.getByLabel(/your full name/i).fill("John Admin");
    await page.getByLabel(/your phone number/i).fill("0700000000");
    await page.locator('input[type="password"]').first().fill("abc");
    await page.locator('input[type="password"]').nth(1).fill("abc");
    await page.getByRole("button", { name: /finish.*start/i }).click();
    const isInvalid = await page
      .locator('input[type="password"]')
      .first()
      .evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test("step 3 – shows error when passwords do not match", async ({ page }) => {
    await reachStep3(page);
    await page.getByLabel(/your full name/i).fill("John Admin");
    await page.getByLabel(/your phone number/i).fill("0700000000");
    // Passwords must have uppercase + number to pass the strength check
    // and reach the mismatch validation branch
    await page.locator('input[type="password"]').first().fill("SecretPass1");
    await page.locator('input[type="password"]').nth(1).fill("DifferentPass1");
    await page.getByRole("button", { name: /finish.*start/i }).click();
    await expect(
      page.getByText(/passwords do not match/i),
    ).toBeVisible();
  });

  test("step 3 – back button returns to step 2", async ({ page }) => {
    await reachStep3(page);
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
  });

  // ── Setup page ──

  test("setup page shows environment variable instructions", async ({
    page,
  }) => {
    await page.goto("/setup");
    await expect(
      page.getByRole("heading", { name: /^configuration required$/i }),
    ).toBeVisible();
    await expect(
      page.getByText("NEXT_PUBLIC_SUPABASE_URL"),
    ).toBeVisible();
    await expect(
      page.getByText("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /go to login/i }),
    ).toBeVisible();
  });
});

