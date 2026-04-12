"use client";

import { useState, useEffect, useCallback } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useOnlineStatus } from "@/lib/offline";

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSynced: Date | null;
  conflicts: SyncConflict[];
  errors: string[];
}

interface SyncConflict {
  id: string;
  table: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  field: string;
}

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [status, setStatus] = useState<SyncStatus>({
    isOnline,
    isSyncing: false,
    pendingCount: 0,
    lastSynced: null,
    conflicts: [],
    errors: [],
  });

  const checkPending = useCallback(async () => {
    try {
      const { offlineDB } = await import("@/lib/offline");
      const pending = await offlineDB.getPendingSync();
      setStatus((prev) => ({ ...prev, pendingCount: pending.length }));
    } catch (e) {
      console.error("Failed to check pending sync", e);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline || status.isSyncing) return;

    setStatus((prev) => ({ ...prev, isSyncing: true, errors: [] }));

    try {
      const { offlineDB } = await import("@/lib/offline");
      const result = await offlineDB.syncToServer();

      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSynced: new Date(),
        pendingCount: prev.pendingCount - result.success,
        errors: result.errors,
      }));

      if (result.success > 0) {
        await checkPending();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        errors: [...prev.errors, msg],
      }));
    }
  }, [isOnline, status.isSyncing, checkPending]);

  useEffect(() => {
    setStatus((prev) => ({ ...prev, isOnline }));
  }, [isOnline]);

  useEffect(() => {
    checkPending();
    const interval = setInterval(checkPending, 30000);
    return () => clearInterval(interval);
  }, [checkPending]);

  return {
    ...status,
    syncNow,
    checkPending,
    hasPending: status.pendingCount > 0,
    hasErrors: status.errors.length > 0,
    hasConflicts: status.conflicts.length > 0,
  };
}

export function OfflineIndicator() {
  const sync = useOfflineSync();

  if (sync.isOnline) {
    if (sync.isSyncing) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span>Syncing...</span>
        </div>
      );
    }

    if (sync.hasPending) {
      return (
        <button
          onClick={sync.syncNow}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm hover:bg-amber-200 transition-colors"
        >
          <div className="w-2 h-2 bg-amber-500 rounded-full" />
          <span>{sync.pendingCount} pending</span>
          <MaterialIcon icon="sync" className="text-sm" />
        </button>
      );
    }

    if (sync.lastSynced) {
      const timeAgo = Date.now() - sync.lastSynced.getTime();
      const minutes = Math.floor(timeAgo / 60000);
      const timeText =
        minutes < 1
          ? "Just now"
          : minutes < 60
            ? `${minutes}m ago`
            : `${Math.floor(minutes / 60)}h ago`;

      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm">
          <MaterialIcon icon="cloud_done" className="text-sm" />
          <span>{timeText}</span>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm">
      <MaterialIcon icon="cloud_off" className="text-sm" />
      <span>Offline</span>
    </div>
  );
}

export function SyncStatusPanel() {
  const sync = useOfflineSync();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sync.hasPending && !sync.hasErrors && sync.isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-6 z-40">
      {isExpanded ? (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-72 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="font-medium text-gray-900">Sync Status</span>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <MaterialIcon icon="close" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {sync.isOnline ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Pending changes</span>
                  <span className="font-semibold text-gray-900">
                    {sync.pendingCount}
                  </span>
                </div>

                {sync.lastSynced && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Last synced</span>
                    <span className="text-gray-900 text-sm">
                      {sync.lastSynced.toLocaleTimeString()}
                    </span>
                  </div>
                )}

                {sync.hasPending && (
                  <button
                    onClick={sync.syncNow}
                    disabled={sync.isSyncing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <MaterialIcon
                      icon={sync.isSyncing ? "sync" : "sync_alt"}
                      className={sync.isSyncing ? "animate-spin" : ""}
                    />
                    {sync.isSyncing ? "Syncing..." : "Sync Now"}
                  </button>
                )}

                {sync.errors.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg">
                    <div className="text-sm font-medium text-red-800 mb-1">
                      Sync Errors
                    </div>
                    {sync.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-600">
                        {err}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <MaterialIcon
                  icon="cloud_off"
                  className="text-4xl text-gray-400 mx-auto mb-2"
                />
                <p className="text-gray-600 text-sm">You&apos;re offline</p>
                <p className="text-gray-500 text-xs mt-1">
                  Changes will sync when you reconnect
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-colors ${
            sync.isOnline
              ? sync.hasPending
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-gray-500 text-white hover:bg-gray-600"
          }`}
        >
          {sync.isOnline ? (
            <>
              {sync.hasPending ? (
                <>
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span>{sync.pendingCount}</span>
                </>
              ) : (
                <MaterialIcon icon="cloud_done" />
              )}
            </>
          ) : (
            <>
              <MaterialIcon icon="cloud_off" />
              <span>Offline</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default useOfflineSync;
