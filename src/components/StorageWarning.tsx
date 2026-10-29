"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { formatStorageSize } from "@/lib/storage-health";
import { useStorageHealth } from "@/lib/useStorageHealth";

const DISMISS_KEY = "skoolmate:storage-warning-dismissed";

/**
 * Warn while there is still room to act.
 *
 * A full phone does not fail gracefully: the browser evicts the offline copy,
 * and the next attendance register or fee payment is the one that disappears.
 * The warning names the real amount left and points at what is saved, so the
 * fix (freeing space, syncing) happens before a write is lost.
 */
export function StorageWarning() {
  const { health } = useStorageHealth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;
  if (health.level !== "low" && health.level !== "critical") return null;

  const critical = health.level === "critical";
  const free = health.free === null ? "very little" : formatStorageSize(health.free);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode: the banner simply returns on the next page.
    }
  };

  return (
    <div
      role={critical ? "alert" : "status"}
      aria-live={critical ? "assertive" : "polite"}
      className={[
        "flex items-start gap-2.5 border-b px-3 py-2 text-[12px] leading-snug sm:px-6",
        critical
          ? "border-[var(--error)] bg-[var(--red-soft)] text-[var(--red-ink)]"
          : "border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--t2)]",
      ].join(" ")}
    >
      <MaterialIcon icon={critical ? "error" : "warning"} size={17} className="mt-px shrink-0" />
      <p className="flex-1">
        <span className="font-semibold">
          {critical ? "Phone storage is almost full" : "Phone storage is running low"}
        </span>{" "}
        — only {free} left. Changes saved on this phone are safe, but new downloads and photos may fail. Free space in
        your phone&apos;s settings, or{" "}
        <Link href="/dashboard/sync-center/" className="underline underline-offset-2">
          see what is saved
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss storage warning"
        className="shrink-0 rounded p-0.5 hover:bg-black/5"
      >
        <MaterialIcon icon="close" size={15} />
      </button>
    </div>
  );
}
