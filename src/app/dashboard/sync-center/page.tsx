"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { offlineDB } from "@/lib/offline";
import { useOnlineStatus } from "@/lib/offline";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, Button, DataTable, StatStrip, type DataColumn } from "@/components/ui/index";
import { ConflictResolver } from "@/components/ui/ConflictResolver";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { logger } from "@/lib/logger";

interface PendingItem {
  id: number;
  table: string;
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
  timestamp: number;
  attempts: number;
  reason?: string;
}

interface SyncMetadata {
  table: string;
  last_synced: number;
  record_count: number;
}

type ServerRow = Record<string, unknown>;

function isConflict(item: PendingItem): boolean {
  return Boolean(item.reason && item.reason.includes("server newer"));
}

function actionVariant(action: PendingItem["action"]): "success" | "info" | "error" {
  if (action === "create") return "success";
  if (action === "update") return "info";
  return "error";
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function shortId(item: PendingItem): string {
  const id = item.data.id;
  return typeof id === "string" && id ? id.slice(0, 8) : "—";
}

export default function SyncCenterPage() {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [failed, setFailed] = useState<PendingItem[]>([]);
  const [serverRows, setServerRows] = useState<Record<string, ServerRow | null>>({});
  const [metadata, setMetadata] = useState<SyncMetadata[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const pendingItems = (await offlineDB.getPendingSync()) as unknown as PendingItem[];
      const failedItems = (await offlineDB.getFailedSync()) as unknown as PendingItem[];
      const meta = await offlineDB.getAllLastSynced();

      setPending(pendingItems);
      setFailed(failedItems);

      const metaList: SyncMetadata[] = Object.entries(meta).map(([table, timestamp]) => ({
        table,
        last_synced: timestamp,
        record_count: 0,
      }));
      setMetadata(metaList);

      const conflicts = failedItems.filter(isConflict);
      if (conflicts.length === 0) {
        setServerRows({});
        return;
      }

      const { supabase } = await import("@/lib/supabase");
      const entries = await Promise.all(
        conflicts.map(async (item) => {
          const rowId = item.data.id;
          if (typeof rowId !== "string" || !rowId) return [String(item.id), null] as const;
          try {
            const { data, error } = await supabase.from(item.table).select("*").eq("id", rowId).maybeSingle();
            if (error) throw error;
            return [String(item.id), (data as ServerRow | null) ?? null] as const;
          } catch (e) {
            logger.warn("Could not load server copy for conflict", { table: item.table, rowId, e });
            return [String(item.id), null] as const;
          }
        }),
      );
      setServerRows(Object.fromEntries(entries));
    } catch (e) {
      logger.error("Error loading sync data:", e);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSync = async () => {
    if (!isOnline) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await offlineDB.syncToServer();
      setSyncResult(result);
      await loadData();
    } catch (e) {
      setSyncResult({
        success: 0,
        failed: 1,
        errors: [e instanceof Error ? e.message : "Sync failed"],
      });
    }
    setSyncing(false);
  };

  const handleKeepLocal = async (item: PendingItem) => {
    if (!isOnline) return;
    await offlineDB.retrySyncItem(item.id);
    await handleSync();
  };

  const handleKeepServer = async (item: PendingItem) => {
    const server = serverRows[String(item.id)];
    try {
      if (server) await offlineDB.cacheFromServer(item.table, [server]);
      await offlineDB.removeSyncItem(item.id);
    } catch (e) {
      logger.error("Failed to accept the server copy", { table: item.table, id: item.id, e });
      setSyncResult({
        success: 0,
        failed: 1,
        errors: ["Could not keep the server copy. Check your connection and try again."],
      });
      return;
    }
    await loadData();
  };

  const handleRetryFailed = async () => {
    if (!isOnline) return;
    for (const item of failed.filter((entry) => !isConflict(entry))) {
      await offlineDB.retrySyncItem(item.id);
    }
    await handleSync();
  };

  const handleDiscardFailed = async () => {
    for (const item of failed) {
      await offlineDB.removeSyncItem(item.id);
    }
    setConfirmClear(false);
    await loadData();
  };

  const conflicts = failed.filter(isConflict);
  const otherFailed = failed.filter((item) => !isConflict(item));
  const lastSynced = metadata.reduce((latest, entry) => Math.max(latest, entry.last_synced), 0);

  const pendingColumns: DataColumn<PendingItem>[] = [
    {
      key: "table",
      header: "Table",
      sortValue: (item) => item.table,
      render: (item) => <span className="font-medium">{item.table.replaceAll("_", " ")}</span>,
    },
    {
      key: "action",
      header: "Action",
      sortValue: (item) => item.action,
      render: (item) => <Badge variant={actionVariant(item.action)}>{item.action}</Badge>,
    },
    {
      key: "id",
      header: "ID",
      hideOnMobile: true,
      render: (item) => <span className="font-mono text-xs text-[var(--t3)]">{shortId(item)}</span>,
    },
    {
      key: "time",
      header: "Queued",
      sortValue: (item) => item.timestamp,
      render: (item) => <span className="text-xs text-[var(--t3)]">{formatTime(item.timestamp)}</span>,
    },
    {
      key: "attempts",
      header: "Tries",
      align: "right",
      sortValue: (item) => item.attempts,
      render: (item) => <span className="tabular-nums">{item.attempts}</span>,
    },
  ];

  const failedColumns: DataColumn<PendingItem>[] = [
    ...pendingColumns,
    {
      key: "reason",
      header: "Reason",
      hideOnMobile: true,
      render: (item) => (
        <span className="block max-w-[28rem] break-words text-xs text-[var(--error)]">{item.reason || "—"}</span>
      ),
    },
  ];

  return (
    <PageErrorBoundary>
      <div className="content space-y-6">
        <PageHeader
          title="Sync Center"
          subtitle="Offline changes, conflicts and last-sync status — one place, on any device"
        />

        <StatStrip
          ariaLive="polite"
          columns={4}
          items={[
            {
              label: "Connection",
              value: isOnline ? "Online" : "Offline",
              tone: isOnline ? "positive" : "negative",
              hint: isOnline ? "Connected to the server" : "Changes are queued on this device",
            },
            {
              label: "Waiting",
              value: pending.length,
              tone: "info",
              hint: pending.length === 1 ? "change not uploaded yet" : "changes not uploaded yet",
            },
            {
              label: "Conflicts",
              value: conflicts.length,
              tone: conflicts.length > 0 ? "warning" : "default",
              hint: "changed on another device",
            },
            {
              label: "Other failures",
              value: otherFailed.length,
              tone: otherFailed.length > 0 ? "negative" : "default",
              hint: lastSynced ? `Last sync ${new Date(lastSynced).toLocaleString()}` : "Never synced",
            },
          ]}
        />

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={handleSync} disabled={!isOnline || syncing}>
            <MaterialIcon icon="cloud_sync" className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
          {otherFailed.length > 0 && (
            <Button variant="secondary" onClick={handleRetryFailed} disabled={!isOnline || syncing}>
              <MaterialIcon icon="refresh" />
              Retry failed
            </Button>
          )}
          {failed.length > 0 && (
            <Button variant="ghost" onClick={() => setConfirmClear(true)}>
              <MaterialIcon icon="delete_sweep" />
              Discard all failed
            </Button>
          )}
          {!isOnline && (
            <p className="self-center text-xs text-[var(--t3)]">
              Reconnect to sync — your changes are safe on this device.
            </p>
          )}
        </div>

        {syncResult && (
          <Card>
            <CardBody>
              <div className="mb-2 flex items-center gap-3">
                <MaterialIcon
                  icon={syncResult.failed === 0 ? "check_circle" : "warning"}
                  className={syncResult.failed === 0 ? "text-[var(--green)]" : "text-[var(--amber)]"}
                />
                <span className="font-semibold">
                  {syncResult.failed === 0 ? "Sync complete" : "Sync finished with problems"}
                </span>
              </div>
              <div className="text-sm text-[var(--on-surface-variant)]">
                {syncResult.success} synced, {syncResult.failed} failed
              </div>
              {syncResult.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-[var(--error)]">
                  {syncResult.errors.slice(0, 3).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}

        {conflicts.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--t1)]">Conflicts to resolve</h2>
              <p className="text-xs text-[var(--t3)]">
                Your edit was kept on this device. Choose a version to finish syncing.
              </p>
            </div>
            {conflicts.map((item) => {
              const server = serverRows[String(item.id)];
              return (
                <ConflictResolver
                  key={item.id}
                  title={`${item.table.replaceAll("_", " ")} · ${shortId(item)}`}
                  subtitle={formatTime(item.timestamp)}
                  reason={item.reason}
                  local={item.data}
                  server={server ?? {}}
                  onKeepLocal={() => handleKeepLocal(item)}
                  onKeepServer={() => handleKeepServer(item)}
                  busy={syncing}
                />
              );
            })}
          </section>
        )}

        {pending.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-[var(--t1)]">Waiting to upload</h2>
            <DataTable
              caption="Offline changes waiting to upload"
              columns={pendingColumns}
              rows={pending}
              getRowId={(item) => String(item.id)}
              initialSort={{ key: "time", dir: "asc" }}
              footer={
                <span className="text-xs text-[var(--t3)]">
                  {pending.length} queued · oldest first · retried automatically when online
                </span>
              }
            />
          </section>
        )}

        {otherFailed.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-[var(--error)]">Could not sync</h2>
            <DataTable
              caption="Offline changes that could not be synced"
              columns={failedColumns}
              rows={otherFailed}
              getRowId={(item) => String(item.id)}
              initialSort={{ key: "time", dir: "asc" }}
              footer={
                <span className="text-xs text-[var(--t3)]">Retry after fixing the reason, or discard the change.</span>
              }
            />
          </section>
        )}

        {pending.length === 0 && failed.length === 0 && (
          <EmptyState
            icon="cloud_done"
            title="All synced"
            description="Every change on this device has reached the server. You can keep working offline — new changes will appear here."
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleDiscardFailed}
        title="Discard all failed changes?"
        message={`${failed.length} change${failed.length === 1 ? "" : "s"} will be removed from this device and will not be sent to the server. This cannot be undone.`}
        confirmLabel="Discard changes"
        variant="danger"
      />
    </PageErrorBoundary>
  );
}
