"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useOnlineStatus } from "@/lib/offline";
import {
  preparationKey,
  readPreparation,
  PREPARATION_EVENT,
  PREPARE_EVENT,
  type Preparation,
} from "@/lib/offline-preparation";

export function OfflinePreparation() {
  const { user, school, isDemo } = useAuth();
  const online = useOnlineStatus();
  const [progress, setProgress] = useState<Preparation | null>(null);
  const key = user && school ? preparationKey(user.id, school.id) : "";
  useEffect(() => {
    setProgress(key ? readPreparation(key) : null);
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; preparation: Preparation }>).detail;
      if (detail?.key === key) setProgress(detail.preparation);
    };
    window.addEventListener(PREPARATION_EVENT, update);
    return () => window.removeEventListener(PREPARATION_EVENT, update);
  }, [key]);
  return (
    <section
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
      aria-label="Offline preparation"
    >
      <h2 className="font-bold text-base">Prepare for offline work</h2>
      <p className="text-sm text-[var(--t2)]">
        Download student records and working data while connected. History may be limited; check the coverage below
        before relying on it offline.
      </p>
      <button
        type="button"
        disabled={!online || progress?.running || isDemo}
        onClick={() => window.dispatchEvent(new Event(PREPARE_EVENT))}
        className="min-h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {progress?.running ? "Preparing…" : "Download offline data and pages"}
      </button>
      <p className="text-xs text-[var(--t2)]">
        Uses mobile data and device storage. Larger schools take longer.{" "}
        {isDemo ? "Downloads are unavailable in demo mode." : ""}
      </p>
      <div role="status" aria-live="polite" className="text-sm text-[var(--t2)]">
        {progress
          ? `${progress.running ? "Preparing" : "Last prepared"}: ${new Date(progress.at).toLocaleString()}`
          : "Offline coverage has not been verified yet."}
      </div>
      {progress && (
        <ul className="space-y-2 text-sm">
          {Object.entries(progress.tables).map(([table, coverage]) => (
            <li key={table}>
              <span className="capitalize">{table.replace(/_/g, " ")}</span>: {coverage.rows}
              {coverage.total !== null ? ` of ${coverage.total}` : ""} records —{" "}
              {coverage.complete ? "complete at download time" : "partial download"}
            </li>
          ))}
        </ul>
      )}
      {progress && progress.errors.length > 0 && (
        <p role="alert" className="text-sm text-[var(--red)]">
          Some downloads failed. Coverage is incomplete. Reconnect and try again.
        </p>
      )}
    </section>
  );
}
