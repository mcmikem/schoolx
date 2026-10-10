import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { seedDemoSession } from "./helpers/demo";

const teacherRoutes = [
  "/dashboard",
  "/dashboard/timetable",
  "/dashboard/students",
  "/dashboard/classes",
  "/dashboard/attendance",
  "/dashboard/period-attendance",
  "/dashboard/grades",
  "/dashboard/exams",
  "/dashboard/homework",
  "/dashboard/homework-submissions",
  "/dashboard/syllabus",
  "/dashboard/scheme-of-work",
  "/dashboard/lesson-plans",
  "/dashboard/health",
  "/dashboard/library",
];

const auditedWidths = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];

test("teacher navigation routes render without page overflow at phone and desktop widths", async ({ page }) => {
  test.setTimeout(180_000);
  await seedDemoSession(page, "teacher");
  const screenshotDir = join(process.cwd(), "test-results", "teacher-visual-audit");
  await mkdir(screenshotDir, { recursive: true });

  const routeIssues: string[] = [];
  for (const viewport of auditedWidths) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of teacherRoutes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const main = page.locator("main#main-content");
      await main.waitFor({ state: "visible", timeout: 15_000 });
      await page.getByRole("heading").first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
      await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" });
      await main.evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
      });

      const state = await page.evaluate(() => ({
        width: window.innerWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        title: document.title,
        heading: document.querySelector("main h1, main h2, main h3")?.textContent?.trim() || "No heading",
        loading: document.body.innerText.includes("Verifying your session..."),
        pageError: document.body.innerText.includes("Something went wrong") || document.body.innerText.includes("Application error"),
      }));

      if (state.loading) routeIssues.push(`${viewport.name} ${route}: remained on session verification`);
      if (state.pageError) routeIssues.push(`${viewport.name} ${route}: rendered an application error`);
      if (state.documentWidth > state.width + 2) {
        routeIssues.push(`${viewport.name} ${route}: horizontal overflow ${state.documentWidth}px > ${state.width}px`);
      }

      if (viewport.name === "phone" && ["/dashboard", "/dashboard/attendance", "/dashboard/period-attendance", "/dashboard/grades", "/dashboard/homework", "/dashboard/timetable"].includes(route)) {
        const safeRoute = route.replaceAll("/", "_") || "home";
        await page.screenshot({ path: join(screenshotDir, `${safeRoute}-${viewport.name}.png`), fullPage: true });
      }

      if (viewport.name === "phone" && ["/dashboard/attendance", "/dashboard/period-attendance"].includes(route)) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const overlap = await page.evaluate(() => {
          const action = document.querySelector(".mobile-sticky-action");
          const navigation = document.querySelector(".mobile-bottom-nav");
          if (!action || !navigation) return false;
          const actionRect = action.getBoundingClientRect();
          const navRect = navigation.getBoundingClientRect();
          return actionRect.bottom > navRect.top - 8;
        });
        if (overlap) routeIssues.push(`${viewport.name} ${route}: sticky save action overlaps mobile navigation`);
      }

      if (viewport.name === "phone" && route === "/dashboard") {
        await page.getByRole("button", { name: "Open more pages" }).click();
        await expect(page.getByRole("link", { name: "Period Attendance" })).toBeVisible();
        await page.getByRole("button", { name: "Close sidebar" }).click();
        expect(page.getByRole("link", { name: "WhatsApp SkoolMate support" })).toHaveCount(0);
        await page.getByRole("button", { name: "Open SkoolMate Assistant" }).click();
        await expect(page.getByRole("link", { name: /WhatsApp \+?256|WhatsApp Support Team/i }).first()).toBeVisible();
        await page.getByRole("button", { name: "Open SkoolMate Assistant" }).click();
      }

      if (route === "/dashboard/classes") {
        await expect(page.getByRole("button", { name: "Add Class" })).toHaveCount(0);
        await expect(page.getByTitle("Edit class")).toHaveCount(0);
        await expect(page.getByTitle("Delete class")).toHaveCount(0);
      }

      if (route === "/dashboard/students") {
        await expect(page.getByRole("button", { name: "Export", exact: true })).toHaveCount(0);
      }

      console.info(`[teacher-visual-audit] ${viewport.name} ${route} -> ${page.url()} | ${state.heading} | ${state.documentWidth}/${state.width}`);
    }
  }

  expect(routeIssues, routeIssues.join("\n")).toEqual([]);
});

test("teacher deep links distinguish permitted work from blocked settings and feedback", async ({ page }) => {
  await seedDemoSession(page, "teacher");

  for (const route of [
    "/dashboard/report-cards",
    "/dashboard/substitutions",
    "/dashboard/uneb",
    "/dashboard/homework-submissions",
    "/dashboard/period-attendance",
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main#main-content")).toBeVisible();
    await expect(page.getByRole("heading").first()).toBeVisible();
    expect(page.url()).not.toContain("/dashboard/no-access");
  }

  await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/no-access/);
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();

  await page.goto("/dashboard/feedback", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/no-access/);
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
});