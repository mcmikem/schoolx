import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { type DemoRole, seedDemoSession } from "./helpers/demo";

test.beforeEach(async ({ page }) => {
  await page.route("**/rest/v1/**", async (route) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      await route.abort();
      throw new Error(`Learning must not write to school records: ${route.request().method()} ${route.request().url()}`);
    }
    await route.continue();
  });
});

for (const role of ["headmaster", "teacher", "bursar"] as DemoRole[]) {
  test(`${role} can find short lessons on a 320px phone without a popup`, async ({ page }) => {
    test.setTimeout(90_000);
    await seedDemoSession(page, role);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/dashboard/");
    await page.getByRole("link", { name: "Learn step by step", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Learn step by step", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Tap once, then wait" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const lessons = page.getByRole("navigation", { name: "Learning lessons" });
    await page.getByRole("button", { name: "Choose a lesson", exact: true }).click();
    await expect(lessons.locator("ol").getByRole("button")).toHaveCount(4);
    if (role === "teacher") await expect(lessons).not.toContainText("Record a payment");
    if (role === "bursar") await expect(lessons).not.toContainText("Set up your school");
    for (const button of await lessons.getByRole("button").all()) expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const output = join(process.cwd(), "test-results", "easy-onboarding");
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, `${role}-320.png`), fullPage: true, animations: "disabled" });
  });
}

test("teacher can practise attendance offline and resume without marking skipped lessons complete", async ({ page, context }) => {
  await seedDemoSession(page, "teacher");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/learn/");
  await page.getByRole("button", { name: "Choose a lesson", exact: true }).click();
  await page.getByRole("button", { name: /Mark who came to school/ }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Absent", exact: true }).click();
  await expect(page.getByRole("button", { name: "Absent", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Your school’s register has not changed/)).toBeVisible();
  await expect(page.getByText(/You are offline/)).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText("0 of 4 lessons read")).toBeVisible();
  await page.getByRole("button", { name: "Mark this lesson as read" }).click();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Check the exceptions, then save" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("1 of 4 lessons read")).toBeVisible();
  await page.getByRole("button", { name: "User menu" }).click();
  await expect(page.getByRole("link", { name: "Help: learn step by step" })).toBeVisible();
});

test("bursar practises a payment with large controls and no real receipt", async ({ page }) => {
  await seedDemoSession(page, "bursar");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/dashboard/learn/");
  await page.getByRole("button", { name: "Choose a lesson", exact: true }).click();
  await page.getByRole("button", { name: /Record a payment correctly/ }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByLabel("Amount paid (UGX)").fill("0");
  await page.getByRole("button", { name: "Save practice receipt" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter an amount from 1 to 50,000" })).toBeVisible();
  await page.getByLabel("Amount paid (UGX)").fill("20000");
  await expect(page.getByText("UGX 30,000", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save practice receipt" }).click();
  await expect(page.getByText(/No real payment was recorded/)).toBeVisible();
  await expect(page.getByLabel("Amount paid (UGX)")).toHaveCSS("font-size", "16px");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const output = join(process.cwd(), "test-results", "easy-onboarding");
  await mkdir(output, { recursive: true });
  await page.getByRole("region", { name: "Current lesson" }).screenshot({ path: join(output, "bursar-practice-320.png"), animations: "disabled" });
});

test("school setup has examples and optional details, and pausing does not launch the school", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/dashboard/setup-wizard/");
  await expect(page.getByRole("region", { name: "Help with this setup step" })).toBeVisible({ timeout: 15_000 });
  await page.getByText("Show me an example", { exact: true }).click();
  await expect(page.getByText("Your school’s full name", { exact: true })).toBeVisible();
  const output = join(process.cwd(), "test-results", "easy-onboarding");
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, "school-setup-320.png"), animations: "disabled" });
  const optional = page.locator("details").filter({ has: page.getByText("Other school details (optional)", { exact: true }) });
  await expect(optional).not.toHaveAttribute("open");
  await page.getByLabel(/School Name/).fill("Example School Paused");
  await page.getByRole("button", { name: "Pause setup — come back later" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/?$/);
  await expect(page.getByRole("button", { name: "Finish setup", exact: true })).toHaveCount(0);
});

test("school guide and setup stay usable on desktop", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard/learn/");
  await page.getByRole("button", { name: /Set up your school/ }).click();
  await expect(page.getByRole("heading", { name: "Keep your school records nearby" })).toBeVisible();
  await expect(page.locator("main h1")).toHaveCount(1);
  const output = join(process.cwd(), "test-results", "easy-onboarding");
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, "school-guide-desktop.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("link", { name: "Open school setup", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Set up your school" })).toBeVisible();
  await expect(page.getByLabel(/School Name/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Pause setup — come back later" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/?$/);
});
