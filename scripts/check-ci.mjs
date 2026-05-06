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
 *   GITHUB_TOKEN   – required for private repos
 *   VERCEL_TOKEN   – required for Vercel deployment checks
 */

import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const REPO_OWNER = "mcmikem";
const REPO_NAME = "schoolx";
const VERCEL_PROJECT_NAME = process.env.VERCEL_PROJECT_NAME || "schoolx";
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
  const token = process.env.GITHUB_TOKEN;
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
  const token = process.env.GITHUB_TOKEN;
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

async function checkGitHub(gitInfo) {
  header("GitHub Actions");

  try {
    const [checksData, runsData] = await Promise.all([
      fetchGitHubCheckRuns(gitInfo.sha).catch(() => ({ check_runs: [] })),
      fetchGitHubWorkflowRuns(gitInfo.sha).catch(() => ({ workflow_runs: [] })),
    ]);

    const checks = checksData.check_runs || [];
    const runs = runsData.workflow_runs || [];

    if (checks.length === 0 && runs.length === 0) {
      print(`  ${C.yellow}⚠ No CI runs found for ${gitInfo.shortSha}${C.reset}`);
      print(`      ${C.dim}Pushed recently? CI may still be queuing.${C.reset}`);
      if (!process.env.GITHUB_TOKEN) {
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

    return overall;
  } catch (err) {
    print(`  ${C.red}✗ Failed to fetch GitHub status:${C.reset} ${err.message}`);
    if (!process.env.GITHUB_TOKEN) {
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

  const scope = process.env.VERCEL_TEAM_ID
    ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}`
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
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;

  const projectId = await resolveVercelProjectId(token);
  if (!projectId) {
    throw new Error("Vercel project ID could not be resolved");
  }

  const scope = process.env.VERCEL_TEAM_ID
    ? `&teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}`
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

  if (!process.env.VERCEL_TOKEN) {
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
    process.exit(1);
  }

  print(`\n${C.bold}Branch:${C.reset}  ${C.cyan}${gitInfo.branch}${C.reset}`);
  print(`${C.bold}Commit:${C.reset}  ${C.dim}${gitInfo.shortSha}${C.reset}`);

  const [ghState, vercelState] = await Promise.all([
    checkGitHub(gitInfo),
    checkVercel(gitInfo),
  ]);

  print("");
  if (ghState === "failure" || vercelState === "failure") {
    print(`${C.red}${C.bold}✗ Some checks failed.${C.reset} Review URLs above.`);
    process.exit(1);
  }
  if (ghState === "pending" || vercelState === "pending") {
    print(`${C.yellow}${C.bold}⟳ Some checks are still running.${C.reset}`);
    process.exit(2); // distinct code for "still running"
  }
  print(`${C.green}${C.bold}✓ All checks passed.${C.reset}`);
  process.exit(0);
}

async function runWatch() {
  const isWatch = process.argv.includes("--watch") || process.argv.includes("-w");
  if (!isWatch) {
    await runOnce();
    return;
  }

  print(`\n${C.dim}Polling every ${POLL_INTERVAL_MS / 1000}s. Press Ctrl+C to stop.${C.reset}\n`);

  while (true) {
    console.clear();
    try {
      await runOnce();
      const code = process.exitCode || 0;
      if (code === 0 || code === 1) break; // done (pass or fail)
    } catch {
      print(`${C.red}Unexpected error during check.${C.reset}`);
    }
    process.exitCode = undefined;
    print(`\n${C.dim}Waiting ${POLL_INTERVAL_MS / 1000}s...${C.reset}`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

runWatch();
