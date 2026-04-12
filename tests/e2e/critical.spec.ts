import { test, expect } from "@playwright/test";

test.describe("Critical app flows", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /open dashboard/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("parent portal loads", async ({ page }) => {
    await page.goto("/parent");
    await expect(page.getByText(/parent portal/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("input").first()).toBeVisible({ timeout: 10000 });
  });
});
