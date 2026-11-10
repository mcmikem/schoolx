import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("guided tour is readable and stays dismissed after reload", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/#guided-tour");

  const welcome = page.getByText(/Welcome to SkoolMate\. This short tour/i);
  await expect(welcome).toBeVisible({ timeout: 20_000 });
  await expect(welcome).toHaveCSS("font-size", "18px");

  await page.getByRole("button", { name: /^next$/i }).click();
  await page.getByRole("button", { name: /^next$/i }).click();
  await page.getByRole("button", { name: /^next$/i }).click();
  await expect(page.getByText(/Review today’s dashboard, then open Attendance, Staff, or Reports/i)).toBeVisible();

  await page.getByRole("button", { name: /^close$/i }).click();
  await expect(welcome).not.toBeVisible();

  await page.reload();
  await expect(welcome).not.toBeVisible({ timeout: 10_000 });
});

test("Owly clears mobile navigation and opens from the keyboard at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/");

  const launcher = page.locator('button[data-owl-assistant]');
  const nav = page.locator('[data-tour="mobile-nav"]');
  await expect(launcher).toBeVisible({ timeout: 20_000 });
  await expect(nav).toBeVisible();

  const launcherBox = await launcher.boundingBox();
  const navBox = await nav.boundingBox();
  expect(launcherBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(launcherBox!.x).toBeGreaterThanOrEqual(0);
  expect(launcherBox!.x + launcherBox!.width).toBeLessThanOrEqual(320);
  expect(launcherBox!.y + launcherBox!.height).toBeLessThan(navBox!.y);

  await launcher.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Owly Assistant")).toBeVisible();
});
