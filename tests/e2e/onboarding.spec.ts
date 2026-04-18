/**
 * E2E tests for the public onboarding / school-registration flow.
 *
 * These tests cover the 3-step registration form without submitting to a real
 * backend, so they run against any environment (dev, preview, CI).
 *
 * "Lock" intent: if anyone breaks the step navigation, validation, or field
 * structure of the register page these tests will fail immediately.
 */
import { test, expect, type Page } from "@playwright/test";

// ─── helpers ────────────────────────────────────────────────────────────────

async function reachStep3(page: Page) {
  await page.goto("/register");
  await page.getByLabel(/school name/i).fill("Test School");
  await page.getByRole("button", { name: /next.*where/i }).click();
  await page.getByLabel(/district/i).selectOption("Kampala");
  await page.getByLabel(/sub-county/i).fill("Central Division");
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
    await page.goto("/register");
    await page.getByRole("button", { name: /next.*where/i }).click();
    await expect(
      page.getByText(/school name is required/i),
    ).toBeVisible();
  });

  test("step 1 – shows error when school name is too short", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel(/school name/i).fill("AB");
    await page.getByRole("button", { name: /next.*where/i }).click();
    await expect(
      page.getByText(/at least 3 characters/i),
    ).toBeVisible();
  });

  test("step 1 – advances to step 2 with a valid school name", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel(/school name/i).fill("St. Mary Primary School");
    await page.getByRole("button", { name: /next.*where/i }).click();
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
  });

  // ── Step 2 ──

  test("step 2 – shows error when district is not selected", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel(/school name/i).fill("Test School");
    await page.getByRole("button", { name: /next.*where/i }).click();

    await page.getByRole("button", { name: /next.*account/i }).click();
    await expect(
      page.getByText(/please select a district/i),
    ).toBeVisible();
  });

  test("step 2 – shows error when sub-county is empty", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel(/school name/i).fill("Test School");
    await page.getByRole("button", { name: /next.*where/i }).click();

    await page.getByLabel(/district/i).selectOption("Kampala");
    await page.getByRole("button", { name: /next.*account/i }).click();
    await expect(
      page.getByText(/sub-county is required/i),
    ).toBeVisible();
  });

  test("step 2 – back button returns to step 1 and preserves school name", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel(/school name/i).fill("Preserved School Name");
    await page.getByRole("button", { name: /next.*where/i }).click();
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();

    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
    await expect(page.getByLabel(/school name/i)).toHaveValue(
      "Preserved School Name",
    );
  });

  test("step 2 – advances to step 3 with valid location data", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel(/school name/i).fill("Test School");
    await page.getByRole("button", { name: /next.*where/i }).click();

    await page.getByLabel(/district/i).selectOption("Kampala");
    await page.getByLabel(/sub-county/i).fill("Central Division");
    await page.getByRole("button", { name: /next.*account/i }).click();

    await expect(page.getByText(/step 3 of 3/i)).toBeVisible();
    await expect(page.getByLabel(/your full name/i)).toBeVisible();
    await expect(page.getByLabel(/your phone number/i)).toBeVisible();
  });

  // ── Step 3 ──

  test("step 3 – shows error when admin name is missing", async ({ page }) => {
    await reachStep3(page);
    await page.getByRole("button", { name: /finish.*start/i }).click();
    await expect(
      page.getByText(/admin name is required/i),
    ).toBeVisible();
  });

  test("step 3 – shows error when password is too short", async ({ page }) => {
    await reachStep3(page);
    await page.getByLabel(/your full name/i).fill("John Admin");
    await page.getByLabel(/your phone number/i).fill("0700000000");
    await page.locator('input[type="password"]').first().fill("abc");
    await page.locator('input[type="password"]').nth(1).fill("abc");
    await page.getByRole("button", { name: /finish.*start/i }).click();
    await expect(
      page.getByText(/password must be at least 6/i),
    ).toBeVisible();
  });

  test("step 3 – shows error when passwords do not match", async ({ page }) => {
    await reachStep3(page);
    await page.getByLabel(/your full name/i).fill("John Admin");
    await page.getByLabel(/your phone number/i).fill("0700000000");
    await page.locator('input[type="password"]').first().fill("secret123");
    await page.locator('input[type="password"]').nth(1).fill("different456");
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
      page.getByText(/configuration required/i),
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

