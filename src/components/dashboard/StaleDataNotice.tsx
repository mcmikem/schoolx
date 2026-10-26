"use client";
import { useMemo } from "react";
import { useSyncStatus } from "@/lib/useSyncStatus";

const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

/**
 * Offline answers "is what I'm looking at still true?".
 *
 * When the device is offline and the cache behind this screen is at least half
 * a day old, say so next to the data instead of letting stale rows pose as
 * current ones. Online, or fresh, it renders nothing — the banner exists only
 * for the state where the user cannot check for themselves.
 */
export function StaleDataNotice({ tables }: { tables: string | string[] }) {
  const { isOnline, lastSyncedPerTable } = useSyncStatus();

  const shown = useMemo(() => {
    if (isOnline) return null;
    const list = Array.isArray(tables) ? tables : [tables];
    const timestamps = list.map((table) => lastSyncedPerTable[table]).filter(Boolean) as Date[];
    if (timestamps.length === 0) return null;
    const newest = new Date(Math.max(...timestamps.map((t) => t.getTime())));
    if (Date.now() - newest.getTime() < STALE_AFTER_MS) return null;
    return newest.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [isOnline, lastSyncedPerTable, tables]);

  if (!shown) return null;
  return (
    <p
      role="status"
      className="text-[11px] font-medium text-[var(--amber-ink)]"
      title="You are offline — this screen shows the last data saved on this phone."
    >
      Offline · showing data saved {shown}
    </p>
  );
}
