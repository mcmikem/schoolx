#!/usr/bin/env node
/**
 * Stamp a per-deploy build id into the service worker.
 *
 * Browsers decide a service worker has changed by byte-comparing the script it
 * fetch against the one it already stored. Because public/sw.js was previously
 * byte-identical on every deploy, the browser never detected a new worker:
 * `updatefound` never fired, the "new version available" prompt never appeared,
 * and installed copies kept running whatever they had cached. Bumping
 * CACHE_VERSION by hand is easy to forget, so it is derived from the build
 * instead.
 *
 * Only runs for real builds. In development the app unregisters its service
 * worker (see src/app/providers.tsx), and skipping the stamp keeps the working
 * tree clean for local builds.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const SW_PATH = resolve(process.cwd(), "public/sw.js");
// Truthiness rather than `!== undefined`: an environment variable that is
// present but empty must not count as a Vercel build.
const isRealBuild =
  process.env.VERCEL === "1" ||
  Boolean(process.env.VERCEL_ENV) ||
  process.env.CI === "true" ||
  process.env.GITHUB_ACTIONS === "true" ||
  process.argv.includes("--force");

if (!isRealBuild) {
  console.log("[sw] skipping build id stamp (not a CI/Vercel build)");
  process.exit(0);
}

function resolveBuildId() {
  const fromEnv =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.BUILD_ID ||
    process.env.COMMIT_REF;
  if (fromEnv) return String(fromEnv).slice(0, 12);

  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    // A shallow export with no git metadata still needs a value that changes
    // between deploys, otherwise the staleness this script exists to prevent
    // silently returns.
    return `t${Date.now().toString(36)}`;
  }
}

const buildId = resolveBuildId();
const source = readFileSync(SW_PATH, "utf8");
const pattern = /const CACHE_VERSION = '[^']*';/;

if (!pattern.test(source)) {
  console.error("[sw] could not find the CACHE_VERSION declaration in public/sw.js");
  process.exit(1);
}

const next = `const CACHE_VERSION = 'skoolmate-${buildId}';`;
if (source === source.replace(pattern, next)) {
  console.log(`[sw] already stamped with build ${buildId}`);
  process.exit(0);
}

writeFileSync(SW_PATH, source.replace(pattern, next));
console.log(`[sw] stamped service worker with build ${buildId}`);
