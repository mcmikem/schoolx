"use client";

import { useCallback, useEffect, useState } from "react";
import MaterialIcon from "./MaterialIcon";
import { logger } from "@/lib/logger";

/**
 * App-wide "a new build is ready" control.
 *
 * The service worker update flow already existed but its prompt lived inside
 * OfflineIndicator, which only renders in the dashboard layout. That meant
 * parents on the parent portal, and anyone on a public page, could never see it
 * even when a new build was waiting. This component is mounted in the root
 * layout so the prompt is available on every screen.
 *
 * Applying an update needs a full document reload, not router.refresh():
 * refresh() re-fetches server data but keeps running the bundles the page
 * already loaded, which would leave the previous build in place.
 */
export function AppUpdatePrompt() {
  const [updateReady, setUpdateReady] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const announce = () => setUpdateReady(true);

    // A worker may already be waiting by the time this mounts (the app can open
    // after a deploy), so check rather than relying only on the event.
    const checkForWaiting = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.waiting) announce();
      } catch (err) {
        logger.warn("[SW] Could not read registration", err);
      }
    };

    void checkForWaiting();
    window.addEventListener("sw-update-available", announce);

    return () => window.removeEventListener("sw-update-available", announce);
  }, []);

  const applyUpdate = useCallback(() => {
    if (!("serviceWorker" in navigator)) return;
    setApplying(true);

    void navigator.serviceWorker.getRegistration().then((registration) => {
      const waiting = registration?.waiting;
      if (!waiting) {
        setApplying(false);
        setUpdateReady(false);
        return;
      }

      let reloaded = false;
      const reload = () => {
        if (reloaded) return;
        reloaded = true;
        navigator.serviceWorker.removeEventListener("controllerchange", reload);
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener("controllerchange", reload);
      waiting.postMessage({ type: "APPLY_UPDATE" });

      // Fallback if controllerchange never arrives, e.g. the worker was already
      // the active one.
      window.setTimeout(() => {
        if (!reloaded) reload();
      }, 2500);
    });
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 14px",
        borderRadius: 12,
        background: "var(--navy)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      <MaterialIcon icon="system_update_alt" style={{ fontSize: 18 }} />
      <span>New version available</span>
      <button
        type="button"
        onClick={applyUpdate}
        disabled={applying}
        style={{
          background: "#fff",
          color: "var(--navy)",
          border: "none",
          padding: "7px 14px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          cursor: applying ? "wait" : "pointer",
          opacity: applying ? 0.7 : 1,
          minHeight: 32,
        }}
      >
        {applying ? "Updating…" : "Update now"}
      </button>
    </div>
  );
}
