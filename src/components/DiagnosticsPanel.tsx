"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MaterialIcon from "./MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import {
  canViewDiagnostics,
  fetchServerTime,
  formatClockSkew,
  getEnvironmentSnapshot,
  getRecentApiErrors,
  getServiceWorkerSnapshot,
  getStorageSnapshot,
  installApiErrorRecorder,
  parseDebugFlag,
  readStoredSession,
  type ApiErrorEntry,
  type EnvironmentSnapshot,
  type ServerTimeSnapshot,
  type ServiceWorkerSnapshot,
  type StorageSnapshot,
  type StoredSessionSnapshot,
} from "@/lib/diagnostics";
import { logger } from "@/lib/logger";
import { useSyncStatus } from "@/lib/useSyncStatus";

const DEBUG_STORAGE_KEY = "skoolmate-diagnostics";
const CLOCK_SKEW_WARNING_MS = 5 * 60 * 1000;

interface Snapshot {
  server: ServerTimeSnapshot | null;
  serviceWorker: ServiceWorkerSnapshot | null;
  environment: EnvironmentSnapshot;
  storage: StorageSnapshot;
  session: StoredSessionSnapshot;
  errors: ApiErrorEntry[];
  capturedAt: number;
}

function Row({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[11px] uppercase tracking-wide text-[var(--t3)] shrink-0">{label}</span>
      <span
        className={`text-[11px] font-semibold text-right break-all ${warning ? "text-red-600" : "text-[var(--t1)]"}`}
      >
        {value}
      </span>
    </div>
  );
}

function shortPath(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export default function DiagnosticsPanel() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const roles = useMemo(() => user?.roles ?? (user ? [user.role] : []), [user]);

  useEffect(() => {
    const flag = parseDebugFlag(window.location.search);
    if (flag === "off") {
      try {
        window.sessionStorage.removeItem(DEBUG_STORAGE_KEY);
      } catch {}
      setEnabled(false);
      return;
    }
    if (flag === "on") {
      try {
        window.sessionStorage.setItem(DEBUG_STORAGE_KEY, "1");
      } catch {}
      setEnabled(true);
      return;
    }
    try {
      setEnabled(window.sessionStorage.getItem(DEBUG_STORAGE_KEY) === "1");
    } catch {
      setEnabled(false);
    }
  }, []);

  if (!enabled || !canViewDiagnostics(roles)) return null;
  return <DiagnosticsPanelBody />;
}

function DiagnosticsPanelBody() {
  const { user, school, authInitialized, profileDegraded, isDemo } = useAuth();
  const sync = useSyncStatus();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const roles = useMemo(() => user?.roles ?? (user ? [user.role] : []), [user]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [server, serviceWorker, storage] = await Promise.all([
        fetchServerTime().catch(() => null),
        getServiceWorkerSnapshot(),
        getStorageSnapshot(),
      ]);
      setSnapshot({
        server,
        serviceWorker,
        environment: getEnvironmentSnapshot(),
        storage,
        session: readStoredSession(),
        errors: getRecentApiErrors(),
        capturedAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnostics failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const uninstall = installApiErrorRecorder();
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    const handleConnectivity = () => void refresh();
    window.addEventListener("online", handleConnectivity);
    window.addEventListener("offline", handleConnectivity);
    return () => {
      uninstall();
      clearInterval(interval);
      window.removeEventListener("online", handleConnectivity);
      window.removeEventListener("offline", handleConnectivity);
    };
  }, [refresh]);

  const report = useMemo(() => {
    const server = snapshot?.server ?? null;
    const sessionExpiresAt = snapshot?.session.expiresAt ?? null;
    return {
      app: "SkoolMate OS",
      capturedAt: snapshot?.capturedAt ? new Date(snapshot.capturedAt).toISOString() : null,
      url: typeof window !== "undefined" ? window.location.href : "",
      build: snapshot?.serviceWorker?.activeVersion ?? null,
      clockSkewMs: server?.skewMs ?? null,
      clockSkew: formatClockSkew(server?.skewMs ?? null),
      serverLatencyMs: server?.latencyMs ?? null,
      serviceWorker: snapshot?.serviceWorker ?? null,
      session: {
        ...snapshot?.session,
        expiresInMinutes:
          sessionExpiresAt === null ? null : Math.round((sessionExpiresAt * 1000 - Date.now()) / 60_000),
      },
      auth: {
        authInitialized,
        profileDegraded,
        isDemo,
        userId: user?.id ?? null,
        authId: user?.auth_id ?? null,
        roles,
        school: school ? { id: school.id, name: school.name, code: school.school_code } : null,
      },
      sync: {
        isOnline: sync.isOnline,
        pendingCount: sync.pendingCount,
        isSyncing: sync.isSyncing,
        lastSynced: sync.lastSynced ? sync.lastSynced.toISOString() : null,
        errors: sync.syncErrors,
      },
      storage: snapshot?.storage ?? null,
      environment: snapshot?.environment ?? null,
      recentApiErrors: snapshot?.errors ?? [],
    };
  }, [snapshot, authInitialized, profileDegraded, isDemo, user, roles, school, sync]);

  const copyReport = useCallback(async () => {
    const text = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch (e) {
      logger.warn("[Diagnostics] Clipboard write failed", e);
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1_500);
      } catch {
        setError("Could not copy. Select the panel text manually.");
      } finally {
        document.body.removeChild(area);
      }
    }
  }, [report]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open diagnostics"
        className="fixed bottom-4 right-4 z-[9990] flex h-11 w-11 items-center justify-center rounded-full bg-[var(--navy)] text-[var(--on-primary)] shadow-lg"
      >
        <MaterialIcon icon="bug_report" style={{ fontSize: 20 }} />
      </button>
    );
  }

  const skewMs = snapshot?.server?.skewMs ?? null;
  const skewWarning = skewMs !== null && Math.abs(skewMs) > CLOCK_SKEW_WARNING_MS;
  const session = snapshot?.session;
  const sessionExpiry = session?.expiresAt
    ? `${Math.round((session.expiresAt * 1000 - Date.now()) / 60_000)} min`
    : session?.found
      ? "unknown"
      : "none";
  const env = snapshot?.environment;

  return (
    <div className="fixed bottom-4 right-4 z-[9990] w-[min(360px,calc(100vw-2rem))]">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
          <div className="flex items-center gap-2">
            <MaterialIcon icon="bug_report" style={{ fontSize: 16 }} />
            <span className="text-[12px] font-bold">Diagnostics</span>
            {skewWarning && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">clock</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={busy}
              aria-label="Refresh diagnostics"
              className="rounded-lg p-1.5 text-[var(--t2)] hover:bg-[var(--bg)] disabled:opacity-50"
            >
              <MaterialIcon icon={busy ? "progress_activity" : "refresh"} style={{ fontSize: 16 }} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Hide diagnostics"
              className="rounded-lg p-1.5 text-[var(--t2)] hover:bg-[var(--bg)]"
            >
              <MaterialIcon icon="close" style={{ fontSize: 16 }} />
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-3 py-2">
          {error && <div className="mb-2 rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-700">{error}</div>}

          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--t3)] pt-1">Clock</div>
          <Row label="Skew" value={formatClockSkew(skewMs)} warning={skewWarning} />
          <Row label="Latency" value={snapshot?.server ? `${snapshot.server.latencyMs} ms` : "unknown"} />
          <Row label="Timezone" value={env?.timezone || "unknown"} />

          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--t3)] pt-2">Build</div>
          <Row label="SW version" value={snapshot?.serviceWorker?.activeVersion ?? "unknown"} />
          <Row label="SW control" value={snapshot?.serviceWorker?.controlled ? "active" : "not controlling"} />
          <Row label="Caches" value={snapshot?.serviceWorker?.caches.join(", ") || "none"} />

          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--t3)] pt-2">Connection</div>
          <Row label="Network" value={sync.isOnline ? "online" : "offline"} warning={!sync.isOnline} />
          <Row
            label="Type"
            value={
              env?.connection.effectiveType
                ? `${env.connection.effectiveType}${env.connection.rttMs !== null ? ` / ${env.connection.rttMs} ms` : ""}`
                : "unknown"
            }
          />
          <Row label="Pending sync" value={`${sync.pendingCount}`} warning={sync.pendingCount > 0} />
          <Row label="Last sync" value={sync.lastSynced ? sync.lastSynced.toLocaleTimeString() : "never"} />
          {sync.syncErrors.length > 0 && (
            <Row label="Sync errors" value={sync.syncErrors.slice(0, 2).join("; ")} warning />
          )}

          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--t3)] pt-2">Session</div>
          <Row
            label="Expires"
            value={sessionExpiry}
            warning={session?.expiresAt ? session.expiresAt * 1000 < Date.now() : false}
          />
          <Row label="Storage" value={session?.storage ?? "none"} />
          <Row label="Auth ready" value={authInitialized ? "yes" : "no"} warning={!authInitialized} />
          <Row label="Profile" value={profileDegraded ? "degraded" : "ok"} warning={profileDegraded} />
          <Row label="Demo" value={isDemo ? "yes" : "no"} />
          <Row label="Roles" value={roles.join(", ") || "none"} />

          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--t3)] pt-2">Device</div>
          <Row
            label="Storage"
            value={
              snapshot?.storage.usageMb !== null && snapshot?.storage.usageMb !== undefined
                ? `${snapshot.storage.usageMb} / ${snapshot.storage.quotaMb ?? "?"} MB`
                : "unknown"
            }
          />
          <Row label="Memory" value={env?.deviceMemoryGb ? `${env.deviceMemoryGb} GB` : "unknown"} />
          <Row label="Cores" value={env?.hardwareConcurrency ? `${env.hardwareConcurrency}` : "unknown"} />
          <Row label="Viewport" value={`${env?.viewport ?? "?"} @${env?.pixelRatio ?? 1}x`} />
          <Row label="Mode" value={env?.displayMode ?? "unknown"} />

          {snapshot && snapshot.errors.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--t3)] pt-2">
                Recent API errors
              </div>
              {snapshot.errors.slice(0, 5).map((entry) => (
                <Row
                  key={`${entry.at}-${entry.method}-${entry.url}-${entry.status}`}
                  label={`${entry.status || "net"}`}
                  value={`${entry.method} ${shortPath(entry.url)}`}
                  warning
                />
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2">
          <button
            type="button"
            onClick={() => void copyReport()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--navy)] px-3 py-2 text-[11px] font-bold text-[var(--on-primary)]"
          >
            <MaterialIcon icon={copied ? "check" : "content_copy"} style={{ fontSize: 14 }} />
            {copied ? "Copied" : "Copy report"}
          </button>
          <span className="text-[10px] text-[var(--t3)]">
            {snapshot?.capturedAt ? new Date(snapshot.capturedAt).toLocaleTimeString() : "not loaded"}
          </span>
        </div>
      </div>
    </div>
  );
}
