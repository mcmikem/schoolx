"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { onlineOnlySummary } from "@/lib/offline-features";
import { useSyncStatus } from "@/lib/useSyncStatus";

declare global {
  interface Window {
    __SKOOLMATE_OFFLINE_FALLBACK__?: string;
  }
}

/**
 * The one honest sentence about what offline means right now.
 *
 * The service worker can keep every page reachable, but it cannot make a
 * payment provider or an SMS gateway answer. This banner separates the two:
 * what is saved and safe on the device, and the few actions that still need a
 * connection. It is rendered inside the app shell so a user is never left
 * guessing why a button did nothing.
 */
export function OfflineModeBanner() {
  const pathname = usePathname() || "";
  const { isOnline, pendingCount } = useSyncStatus();
  const [fallbackFrom, setFallbackFrom] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const injected = window.__SKOOLMATE_OFFLINE_FALLBACK__;
    if (injected) {
      setFallbackFrom(injected);
      delete window.__SKOOLMATE_OFFLINE_FALLBACK__;
    }

    const readHash = () => {
      if (window.location.hash.startsWith("#offline-fallback=")) {
        setFallbackFrom(decodeURIComponent(window.location.hash.slice("#offline-fallback=".length)));
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const featureMessage = onlineOnlySummary(pathname);
  if (isOnline && !fallbackFrom) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-2.5 border-b border-[var(--amber)] bg-[var(--amber-soft)] px-3 py-2 text-[12px] leading-snug text-[var(--t2)] sm:px-6"
    >
      <MaterialIcon
        icon={isOnline ? "info" : "cloud_off"}
        size={17}
        className="mt-0.5 shrink-0 text-[var(--amber-ink)]"
      />
      <div className="min-w-0 flex-1">
        {!isOnline && (
          <p className="font-semibold text-[var(--t1)]">
            Offline mode — using data saved on this device.
            {pendingCount > 0 ? ` ${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync.` : ""}
          </p>
        )}
        {fallbackFrom && (
          <p>
            That page was not saved for offline use, so the closest saved page is shown instead.
            {!isOnline ? " Reconnect once to download it." : ""}
          </p>
        )}
        {featureMessage && <p className={!isOnline ? "mt-0.5" : "font-semibold text-[var(--t1)]"}>{featureMessage}</p>}
        {!isOnline && (
          <p className="mt-0.5 text-[11px] text-[var(--t3)]">
            Registers, marks, fees and other supported work are saved here and sent automatically when the connection
            returns.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard/sync-center"
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
        >
          Sync
        </Link>
        <a
          href="/offline.html"
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
        >
          Saved pages
        </a>
      </div>
    </div>
  );
}
