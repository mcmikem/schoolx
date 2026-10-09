import { test, expect, type Page } from "@playwright/test";
import { appendFileSync } from "node:fs";
import { seedDemoSession } from "./helpers/demo";

type Role = "teacher" | "bursar";

type Diag = {
  role: Role;
  scenario: string;
  path: string;
  status: "ok" | "denied" | "failed";
  url: string;
  heading: string;
  loadMs: number;
  overflowPx: number;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  notes: string[];
};

const REPORT = "/tmp/role-scenarios-50.jsonl";

function newDiag(role: Role, scenario: string): Diag {
  return {
    role,
    scenario,
    path: "",
    status: "ok",
    url: "",
    heading: "",
    loadMs: 0,
    overflowPx: 0,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    notes: [],
  };
}

function capture(page: Page, diag: Diag) {
  page.on("console", (message) => {
    if (message.type() === "error") diag.consoleErrors.push(message.text().slice(0, 240));
  });
  page.on("pageerror", (error) => diag.pageErrors.push(String(error).slice(0, 240)));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      diag.failedRequests.push(`${response.status()} ${response.url().slice(0, 160)}`);
    }
  });
}

async function visit(page: Page, diag: Diag, path: string) {
  diag.path = path;
  const started = Date.now();
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {
    diag.notes.push("networkidle timeout");
  });
  diag.loadMs = Date.now() - started;
  diag.url = page.url();
  diag.overflowPx = await page
    .evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    .catch(() => -1);
  const heading = page.locator("h1, h2, h3").first();
  diag.heading = (await heading.isVisible({ timeout: 8_000 })
    ? await heading.innerText().catch(() => "")
    : ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function finish(diag: Diag) {
  appendFileSync(REPORT, `${JSON.stringify(diag)}\n`);
}

async function expandSidebar(page: Page) {
  await page.locator("#dashboard-sidebar").hover({ timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  await page
    .locator('#dashboard-sidebar button[aria-label="Pin sidebar open"]')
    .first()
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);
  const toggles = page.locator('#dashboard-sidebar button[aria-expanded="false"]');
  for (let guard = 0; guard < 12; guard += 1) {
    const count = await toggles.count();
    if (count === 0) break;
    await toggles.first().click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

async function expectDenied(page: Page, diag: Diag) {
  await expect(page).toHaveURL(/\/dashboard\/no-access/, { timeout: 15_000 });
  diag.status = "denied";
}

async function expectReachable(page: Page, diag: Diag, headingPattern: RegExp) {
  expect(page.url()).not.toContain("no-access");
  expect(page.url()).not.toContain("/login");
  await expect(page.getByRole("heading", { name: headingPattern }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Teacher scenarios", () => {
  test("T01 dashboard greets the teacher and paints", async ({ page }) => {
    const diag = newDiag("teacher", "dashboard greeting");
    capture(page, diag);
    await seedDemoSession(page, "teacher");
    await visit(page, diag, "/dashboard");
    await expect(page.getByText(/good (morning|afternoon|evening), mary/i)).toBeVisible({
      timeout: 15_000,
    });
    finish(diag);
  });

  test("T02 sidebar hides privileged links", async ({ page }) => {
    const diag = newDiag("teacher", "sidebar hides privileged links");
    capture(page, diag);
    await seedDemoSession(page, "teacher");
    await visit(page, diag, "/dashboard");
    await expandSidebar(page);
    for (const href of ["/dashboard/fees", "/dashboard/staff", "/dashboard/settings", "/dashboard/messages"]) {
      await expect(page.locator(`a[href^="${href}"]`)).toHaveCount(0);
    }
    finish(diag);
  });

  test("T03 sidebar shows the teaching links", async ({ page }) => {
    const diag = newDiag("teacher", "sidebar shows teaching links");
    capture(page, diag);
    await seedDemoSession(page, "teacher");
    await visit(page, diag, "/dashboard");
    await expandSidebar(page);
    for (const href of [
      "/dashboard/timetable",
      "/dashboard/classes",
      "/dashboard/attendance",
      "/dashboard/grades",
      "/dashboard/homework",
    ]) {
      await expect(page.locator(`a[href^="${href}"]`).first()).toBeVisible({ timeout: 10_000 });
    }
    finish(diag);
  });

  test("T04 invite-staff card is hidden from teachers", async ({ page }) => {
    const diag = newDiag("teacher", "invite staff card hidden");
    capture(page, diag);
    await seedDemoSession(page, "teacher");
    await visit(page, diag, "/dashboard");
    await expect(page.getByText(/bring your team aboard/i)).toHaveCount(0);
    finish(diag);
  });

  const denied: Array<[string, string]> = [
    ["T05", "/dashboard/fees"],
    ["T06", "/dashboard/staff"],
    ["T07", "/dashboard/settings"],
    ["T08", "/dashboard/users"],
    ["T09", "/dashboard/finance"],
    ["T10", "/dashboard/bulk-sms"],
    ["T11", "/dashboard/messages"],
    ["T12", "/dashboard/export"],
    ["T13", "/dashboard/payroll"],
  ];

  for (const [id, path] of denied) {
    test(`${id} teacher is blocked from ${path}`, async ({ page }) => {
      const diag = newDiag("teacher", `${id} blocked`);
      capture(page, diag);
      await seedDemoSession(page, "teacher");
      await visit(page, diag, path);
      await expectDenied(page, diag);
      finish(diag);
    });
  }

  test("T14 students registry is read-only for teachers", async ({ page }) => {
    const diag = newDiag("teacher", "students read-only");
    capture(page, diag);
    await seedDemoSession(page, "teacher");
    await visit(page, diag, "/dashboard/students");
    await expectReachable(page, diag, /student/i);
    await expect(page.getByRole("button", { name: /register student/i })).toHaveCount(0);
    finish(diag);
  });

  const pages: Array<[string, string, RegExp]> = [
    ["T15", "/dashboard/attendance", /attendance/i],
    ["T16", "/dashboard/grades", /grade/i],
    ["T17", "/dashboard/classes", /class/i],
    ["T18", "/dashboard/timetable", /timetable|schedule/i],
    ["T19", "/dashboard/exams", /exam/i],
    ["T20", "/dashboard/homework", /homework/i],
    ["T21", "/dashboard/syllabus", /syllabus/i],
    ["T22", "/dashboard/lesson-plans", /lesson/i],
    ["T23", "/dashboard/scheme-of-work", /scheme/i],
  ];

  for (const [id, path, heading] of pages) {
    test(`${id} teacher can open ${path}`, async ({ page }) => {
      const diag = newDiag("teacher", `${id} open`);
      capture(page, diag);
      await seedDemoSession(page, "teacher");
      await visit(page, diag, path);
      await expectReachable(page, diag, heading);
      finish(diag);
    });
  }

  test("T24 global search only offers role-appropriate page shortcuts", async ({ page }) => {
    const diag = newDiag("teacher", "global search gating");
    capture(page, diag);
    await seedDemoSession(page, "teacher");
    await visit(page, diag, "/dashboard");
    await page.locator("[data-globalsearch-trigger]").click({ timeout: 10_000 });
    const input = page.getByRole("dialog", { name: "Search" }).getByRole("textbox");
    await input.fill("student");
    await page.waitForTimeout(1200);
    const results = page.getByRole("dialog", { name: "Search" }).locator("button", { hasText: "Students" });
    await expect(results.first()).toBeVisible({ timeout: 8_000 });
    await input.fill("fees");
    await page.waitForTimeout(1200);
    await expect(
      page.getByRole("dialog", { name: "Search" }).getByRole("button", { name: /fees/i }),
    ).toHaveCount(0);
    await input.fill("staff");
    await page.waitForTimeout(1200);
    await expect(
      page.getByRole("dialog", { name: "Search" }).getByRole("button", { name: /staff/i }),
    ).toHaveCount(0);
    finish(diag);
  });

  test("T25 teacher dashboard has no horizontal overflow at mobile width", async ({ page }) => {
    const diag = newDiag("teacher", "mobile layout");
    capture(page, diag);
    await seedDemoSession(page, "teacher");
    await page.setViewportSize({ width: 390, height: 844 });
    await visit(page, diag, "/dashboard");
    expect(diag.overflowPx).toBeLessThanOrEqual(8);
    finish(diag);
  });
});

test.describe("Bursar scenarios", () => {
  test("B01 dashboard greets the bursar and paints", async ({ page }) => {
    const diag = newDiag("bursar", "dashboard greeting");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard");
    await expect(page.getByText(/good (morning|afternoon|evening), james/i)).toBeVisible({
      timeout: 15_000,
    });
    finish(diag);
  });

  test("B02 sidebar shows settings but hides the dead permission links", async ({ page }) => {
    const diag = newDiag("bursar", "sidebar settings and dead links");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard");
    await expandSidebar(page);
    await expect(page.locator('a[href^="/dashboard/settings"]').first()).toBeVisible({ timeout: 10_000 });
    for (const href of ["/dashboard/permissions", "/dashboard/data-quality"]) {
      await expect(page.locator(`a[href^="${href}"]`)).toHaveCount(0);
    }
    finish(diag);
  });

  test("B03 sidebar shows finance links", async ({ page }) => {
    const diag = newDiag("bursar", "sidebar shows finance links");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard");
    await expandSidebar(page);
    for (const href of [
      "/dashboard/fees",
      "/dashboard/budget",
      "/dashboard/payroll",
      "/dashboard/students",
      "/dashboard/billing",
      "/dashboard/messages",
    ]) {
      await expect(page.locator(`a[href^="${href}"]`).first()).toBeVisible({ timeout: 10_000 });
    }
    finish(diag);
  });

  test("B04 fees page opens the record payment dialog", async ({ page }) => {
    const diag = newDiag("bursar", "record payment dialog");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard/fees");
    await expectReachable(page, diag, /fees/i);
    await page.getByRole("button", { name: /add payment/i }).click({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /record payment/i })).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: /cancel/i }).first().click();
    finish(diag);
  });

  test("B05 fees invoices sidebar link opens the invoices tab", async ({ page }) => {
    const diag = newDiag("bursar", "invoices tab link");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard");
    await expandSidebar(page);
    await page.locator('a[href*="tab=invoices"]').first().click({ timeout: 10_000 });
    await expect(page).toHaveURL(/tab=invoices/, { timeout: 10_000 });
    finish(diag);
  });

  test("B06 fees cashbook sidebar link opens the cashbook tab", async ({ page }) => {
    const diag = newDiag("bursar", "cashbook tab link");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard");
    await expandSidebar(page);
    await page.locator('a[href*="tab=cashbook"]').first().click({ timeout: 10_000 });
    await expect(page).toHaveURL(/tab=cashbook/, { timeout: 10_000 });
    finish(diag);
  });

  test("B07 budget page opens", async ({ page }) => {
    const diag = newDiag("bursar", "budget page");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard/budget");
    await expectReachable(page, diag, /budget/i);
    finish(diag);
  });

  test("B08 payroll page opens with run payroll action", async ({ page }) => {
    const diag = newDiag("bursar", "payroll page");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard/payroll");
    await expectReachable(page, diag, /payroll/i);
    await expect(page.getByRole("button", { name: /run payroll/i }).first()).toBeVisible({ timeout: 10_000 });
    finish(diag);
  });

  test("B09 bursar billing opens the subscription settings tab", async ({ page }) => {
    const diag = newDiag("bursar", "billing opens subscription");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard/billing");
    await expect(page).toHaveURL(/\/dashboard\/settings\/\?tab=subscription/, { timeout: 15_000 });
    await expectReachable(page, diag, /settings/i);
    finish(diag);
  });

  test("B10 messages page opens with the message composer", async ({ page }) => {
    const diag = newDiag("bursar", "messages page");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard/messages");
    await expectReachable(page, diag, /communication hub/i);
    await expect(page.getByText("Send Message").first()).toBeVisible({ timeout: 10_000 });
    finish(diag);
  });

  test("B11 reports page opens", async ({ page }) => {
    const diag = newDiag("bursar", "reports page");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard/reports");
    await expectReachable(page, diag, /report/i);
    finish(diag);
  });

  test("B12 students registry allows the bursar to register students", async ({ page }) => {
    const diag = newDiag("bursar", "students manage");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await visit(page, diag, "/dashboard/students");
    await expectReachable(page, diag, /student/i);
    await expect(page.getByRole("button", { name: /register student/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    finish(diag);
  });

  const denied: Array<[string, string]> = [
    ["B14", "/dashboard/permissions"],
    ["B15", "/dashboard/users"],
    ["B16", "/dashboard/attendance"],
    ["B17", "/dashboard/grades"],
    ["B18", "/dashboard/staff"],
  ];

  for (const [id, path] of denied) {
    test(`${id} bursar is blocked from ${path}`, async ({ page }) => {
      const diag = newDiag("bursar", `${id} blocked`);
      capture(page, diag);
      await seedDemoSession(page, "bursar");
      await visit(page, diag, path);
      await expectDenied(page, diag);
      finish(diag);
    });
  }

  const pages: Array<[string, string, RegExp]> = [
    ["B13", "/dashboard/settings", /settings/i],
    ["B19", "/dashboard/invoicing", /fees tracker/i],
    ["B20", "/dashboard/cashbook", /fees tracker/i],
    ["B21", "/dashboard/payment-plans", /fees tracker/i],
    ["B22", "/dashboard/expense-approvals", /expense|approval/i],
    ["B23", "/dashboard/export", /export/i],
    ["B24", "/dashboard/auto-sms", /sms|auto/i],
  ];

  for (const [id, path, heading] of pages) {
    test(`${id} bursar can open ${path}`, async ({ page }) => {
      const diag = newDiag("bursar", `${id} open`);
      capture(page, diag);
      await seedDemoSession(page, "bursar");
      await visit(page, diag, path);
      await expectReachable(page, diag, heading);
      finish(diag);
    });
  }

  test("B25 fees page has no horizontal overflow at mobile width", async ({ page }) => {
    const diag = newDiag("bursar", "mobile layout");
    capture(page, diag);
    await seedDemoSession(page, "bursar");
    await page.setViewportSize({ width: 390, height: 844 });
    await visit(page, diag, "/dashboard/fees");
    expect(diag.overflowPx).toBeLessThanOrEqual(8);
    finish(diag);
  });
});
