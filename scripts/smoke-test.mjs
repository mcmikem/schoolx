#!/usr/bin/env node
import process from "node:process";

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

const BASE_URL = (readArg("--base-url") || process.env.BASE_URL || "https://skoolmate.omuto.org").replace(/\/$/, "");
const WAIT_FOR_SHA = readArg("--wait-for-sha", "");
const WAIT_TIMEOUT_SECONDS = Number(readArg("--timeout", "600"));
const JSON_OUTPUT = args.includes("--json");
const PUBLIC_ONLY = args.includes("--public-only");
const PHONE = process.env.SMOKE_PHONE || "";
const PASSWORD = process.env.SMOKE_PASSWORD || "";
const CRON_SECRET = process.env.SMOKE_CRON_SECRET || "";

const REQUEST_TIMEOUT_MS = 15_000;

async function request(path, options = {}) {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    redirect: "follow",
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  return { res, text, ms: Date.now() - started };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const results = [];

function pass(name, detail, ms) {
  results.push({ name, ok: true, skipped: false, detail, ms });
}

function fail(name, detail, ms) {
  results.push({ name, ok: false, skipped: false, detail, ms });
}

function skip(name, detail) {
  results.push({ name, ok: true, skipped: true, detail, ms: 0 });
}

async function waitForDeploy(sha) {
  const short = sha.slice(0, 12);
  const deadline = Date.now() + WAIT_TIMEOUT_SECONDS * 1000;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const { res, text } = await request(`/sw.js?wait=${Date.now()}`);
      last = res.ok ? (text.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null) : null;
      if (last?.includes(short)) {
        console.error(`[smoke] deployment ${short} is live (${last})`);
        return last;
      }
      console.error(`[smoke] waiting for ${short}; live is ${last ?? "unknown"}`);
    } catch (error) {
      console.error(`[smoke] waiting for ${short}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  return last;
}

function printJson() {
  process.stdout.write(
    `${JSON.stringify(
      {
        baseUrl: BASE_URL,
        checkedAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    )}\n`,
  );
}

function printTable() {
  for (const result of results) {
    const icon = result.skipped ? "-" : result.ok ? "PASS" : "FAIL";
    const ms = result.ms ? ` (${result.ms}ms)` : "";
    console.log(`${icon.padEnd(4)} ${result.name.padEnd(14)} ${result.detail}${ms}`);
  }
  const failed = results.filter((result) => !result.ok && !result.skipped);
  const skipped = results.filter((result) => result.skipped);
  console.log("");
  console.log(
    `${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`,
  );
}

async function main() {
  console.error(`[smoke] target ${BASE_URL}`);

  if (WAIT_FOR_SHA) {
    const live = await waitForDeploy(WAIT_FOR_SHA);
    if (live?.includes(WAIT_FOR_SHA.slice(0, 12))) {
      pass("deploy", `serving ${live}`, 0);
    } else {
      fail("deploy", `expected ${WAIT_FOR_SHA.slice(0, 12)}, live is ${live ?? "unknown"}`, 0);
    }
  }

  try {
    const { res, text, ms } = await request(`/api/health/?smoke=${Date.now()}`);
    const body = parseJson(text);
    if (res.ok && body?.status === "ok") pass("health", `status=${body.status}`, ms);
    else fail("health", `HTTP ${res.status}`, ms);
  } catch (error) {
    fail("health", error instanceof Error ? error.message : String(error), 0);
  }

  try {
    const { res, text, ms } = await request("/login/");
    const hasForm = /id=["']identifier["']/.test(text) && /id=["']password["']/.test(text);
    if (res.ok && hasForm) pass("login-page", "form present", ms);
    else fail("login-page", `HTTP ${res.status}${hasForm ? "" : " form missing"}`, ms);
  } catch (error) {
    fail("login-page", error instanceof Error ? error.message : String(error), 0);
  }

  let serviceWorkerVersion = null;
  try {
    const { res, text, ms } = await request(`/sw.js?smoke=${Date.now()}`);
    serviceWorkerVersion = res.ok ? (text.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null) : null;
    if (serviceWorkerVersion) pass("service-worker", serviceWorkerVersion, ms);
    else fail("service-worker", `HTTP ${res.status} or version missing`, ms);
  } catch (error) {
    fail("service-worker", error instanceof Error ? error.message : String(error), 0);
  }

  if (CRON_SECRET) {
    try {
      const { res, text, ms } = await request("/api/health/", {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      const body = parseJson(text);
      const db = body?.database;
      if (res.ok && db?.read === "ok" && db?.write === "ok") pass("database", "read + write", ms);
      else fail("database", `HTTP ${res.status} read=${db?.read ?? "?"} write=${db?.write ?? "?"}`, ms);
    } catch (error) {
      fail("database", error instanceof Error ? error.message : String(error), 0);
    }
  } else {
    skip("database", "SMOKE_CRON_SECRET not set");
  }

  if (PUBLIC_ONLY || !PHONE || !PASSWORD) {
    skip("sign-in", PUBLIC_ONLY ? "--public-only" : "SMOKE_PHONE/SMOKE_PASSWORD not set");
    skip("profile", "requires sign-in");
  } else {
    let token = null;
    try {
      const { res, text, ms } = await request("/api/auth/signin/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: PHONE, password: PASSWORD }),
      });
      const body = parseJson(text);
      token = body?.data?.access_token ?? null;
      if (res.ok && body?.success === true && token) {
        pass("sign-in", `role=${body.data.role ?? "?"}`, ms);
      } else {
        fail("sign-in", `HTTP ${res.status} ${body?.error ?? "no token"}`, ms);
      }
    } catch (error) {
      fail("sign-in", error instanceof Error ? error.message : String(error), 0);
    }

    if (token) {
      try {
        const { res, text, ms } = await request("/api/auth/me/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = parseJson(text);
        if (res.ok && body?.user?.id) pass("profile", `user=${body.user.id.slice(0, 8)}`, ms);
        else fail("profile", `HTTP ${res.status}`, ms);
      } catch (error) {
        fail("profile", error instanceof Error ? error.message : String(error), 0);
      }
    } else {
      skip("profile", "no token from sign-in");
    }
  }

  if (JSON_OUTPUT) {
    printJson();
  } else {
    printTable();
    console.log(`build: ${serviceWorkerVersion ?? "unknown"}`);
  }

  const failed = results.filter((result) => !result.ok && !result.skipped);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
