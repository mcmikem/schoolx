import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("headmaster can search generated report cards, clear empty results, and edit comments on phones", async ({ page }) => {
  test.setTimeout(120_000);
  await seedDemoSession(page, "headmaster");
  const output = join(process.cwd(), "test-results", "common-page-workflows");
  await mkdir(output, { recursive: true });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/dashboard/report-cards/");
    await page.getByLabel("Select Class", { exact: true }).selectOption("4");
    await page.getByRole("button", { name: "Generate Now", exact: true }).click();
    // The table becomes visible before report persistence finishes. Wait for
    // the demo confirmation before capturing the count used by the filter
    // assertions, otherwise the late result update looks like a broken clear.
    await expect(page.getByRole("status").filter({ hasText: /Demo preview generated for \d+ students/ })).toBeVisible();
    const search = page.getByRole("searchbox", { name: "Search report cards" });
    await expect(search).toBeVisible();
    const results = page.getByRole("region", { name: "Report card results" });
    await expect(results).toBeVisible();
    const visibleCount = await results.locator("tbody tr").count();
    expect(visibleCount).toBeGreaterThan(0);
    const summary = await page.getByRole("status").filter({ hasText: /^Showing / }).innerText();
    const totalCount = Number(summary.match(/of (\d+) report cards/)?.[1]);
    expect(totalCount).toBeGreaterThanOrEqual(visibleCount);
    await search.fill("no matching learner");
    await expect(page.getByRole("heading", { name: "No matching report cards" })).toBeVisible();
    await expect(search).toBeVisible();
    await page.getByRole("button", { name: "Clear report filters", exact: true }).click();
    // Clearing also removes the default fee hold, so there can be more visible
    // rows than before the search. Compare against the full count in the
    // results summary, not the initially filtered subset.
    await expect(results.locator("tbody tr")).toHaveCount(totalCount);
    const number = await results.locator("tbody tr").first().locator("td").first().locator(".font-mono").innerText();
    await search.fill(number);
    await expect(results.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("button", { name: "Clear search report cards", exact: true }).click();
    await expect(results.locator("tbody tr")).toHaveCount(totalCount);
    await results.getByLabel("Class Teacher", { exact: true }).first().fill("Making steady progress.");
    await expect(results.getByLabel("Class Teacher", { exact: true }).first()).toHaveValue("Making steady progress.");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    if (width < 768) {
      const overflow = await results.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
    await results.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(output, `report-cards-${width}.png`), animations: "disabled" });
  }
});

test("student search and advanced filters stay usable on narrow phones", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/dashboard/students/");
  const search = page.getByRole("searchbox", { name: "Search students" });
  await search.fill("no matching learner");
  await expect(page.getByText("No students found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search students", exact: true }).click();
  await page.getByRole("button", { name: /^Filters/ }).click();
  const dialog = page.getByRole("dialog", { name: "More filters" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await dialog.getByRole("combobox", { name: "Filter by gender" }).selectOption("F");
  await dialog.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
  const output = join(process.cwd(), "test-results", "common-page-workflows");
  await mkdir(output, { recursive: true });
  await search.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, "student-filters-320.png"), animations: "disabled" });
});

test("grade search and status filters are labeled and clearable on phones", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/grades/");
  await page.getByRole("combobox", { name: "Target Class", exact: true }).selectOption("4");
  await page.getByRole("combobox", { name: "Subject Area", exact: true }).selectOption({ index: 1 });
  const search = page.getByRole("searchbox", { name: "Search students", exact: true });
  await search.fill("no matching learner");
  await expect(page.getByRole("status").filter({ hasText: "Showing 0 of" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search students", exact: true }).click();
  const filters = page.getByRole("group", { name: "Grade status", exact: true });
  await filters.getByRole("button", { name: "Submitted", exact: true }).click();
  await expect(filters.getByRole("button", { name: "Submitted", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(filters.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  const actions = page.locator("[data-page-action-bar]");
  const actionBounds = (await actions.boundingBox())!;
  expect(actionBounds.x).toBeGreaterThanOrEqual(0);
  expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(390);
  const assistant = page.locator("button[data-owl-assistant]");
  if (await assistant.isVisible()) {
    const assistantBounds = (await assistant.boundingBox())!;
    expect(assistantBounds.y + assistantBounds.height).toBeLessThanOrEqual(actionBounds.y);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const output = join(process.cwd(), "test-results", "common-page-workflows");
  await mkdir(output, { recursive: true });
  await search.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, "grade-filters-390.png"), animations: "disabled" });
});
