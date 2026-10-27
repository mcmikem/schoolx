import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test.beforeEach(async ({ page }) => {
  await seedDemoSession(page, "bursar");
  await page.route("**/rest/v1/**", async (route) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      throw new Error(`Unexpected database mutation: ${route.request().method()} ${route.request().url()}`);
    }
    await route.continue();
  });
});

test("bursar finance desk fits narrow phones and desktop with visible daily work", async ({ page }) => {
  test.setTimeout(120_000);
  const output = join(process.cwd(), "test-results", "bursar-redesign");
  await mkdir(output, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/dashboard/");
    await expect(page.getByRole("heading", { name: /^Good (Morning|Afternoon|Evening),/ })).toBeVisible();
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Collections" })).toBeVisible();
    const daily = page.getByRole("region", { name: "Collections" });
    await daily.getByRole("button", { name: "Today" }).click();
    const cashBounds = await daily.getByText("Cash", { exact: true }).boundingBox();
    const bankBounds = await daily.getByText("Bank", { exact: true }).boundingBox();
    expect(Math.abs(cashBounds!.y - bankBounds!.y)).toBeLessThan(2);
    await expect(page.getByRole("link", { name: "Record payment", exact: true })).toBeVisible();
    await expect(page.getByText("Demo figures")).toBeVisible();
    await expect(page.getByRole("list", { name: "Loaded receipts" })).toBeVisible();
    const actions = page.getByRole("navigation", { name: "Bursar quick actions" });
    for (const action of await actions.getByRole("link").all()) {
      expect((await action.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    const calendarToggle = page.getByRole("button", { name: "School calendar" });
    await expect(calendarToggle).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: join(output, `bursar-${width}.png`), fullPage: true, animations: "disabled" });
    await page.getByRole("region", { name: "Collections" }).scrollIntoViewIfNeeded();
    if (width === 1440) await page.screenshot({ path: join(output, "bursar-desktop-preview.png"), animations: "disabled" });
  }
  expect(errors).toEqual([]);
});

test("bursar finds a receipt, recovers from empty results and opens the ledger", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/");
  const search = page.getByRole("searchbox", { name: "Find a receipt" });
  await search.fill("no such receipt");
  await expect(page.getByRole("status").filter({ hasText: "No receipts match" })).toBeVisible();
  await page.getByRole("button", { name: "Clear find a receipt" }).click();
  await expect(search).toBeFocused();
  await expect(page.getByRole("list", { name: "Loaded receipts" }).getByRole("listitem")).toHaveCount(5);
  await page.getByRole("button", { name: "Dated today" }).click();
  await expect(page.getByRole("status").filter({ hasText: "No receipts dated today" })).toBeVisible();
  await page.getByRole("button", { name: "Reset receipt filters" }).click();
  await search.fill("MM250115001");
  await expect(page.getByRole("list", { name: "Loaded receipts" }).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Loaded receipts" })).toContainText("Amina Nakamya");
  await page.getByRole("link", { name: "Full ledger", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment Ledger", exact: true })).toBeVisible();
});

test("bursar shortcuts retain fee setup and filtered arrears destinations", async ({ page }) => {
  await page.goto("/dashboard/");
  const navigation = page.getByRole("navigation", { name: "Bursar quick actions" });
  await navigation.getByRole("link", { name: "Fee structure" }).click();
  await expect(page.getByRole("heading", { name: "Fee Structure", exact: true })).toBeVisible();
  await page.goto("/dashboard/");
  await page.getByRole("link", { name: "View all arrears", exact: true }).click();
  await expect(page).toHaveURL(/status=unpaid/);
  await expect(page.getByRole("heading", { name: "Fees Tracker", exact: true })).toBeVisible();
});

test("bursar dashboard survives refresh and returning from the fees page", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard/");
  await expect(page.getByRole("heading", { name: /^Good (Morning|Afternoon|Evening),/ })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Bursar quick actions" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("navigation", { name: "Bursar quick actions" }).getByRole("link", { name: "Fee balances" }).click();
  await expect(page.getByRole("heading", { name: "Fees Tracker", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: /^Good (Morning|Afternoon|Evening),/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Something went wrong", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
