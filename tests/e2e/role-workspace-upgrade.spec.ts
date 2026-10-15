import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { type DemoRole, seedDemoSession } from "./helpers/demo";

const workspaces: { role: DemoRole; label: string; routes: string[] }[] = [
  { role: "bursar", label: "Bursar quick actions", routes: ["fees", "fee-structure", "fee-ledger", "money", "messages"] },
  { role: "teacher", label: "Teacher quick actions", routes: ["students", "attendance", "grades", "report-cards", "timetable", "messages"] },
  { role: "headmaster", label: "Headmaster common actions", routes: ["students", "attendance", "fees", "grades", "report-cards", "timetable", "messages"] },
];

for (const workspace of workspaces) {
  test(`${workspace.role} workspace and common pages fit phone and desktop`, async ({ page }) => {
    test.setTimeout(360_000);
    await seedDemoSession(page, workspace.role);
    const output = join(process.cwd(), "test-results", "role-workspace-upgrade");
    await mkdir(output, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto("/dashboard/");
      const actions = page.getByRole("navigation", { name: workspace.label, exact: true });
      await expect(actions).toBeVisible();
      await expect(page.locator("main h1")).toHaveCount(1);
      if (workspace.role === "teacher") {
        const search = page.getByRole("searchbox", { name: "Find a class" });
        await search.fill("no matching class");
        await expect(page.getByRole("status").filter({ hasText: "No classes match" })).toBeVisible();
        await search.fill("P.1");
        await expect(page.getByRole("heading", { name: "P.1", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "P.2", exact: true })).toHaveCount(0);
        await search.fill("");
      }
      for (const action of await actions.getByRole("link").all()) {
        const bounds = await action.boundingBox();
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
        expect(await action.getAttribute("href")).toMatch(/^\/dashboard\//);
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: join(output, `${workspace.role}-${width}.png`), fullPage: true, animations: "disabled" });
      if (width === 390) await page.screenshot({ path: join(output, `${workspace.role}-phone-preview.png`), animations: "disabled" });
      if (width === 320) continue;
      for (const route of workspace.routes) {
        await page.goto(`/dashboard/${route}/`);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("main h1")).toHaveCount(1);
        await expect(page.getByText("Something went wrong", { exact: true })).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        await page.screenshot({ path: join(output, `${workspace.role}-${route}-${width}.png`), fullPage: true, animations: "disabled" });
      }
    }
    expect(errors).toEqual([]);
  });
}
