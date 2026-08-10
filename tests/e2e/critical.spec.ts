import { test, expect } from "@playwright/test";

test.describe("Critical app flows", () => {
  test("landing page loads with headline", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /all-in-one.*school management/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("input").first()).toBeVisible({ timeout: 10000 });
  });

  test("parent portal loads", async ({ page }) => {
    await page.goto("/parent-portal");

    await expect
      .poll(() => page.url(), { timeout: 15000 })
      .toMatch(/parent-portal|login/);

    const parentPortalHeading = page.getByRole("heading", { name: /parent portal/i }).first();
    const accessUnavailable = page.getByRole("heading", { name: /parent portal access unavailable/i }).first();
    const loginHeading = page.getByRole("heading", { name: /welcome back|sign in/i }).first();

    await expect(async () => {
      const visible =
        (await parentPortalHeading.isVisible().catch(() => false)) ||
        (await accessUnavailable.isVisible().catch(() => false)) ||
        (await loginHeading.isVisible().catch(() => false));
      expect(visible).toBeTruthy();
    }).toPass({ timeout: 15000 });
  });

  test("setup admin page redirects existing schools to /login", async ({ page }) => {
    await page.goto("/setup-admin");
    // /setup-admin is only for first-time setup. Once a Supabase project has any
    // schools (which the live env does), the proxy redirects to /login so the
    // super-admin creation form cannot be reached through the public web.
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
