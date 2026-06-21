"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { withTimeout } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";

type SupabaseResponse<T> = { data: T | null; error: unknown | null; count?: number | null };

interface AutomationRun {
  id: string;
  type: "sms" | "automated";
  automation_type?: string;
  status: string;
  message?: string;
  parent_phone?: string;
  sent_at: string;
}

export default function SystemHealthPage() {
  const { school } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<"idle" | "ok" | "error">("idle");
  const [healthDetail, setHealthDetail] = useState<string>("");
  const [storageBuckets, setStorageBuckets] = useState<{ name: string; fileCount: number }[]>([]);
  const [automationRuns, setAutomationRuns] = useState<AutomationRun[]>([]);
  const [failedCount24h, setFailedCount24h] = useState(0);
  const [schoolCount, setSchoolCount] = useState(0);
  const [activeUserCount, setActiveUserCount] = useState(0);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const fetchHealthData = useCallback(async () => {
    setLoading(true);
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [healthRes, bucketsResult, smsLogsResult, autoLogsResult, failedResult, schoolsResult, usersResult] =
        await Promise.allSettled([
          fetch("/api/health/").then((r) => r.json()),
          withTimeout(supabase.storage.listBuckets(), 10000, { data: null, error: null } as any),
          withTimeout(
            supabase
              .from("sms_logs")
              .select("id, automation_type, status, message, parent_phone, sent_at")
              .order("sent_at", { ascending: false })
              .limit(20),
            10000,
            { data: [], error: null } as SupabaseResponse<unknown[]>,
          ),
          withTimeout(
            supabase
              .from("automated_message_logs")
              .select("id, status, sent_at")
              .order("sent_at", { ascending: false })
              .limit(20),
            10000,
            { data: [], error: null } as SupabaseResponse<unknown[]>,
          ),
          withTimeout(
            supabase
              .from("audit_log")
              .select("id", { count: "exact", head: true })
              .gte("created_at", twentyFourHoursAgo)
              .in("action", ["delete", "update"]),
            10000,
            { count: 0, data: null, error: null } as SupabaseResponse<unknown>,
          ),
          withTimeout(supabase.from("schools").select("id", { count: "exact", head: true }), 10000, { count: 0, data: null, error: null } as SupabaseResponse<unknown>),
          withTimeout(
            supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "active"),
            10000,
            { count: 0, data: null, error: null } as SupabaseResponse<unknown>,
          ),
        ]);

      if (healthRes.status === "fulfilled") {
        setHealthStatus("ok");
        setHealthDetail(JSON.stringify(healthRes.value, null, 2));
      } else {
        setHealthStatus("error");
        setHealthDetail(healthRes.reason instanceof Error ? healthRes.reason.message : "Health check failed");
      }

      if (bucketsResult.status === "fulfilled") {
        const bucketsValue = bucketsResult.value as { data: { name: string }[] | null; error: unknown | null };
        const buckets = bucketsValue.data;
        if (Array.isArray(buckets)) {
          const bucketInfo = await Promise.all(
            buckets.map(async (b: { name: string }) => {
              const listResult = await withTimeout(
                supabase.storage.from(b.name).list("", { limit: 1000 }),
                10000,
                { data: null, error: null } as any,
              );
              const files = listResult.data;
              return { name: b.name, fileCount: Array.isArray(files) ? files.length : 0 };
            }),
          );
          setStorageBuckets(bucketInfo);
        }
      }

      const runs: AutomationRun[] = [];
      if (smsLogsResult.status === "fulfilled") {
        const smsValue = smsLogsResult.value as { data: unknown[] | null; error: unknown | null };
        const data = smsValue.data;
        if (Array.isArray(data)) {
          (data as Record<string, unknown>[]).forEach((r) =>
            runs.push({
              id: String(r.id),
              type: "sms",
              automation_type: r.automation_type as string | undefined,
              status: String(r.status),
              message: r.message as string | undefined,
              parent_phone: r.parent_phone as string | undefined,
              sent_at: String(r.sent_at),
            }),
          );
        }
      }
      if (autoLogsResult.status === "fulfilled") {
        const autoValue = autoLogsResult.value as { data: unknown[] | null; error: unknown | null };
        const data = autoValue.data;
        if (Array.isArray(data)) {
          (data as Record<string, unknown>[]).forEach((r) =>
            runs.push({
              id: String(r.id),
              type: "automated",
              status: String(r.status),
              sent_at: String(r.sent_at),
            }),
          );
        }
      }
      runs.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
      setAutomationRuns(runs.slice(0, 20));

      if (failedResult.status === "fulfilled") {
        const failedVal = failedResult.value as { count?: number | null; error?: unknown | null };
        setFailedCount24h(failedVal.count ?? 0);
      }
      if (schoolsResult.status === "fulfilled") {
        const schoolsVal = schoolsResult.value as { count?: number | null; error?: unknown | null };
        setSchoolCount(schoolsVal.count ?? 0);
      }
      if (usersResult.status === "fulfilled") {
        const usersVal = usersResult.value as { count?: number | null; error?: unknown | null };
        setActiveUserCount(usersVal.count ?? 0);
      }
    } catch (e) {
      logger.error("System health fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  const runHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/health/");
      const data = await res.json();
      setHealthStatus(res.ok ? "ok" : "error");
      setHealthDetail(JSON.stringify(data, null, 2));
      toast.success("Health check complete");
    } catch (e) {
      setHealthStatus("error");
      setHealthDetail(e instanceof Error ? e.message : "Unknown error");
      toast.error("Health check failed");
    } finally {
      setCheckingHealth(false);
    }
  };

  const clearExpiredData = async () => {
    if (!school?.id) {
      toast.error("School context not found");
      return;
    }

    try {
      const retentionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [smsDelete, automatedDelete] = await Promise.all([
        withTimeout(
          supabase
            .from("sms_logs")
            .delete()
            .eq("school_id", school.id)
            .lt("sent_at", retentionCutoff),
          15000,
          { error: null } as { error: unknown | null; data: unknown },
        ),
        withTimeout(
          supabase
            .from("automated_message_logs")
            .delete()
            .eq("school_id", school.id)
            .lt("sent_at", retentionCutoff),
          15000,
          { error: null } as { error: unknown | null; data: unknown },
        ),
      ]);

      if (smsDelete?.error || automatedDelete?.error) {
        throw smsDelete?.error || automatedDelete?.error;
      }

      toast.success("Expired logs cleared successfully");
      await fetchHealthData();
    } catch (error) {
      logger.error("Failed to clear expired data:", error);
      toast.error("Failed to clear expired data");
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "sent":
      case "ok":
        return "bg-green-100 text-green-700";
      case "failed":
      case "error":
        return "bg-red-100 text-red-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const nextjsInfo =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || `v${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ? "" : "client"}`;

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="System Health"
          subtitle="Monitor system status, storage, and automation health"
          actions={
            <div className="flex gap-2">
              <Button onClick={runHealthCheck} loading={checkingHealth} icon={<MaterialIcon icon="refresh" />}>
                Run Health Check
              </Button>
              <Button variant="secondary" onClick={clearExpiredData} icon={<MaterialIcon icon="cleaning_services" />}>
                Clear Expired Data
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardBody>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                    <div className="h-8 bg-slate-50 rounded w-3/4" />
                    <div className="h-3 bg-slate-50 rounded w-full" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardBody>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-[var(--t1)]">Supabase Connection</h3>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClass(healthStatus)}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${healthStatus === "ok" ? "bg-green-500" : healthStatus === "error" ? "bg-red-500" : "bg-slate-400"}`}
                      />
                      {healthStatus === "ok" ? "Connected" : healthStatus === "error" ? "Error" : "Idle"}
                    </span>
                  </div>
                  {healthDetail && (
                    <pre className="mt-2 text-xs text-[var(--t3)] bg-[var(--surface-container)] p-3 rounded-xl overflow-x-auto max-h-32">
                      {healthDetail}
                    </pre>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h3 className="text-sm font-semibold text-[var(--t1)] mb-3">Storage Usage</h3>
                  {storageBuckets.length === 0 ? (
                    <div className="text-sm text-[var(--t3)]">No storage buckets found</div>
                  ) : (
                    <div className="space-y-2">
                      {storageBuckets.map((b) => (
                        <div
                          key={b.name}
                          className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <MaterialIcon icon="folder" size={16} className="text-[var(--t3)]" />
                            <span className="text-sm font-medium text-[var(--t1)]">{b.name}</span>
                          </div>
                          <span className="text-xs font-mono text-[var(--t3)]">
                            {b.fileCount} file{b.fileCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h3 className="text-sm font-semibold text-[var(--t1)] mb-3">System Info</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-[var(--t3)] text-xs">Next.js</span>
                      <p className="font-semibold text-[var(--t1)]">{nextjsInfo || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[var(--t3)] text-xs">Environment</span>
                      <p className="font-semibold text-[var(--t1)]">{process.env.NODE_ENV === "production" ? "Production" : "Development"}</p>
                    </div>
                    <div>
                      <span className="text-[var(--t3)] text-xs">Schools</span>
                      <p className="font-semibold text-[var(--t1)]">{schoolCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-[var(--t3)] text-xs">Active Users</span>
                      <p className="font-semibold text-[var(--t1)]">{activeUserCount.toLocaleString()}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[var(--t3)] text-xs">Failed Actions (24h)</span>
                      <p className={`font-semibold ${failedCount24h > 0 ? "text-red-600" : "text-green-600"}`}>
                        {failedCount24h}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardBody>
                <h3 className="text-sm font-semibold text-[var(--t1)] mb-3">Recent Automation Runs</h3>
                {automationRuns.length === 0 ? (
                  <div className="text-sm text-[var(--t3)] py-4 text-center">No automation runs found</div>
                ) : (
                  <div className="space-y-1.5">
                    {automationRuns.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between py-2 px-3 bg-[var(--surface-container)] rounded-xl"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MaterialIcon
                            icon={run.type === "sms" ? "sms" : "smart_toy"}
                            className={run.status === "sent" ? "text-green-500" : "text-red-500"}
                            size={16}
                          />
                          <span className="text-xs font-medium text-[var(--t1)] truncate max-w-[200px]">
                            {run.automation_type || run.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusBadgeClass(run.status)}`}
                          >
                            {run.status}
                          </span>
                          <span className="text-[11px] text-[var(--t3)] font-mono">
                            {new Date(run.sent_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardBody className="text-center py-4">
                  <MaterialIcon
                    icon={healthStatus === "ok" ? "check_circle" : "error"}
                    size={28}
                    className={healthStatus === "ok" ? "text-green-500" : "text-red-500"}
                  />
                  <div className="text-xs font-medium text-[var(--t3)] mt-1">API Health</div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center py-4">
                  <div className="text-2xl font-bold text-[var(--t1)]">{storageBuckets.length}</div>
                  <div className="text-xs font-medium text-[var(--t3)] mt-1">Buckets</div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center py-4">
                  <div className="text-2xl font-bold text-[var(--t1)]">{automationRuns.length}</div>
                  <div className="text-xs font-medium text-[var(--t3)] mt-1">Recent Runs</div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center py-4">
                  <div className={`text-2xl font-bold ${failedCount24h > 0 ? "text-red-600" : "text-green-600"}`}>
                    {failedCount24h}
                  </div>
                  <div className="text-xs font-medium text-[var(--t3)] mt-1">Failed (24h)</div>
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </PageErrorBoundary>
  );
}
