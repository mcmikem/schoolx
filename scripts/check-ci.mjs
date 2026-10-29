#!/usr/bin/env node
/**
 * Local CI / build status checker
 *
 * Checks GitHub Actions and Vercel build status for the current branch's
 * latest commit so you don't have to manually open browsers after pushing.
 *
 * Usage:
 *   npm run check:ci              # one-shot status
 *   npm run check:ci -- --watch   # poll every 15s until done
 *
 * Env vars (optional):
 *   GITHUB_TOKEN   – falls back to `gh auth token`
 *   VERCEL_TOKEN   – falls back to the Vercel CLI auth file
 *
 * Exit codes: 0 pass, 1 failure, 2 still running, 3 blocked before it could
 * run (for example, GitHub Actions locked for a billing issue).
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const REPO_OWNER = process.env.REPO_OWNER || "mcmikem";
const REPO_NAME = process.env.REPO_NAME || "schoolx";

/**
 * Tokens should not have to be exported twice.
 *
 * The developer is already signed in to both CLIs locally, so fall back to the
 * `gh` credential store and the Vercel CLI's auth file when the environment
 * does not carry a token. CI still passes real tokens explicitly; this is for
 * `npm run check:ci` on a workstation.
 */
function resolveGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const token = execSync("gh auth token", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return token || null;
  } catch {
    return null;
  }
}

function resolveVercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;

  const candidates = [
    process.env.VERCEL_AUTH_FILE,
    join(homedir(), "Library", "Application Support", "com.vercel.cli", "auth.json"),
    join(homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
    join(homedir(), ".config", "com.vercel.cli", "auth.json"),
    join(homedir(), ".vercel", "auth.json"),
  ].filter(Boolean);

  for (const file of candidates) {
    try {
      if (!existsSync(file)) continue;
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (typeof parsed?.token === "string" && parsed.token) return parsed.token;
    } catch {
      // Try the next location.
    }
  }
  return null;
}

const GITHUB_TOKEN = resolveGitHubToken();
const VERCEL_TOKEN = resolveVercelToken();

function getLinkedVercelProjectInfo() {
  try {
    const filePath = ".vercel/project.json";
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      projectId: parsed?.projectId || null,
      orgId: parsed?.orgId || null,
      projectName: parsed?.projectName || null,
    };
  } catch {
    return null;
  }
}

const LINKED_VERCEL = getLinkedVercelProjectInfo();
const VERCEL_PROJECT_NAME =
  process.env.VERCEL_PROJECT_NAME || LINKED_VERCEL?.projectName || "schoolx";
const POLL_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function print(...args) {
  console.log(...args);
}

function header(text) {
  print(`\n${C.bold}${C.cyan}▶ ${text}${C.reset}\n`);
}

function status(label, state, detail = "") {
  const color =
    state === "success" || state === "completed"
      ? C.green
      : state === "failure" || state === "action_required"
        ? C.red
        : state === "in_progress" || state === "queued" || state === "pending"
          ? C.yellow
          : C.dim;
  const icon =
    state === "success" || state === "completed"
      ? "✓"
      : state === "failure" || state === "action_required"
        ? "✗"
        : state === "in_progress"
          ? "⟳"
          : "•";
  print(`  ${icon} ${label}: ${color}${state}${C.reset}${detail ? `  ${C.dim}(${detail})${C.reset}` : ""}`);
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------
function getGitInfo() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
    const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    const shortSha = sha.slice(0, 7);
    return { branch, sha, shortSha };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GitHub Actions
// ---------------------------------------------------------------------------
async function fetchGitHubCheckRuns(sha) {
  const token = GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${sha}/check-runs`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchGitHubWorkflowRuns(sha) {
  const token = GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs?head_sha=${sha}&per_page=10`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchCheckAnnotations(checkRunId) {
  if (!GITHUB_TOKEN) return [];
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/check-runs/${checkRunId}/annotations`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

async function checkGitHub(gitInfo) {
  header("GitHub Actions");

  try {
    const [checksData, runsData] = await Promise.all([
      fetchGitHubCheckRuns(gitInfo.sha).catch(() => ({ check_runs: [] })),
      fetchGitHubWorkflowRuns(gitInfo.sha).catch(() => ({ workflow_runs: [] })),
    ]);

    const checks = checksData.check_runs || [];
    const runs = runsData.workflow_runs || [];

    // A billing lock fails every job in about a second without running a
    // single step. Reporting that as "CI failed" sends the reader looking for
    // a code defect that is not there, so read the annotation and say what
    // actually happened.
    const failedChecks = checks.filter(
      (check) => check.conclusion === "failure" || check.conclusion === "action_required",
    );
    let billingLocked = false;
    if (failedChecks.length > 0) {
      const annotations = await Promise.all(
        failedChecks.slice(0, 5).map((check) => fetchCheckAnnotations(check.id).catch(() => [])),
      );
      billingLocked = annotations
        .flat()
        .some((annotation) => /account is locked due to a billing issue/i.test(annotation.message || ""));
    }

    if (checks.length === 0 && runs.length === 0) {
      print(`  ${C.yellow}⚠ No CI runs found for ${gitInfo.shortSha}${C.reset}`);
      print(`      ${C.dim}Pushed recently? CI may still be queuing.${C.reset}`);
      if (!GITHUB_TOKEN) {
        print(`      ${C.dim}Private repo? Set GITHUB_TOKEN env var.${C.reset}`);
      }
      return "unknown";
    }

    let overall = "success";

    for (const run of runs.slice(0, 5)) {
      const state = run.conclusion || run.status;
      const name = run.name || run.workflow_name || "Workflow";
      const detail = `${run.html_url}`;
      status(name, state, detail);
      if (state === "failure" || state === "action_required" || state === "cancelled") {
        overall = "failure";
      } else if (state !== "success" && state !== "completed" && overall !== "failure") {
        overall = "pending";
      }
    }

    for (const check of checks.slice(0, 5)) {
      const state = check.conclusion || check.status;
      const name = check.name || "Check";
      const detail = `${check.html_url}`;
      status(name, state, detail);
      if (state === "failure" || state === "action_required" || state === "timed_out") {
        overall = "failure";
      } else if (state !== "success" && state !== "completed" && overall !== "failure") {
        overall = "pending";
      }
    }

    if (billingLocked) {
      print(`\n  ${C.red}✗ GitHub Actions is blocked by a GitHub billing lock.${C.reset}`);
      print(`      ${C.dim}The job was not started, so this is not a code failure.${C.reset}`);
      print(`      ${C.dim}Fix billing: https://github.com/settings/billing${C.reset}`);
      print(`      ${C.dim}Until then, run the gates locally: npm run lint && npm run typecheck && npm test${C.reset}`);
      return "blocked";
    }

    return overall;
  } catch (err) {
    print(`  ${C.red}✗ Failed to fetch GitHub status:${C.reset} ${err.message}`);
    if (!GITHUB_TOKEN) {
      print(`      ${C.dim}Tip: export GITHUB_TOKEN=<your-token> for private repos${C.reset}`);
    }
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Vercel
// ---------------------------------------------------------------------------
async function resolveVercelProjectId(token) {
  const explicitProjectId = process.env.VERCEL_PROJECT_ID;
  if (explicitProjectId) return explicitProjectId;
  if (LINKED_VERCEL?.projectId) return LINKED_VERCEL.projectId;

  const teamId = process.env.VERCEL_TEAM_ID || LINKED_VERCEL?.orgId;
  const scope = teamId
    ? `?teamId=${encodeURIComponent(teamId)}`
    : "";
  const projectUrl =
    `https://api.vercel.com/v9/projects/${encodeURIComponent(VERCEL_PROJECT_NAME)}` +
    scope;

  const projectRes = await fetch(projectUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!projectRes.ok) {
    const body = await projectRes.text();
    throw new Error(
      `Vercel project lookup ${projectRes.status}: ${body.slice(0, 200)}`,
    );
  }

  const project = await projectRes.json();
  return project?.id || null;
}

async function fetchVercelDeployments(gitInfo) {
  const token = VERCEL_TOKEN;
  if (!token) return null;

  const projectId = await resolveVercelProjectId(token);
  if (!projectId) {
    throw new Error("Vercel project ID could not be resolved");
  }

  const teamId = process.env.VERCEL_TEAM_ID || LINKED_VERCEL?.orgId;
  const scope = teamId
    ? `&teamId=${encodeURIComponent(teamId)}`
    : "";

  const url =
    `https://api.vercel.com/v6/deployments?` +
    `projectId=${encodeURIComponent(projectId)}&` +
    `meta-githubCommitSha=${gitInfo.sha}&` +
    `limit=5${scope}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function checkVercel(gitInfo) {
  header("Vercel Build");

  if (!VERCEL_TOKEN) {
    print(`  ${C.yellow}⚠ Skipped${C.reset} — set VERCEL_TOKEN env var to check builds.`);
    print(`      ${C.dim}Get token: https://vercel.com/account/tokens${C.reset}`);
    print(`      ${C.dim}Optional: set VERCEL_PROJECT_ID / VERCEL_PROJECT_NAME / VERCEL_TEAM_ID${C.reset}`);
    return "unknown";
  }

  try {
    const data = await fetchVercelDeployments(gitInfo);
    const deployments = data?.deployments || [];

    if (deployments.length === 0) {
      print(`  ${C.yellow}⚠ No Vercel deployments found for ${gitInfo.shortSha}${C.reset}`);
      print(`      ${C.dim}Build may still be queuing.${C.reset}`);
      return "unknown";
    }

    let overall = "success";
    for (const d of deployments.slice(0, 3)) {
      const state = d.state || d.readyState || "unknown";
      const name = d.name || "Deployment";
      const url = d.url ? `https://${d.url}` : "";
      status(name, state, url);
      if (state === "ERROR" || state === "CANCELED") {
        overall = "failure";
      } else if (state !== "READY" && state !== "success" && overall !== "failure") {
        overall = "pending";
      }
    }
    return overall;
  } catch (err) {
    print(`  ${C.red}✗ Failed to fetch Vercel status:${C.reset} ${err.message}`);
    print(`      ${C.dim}Tip: set VERCEL_PROJECT_ID explicitly to avoid project-name lookup issues.${C.reset}`);
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function runOnce() {
  const gitInfo = getGitInfo();
  if (!gitInfo) {
    print(`${C.red}✗ Not a git repository or no commits.${C.reset}`);
    return 1;
  }

  print(`\n${C.bold}Branch:${C.reset}  ${C.cyan}${gitInfo.branch}${C.reset}`);
  print(`${C.bold}Commit:${C.reset}  ${C.dim}${gitInfo.shortSha}${C.reset}`);

  // Sequential so each section's output stays under its own heading. The two
  // calls are a couple of HTTP requests; running them in parallel only
  // interleaved the report.
  const ghState = await checkGitHub(gitInfo);
  const vercelState = await checkVercel(gitInfo);

  print("");
  if (ghState === "failure" || vercelState === "failure") {
    print(`${C.red}${C.bold}✗ Some checks failed.${C.reset} Review URLs above.`);
    return 1;
  }
  if (ghState === "pending" || vercelState === "pending") {
    print(`${C.yellow}${C.bold}⟳ Some checks are still running.${C.reset}`);
    return 2; // distinct code for "still running"
  }
  if (ghState === "blocked" || vercelState === "blocked") {
    print(
      `${C.yellow}${C.bold}⚠ CI could not run, but the deployment checks completed.${C.reset} ` +
        `Fix the GitHub billing lock, then re-run.`,
    );
    return 3; // distinct code for "blocked before it could run"
  }
  print(`${C.green}${C.bold}✓ All checks passed.${C.reset}`);
  return 0;
}

async function runWatch() {
  const isWatch = process.argv.includes("--watch") || process.argv.includes("-w");
  if (!isWatch) {
    process.exit(await runOnce());
  }

  print(`\n${C.dim}Polling every ${POLL_INTERVAL_MS / 1000}s. Press Ctrl+C to stop.${C.reset}\n`);

  while (true) {
    console.clear();
    try {
      const code = await runOnce();
      if (code === 0 || code === 1 || code === 3) process.exit(code);
    } catch {
      print(`${C.red}Unexpected error during check.${C.reset}`);
    }
    print(`\n${C.dim}Waiting ${POLL_INTERVAL_MS / 1000}s...${C.reset}`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

runWatch();
