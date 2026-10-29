"use client";

import { useCallback, useEffect, useState } from "react";
import { assessStorageHealth, type StorageHealth } from "@/lib/storage-health";

const UNKNOWN: StorageHealth = {
  supported: true,
  persisted: null,
  usage: null,
  quota: null,
  free: null,
  usedPercent: null,
  level: "unknown",
};

const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

/**
 * Reads the origin's storage estimate and whether the browser promised to keep
 * it. `persisted()` is the difference between "safe until the phone needs
 * room" and "safe until the user clears site data", so both are reported.
 */
export function useStorageHealth(refreshMs: number = DEFAULT_REFRESH_MS) {
  const [health, setHealth] = useState<StorageHealth>(UNKNOWN);

  const refresh = useCallback(async () => {
    if (typeof navigator === "undefined" || typeof navigator.storage?.estimate !== "function") {
      setHealth(assessStorageHealth({ supported: false }));
      return;
    }

    try {
      const [estimate, persisted] = await Promise.all([
        navigator.storage.estimate(),
        typeof navigator.storage.persisted === "function"
          ? navigator.storage.persisted().catch(() => null)
          : Promise.resolve(null),
      ]);

      setHealth(
        assessStorageHealth({
          usage: estimate.usage ?? null,
          quota: estimate.quota ?? null,
          persisted,
        }),
      );
    } catch {
      setHealth(assessStorageHealth({ supported: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, refreshMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, refreshMs]);

  return { health, refresh };
}
