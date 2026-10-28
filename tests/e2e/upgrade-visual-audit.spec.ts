import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

const routes = [
  ["/dashboard/", /^Good (Morning|Afternoon|Evening),/],
  ["/dashboard/fees/", "Fees Tracker"],
  ["/dashboard/fee-structure/", "Fee Structure"],
  ["/dashboard/fee-ledger/", "Payment Ledger"],
  ["/dashboard/money/", "Money in and out"],
] as const;

test("finance screens fit phones and desktop without app errors", async ({ page }) => {
  test.setTimeout(240_000);
  await seedDemoSession(page, "bursar");
  const output = join(process.cwd(), "test-results", "upgrade-audit");
  await mkdir(output, { recursive: true });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const [route, heading] of routes) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.locator("main h1")).toHaveCount(1);
      if (width >= 1024) await expect(page.locator("#dashboard-sidebar")).toHaveClass(/desktop-rail/);
      await expect(page.getByText("Something went wrong", { exact: true })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: join(output, `${route.split("/").filter(Boolean).join("-")}-${width}.png`), fullPage: true, animations: "disabled" });
    }
  }
});

test("fee form creates and edits annual charges with preserved metadata", async ({ page }) => {
  await seedDemoSession(page, "bursar");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/fee-structure/");
  await page.getByRole("button", { name: "Add Fee", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add New Fee", exact: true });
  await dialog.getByLabel("Fee Name", { exact: true }).fill("Annual transport audit");
  await dialog.getByLabel("Amount (UGX)", { exact: true }).fill("150000");
  await dialog.getByLabel("Category", { exact: true }).selectOption("transport");
  await dialog.getByLabel("Applies To", { exact: true }).selectOption("day");
  await dialog.getByLabel("Frequency", { exact: true }).selectOption("per_year");
  await expect(dialog.getByLabel("Term (if per term)", { exact: true })).toBeDisabled();
  await dialog.getByLabel("Transport Zone (if transport)", { exact: true }).fill("Zone 2");
  await dialog.getByRole("button", { name: "Add Fee", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Edit Annual transport audit", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit Fee", exact: true });
  await expect(edit.getByLabel("Frequency", { exact: true })).toHaveValue("per_year");
  await expect(edit.getByLabel("Applies To", { exact: true })).toHaveValue("day");
  await expect(edit.getByLabel("Transport Zone (if transport)", { exact: true })).toHaveValue("Zone 2");
  await edit.getByLabel("Amount (UGX)", { exact: true }).fill("175000");
  await edit.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(edit).not.toBeVisible();
  await expect(page.getByRole("list").getByText("UGX 175,000", { exact: true })).toBeVisible();
});

test("grading configuration saves selections and the ledger opens payment details", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/grading-settings/");
  await expect(page.getByLabel("Curriculum track", { exact: true })).toBeVisible();
  await page.getByLabel("Curriculum track", { exact: true }).selectOption("old");
  await page.getByLabel("Report layout", { exact: true }).selectOption("ncdc_cbc");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Configuration is up to date." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Curriculum track", { exact: true })).toHaveValue("old");
  await expect(page.getByLabel("Report layout", { exact: true })).toHaveValue("ncdc_cbc");
  const output = join(process.cwd(), "test-results", "upgrade-audit");
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, "grading-settings-390.png"), fullPage: true, animations: "disabled" });
  await page.goto("/dashboard/fee-ledger/");
  const details = page.getByRole("button", { name: /Payment details for/ });
  await expect(details.first()).toBeVisible();
  await details.first().click();
  await expect(page.getByRole("dialog", { name: "Payment Details", exact: true })).toBeVisible();
});

test("bursar searches for a student and records a historical payment date", async ({ page }) => {
  await seedDemoSession(page, "bursar");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/fees/");
  await page.getByRole("button", { name: "Add Payment", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Record Payment", exact: true });
  const search = dialog.getByRole("combobox", { name: "Student", exact: true });
  await search.fill("Brian Ochen");
  const output = join(process.cwd(), "test-results", "upgrade-audit");
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, "student-payment-search-390.png"), animations: "disabled" });
  await dialog.getByRole("option", { name: /Brian Ochen/ }).click();
  await dialog.getByLabel("Amount (UGX)", { exact: true }).fill("1000");
  await dialog.getByRole("button", { name: /Next/ }).click();
  await dialog.getByLabel("Payment date", { exact: true }).fill("2026-02-05");
  await dialog.getByLabel("Paid By", { exact: true }).fill("Demo parent");
  await dialog.getByLabel("Payment Reference", { exact: true }).fill("AUDIT-RECEIPT");
  await page.screenshot({ path: join(output, "record-payment-390.png"), animations: "disabled" });
  await dialog.getByRole("button", { name: "Record UGX 1,000", exact: true }).click();
  const receiptPrompt = page.getByRole("status").filter({ hasText: "Payment added" });
  await expect(receiptPrompt).toBeVisible();
  await receiptPrompt.getByRole("button", { name: "Receipt", exact: true }).click();
  const receipt = page.getByRole("dialog", { name: "Fee Payment Receipt", exact: true });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByText("05/02/2026", { exact: true })).toBeVisible();
});

test("desktop content stays clear of the sidebar and academic screens render", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(1100, 600);
  for (const route of ["/dashboard/fee-ledger/", "/dashboard/grading-settings/", "/dashboard/grades/", "/dashboard/report-cards/"]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("#dashboard-sidebar")).toHaveClass(/desktop-rail/);
    await expect.poll(() => page.locator("#dashboard-sidebar").evaluate((sidebar) => sidebar.getBoundingClientRect().width)).toBeLessThanOrEqual(80);
    const geometry = await page.evaluate(() => ({
      headingLeft: document.querySelector("main h1")!.getBoundingClientRect().left,
      sidebarRight: document.querySelector("#dashboard-sidebar")!.getBoundingClientRect().right,
    }));
    expect(geometry.headingLeft).toBeGreaterThanOrEqual(geometry.sidebarRight);
  }
});
