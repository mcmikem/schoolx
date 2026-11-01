import { isLiteMode } from "@/lib/performance-mode";
import { runBackgroundWork } from "@/lib/background-work";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type Importer<P> = () => Promise<{ default: ComponentType<P> }>;

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
 * essential forms remain available offline; optional panels load on demand in Lite mode.
 */
export function lazyWithIdlePrefetch<P extends object>(
  importer: Importer<P>,
  options: { loading?: () => React.ReactNode; offlineEssential?: boolean } = {},
): ComponentType<P> {
  whenIdle(
    () => {
      if (isLiteMode() && !options.offlineEssential) return;
      void runBackgroundWork(importer).catch(() => {
        /* Offline or a failed chunk: the real render path retries and reports. */
      });
    },
    isLiteMode() ? 12000 : 4000,
  );

  return dynamic<P>(importer, { loading: options.loading ?? (() => null) }) as ComponentType<P>;
}
