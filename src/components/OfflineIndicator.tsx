"use client";
import { memo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { offlineDB } from "@/lib/offline";
import MaterialIcon from "@/components/MaterialIcon";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/app-name";

export const OfflineIndicator = memo(function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  // Install prompt handled by PWAInstallPrompt component

  const syncData = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const pending = await offlineDB.getPendingSync();
      if (pending.length > 0) {
        await offlineDB.syncToServer("/api/sync");
      }
      const remaining = await offlineDB.getPendingSync();
      setPendingSync(remaining.length);
    } catch {
      // Sync will retry on next online event
    }
    setSyncing(false);
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setShowIndicator(true);
      await syncData();
      setTimeout(() => {
        setShowIndicator(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    const checkPending = async () => {
      try {
        const online = navigator.onLine;
        setIsOnline(online);
        const pending = await offlineDB.getPendingSync();
        setPendingSync(pending.length);
        if (pending.length > 0) setShowIndicator(true);
      } catch {
        // Ignore errors
      }
    };

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_REQUESTED") {
        syncData();
      }
    };

    void checkPending().then(() => {
      if (navigator.onLine) void syncData();
    });
    const interval = setInterval(checkPending, 30000);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
    }

    setIsOnline(navigator.onLine);
    if (!navigator.onLine) setShowIndicator(true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      }
      clearInterval(interval);
    };
  }, [syncData]);

  if (!showIndicator && isOnline && pendingSync === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        // Top-right, icon-only, and silent when there is nothing to say.
        //
        // This was a sentence in a coloured pill floating over the middle of
        // the phone: "Offline - Changes saved locally (3 pending)". A teacher
        // mid-register does not need to read that to know whether their work
        // is safe -- they need one glance that costs nothing, and then to get
        // on with marking. So: nothing at all when online and synced, a small
        // count when changes are waiting, a small icon when offline. The
        // words are one tap away on the sync centre for anyone who wants them.
        position: "fixed",
        top: "calc(var(--topbar-height, 56px) + 8px)",
        right: "max(16px, env(safe-area-inset-right, 0px))",
        zIndex: "var(--z-toast, 3000)",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      {showIndicator && (syncing || !isOnline || pendingSync > 0) && (
        <Link
          href="/dashboard/sync-center"
          aria-label={
            syncing
              ? `Syncing ${pendingSync} saved changes`
              : isOnline
                ? `${pendingSync} changes waiting to sync. Tap for details.`
                : `Offline. ${pendingSync} changes saved on this device. Tap for details.`
          }
          title={isOnline ? `${pendingSync} changes syncing` : "Offline — your work is saved on this device"}
          style={{
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 34,
            padding: "0 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "var(--sh2, 0 4px 12px rgba(0,0,0,0.12))",
            background: isOnline ? "var(--amber-soft, #fef3c7)" : "var(--red-soft, #fee2e2)",
            color: isOnline ? "var(--amber-ink, #92400e)" : "var(--red-ink, #991b1b)",
            border: `1px solid ${isOnline ? "var(--amber, #f59e0b)" : "var(--red, #f04444)"}`,
          }}
        >
          {syncing ? (
            <MaterialIcon icon="sync" style={{ animation: "spin 1s linear infinite", fontSize: 15 }} />
          ) : isOnline ? (
            <MaterialIcon icon="cloud_upload" style={{ fontSize: 15 }} />
          ) : (
            <MaterialIcon icon="cloud_off" style={{ fontSize: 15 }} />
          )}
          {/* The number is the message. "3" beats "3 changes syncing" when the
              teacher's thumb is already on the next pupil. */}
          {pendingSync > 0 ? <span aria-hidden="true">{pendingSync}</span> : <span aria-hidden="true">Saved</span>}
        </Link>
      )}

      <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
    </div>
  );
});

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const pending = await offlineDB.getPendingSync();
        setPendingCount(pending.length);
      } catch (err) {
        logger.error("Failed to check pending sync:", err);
      }
    };

    check();
    const interval = setInterval(check, 5000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const sync = async () => {
    if (!navigator.onLine) return { success: 0, failed: 0 };
    return await offlineDB.syncToServer("/api/sync");
  };

  return { pendingCount, isOnline, sync };
}
