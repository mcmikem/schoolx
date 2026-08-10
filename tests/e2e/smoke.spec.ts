import { test, expect } from "@playwright/test";

test("landing page renders primary CTAs", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /all-in-one.*school management/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /start free trial/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /sign in/i }).first(),
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
  await expect(page.getByText("UGX 1,400").first()).toBeVisible();
  await expect(page.getByText("UGX 2,450").first()).toBeVisible();
  await expect(page.getByText("UGX 3,850").first()).toBeVisible();
  await expect(page.getByText("UGX 8-15M").first()).toBeVisible();
});

test("parent portal login page renders", async ({ page }) => {
  await page.goto("/parent");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel(/phone number/i)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^password$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
});

test("login page renders demo shortcuts", async ({ page }) => {
  await page.goto("/login");

  // Check for login form
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();

  // Demo account shortcuts must render (this build runs with demo mode enabled).
  await expect(
    page.getByText(/try demo account|demo account/i).first(),
  ).toBeVisible();
});
