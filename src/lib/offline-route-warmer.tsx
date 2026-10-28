"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { useOnlineStatus } from "@/lib/offline";
import { safeLocalStorage } from "@/lib/safe-storage";

// v2 invalidates old records: v1 marked a route complete before the service
// worker confirmed that it had actually cached the document.
const DONE_KEY = "skoolmate_offline_routes_done_v2";
const START_DELAY_MS = 8_000;
const BATCH_DELAY_MS = 250;
const BATCH_DELAY_SLOW_MS = 1_000;
const ROUTE_CACHE_TIMEOUT_MS = 15_000;

const PRIORITY_ROUTES = [
  "/dashboard/",
  "/dashboard/attendance/",
  "/dashboard/grades/",
  "/dashboard/fees/",
  "/dashboard/fee-structure/",
  "/dashboard/money/",
  "/dashboard/students/",
  "/dashboard/messages/",
  "/dashboard/report-cards/",
  "/dashboard/cashbook/",
  "/dashboard/fee-ledger/",
  "/dashboard/sync-center/",
];

interface OfflineRouteManifest {
  version: string;
  routes: string[];
}

interface DoneRecord {
  version: string;
  routes: string[];
}

function readDone(version: string): Set<string> {
  try {
    const raw = safeLocalStorage.getItem(DONE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as DoneRecord;
    if (parsed.version !== version || !Array.isArray(parsed.routes)) return new Set();
    return new Set(parsed.routes);
  } catch {
    return new Set();
  }
}

function writeDone(version: string, done: Set<string>) {
  try {
    safeLocalStorage.setItem(DONE_KEY, JSON.stringify({ version, routes: Array.from(done) }));
  } catch {
    // Storage full or private mode: the warmer will simply try again next time.
  }
}

function routesForRole(routes: string[], role: string | undefined): string[] {
  let allowed: string[];
  if (role === "parent") return routes.filter((route) => route.startsWith("/parent-portal/"));
  if (role === "student") return routes.filter((route) => route.startsWith("/student-portal/"));
  if (role === "super_admin") return routes.filter((route) => route.startsWith("/super-admin/"));
  allowed = routes.filter((route) => route.startsWith("/dashboard/") || route === "/onboarding/");
  const priority = PRIORITY_ROUTES.filter((route) => allowed.includes(route));
  return [...priority, ...allowed.filter((route) => !priority.includes(route))];
}

function isSlowConnection(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  if (connection?.saveData) return true;
  return ["slow-2g", "2g", "3g"].includes(connection?.effectiveType || "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheRouteWithWorker(worker: ServiceWorker, route: string): Promise<boolean> {
  if (typeof MessageChannel === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, ROUTE_CACHE_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent<{ type?: string; route?: string; cached?: boolean }>) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data?.type === "WARM_ROUTE_RESULT" && event.data.route === route && event.data.cached === true);
    };
    try {
      worker.postMessage({ type: "WARM_ROUTE", url: route }, [channel.port2]);
    } catch {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(false);
    }
  });
}

/**
 * Download every page the signed-in role can open, in the background.
 *
 * The service worker can keep a page offline only if the browser has seen its
 * document and chunks. The app already caches pages as they are visited; this
 * fills the gaps for pages the user has not opened yet, so a sudden loss of
 * signal does not leave a menu item pointing at a page that was never saved.
 *
 * It is deliberately quiet and resumable: it waits for idle time, downloads a
 * few routes at a time, remembers what finished, and stops immediately when
 * the connection disappears. Online-only screens are still downloaded; they
 * open with their "needs internet" label rather than a dead link.
 */
export function OfflineRouteWarmer() {
  const router = useRouter();
  const { user, authInitialized } = useAuth();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!authInitialized || !user || !isOnline) return;
    if (typeof navigator === "undefined") return;
    // The worker is deliberately unregistered in `next dev`, so there is no
    // offline shell to fill there and prefetching 100+ routes would only slow
    // the dev server.
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;
    let idleHandle: number | undefined;
    let timerHandle: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (cancelled || !navigator.onLine) return;
      if (typeof navigator.storage?.persist === "function") {
        try {
          await navigator.storage.persist();
        } catch {
          // Persistence is a request, not a requirement.
        }
      }

      let manifest: OfflineRouteManifest | null = null;
      try {
        const response = await fetch("/offline-routes.json", { cache: "no-store" });
        if (!response.ok) return;
        manifest = (await response.json()) as OfflineRouteManifest;
      } catch {
        return;
      }
      if (cancelled || !manifest?.routes?.length) return;

      const roleRoutes = routesForRole(manifest.routes, user.role);
      const slow = isSlowConnection();
      // On Data Saver / weak mobile data, prepare the pages teachers and
      // bursars need first. Leave the rest pending for a better connection.
      const routes = slow ? PRIORITY_ROUTES.filter((route) => roleRoutes.includes(route)) : roleRoutes;
      const done = readDone(manifest.version);
      const pending = routes.filter((route) => !done.has(route));
      if (pending.length === 0) return;

      const wait = slow ? BATCH_DELAY_SLOW_MS : BATCH_DELAY_MS;

      let controller: ServiceWorker | null = null;
      if ("serviceWorker" in navigator) {
        try {
          const registration = await Promise.race([navigator.serviceWorker.ready, delay(3_000).then(() => null)]);
          controller = navigator.serviceWorker.controller || registration?.active || null;
        } catch {
          controller = null;
        }
      }

      for (const route of pending) {
        if (cancelled || !navigator.onLine) break;
        try {
          // Let Next prepare the route's RSC payload and code, then wait for
          // the service worker to confirm that the HTML document was cached.
          // A failed/redirected fetch stays pending for the next online pass.
          await router.prefetch(route);
          const cached = controller ? await cacheRouteWithWorker(controller, route) : false;
          if (cached) {
            done.add(route);
            writeDone(manifest.version, done);
          } else {
            logger.debug("[offline] route was not confirmed in page cache; will retry", route);
          }
        } catch (error) {
          logger.debug("[offline] could not prefetch route", route, error);
        }
        await delay(wait);
      }
    };

    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => void run(), { timeout: 20_000 });
      } else {
        timerHandle = setTimeout(() => void run(), START_DELAY_MS);
      }
    };

    schedule();

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) window.cancelIdleCallback?.(idleHandle);
      if (timerHandle) clearTimeout(timerHandle);
    };
  }, [authInitialized, user, isOnline, router]);

  return null;
}
