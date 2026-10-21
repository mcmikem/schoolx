"use client";
import { useEffect, useState } from "react";
import { logger } from "./logger";
import { offlineDB, SYNC_QUEUE_EVENT } from "./offline";

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSynced: Date | null;
  lastSyncedPerTable: Record<string, Date>;
  isFromCache: boolean;
  syncErrors: string[];
}

/**
 * One sync state for the whole app.
 *
 * The sync picture used to be drawn three times over: `useSyncStatus` in the
 * sidebar, the floating `OfflineIndicator` over the page, and a private
 * `navigator.onLine` listener in the top bar. Each kept its own copy, each
 * polled IndexedDB on its own timer, and they disagreed -- a teacher could be
 * told "All synced" in one place while a number floated over the page saying
 * three records were still waiting.
 *
 * It is a module-level store now: one poller, one queue length, and every
 * consumer reads the same numbers. The count also updates the moment a write
 * is queued instead of waiting for the next poll, because the queue announces
 * itself with `skoolmate:sync-queue-changed`.
 */
const INITIAL_STATE: SyncStatus = {
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  lastSynced: null,
  lastSyncedPerTable: {},
  isFromCache: false,
  syncErrors: [],
};

let state: SyncStatus = INITIAL_STATE;
const listeners = new Set<(next: SyncStatus) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

function emit(patch: Partial<SyncStatus>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

async function readPending() {
  try {
    const pending = await offlineDB.getPendingSync();
    const allSynced = await offlineDB.getAllLastSynced();

    const perTable: Record<string, Date> = {};
    for (const [table, ts] of Object.entries(allSynced)) {
      perTable[table] = new Date(ts);
    }

    // Global last synced = most recent table sync
    const timestamps = Object.values(allSynced);
    const latestGlobal = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;

    emit({ pendingCount: pending.length, lastSynced: latestGlobal, lastSyncedPerTable: perTable });
  } catch (e) {
    logger.error("Error checking pending:", e);
  }
}

async function syncNow() {
  if (!state.isOnline || state.isSyncing) return;

  emit({ isSyncing: true, syncErrors: [] });
  try {
    const result = await offlineDB.syncToServer();
    await readPending();
    emit({
      isSyncing: false,
      lastSynced: result.failed === 0 ? new Date() : state.lastSynced,
      syncErrors: result.errors,
    });
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    emit({ isSyncing: false, syncErrors: [...state.syncErrors, msg] });
    throw e;
  }
}

async function refreshAll(tables?: string[]) {
  const tablesToSync = tables || [
    "students",
    "classes",
    "subjects",
    "attendance",
    "grades",
    "fee_payments",
    "fee_structure",
    "messages",
    "events",
    "canteen_sales",
  ];

  emit({ isSyncing: true, syncErrors: [] });
  try {
    const result = await offlineDB.refreshAll(tablesToSync);
    await readPending();
    emit({ isSyncing: false, lastSynced: new Date(), syncErrors: result.errors });
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    emit({ isSyncing: false, syncErrors: [...state.syncErrors, msg] });
    throw e;
  }
}

function setIsFromCache(value: boolean) {
  emit({ isFromCache: value });
}

/**
 * Start the single poller and the browser listeners. Safe to call twice: the
 * second call is a no-op, which is what lets several components mount the
 * store without multiplying the timers.
 */
function start() {
  if (started) return;
  if (typeof window === "undefined") return;
  started = true;

  const handleOnline = () => {
    emit({ isOnline: true });
    // The connection is back, so push the queue instead of waiting for the
    // next poll. This is the moment a teacher is actually waiting on.
    void syncNow().catch(() => {});
  };
  const handleOffline = () => emit({ isOnline: false });
  const handleQueueChanged = () => void readPending();
  const handleServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data?.type === "SYNC_REQUESTED") void syncNow().catch(() => {});
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  window.addEventListener(SYNC_QUEUE_EVENT, handleQueueChanged);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
  }

  emit({ isOnline: navigator.onLine });
  void (async () => {
    await readPending();
    // Work left over from a session that ended offline goes up as soon as the
    // app opens again, rather than waiting for the teacher to notice it.
    if (state.isOnline && state.pendingCount > 0) await syncNow().catch(() => {});
  })();

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => void readPending(), 30000);
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(state);

  useEffect(() => {
    start();
    listeners.add(setStatus);
    // A mount that happens after the queue was read still gets fresh numbers.
    setStatus(state);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  return {
    ...status,
    syncNow,
    checkPending: readPending,
    refreshAll,
    setIsFromCache,
  };
}
