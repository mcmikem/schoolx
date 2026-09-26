import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs";
const u = JSON.parse(fs.readFileSync("/tmp/quser.json", "utf8"));
const APP = "https://skoolmate.omuto.org";
test.use({ video: "off", trace: "off" });

async function countReqs(page: Page, url: string) {
  const reqs: string[] = [];
  page.on("request", (r: import("@playwright/test").Request) => { if (r.url().includes("/rest/v1/")) reqs.push(r.url().replace(APP, "")); });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (let i=1;i<=16;i++){ await page.waitForTimeout(2000);
    const t=(await page.locator("body").innerText()).replace(/\s+/g," ");
    if(!/Verifying|^Loading/.test(t)) break; }
  await page.waitForTimeout(3000);
  return reqs;
}

test("dashboard duplicate round-trips", async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(APP + "/login/", { waitUntil: "domcontentloaded" });
  await page.fill("#identifier", u.email);
  await page.fill("#password", u.pass);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  await page.getByText(/skip all/i).first().click().catch(() => {});
  await page.waitForTimeout(6000);

  const reqs = await countReqs(page, APP + "/dashboard/");
  const tally = new Map<string, number>();
  for (const r of reqs) { const k = r.split("&")[0]; tally.set(k, (tally.get(k) || 0) + 1); }
  const dups = [...tally.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  const wasted = dups.reduce((s, [, n]) => s + (n - 1), 0);
  console.log(`TOTAL_REST_CALLS=${reqs.length} UNIQUE=${tally.size} DUPLICATE_WASTE=${wasted}`);
  for (const [k, n] of dups.slice(0, 12)) console.log(`  x${n}  ${decodeURIComponent(k).slice(0, 100)}`);
});
