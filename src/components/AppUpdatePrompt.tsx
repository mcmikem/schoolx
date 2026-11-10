"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { askOwly } from "@/lib/owly-bus";

/**
 * App-wide "a new build is ready" control.
 *
 * The service worker update flow already existed but its prompt lived inside
 * the dashboard-only offline overlay. That meant parents on the parent portal,
 * and anyone on a public page, could never see it even when a new build was
 * waiting. This component is mounted in the root layout so the prompt is
 * available on every screen.
 *
 * Applying an update needs a full document reload, not router.refresh():
 * refresh() re-fetches server data but keeps running the bundles the page
 * already loaded, which would leave the previous build in place.
 */
export function AppUpdatePrompt() {
  const [updateReady, setUpdateReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const applyUpdateRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const announce = () => {
      setUpdateReady(true);
      askOwly({
        kind: "notify",
        title: "A SkoolMate update is ready",
        detail: "Update now to get the latest improvements. Your current page will reopen after the update.",
        severity: "info",
        actionLabel: "Update now",
        onAction: () => applyUpdateRef.current(),
      });
    };

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

  useEffect(() => {
    applyUpdateRef.current = applyUpdate;
  }, [applyUpdate]);

  if (!updateReady) return null;

  return null;
}
