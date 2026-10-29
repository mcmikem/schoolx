#!/usr/bin/env node
/**
 * Write the list of static app routes the offline warmer should download.
 *
 * The service worker can only open a page offline if its document (and the
 * JavaScript chunks Next.js references) were fetched while the device had a
 * connection. Walking the app directory here keeps that list in step with the
 * routes that actually exist, instead of a hand-maintained array that silently
 * falls behind every new page.
 *
 * Dynamic routes (`students/[id]`) are intentionally excluded: there is no
 * finite list to download, and the service worker already falls back to the
 * nearest saved list page and labels the substitution.
 */
import { createHash } from "node:crypto";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const APP_DIR = resolve(process.cwd(), "src/app");
const OUTPUT = resolve(process.cwd(), "public/offline-routes.json");

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (entry === "page.tsx" || entry === "page.ts") files.push(full);
  }
  return files;
}

function toRoute(file) {
  const rel = relative(APP_DIR, dirname(file)).split(sep).join("/");
  if (rel === "" || rel === ".") return "/";
  return `/${rel}/`;
}

const routes = walk(APP_DIR)
  .map(toRoute)
  .filter((route) => {
    // There is nothing finite to download for a parameterised page.
    if (route.includes("[")) return false;
    // Development-only demo entries must never be cached for real users.
    if (route === "/demo/" || route === "/demo-login/" || route === "/demo-student/") return false;
    return true;
  })
  .sort();

// The service worker deletes the PAGE cache whenever CACHE_VERSION changes,
// so the warmer's "done" list must be scoped to the deploy that filled it.
// Including the commit lets every new deployment re-check (and refill) the
// pages instead of trusting a list whose cache no longer exists.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";
const version = createHash("sha256").update(`${routes.join("\n")}:${buildId}`).digest("hex").slice(0, 12);
const payload = {
  version,
  generatedAt: new Date().toISOString(),
  routes,
};

writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[offline] wrote ${routes.length} routes (version ${version}) to public/offline-routes.json`);
