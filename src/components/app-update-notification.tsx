"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

/**
 * App Update Notification Component
 *
 * Shows users when a new version of the app is available.
 * Checks /api/app-version endpoint for version info.
 * Automatically dismisses when user refreshes.
 */
export function AppUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    try {
      const res = await fetch("/api/app-version/", {
        cache: "no-cache",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!res.ok) return;

      const data = await res.json();

      // Check for app version update
      if (data.new_version && data.new_version !== process.env.NEXT_PUBLIC_APP_VERSION) {
        setUpdateMessage(data.message || "New version available with improvements");
        setIsCritical(data.critical || false);
        setShowUpdate(true);
      }

      // Check for maintenance windows
      if (data.maintenance_window) {
        showMaintenanceWindow(data.maintenance_window);
      }
    } catch (err) {
      logger.warn("[AppUpdateNotification] Failed to check for updates:", err);
    }
  }

  function showMaintenanceWindow(window: { start: string; end: string; message: string }) {
    setUpdateMessage(window.message || "Scheduled maintenance");
    setIsCritical(true);
    setShowUpdate(true);
  }

  function handleRefresh() {
    window.location.reload();
  }

  if (!showUpdate) return null;

  const bannerClass = isCritical ? "bg-amber-100 border border-amber-400" : "bg-blue-100 border border-blue-400";
  const iconClass = isCritical ? "text-amber-600" : "text-blue-600";
  const buttonClass = isCritical ? "text-amber-600" : "text-blue-600";

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${bannerClass} p-4 rounded shadow-lg max-w-md`}>
      <div className="flex items-start gap-3">
        <span className={iconClass}>ℹ️</span>
        <div>
          <p className="font-semibold text-gray-800">{isCritical ? "Important Update" : "App Update Available"}</p>
          <p className="text-sm text-gray-600">{updateMessage}</p>
          <button onClick={handleRefresh} className={`mt-2 text-sm underline ${buttonClass}`}>
            {isCritical ? "Refresh Now" : "Refresh Later"}
          </button>
          {!isCritical && (
            <button
              onClick={() => setShowUpdate(false)}
              className="mt-1 text-xs text-gray-500 underline hover:text-gray-700"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Check if app needs mandatory update (called on app load)
 */
export async function checkMandatoryUpdate(): Promise<boolean> {
  try {
    const res = await fetch("/api/app-version/", {
      cache: "no-cache",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!res.ok) return false;

    const data = await res.json();
    const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0";

    return Boolean(data.min_required_version && parseInt(data.min_required_version) > parseInt(currentVersion));
  } catch {
    return false;
  }
}
