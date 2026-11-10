import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("Owly greets a first-time user once and auto-hides the welcome bubble", async ({ page }) => {
  await seedDemoSession(page, "teacher");
  await page.goto("/dashboard/");

  const welcome = page.getByRole("status", { name: "Owly welcome" });
  await expect(welcome).toBeVisible({ timeout: 20_000 });
  await expect(welcome).toContainText("Hi, I’m Owly.");
  await expect(welcome).toContainText("I can help with SkoolMate. Ask me anything.");
  await expect(welcome.getByRole("button", { name: "Ask Owly" })).toBeVisible();

  await expect(welcome).toBeHidden({ timeout: 12_000 });
  await page.reload();
  await expect(page.getByRole("status", { name: "Owly welcome" })).toHaveCount(0);
});

test("the Owly welcome action opens the assistant", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seedDemoSession(page, "teacher");
  await page.goto("/dashboard/");

  const welcome = page.getByRole("status", { name: "Owly welcome" });
  await expect(welcome).toBeVisible({ timeout: 20_000 });
  const welcomeBox = await welcome.boundingBox();
  expect(welcomeBox).not.toBeNull();
  expect(welcomeBox!.x).toBeGreaterThanOrEqual(0);
  expect(welcomeBox!.x + welcomeBox!.width).toBeLessThanOrEqual(320);
  await welcome.getByRole("button", { name: "Ask Owly" }).click();

  await expect(page.getByText("Owly Assistant", { exact: true })).toBeVisible();
  await expect(page.getByText(/Hi! I'm Owly, your SkoolMate assistant/i)).toBeVisible();
  const assistantPanel = page.locator('[data-owl-assistant]').last();
  const panelBox = await assistantPanel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(320);
  expect(panelBox!.y).toBeGreaterThanOrEqual(0);
});
