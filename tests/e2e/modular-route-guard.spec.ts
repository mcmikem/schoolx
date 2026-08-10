import { test, expect, type Page } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";

const DEMO_KEY = "skoolmate_demo_v1";

async function seedModularDemoSession(page: Page, featureStage: string) {
  const payload = {
    demoUser: {
      role: "headmaster",
      name: "John Headmaster",
      school_id: "demo-school",
    },
    demoSchool: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Modular Demo School",
      school_code: "MOD001",
      district: "Kampala",
      school_type: "primary",
      ownership: "private",
      primary_color: "#17325F",
      subscription_plan: "starter",
      subscription_status: "active",
      feature_stage: featureStage,
      billing_mode: "full_suite",
    },
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

  await page.context().addCookies([
    {
      name: DEMO_KEY,
      value: encoded,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  await page.addInitScript(
    ({ key, value }) => {
      sessionStorage.setItem(key, value);
      localStorage.setItem("academic_year", "2026");
      localStorage.setItem("current_term", "1");
    },
    { key: DEMO_KEY, value: encoded },
  );
}

async function gotoRouteWithRetry(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "commit", timeout: 15_000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isAbort = message.includes("ERR_ABORTED") || message.includes("frame was detached");
      const pageIsClosed = page.isClosed() || message.includes("Target page, context or browser has been closed");
      if (!isAbort || pageIsClosed || attempt === 2) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

test.describe("Modular route guard (feature stage)", () => {
  test("core-stage school can access core modules", async ({ page }) => {
    test.setTimeout(90_000);
    await seedModularDemoSession(page, "core");

    await gotoRouteWithRetry(page, "/dashboard/attendance");
    await expect(
      page.getByRole("heading", { name: /attendance/i }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("core-stage school is blocked from finance", async ({ page }) => {
    test.setTimeout(90_000);
    await seedModularDemoSession(page, "core");

    await gotoRouteWithRetry(page, "/dashboard/fees");
    await expect(
      page.getByText(/upgrade required/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/your current plan does not include/i),
    ).toBeVisible();
  });

  test("core-stage school is blocked from exams", async ({ page }) => {
    test.setTimeout(90_000);
    await seedModularDemoSession(page, "core");

    await gotoRouteWithRetry(page, "/dashboard/exams");
    await expect(
      page.getByText(/upgrade required/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/your current plan does not include/i),
    ).toBeVisible();
  });

  test("no-access page shows WhatsApp support banner", async ({ page }) => {
    test.setTimeout(90_000);
    await seedModularDemoSession(page, "core");

    await gotoRouteWithRetry(page, "/dashboard/fees?no-access");
    await gotoRouteWithRetry(page, "/dashboard/fees");
    await expect(
      page.getByText(/upgrade required/i),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText(/whatsapp/i, { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/need help upgrading/i),
    ).toBeVisible();
  });

  test("no-access page shows WhatsApp support banner for permission blocks", async ({ page }) => {
    test.setTimeout(90_000);
    await seedModularDemoSession(page, "core");

    await gotoRouteWithRetry(page, "/dashboard/no-access?reason=permission&from=%2Fdashboard%2Fadmin&required=admin_panel");
    await expect(
      page.getByText(/access restricted/i),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText(/whatsapp/i, { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/need help resolving access/i),
    ).toBeVisible();
  });

  test("subscription tab shows module catalog with correct entitlements", async ({ page }) => {
    test.setTimeout(90_000);
    await seedModularDemoSession(page, "core");

    await page.route(`${SUPABASE_URL}/rest/v1/module_catalog*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { module_key: "dashboard", display_name: "Dashboard", description: "School dashboard", annual_price_small: 0, annual_price_medium: 0, annual_price_large: 0, is_active: true, sort_order: 1 },
          { module_key: "attendance", display_name: "Attendance", description: "Track attendance", annual_price_small: 0, annual_price_medium: 0, annual_price_large: 0, is_active: true, sort_order: 2 },
          { module_key: "finance", display_name: "Finance", description: "Fee management", annual_price_small: 200000, annual_price_medium: 300000, annual_price_large: 400000, is_active: true, sort_order: 10 },
        ]),
      });
    });

    await page.route(`${SUPABASE_URL}/rest/v1/school_module_entitlements*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route(`http://localhost:3000/api/modules/entitlements/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            school: { billing_mode: "modular", school_size_band: "small" },
            catalog: [
              { module_key: "dashboard", display_name: "Dashboard", description: "School dashboard", annual_price_ugx: 0, is_active: true, sort_order: 1 },
              { module_key: "attendance", display_name: "Attendance", description: "Track attendance", annual_price_ugx: 0, is_active: true, sort_order: 2 },
              { module_key: "communications", display_name: "Communications", description: "Send messages", annual_price_ugx: 0, is_active: true, sort_order: 3 },
              { module_key: "students", display_name: "Students", description: "Manage students", annual_price_ugx: 0, is_active: true, sort_order: 4 },
              { module_key: "staff", display_name: "Staff", description: "Manage staff", annual_price_ugx: 0, is_active: true, sort_order: 5 },
              { module_key: "settings", display_name: "Settings", description: "School settings", annual_price_ugx: 0, is_active: true, sort_order: 6 },
              { module_key: "finance", display_name: "Finance", description: "Fee management", annual_price_ugx: 200000, is_active: true, sort_order: 10 },
              { module_key: "exams", display_name: "Exams", description: "Manage exams", annual_price_ugx: 100000, is_active: true, sort_order: 11 },
              { module_key: "reports", display_name: "Reports", description: "Generate reports", annual_price_ugx: 100000, is_active: true, sort_order: 12 },
            ],
            entitlements: [],
          },
        }),
      });
    });

    await gotoRouteWithRetry(page, "/dashboard/settings?tab=subscription");
    await expect(
      page.getByRole("heading", { name: /choose your modules/i }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByText(/modular \(small\)/i),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Finance" }),
    ).toBeVisible();
    await expect(
      page.getByText(/ugx 200,000/i),
    ).toBeVisible();

    const lockedBadges = page.locator("text=Locked");
    const lockedCount = await lockedBadges.count();
    expect(lockedCount).toBeGreaterThanOrEqual(1);

    const requestButtons = page.locator("button:has-text('Request Activation')");
    await expect(requestButtons.first()).toBeVisible();
  });

  test("academic-stage school can access marks but not finance", async ({ page }) => {
    test.setTimeout(90_000);
    await seedModularDemoSession(page, "academic");

    await gotoRouteWithRetry(page, "/dashboard/exams");
    await expect(
      page.getByRole("heading", { name: /exams/i }),
    ).toBeVisible({ timeout: 30_000 });

    await gotoRouteWithRetry(page, "/dashboard/fees");
    await expect(
      page.getByText(/upgrade required/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("full-stage school can access all modules", async ({ page }) => {
    test.setTimeout(90_000);
    await seedModularDemoSession(page, "full");

    await gotoRouteWithRetry(page, "/dashboard/fees");
    await expect(
      page.getByRole("heading", { name: /fees/i }),
    ).toBeVisible({ timeout: 30_000 });

    await gotoRouteWithRetry(page, "/dashboard/transport");
    await expect(
      page.getByRole("heading", { name: /transport management/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
