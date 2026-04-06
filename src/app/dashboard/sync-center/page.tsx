"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { offlineDB } from "@/lib/offline";
import { useOnlineStatus } from "@/lib/offline";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface PendingItem {
  id: number | string;
  table: string;
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
  timestamp: number;
  attempts: number;
}

interface SyncMetadata {
  table: string;
  last_synced: number;
  record_count: number;
}

export default function SyncCenterPage() {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [failed, setFailed] = useState<PendingItem[]>([]);
  const [metadata, setMetadata] = useState<SyncMetadata[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const pendingItems = await offlineDB.getPendingSync();
      const failedItems = await offlineDB.getFailedSync();
      const meta = await offlineDB.getAllLastSynced();

      setPending(pendingItems as PendingItem[]);
      setFailed(failedItems as PendingItem[]);

      const metaList: SyncMetadata[] = Object.entries(meta).map(
        ([table, timestamp]) => ({
          table,
          last_synced: timestamp,
          record_count: 0,
        }),
      );
      setMetadata(metaList);
    } catch (e) {
      console.error("Error loading sync data:", e);
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

  const handleClearFailed = async () => {
    await offlineDB.clearSyncQueue();
    await loadData();
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800";
      case "update":
        return "bg-blue-100 text-blue-800";
      case "delete":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const totalPending = pending.length;
  const totalFailed = failed.length;

  return (
    <div className="content">
      <PageHeader
        title="Sync Center"
        subtitle="Manage offline changes and sync status"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardBody className="text-center">
            <div
              className={`text-3xl font-bold mb-1 ${
                isOnline ? "text-green-600" : "text-red-500"
              }`}
            >
              {isOnline ? "Online" : "Offline"}
            </div>
            <div className="text-sm text-on-surface-variant">
              {isOnline ? "Connected to server" : "Working offline"}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {totalPending}
            </div>
            <div className="text-sm text-on-surface-variant">
              Pending changes
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-error mb-1">
              {totalFailed}
            </div>
            <div className="text-sm text-on-surface-variant">
              Failed to sync
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-3 mb-6">
        <Button
          variant="primary"
          onClick={handleSync}
          disabled={!isOnline || syncing}
        >
          <MaterialIcon
            icon={syncing ? "sync" : "cloud_sync"}
            className={syncing ? "animate-spin" : ""}
          />
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
        {totalFailed > 0 && (
          <Button variant="secondary" onClick={handleClearFailed}>
            <MaterialIcon icon="delete_sweep" />
            Clear Failed
          </Button>
        )}
      </div>

      {syncResult && (
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center gap-3 mb-2">
              <MaterialIcon
                icon={syncResult.failed === 0 ? "check_circle" : "warning"}
                className={
                  syncResult.failed === 0 ? "text-green-500" : "text-amber-500"
                }
              />
              <span className="font-semibold">Sync Complete</span>
            </div>
            <div className="text-sm text-on-surface-variant">
              {syncResult.success} synced, {syncResult.failed} failed
            </div>
            {syncResult.errors.length > 0 && (
              <div className="mt-2 text-xs text-error">
                {syncResult.errors[0]}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {totalPending > 0 && (
        <Card className="mb-6">
          <CardBody>
            <h3 className="font-semibold mb-4">Pending Changes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-on-surface-variant">
                    <th className="pb-2">Table</th>
                    <th className="pb-2">Action</th>
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.slice(0, 20).map((item) => (
                    <tr key={item.id} className="border-t border-outline/10">
                      <td className="py-2 font-medium">{item.table}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${getActionColor(
                            item.action,
                          )}`}
                        >
                          {item.action}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {(item.data.id as string)?.slice(0, 8) || "-"}
                      </td>
                      <td className="py-2 text-xs text-on-surface-variant">
                        {formatTime(item.timestamp)}
                      </td>
                      <td className="py-2">{item.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPending > 20 && (
                <div className="text-sm text-on-surface-variant mt-2">
                  +{totalPending - 20} more items
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {totalFailed > 0 && (
        <Card className="mb-6 border-error/30">
          <CardBody>
            <h3 className="font-semibold mb-4 text-error">Failed Sync Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-on-surface-variant">
                    <th className="pb-2">Table</th>
                    <th className="pb-2">Action</th>
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {failed.map((item) => (
                    <tr key={item.id} className="border-t border-outline/10">
                      <td className="py-2 font-medium">{item.table}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${getActionColor(
                            item.action,
                          )}`}
                        >
                          {item.action}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {(item.data.id as string)?.slice(0, 8) || "-"}
                      </td>
                      <td className="py-2 text-xs text-on-surface-variant">
                        {formatTime(item.timestamp)}
                      </td>
                      <td className="py-2 text-error">{item.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {totalPending === 0 && totalFailed === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <MaterialIcon className="text-5xl text-green-500 mb-4">
              check_circle
            </MaterialIcon>
            <h3 className="text-lg font-semibold mb-2">All Synced!</h3>
            <p className="text-sm text-on-surface-variant">
              All your data is up to date
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
