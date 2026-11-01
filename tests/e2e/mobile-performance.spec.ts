import { test, expect } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test.describe("small-phone daily work", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test("Lite preference survives reload and the register searches the roster", async ({ page }) => {
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard/students/");
    await expect(page.getByRole("heading", { name: "Student Hub", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "User menu", exact: true }).click();
    await page.getByRole("combobox", { name: "Performance mode", exact: true }).selectOption("lite");
    await expect(page.locator("html")).toHaveClass(/lite/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/lite/);
    await expect(page.getByRole("heading", { name: "Student Hub", exact: true })).toBeVisible();
    await expect(page.getByText("Loading one page at a time.", { exact: false })).toBeVisible();
    await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
    await page.getByRole("textbox", { name: "Search students", exact: true }).fill("Amina");
    await expect(page.getByRole("textbox", { name: "Search students", exact: true })).toHaveValue("Amina");
    await expect(page.getByText("Brian", { exact: false }).first()).not.toBeVisible();
    for (const width of [320, 360, 412]) {
      await page.setViewportSize({ width, height: 740 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `page fits a ${width}px phone`).toBe(false);
      await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
    }

  });
  test("sync center explains offline preparation and partial coverage", async ({ page }) => {
    await seedDemoSession(page, "teacher");
    await page.goto("/dashboard/sync-center/");
    await expect(page.getByRole("heading", { name: "Prepare for offline work", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download offline data and pages", exact: true })).toBeDisabled();
    await expect(page.getByText("Offline coverage has not been verified yet.", { exact: true })).toBeVisible();
  });
});
