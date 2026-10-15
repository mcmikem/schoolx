import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

const writes = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  writes.set(page, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/rest/v1/**", async (route) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes.get(page)!.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
});

test.afterEach(async ({ page }, info) => {
  await info.attach("blocked-database-writes", { body: JSON.stringify(writes.get(page)), contentType: "application/json" });
  expect(writes.get(page), "Demo workflow must not attempt database writes").toEqual([]);
});

async function paymentForm(page: Page) {
  await seedDemoSession(page, "bursar");
  await page.goto("/dashboard/fees/");
  await page.getByRole("button", { name: "Add Payment", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Record Payment", exact: true });
  await dialog.getByRole("combobox", { name: "Student", exact: true }).fill("Brian Ochen");
  await dialog.getByRole("option", { name: /Brian Ochen/ }).click();
  return dialog;
}

test("S01: typed names alone are not accepted and keyboard selection works", async ({ page }) => {
  await seedDemoSession(page, "bursar");
  await page.goto("/dashboard/fees/");
  await page.getByRole("button", { name: "Add Payment", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Record Payment", exact: true });
  const search = dialog.getByRole("combobox", { name: "Student", exact: true });
  await search.fill("no matching learner");
  await expect(dialog.getByRole("status").filter({ hasText: "No students match" })).toBeVisible();
  await dialog.getByLabel("Amount (UGX)", { exact: true }).fill("1000");
  await expect(dialog.getByRole("button", { name: /Next/ })).toBeDisabled();
  await search.fill("Brian Ochen");
  await search.press("Enter");
  await expect(dialog.getByRole("button", { name: /Next/ })).toBeEnabled();
});

test("S03: nonpositive payments are blocked and partial payment shows remaining balance", async ({ page }) => {
  const dialog = await paymentForm(page);
  const amount = dialog.getByLabel("Amount (UGX)", { exact: true });
  for (const value of ["0", "-100"]) {
    await amount.fill(value);
    await expect(dialog.getByRole("button", { name: /Next/ })).toBeDisabled();
  }
  await amount.fill("1000");
  await expect(dialog.getByText(/left after this payment/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Next/ })).toBeEnabled();
});

test("S02/S47: correcting a future date retains the student and amount", async ({ page }) => {
  const dialog = await paymentForm(page);
  await dialog.getByLabel("Amount (UGX)", { exact: true }).fill("1000");
  await dialog.getByRole("button", { name: /Next/ }).click();
  await dialog.getByLabel("Payment date", { exact: true }).fill("2099-01-01");
  await expect(dialog.getByRole("button", { name: "Record UGX 1,000", exact: true })).toBeDisabled();
  await dialog.getByLabel("Payment date", { exact: true }).fill("2026-02-05");
  await expect(dialog.getByRole("button", { name: "Record UGX 1,000", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: /Back/ }).click();
  await expect(dialog.getByLabel("Amount (UGX)", { exact: true })).toHaveValue("1000");
  await expect(dialog.getByRole("combobox", { name: "Student", exact: true })).toHaveValue("Brian Ochen");
});

test("S03: overpayment requires explicit acknowledgement of credit", async ({ page }) => {
  const dialog = await paymentForm(page);
  await dialog.getByRole("group", { name: "Quick amounts" }).getByRole("button", { name: /^Full/ }).click();
  const amount = dialog.getByLabel("Amount (UGX)", { exact: true });
  await amount.fill(String(Number(await amount.inputValue()) + 50000));
  await expect(dialog.getByRole("button", { name: /Next/ })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /Record excess as credit/ }).check();
  await expect(dialog.getByRole("button", { name: /Next/ })).toBeEnabled();
  const output = join(process.cwd(), "test-results", "ground-usability");
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, "S03-credit-acknowledgement.png"), animations: "disabled" });
});

test("S04: mobile-money receipts require a nonblank transaction reference", async ({ page }) => {
  const dialog = await paymentForm(page);
  await dialog.getByLabel("Amount (UGX)", { exact: true }).fill("1000");
  await dialog.getByRole("button", { name: /Next/ }).click();
  await dialog.getByLabel("Method", { exact: true }).selectOption("mobile_money");
  const submit = dialog.getByRole("button", { name: "Record UGX 1,000", exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Transaction ID", { exact: true }).fill("   ");
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Transaction ID", { exact: true }).fill("AUDIT-MOMO-001");
  await expect(submit).toBeEnabled();
});

test("S49: teacher registry has no registration action and finance deep links deny access", async ({ page }) => {
  await seedDemoSession(page, "teacher");
  await page.goto("/dashboard/students/");
  await expect(page.getByRole("heading", { name: "Student Hub", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Register Student", exact: true })).toHaveCount(0);
  await page.goto("/dashboard/fee-ledger/");
  await expect(page).toHaveURL(/\/dashboard\/no-access/);
});

test("S20: generating demo report cards does not attempt to save school records", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/report-cards/");
  await page.getByLabel("Select Class", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Generate Now", exact: true }).click();
  await expect(page.getByText(/Demo preview generated.*No school records were saved/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Report card results" }).locator("tbody tr").first()).toBeVisible();
});

test("S19: generated report averages stay within the percentage scale", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/report-cards/");
  await page.getByLabel("Select Class", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Generate Now", exact: true }).click();
  await expect(page.getByText(/Demo preview generated.*No school records were saved/)).toBeVisible();
  const rows = page.getByRole("region", { name: "Report card results" }).locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const averages = await rows.evaluateAll((elements) => elements.map((row) => {
    const value = row.querySelector("[data-report-average]")!.textContent!.trim();
    return value === "—" ? null : Number(value.replace("%", ""));
  }));
  const output = join(process.cwd(), "test-results", "ground-usability");
  await mkdir(output, { recursive: true });
  await rows.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, "S19-report-average.png"), animations: "disabled" });
  await test.info().attach("observed-averages", { body: JSON.stringify(averages), contentType: "application/json" });
  expect(averages.some((average) => average !== null)).toBe(true);
  expect(averages.every((average) => average === null || (Number.isFinite(average) && average >= 0 && average <= 100))).toBe(true);
  const first = rows.first();
  await expect(first.getByText(/Provisional/)).toBeVisible();
  await expect(first.locator("td").nth(3)).toHaveText(/Position\s*—/);
  await expect(first.getByRole("button", { name: /Send results by SMS/ })).toBeDisabled();
  const displayed = await first.locator("[data-report-average]").innerText();
  const popupPromise = page.waitForEvent("popup");
  await first.getByRole("button", { name: /Print Uganda progress report/ }).click();
  const printed = await popupPromise;
  const totals = printed.locator("tr").filter({ has: printed.getByRole("cell", { name: "TOTALS", exact: true }) });
  await expect(totals.locator("td").nth(3)).toHaveText(displayed.replace("%", ""));
  await expect(totals).toContainText("DIV: Incomplete");
  await printed.close();
});

test("S19 CBC: changing format clears stale reports and missing assessments stay unknown on screen and print", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/report-cards/");
  await page.getByLabel("Select Class", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Generate Now", exact: true }).click();
  const results = page.getByRole("region", { name: "Report card results" });
  await expect(results).toBeVisible();
  await page.getByLabel("Report Format", { exact: true }).selectOption("cbc");
  await expect(results).toHaveCount(0);
  const gradeRequests: string[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.includes("/rest/v1/grades")) gradeRequests.push(request.url()); });
  await page.getByRole("button", { name: "Generate Now", exact: true }).click();
  await expect(page.getByText(/Demo preview generated.*No school records were saved/).last()).toBeVisible();
  const first = results.locator("tbody tr").first();
  await expect(first.locator("[data-report-average]")).toHaveText("—");
  await expect(first.getByText("Incomplete", { exact: true })).toBeVisible();
  await expect(first.getByRole("button", { name: /Send results by SMS/ })).toBeDisabled();
  await expect(first.getByRole("button", { name: /Print Uganda progress report/ })).toHaveCount(0);
  const popupPromise = page.waitForEvent("popup");
  await first.getByRole("button", { name: /Print CBC report/ }).click();
  const printed = await popupPromise;
  await expect(printed.locator(".cbc-overall-average")).toHaveText("—");
  await expect(printed.locator(".cbc-provisional")).toBeVisible();
  const table = printed.locator(".cbc-summary-table");
  await expect(table.locator("thead th")).toHaveCount(10);
  await expect(table.locator("tbody tr").first().locator("td")).toHaveCount(10);
  await expect(table.locator("tbody tr").first().locator("td").nth(7)).toHaveText("—");
  await expect(table.locator("tbody tr").first().locator("td").nth(8)).toHaveText("—");
  await expect(printed.locator("body")).not.toContainText("February 3, 2025");
  await expect(printed.locator("body")).not.toContainText("NaN");
  expect(gradeRequests).toEqual([]);
  const output = join(process.cwd(), "test-results", "ground-usability");
  await mkdir(output, { recursive: true });
  await printed.setViewportSize({ width: 1000, height: 900 });
  await printed.screenshot({ path: join(output, "S19-CBC-print.png"), fullPage: true, animations: "disabled" });
  await printed.close();
  await first.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, "S19-CBC-provisional.png"), animations: "disabled" });
});
