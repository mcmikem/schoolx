// ============================================================================
// 🔍 Breaking Change Detection Script
// ============================================================================
// Detects changes that could break customers before they're deployed.
// Run this before merging to production.
// ============================================================================

import { execSync } from "child_process";
import { readFileSync } from "fs";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
};

let hasIssues = 0;

function header(text) {
  console.log(`\n${C.bold}${C.cyan}▶ ${text}${C.reset}\n`);
}

function warn(message) {
  console.log(`  ${C.yellow}⚠️  ${message}${C.reset}`);
  hasIssues++;
}

function error(message) {
  console.log(`  ${C.red}✗ ${message}${C.reset}`);
  hasIssues++;
}

function success(message) {
  console.log(`  ${C.green}✓ ${message}${C.reset}`);
}

function info(message) {
  console.log(`  ${message}`);
}

// Get staged and unstaged changes
function getChangedFiles() {
  try {
    const staged = execSync(
      "git diff --cached --name-only --diff-filter=ACMR",
      { encoding: "utf8" }
    ).trim();
    const unstaged = execSync(
      "git diff --name-only --diff-filter=ACMR",
      { encoding: "utf8" }
    ).trim();
    const all = [...new Set([...staged.split("\n"), ...unstaged.split("\n"]).filter(Boolean))];
    return all.filter(Boolean);
  } catch {
    return [];
  }
}

const changedFiles = getChangedFiles();

if (changedFiles.length === 0) {
  info("No changed files detected.");
  process.exit(0);
}

info(`Checking ${changedFiles.length} changed files...\n`);

// 1. Check for removed API routes
header("1. API Route Changes");
const apiRoutes = changedFiles.filter((f) => f.match(/src\/app\/api\/.*\/route\.ts$/));
if (apiRoutes.length > 0) {
  info("API routes modified:");
  apiRoutes.forEach((f) => info(`  • ${f}`));
  warn("API routes were modified. Verify no endpoints were removed without deprecation notice.");
} else {
  success("No API routes modified.");
}

// 2. Check for removed environment variable usage
header("2. Environment Variable Changes");
const envVarRemovals = execSync(
  "git diff --cached --diff-filter=D | grep -E '^-.*process\\.env\\.' || git diff --diff-filter=D | grep -E '^-.*process\\.env\\.'",
  { encoding: "utf8" }
).trim();

if (envVarRemovals) {
  warn("Environment variable usage removed from code:");
  envVarRemovals.split("\n").forEach((line) => info(`  • ${line.trim()}`));
  info("Ensure these env vars are not required by the app.");
} else {
  success("No environment variables removed.");
}

// 3. Check for console.log in production code
header("3. Console Logging");
const consoleLogs = execSync(
  "git diff --cached --diff-filter=ACMR | grep -E 'console\\.(log|error|warn|info)' | grep -v '__tests__' || git diff --diff-filter=ACMR | grep -E 'console\\.(log|error|warn|info)' | grep -v '__tests__'",
  { encoding: "utf8" }
).trim();

if (consoleLogs) {
  warn("console.log/warn/error found in changes - use logger.ts instead:");
  consoleLogs.split("\n").forEach((line) => info(`  • ${line.trim()}`));
} else {
  success("No console.log usage detected.");
}

// 4. Check for feature flag changes
header("4. Feature Flag Changes");
const featureFlagChanges = changedFiles.filter((f) => f.includes("feature-flags.ts"));
if (featureFlagChanges.length > 0) {
  warn("Feature flags file modified - verify no flags were accidentally disabled:");
  featureFlagChanges.forEach((f) => info(`  • ${f}`));
} else {
  success("Feature flags unchanged.");
}

// 5. Check for RLS policy changes
header("5. Database Policy Changes");
const rlsChanges = changedFiles.filter((f) => f.includes("supabase/migrations") && f.includes(".sql"));
if (rlsChanges.length > 0) {
  warn("Database migrations modified - verify no RLS policies were weakened:");
  rlsChanges.forEach((f) => info(`  • ${f}`));
} else {
  success("No database migrations modified.");
}

// 6. Summary
header("Summary");
if (hasIssues > 0) {
  console.log(`${C.red}✗ ${hasIssues} potential issue(s) detected. Review before deploying.${C.reset}\n`);
  process.exit(1);
} else {
  console.log(`${C.green}✓ No breaking changes detected. Safe to deploy.${C.reset}\n`);
  process.exit(0);
}