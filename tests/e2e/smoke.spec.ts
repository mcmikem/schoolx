import { test, expect } from "@playwright/test";

test("landing page renders primary CTAs", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /save 5\+ hours every week/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /start free trial/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /watch.*demo/i }).first(),
  ).toBeVisible();
});

test("pricing section shows correct plans", async ({ page }) => {
  await page.goto("/");

  // Scroll to pricing section - use JavaScript scroll
  await page.evaluate(() => {
    const el = document.getElementById("pricing");
    el?.scrollIntoView();
  });
  await page.waitForTimeout(500);

  // Check for plan names in the pricing cards
  await expect(page.getByText("UGX 2,000").first()).toBeVisible();
  await expect(page.getByText("UGX 3,500").first()).toBeVisible();
  await expect(page.getByText("UGX 5,500").first()).toBeVisible();
  await expect(page.getByText("UGX 8-15M").first()).toBeVisible();
});

test("parent portal login page renders", async ({ page }) => {
  await page.goto("/parent");

  await expect(page.getByText(/parent portal/i).first()).toBeVisible();
  await expect(page.getByLabel(/phone number/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});

test("login page renders demo shortcuts", async ({ page }) => {
  await page.goto("/login");

  // Check for login form
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  // Check demo accounts section
  await expect(page.getByText(/demo accounts/i)).toBeVisible();
});
