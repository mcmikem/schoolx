import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type Importer<P> = () => Promise<{ default: ComponentType<P> }>;

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

function isSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!conn) return false;
  return Boolean(conn.saveData) || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g";
}

function whenIdle(task: () => void, delayMs: number): void {
  if (typeof window === "undefined") return;
  const run = () => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback;
    if (typeof ric === "function") ric(task, { timeout: 5000 });
    else setTimeout(task, 0);
  };
  setTimeout(run, delayMs);
}

/**
 * Code-split a component out of the page's first-load bundle, then quietly
 * download the chunk once the browser is idle.
 *
 * Why not plain next/dynamic: a chunk that is only fetched on first use is not in
 * the service worker cache, so a bursar who opened Fees online and later loses
 * signal could not open the payment form. Warming the chunk in idle time keeps
 * the first load small (less to download and parse on an old phone) and still
 * leaves the component available offline.
 *
 * On a slow or Save-Data connection the warm-up is delayed, not skipped, so it
 * never competes with the data the screen actually needs.
 */
export function lazyWithIdlePrefetch<P extends object>(
  importer: Importer<P>,
  options: { loading?: () => React.ReactNode } = {},
): ComponentType<P> {
  whenIdle(
    () => {
      importer().catch(() => {
        /* Offline or a failed chunk: the real render path retries and reports. */
      });
    },
    isSlowConnection() ? 8000 : 1500,
  );

  return dynamic<P>(importer, { loading: options.loading ?? (() => null) }) as ComponentType<P>;
}
