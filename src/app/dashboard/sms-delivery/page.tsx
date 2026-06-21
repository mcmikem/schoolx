"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/index";
import { Button } from "@/components/ui/index";
import { withTimeout } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";

type SupabaseResponse<T = unknown> = { data: T | null; error: unknown | null; count?: number | null };

interface SmsRecord {
  id: string;
  automation_type: string | null;
  parent_phone: string | null;
  message: string | null;
  status: string;
  sent_at: string;
}

interface AutomationStat {
  type: string;
  sent: number;
  failed: number;
  total: number;
}

export default function SmsDeliveryPage() {
  const { school } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentRecords, setRecentRecords] = useState<SmsRecord[]>([]);
  const [automationStats, setAutomationStats] = useState<AutomationStat[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const schoolId = school?.id;

      const [sentRes, failedRes, pendingRes, recentRes, autoRes] = await Promise.allSettled([
        withTimeout(
          supabase
            .from("sms_logs")
            .select("id", { count: "exact", head: true })
            .gte("sent_at", thirtyDaysAgo)
            .eq("school_id", schoolId)
            .eq("status", "sent"),
          10000,
          { data: null, error: null, count: 0 } as SupabaseResponse,
        ),
        withTimeout(
          supabase
            .from("sms_logs")
            .select("id", { count: "exact", head: true })
            .gte("sent_at", thirtyDaysAgo)
            .eq("school_id", schoolId)
            .eq("status", "failed"),
          10000,
          { data: null, error: null, count: 0 } as SupabaseResponse,
        ),
        withTimeout(
          supabase
            .from("sms_logs")
            .select("id", { count: "exact", head: true })
            .gte("sent_at", thirtyDaysAgo)
            .eq("school_id", schoolId)
            .eq("status", "pending"),
          10000,
          { data: null, error: null, count: 0 } as SupabaseResponse,
        ),
        withTimeout(
          supabase
            .from("sms_logs")
            .select("id, automation_type, parent_phone, message, status, sent_at")
            .eq("school_id", schoolId)
            .order("sent_at", { ascending: false })
            .limit(50),
          10000,
          { data: [], error: null } as SupabaseResponse,
        ),
        withTimeout(
          supabase
            .from("sms_logs")
            .select("automation_type, status")
            .gte("sent_at", thirtyDaysAgo)
            .eq("school_id", schoolId),
          10000,
          { data: [], error: null } as SupabaseResponse,
        ),
      ]);

      if (sentRes.status === "fulfilled") {
        setSentCount(sentRes.value.count ?? 0);
      }
      if (failedRes.status === "fulfilled") {
        setFailedCount(failedRes.value.count ?? 0);
      }
      if (pendingRes.status === "fulfilled") {
        setPendingCount(pendingRes.value.count ?? 0);
      }

      if (recentRes.status === "fulfilled") {
        const { data } = recentRes.value;
        if (Array.isArray(data)) {
          setRecentRecords(data as SmsRecord[]);
        }
      }

      if (autoRes.status === "fulfilled") {
        const { data } = autoRes.value;
        if (Array.isArray(data)) {
          const grouped: Record<string, { sent: number; failed: number; total: number }> = {};
          (data as { automation_type: string | null; status: string }[]).forEach((r) => {
            const type = r.automation_type || "manual";
            if (!grouped[type]) {
              grouped[type] = { sent: 0, failed: 0, total: 0 };
            }
            grouped[type].total++;
            if (r.status === "sent") grouped[type].sent++;
            else if (r.status === "failed") grouped[type].failed++;
          });
          setAutomationStats(
            Object.entries(grouped)
              .map(([type, stats]) => ({ type, ...stats }))
              .sort((a, b) => b.total - a.total),
          );
        }
      }
    } catch (e) {
      logger.error("SMS delivery fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [school?.id]);

  useEffect(() => {
    if (school?.id) fetchData();
  }, [fetchData, school?.id]);

  const totalSent = sentCount;
  const totalFailed = failedCount;
  const totalAttempted = sentCount + failedCount + pendingCount;
  const deliveryRate = totalAttempted > 0 ? ((sentCount / totalAttempted) * 100).toFixed(1) : "0.0";

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="success">Sent</Badge>;
      case "failed":
        return <Badge variant="error">Failed</Badge>;
      case "pending":
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const truncateMessage = (msg: string | null, max = 60) => {
    if (!msg) return "—";
    return msg.length > max ? msg.slice(0, max) + "…" : msg;
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="SMS Delivery"
          subtitle="Monitor SMS delivery status, volume, and automation breakdown"
          actions={
            <Button onClick={fetchData} loading={loading} icon={<MaterialIcon icon="refresh" />}>
              Refresh
            </Button>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardBody>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                    <div className="h-8 bg-slate-50 rounded w-1/3" />
                    <div className="h-3 bg-slate-50 rounded w-full" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                      <MaterialIcon icon="check_circle" className="text-green-600" size={20} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-[var(--t1)]">{totalSent.toLocaleString()}</div>
                      <div className="text-xs font-medium text-[var(--t3)]">Total Sent (30d)</div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                      <MaterialIcon icon="cancel" className="text-red-600" size={20} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-[var(--t1)]">{totalFailed.toLocaleString()}</div>
                      <div className="text-xs font-medium text-[var(--t3)]">Total Failed (30d)</div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <MaterialIcon icon="percent" className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${parseFloat(deliveryRate) < 90 ? "text-red-600" : "text-green-600"}`}>
                        {deliveryRate}%
                      </div>
                      <div className="text-xs font-medium text-[var(--t3)]">Delivery Rate (30d)</div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardBody>
                  <h3 className="text-sm font-semibold text-[var(--t1)] mb-3">Today Overview</h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <MaterialIcon icon="check_circle" size={18} className="text-green-500 mx-auto" />
                      <div className="text-lg font-bold text-[var(--t1)] mt-1">{sentCount}</div>
                      <div className="text-[10px] text-[var(--t3)]">Sent</div>
                    </div>
                    <div>
                      <MaterialIcon icon="cancel" size={18} className="text-red-500 mx-auto" />
                      <div className="text-lg font-bold text-[var(--t1)] mt-1">{failedCount}</div>
                      <div className="text-[10px] text-[var(--t3)]">Failed</div>
                    </div>
                    <div>
                      <MaterialIcon icon="pending" size={18} className="text-amber-500 mx-auto" />
                      <div className="text-lg font-bold text-[var(--t1)] mt-1">{pendingCount}</div>
                      <div className="text-[10px] text-[var(--t3)]">Pending</div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h3 className="text-sm font-semibold text-[var(--t1)] mb-3">Automation Breakdown</h3>
                  {automationStats.length === 0 ? (
                    <div className="text-sm text-[var(--t3)] py-2">No data</div>
                  ) : (
                    <div className="space-y-2">
                      {automationStats.map((stat) => (
                        <div key={stat.type} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <MaterialIcon icon={stat.type === "manual" ? "edit" : "smart_toy"} size={14} className="text-[var(--t3)] shrink-0" />
                            <span className="truncate text-[var(--t1)] font-medium capitalize">{stat.type.replace(/_/g, " ")}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-green-600 font-mono">{stat.sent}</span>
                            <span className="text-[var(--t3)]">/</span>
                            <span className={stat.failed > 0 ? "text-red-600 font-mono" : "text-[var(--t3)] font-mono"}>{stat.failed}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h3 className="text-sm font-semibold text-[var(--t1)] mb-3">Delivery Health</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-[var(--t3)] mb-1">
                        <span>Success Rate</span>
                        <span>{deliveryRate}%</span>
                      </div>
                      <div className="w-full h-2 bg-[var(--surface-container)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${parseFloat(deliveryRate) >= 95 ? "bg-green-500" : parseFloat(deliveryRate) >= 80 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(parseFloat(deliveryRate), 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-[var(--t3)]">
                      {pendingCount > 0 && (
                        <span className="flex items-center gap-1">
                          <MaterialIcon icon="info" size={12} />
                          {pendingCount} message{pendingCount !== 1 ? "s" : ""} still pending
                        </span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[var(--t1)]">Recent Activity</h3>
                  <span className="text-[11px] text-[var(--t3)] font-mono">{recentRecords.length} records</span>
                </div>
                {recentRecords.length === 0 ? (
                  <div className="text-sm text-[var(--t3)] py-6 text-center">No SMS activity found</div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:-mx-0">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[var(--t3)] border-b border-[var(--border)]">
                          <th className="text-left py-2 px-4 font-medium">Phone</th>
                          <th className="text-left py-2 px-4 font-medium">Message</th>
                          <th className="text-left py-2 px-4 font-medium">Type</th>
                          <th className="text-center py-2 px-4 font-medium">Status</th>
                          <th className="text-right py-2 px-4 font-medium">Sent At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentRecords.map((record) => (
                          <tr key={record.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-container)] transition-colors">
                            <td className="py-2.5 px-4 font-mono text-[var(--t1)]">
                              {record.parent_phone || "—"}
                            </td>
                            <td className="py-2.5 px-4 text-[var(--t2)] max-w-[200px] truncate" title={record.message || ""}>
                              {truncateMessage(record.message)}
                            </td>
                            <td className="py-2.5 px-4 capitalize text-[var(--t3)]">
                              {(record.automation_type || "manual").replace(/_/g, " ")}
                            </td>
                            <td className="py-2.5 px-4 text-center">{statusBadge(record.status)}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-[var(--t3)] whitespace-nowrap">
                              {new Date(record.sent_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </PageErrorBoundary>
  );
}
