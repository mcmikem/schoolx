#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const timeoutMs = Number(process.env.ROUTE_TIMEOUT_MS || 15000);
const routes = [
  "/",
  "/login/",
  "/register/",
  "/dashboard/",
  "/parent-portal/",
  "/dashboard/analytics/dna/",
  "/dashboard/students/",
  "/dashboard/staff/",
  "/dashboard/grades/",
  "/dashboard/system-health/",
];

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

async function checkRoute(route) {
  const { controller, timer } = withTimeout(timeoutMs);
  const url = `${baseUrl}${route}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": "route-health-check/1.0",
      },
    });

    clearTimeout(timer);

    return {
      route,
      status: response.status,
      ok: response.status >= 200 && response.status < 400,
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      route,
      status: "ERR",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const checks = await Promise.all(routes.map(checkRoute));
  const failed = checks.filter((item) => !item.ok);

  console.log(`Route health check against ${baseUrl}`);
  for (const item of checks) {
    const suffix = item.error ? ` (${item.error})` : "";
    console.log(`${item.route} -> ${item.status}${suffix}`);
  }

  if (failed.length > 0) {
    console.error(`\nFailed routes: ${failed.length}/${checks.length}`);
    process.exit(1);
  }

  console.log(`\nAll routes healthy: ${checks.length}/${checks.length}`);
}

main().catch((error) => {
  console.error("Route health check crashed:", error);
  process.exit(1);
});
