import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("a signed-in PWA launch goes straight to the remembered dashboard page", async ({ page, context }) => {
  await seedDemoSession(page, "headmaster");
  await context.addCookies([
    {
      name: "skoolmate_last_dashboard_path",
      value: encodeURIComponent("/dashboard/staff/"),
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);

  const mainFramePaths: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) mainFramePaths.push(new URL(frame.url()).pathname);
  });

  await page.goto("/start/");
  await expect(page).toHaveURL(/\/dashboard\/staff\/?$/);
  await expect(page.getByText(/Welcome to SkoolMate/i)).toHaveCount(0);
  expect(mainFramePaths).not.toContain("/login/");
  expect(mainFramePaths).not.toContain("/");
});
