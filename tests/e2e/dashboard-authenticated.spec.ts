import { test, expect } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test.describe("Authenticated dashboard flows", () => {
  test("headmaster can open auto-sms actions", async ({ page }) => {
    test.setTimeout(90_000);
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/auto-sms");
    await expect(
      page.getByRole("heading", { name: /smart sms triggers/i }),
    ).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /new automation rule/i }).click();
    await expect(
      page.getByRole("heading", { name: /create automation rule/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("headmaster can open transport schedule details", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/transport");
    await expect(
      page.getByRole("heading", { name: /transport management/i }),
    ).toBeVisible();
    await expect(page.getByText(/routes configured|no routes registered/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /add route/i })).toBeVisible();
  });

  test("headmaster can reach attendance and grades work areas", async ({
    page,
  }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/attendance");
    await expect(
      page.getByRole("heading", { name: /attendance/i }),
    ).toBeVisible();
    const classSelect = page.locator("select").first();
    await classSelect.selectOption("4");
    await expect(
      page.getByRole("button", { name: /mark all in school|reset all/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Changes", exact: true }),
    ).toBeVisible();

    await page.goto("/dashboard/grades");
    await expect(
      page.getByRole("heading", { name: /grades & marks/i }),
    ).toBeVisible();
    await expect(page.locator("select").nth(0)).toHaveCount(1);
    await page.locator("select").nth(0).selectOption({ index: 1 });
    await page.locator("select").nth(1).selectOption({ index: 1 });
    await expect(
      page.getByRole("button", { name: /save grades/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("bursar can open finance actions on fees page", async ({ page }) => {
    await seedDemoSession(page, "bursar");

    await page.goto("/dashboard/fees");
    await expect(
      page.getByRole("heading", { name: "Fees Tracker", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: /add payment/i }).click();
    await expect(
      page.getByRole("heading", { name: /record payment/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();

    await page
      .getByRole("button", { name: "Scholarship/Discount", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /record fee adjustment/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("headmaster can post a notice in demo mode", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/notices");
    await expect(page.getByRole("heading", { name: /notices/i })).toBeVisible();

    await page.getByRole("button", { name: /post notice/i }).click();
    await expect(
      page.getByRole("heading", { name: /post notice/i }),
    ).toBeVisible();

    await page.getByLabel(/title/i).fill("Playwright Notice");
    await page.getByLabel(/category/i).selectOption("Academic");
    await page.getByLabel(/content/i).fill("Browser test notice body");
    await page.locator("form").getByRole("button", { name: /^post notice$/i }).click();

    await expect(
      page.getByRole("heading", { name: /playwright notice/i }),
    ).toBeVisible();
  });

  test("headmaster can log a substitution in demo mode", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/substitutions");
    await expect(
      page.getByRole("heading", { name: /substitutions/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /log substitution/i }).click();
    await expect(
      page.getByRole("heading", { name: /log substitution/i }),
    ).toBeVisible();

    await page.getByLabel(/absent teacher/i).selectOption({ index: 1 });
    await page.getByLabel(/class affected/i).selectOption("4");
    await page.getByLabel(/substitute teacher/i).selectOption({ index: 1 });
    await page
      .getByRole("button", { name: /^log substitution$/i })
      .last()
      .click();

    await expect(page.getByText(/→/).first()).toBeVisible();
  });

  test("headmaster can send a demo parent message", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/messages");
    await expect(
      page.getByRole("heading", { name: /communication hub/i }),
    ).toBeVisible();

    await page.getByLabel(/phone number/i).fill("0700000000");
    await page.getByRole("textbox", { name: /^message$/i }).fill("Playwright demo message");
    await page.getByRole("button", { name: /send sms/i }).click();

    await expect(page.getByText(/playwright demo message/i)).toBeVisible();
  });

  test("headmaster can open sync center controls", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/sync-center");
    await expect(
      page.getByRole("heading", { name: /sync center/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sync now/i }),
    ).toBeVisible();
    await expect(page.getByText(/pending changes/i)).toBeVisible();
  });

  test("headmaster can search a student and open SMS modal", async ({
    page,
  }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/student-lookup");
    await expect(
      page.getByRole("heading", { name: /student lookup/i }),
    ).toBeVisible();

    await page.getByLabel(/student search/i).fill("Amina");
    await expect(page.getByText(/amina nakamya/i)).toBeVisible();

    await page.getByRole("button", { name: /sms parent/i }).click();
    await expect(
      page.getByRole("heading", { name: /sms parent of amina nakamya/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /fee reminder/i }).click();
    await expect(page.getByLabel(/message/i)).not.toHaveValue("");
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("headmaster can review dropout actions in demo mode", async ({
    page,
  }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/dropout-tracking");
    await expect(
      page.getByRole("heading", { name: /dropout tracking/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/likely dropout|at risk/i).first(),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /contact/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /dropout/i })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: /mark as dropout/i }),
    ).toBeVisible();

    await page
      .getByLabel(/reason for dropout/i)
      .selectOption("Family relocation");
    await page
      .getByRole("button", { name: /mark as dropout/i })
      .last()
      .click();
    await expect(
      page.getByRole("heading", { name: /dropout tracking/i }),
    ).toBeVisible();
  });

  test("headmaster can record transfer in and transfer out flows", async ({
    page,
  }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/student-transfers");
    await expect(
      page.getByRole("heading", { name: /student transfers/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^transfer in$/i }).first().click();
    await expect(
      page.getByRole("heading", { name: /new transfer in/i }),
    ).toBeVisible();
    await page.getByLabel(/first name/i).fill("Play");
    await page.getByLabel(/last name/i).fill("Transfer");
    await page.getByLabel(/previous school/i).fill("Demo Primary");
    await page.getByLabel(/^reason$/i).selectOption("Family relocation");
    await page.getByLabel(/^class/i).selectOption("4");
    await page.getByLabel(/parent name/i).fill("Test Parent");
    await page.getByLabel(/parent phone/i).fill("0700000011");
    await page.getByRole("button", { name: /record transfer in/i }).click();
    await expect(page.getByText(/play transfer/i)).toBeVisible();

    await page
      .getByRole("button", { name: /transfer out/i })
      .nth(1)
      .click();
    await page
      .getByRole("button", { name: /transfer out/i })
      .first()
      .click();
    await page.getByLabel(/select student/i).selectOption({ index: 1 });
    await page.getByLabel(/transferring to/i).fill("Next School");
    await page.getByLabel(/^reason$/i).selectOption("Better opportunity");
    await page
      .getByRole("button", { name: /transfer out/i })
      .last()
      .click();
    await expect(page.getByText(/next school/i)).toBeVisible();
  });

  test("headmaster can generate report cards in demo mode", async ({
    page,
  }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/report-cards");
    await expect(
      page.getByRole("heading", { name: "Report Cards", exact: true }),
    ).toBeVisible();

    await page.getByLabel(/select class/i).selectOption("4");
    await page.getByRole("button", { name: /generate now|generate report cards/i }).click();

    await expect(page.getByText(/class average/i)).toBeVisible();
    await expect(
      page
        .locator("div")
        .filter({ hasText: /^Division 1$/ })
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeVisible();
  });

  test("headmaster can view staff directory in demo mode", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/staff");
    await expect(
      page.getByRole("heading", { name: "Staff Directory" }),
    ).toBeVisible();
  });

  test("headmaster can view fee structure tab", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/fees");
    await expect(
      page.getByRole("heading", { name: "Fees Tracker", exact: true }),
    ).toBeVisible();
  });

  test("headmaster can view student registry with demo data", async ({
    page,
  }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/students");
    expect(page.url()).toContain("/dashboard/students");
    await expect(page.getByRole("heading", { name: /student hub/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: /register student/i }).first()).toBeVisible();
  });

  test("teacher can open teacher dashboard and sub-pages", async ({ page }) => {
    await seedDemoSession(page, "teacher");

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard");
    await expect(
      page.getByText(/good (morning|afternoon|evening), mary/i),
    ).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/dashboard/homework");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/homework");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/dashboard/lesson-plans");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/lesson-plans");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("headmaster can open exam management", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/exams");
    await expect(page.getByRole("heading", { name: /exam/i })).toBeVisible();
  });

  test("headmaster can open UNEB page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/uneb");
    await expect(page.getByRole("heading", { name: /uneb/i })).toBeVisible();
  });

  test("headmaster can open timetable page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/timetable");
    await expect(
      page.getByRole("heading", { name: /timetable/i }),
    ).toBeVisible();
  });

  test("headmaster can open homework page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/homework");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("headmaster can open discipline page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/discipline");
    await expect(
      page.getByRole("heading", { name: /discipline/i }),
    ).toBeVisible();
  });

  test("headmaster can open health page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/health");
    await expect(page.getByRole("heading", { name: /health/i })).toBeVisible();
  });

  test("headmaster can open library page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/library");
    await expect(page.getByRole("heading", { name: /library/i })).toBeVisible();
  });

  test("headmaster can open inventory page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/inventory");
    await expect(
      page.getByRole("heading", { name: /inventory/i }),
    ).toBeVisible();
  });

  test("headmaster can open budget page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/budget");
    await expect(page.getByRole("heading", { name: /budget/i })).toBeVisible();
  });

  test("headmaster can open payroll page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/payroll");
    await expect(page.getByRole("heading", { name: /payroll/i })).toBeVisible();
  });

  test("headmaster can open leave requests page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/leave");
    await expect(page.getByRole("heading", { name: /leave/i })).toBeVisible();
  });

  test("headmaster can open syllabus tracking page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/syllabus");
    await expect(
      page.getByRole("heading", { name: /syllabus/i }),
    ).toBeVisible();
  });

  test("headmaster can open scheme of work page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/scheme-of-work");
    await expect(page.getByRole("heading", { name: /scheme/i })).toBeVisible();
  });

  test("headmaster can open lesson plans page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/lesson-plans");
    await expect(page.getByRole("heading", { name: /lesson/i })).toBeVisible();
  });

  test("headmaster can open trends page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/trends");
    await expect(page.getByRole("heading", { name: /trend/i })).toBeVisible();
  });

  test("headmaster can open export page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/export");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("headmaster can open warnings page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/warnings");
    await expect(page.getByRole("heading", { name: /warning/i })).toBeVisible();
  });

  test("headmaster can open workload page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/workload");
    await expect(
      page.getByRole("heading", { name: /workload/i }),
    ).toBeVisible();
  });

  test("headmaster can open staff attendance page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/staff-attendance");
    await expect(
      page.getByRole("heading", { name: /staff attendance/i }),
    ).toBeVisible();
  });

  test("headmaster can open staff activity page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/staff-activity");
    await expect(
      page.getByRole("heading", { name: /staff activity/i }),
    ).toBeVisible();
  });

  test("headmaster can open staff reviews page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/staff-reviews");
    await expect(page).toHaveURL(/\/dashboard\/teacher-performance\/?$/);
    await expect(
      page.getByRole("heading", { name: /teacher performance/i }),
    ).toBeVisible();
  });

  test("headmaster can open promotion page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/promotion");
    await expect(
      page.getByRole("heading", { name: "Student Promotion" }),
    ).toBeVisible();
  });

  test("headmaster can open audit log page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/audit");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("headmaster can open settings page", async ({ page }) => {
    await seedDemoSession(page, "headmaster");

    await page.goto("/dashboard/settings");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("teacher can open teacher dashboard and sub-pages (quick check)", async ({
    page,
  }) => {
    await seedDemoSession(page, "teacher");

    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    await expect(
      page.getByText(/good (morning|afternoon|evening), mary/i),
    ).toBeVisible();

    await page.goto("/dashboard/homework");
    await page.waitForTimeout(1000);
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();

    await page.goto("/dashboard/lesson-plans");
    await page.waitForTimeout(1000);
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("dean can open dean dashboard and sub-pages", async ({ page }) => {
    await seedDemoSession(page, "dean_of_studies");

    await page.goto("/dashboard");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();

    await page.goto("/dashboard/syllabus");
    await expect(
      page.getByRole("heading", { name: /syllabus/i }),
    ).toBeVisible();

    await page.goto("/dashboard/promotion");
    await expect(
      page.getByRole("heading", { name: "Student Promotion" }),
    ).toBeVisible();
  });
});
