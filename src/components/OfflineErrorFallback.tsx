"use client";

import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

/**
 * A page error while the radio is off is almost never a bug the user can fix.
 * Give them a way back into the saved app instead of "Something went wrong" and
 * a retry button that will fail the same way.
 */
export function OfflineErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--amber-soft)]">
        <MaterialIcon icon="cloud_off" size={28} className="text-[var(--amber-ink)]" />
      </div>
      <h2 className="mb-2 text-lg font-bold text-[var(--t1)]">This page is not ready offline</h2>
      <p className="mb-5 max-w-sm text-sm leading-relaxed text-[var(--t3)]">
        The page could not load from the copy saved on this device. Your saved data and pending changes are safe. Open a
        page that is already saved, or reconnect and try again.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/dashboard/"
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Go to dashboard
        </Link>
        <Link
          href="/dashboard/sync-center/"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--t1)]"
        >
          Sync center
        </Link>
        <a
          href="/offline.html"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--t1)]"
        >
          Saved pages
        </a>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--t1)]"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
