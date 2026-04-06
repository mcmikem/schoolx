"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { offlineDB } from "@/lib/offline";
import MaterialIcon from "@/components/MaterialIcon";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const [swUpdateReady, setSwUpdateReady] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  const syncData = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const pending = await offlineDB.getPendingSync();
      if (pending.length > 0) {
        const result = await offlineDB.syncToServer("/api/sync");
        if (result.success > 0) {
          setPendingSync(0);
          await offlineDB.refreshAll([
            "students",
            "classes",
            "subjects",
            "attendance",
            "grades",
            "fee_payments",
            "fee_structure",
            "fee_adjustments",
            "messages",
          ]);
        }
      } else {
        await offlineDB.refreshAll([
          "students",
          "classes",
          "subjects",
          "attendance",
          "grades",
          "fee_payments",
          "fee_structure",
          "fee_adjustments",
          "messages",
        ]);
      }
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
        setShowInstall(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
      setShowInstall(false);
    };

    const handleSwUpdate = () => {
      setSwUpdateReady(true);
    };

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowInstall(true);
    };

    const checkPending = async () => {
      try {
        const pending = await offlineDB.getPendingSync();
        setPendingSync(pending.length);
        if (pending.length > 0) setShowIndicator(true);
      } catch {
        // Ignore errors
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 10000);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("sw-update-available", handleSwUpdate);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    setIsOnline(navigator.onLine);
    if (!navigator.onLine) setShowIndicator(true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("sw-update-available", handleSwUpdate);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      clearInterval(interval);
    };
  }, [syncData]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstall(false);
    }
    setInstallPrompt(null);
  };

  const handleUpdate = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        }
      });
    }
  };

  if (
    !showIndicator &&
    isOnline &&
    pendingSync === 0 &&
    !swUpdateReady &&
    !showInstall
  )
    return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {swUpdateReady && (
        <div
          style={{
            padding: "10px 20px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            background: "var(--navy)",
            color: "#fff",
          }}
        >
          <MaterialIcon icon="refresh" style={{ fontSize: 18 }} />
          New version available
          <button
            onClick={handleUpdate}
            style={{
              background: "#fff",
              color: "var(--navy)",
              border: "none",
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              marginLeft: 4,
            }}
          >
            Update
          </button>
        </div>
      )}

      {showInstall && (
        <div
          style={{
            padding: "10px 20px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            background: "var(--navy)",
            color: "#fff",
          }}
        >
          <MaterialIcon icon="install_desktop" style={{ fontSize: 18 }} />
          Install ASSEMBLE app
          <button
            onClick={handleInstall}
            style={{
              background: "#fff",
              color: "var(--navy)",
              border: "none",
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              marginLeft: 4,
            }}
          >
            Install
          </button>
          <button
            onClick={() => setShowInstall(false)}
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Later
          </button>
        </div>
      )}

      {showIndicator && (syncing || !isOnline || pendingSync > 0) && (
        <div
          style={{
            padding: "10px 20px",
            borderRadius: 25,
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            background: isOnline ? "#22c55e" : "#ef4444",
            color: "#fff",
            animation: "fadeInUp 0.3s ease",
          }}
        >
          {syncing ? (
            <>
              <MaterialIcon
                icon="sync"
                style={{ animation: "spin 1s linear infinite", fontSize: 16 }}
              />
              Syncing {pendingSync} items...
            </>
          ) : !isOnline ? (
            <>
              <MaterialIcon icon="wifi_off" style={{ fontSize: 16 }} />
              Offline - Changes saved locally
              {pendingSync > 0 && (
                <span style={{ opacity: 0.9, fontWeight: 400 }}>
                  ({pendingSync} pending)
                </span>
              )}
            </>
          ) : pendingSync > 0 ? (
            <>
              <MaterialIcon icon="cloud_upload" style={{ fontSize: 16 }} />
              {pendingSync} changes syncing
            </>
          ) : null}
          {(pendingSync > 0 || !isOnline) && (
            <Link
              href="/dashboard/sync-center"
              style={{
                marginLeft: 6,
                background: "#fff",
                color: isOnline ? "#15803d" : "#b91c1c",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              View Queue
            </Link>
          )}
        </div>
      )}

      <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
    </div>
  );
}

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const pending = await offlineDB.getPendingSync();
        setPendingCount(pending.length);
      } catch {}
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
