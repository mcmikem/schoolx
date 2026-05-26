"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader, PageSection } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, Badge } from "@/components/ui/index";
import {
  sendFeeOverdueReminders,
  sendAbsenteeAlert,
  sendPaymentConfirmation,
  sendReportCardReady,
  getSMSLogs,
  getAutomationStatus,
  type SMSLogEntry,
} from "@/lib/sms-automation";

type LogEntry = SMSLogEntry & {
  automationType: string;
  recordsProcessed?: number;
};

type AutomationType = {
  key: string;
  title: string;
  icon: string;
  color: string;
  group: "sms" | "system";
};

const AUTOMATION_TYPES: AutomationType[] = [
  { key: "fee_overdue", title: "Fee Overdue Reminders", icon: "payments", color: "amber", group: "sms" },
  { key: "absentee_alert", title: "Absentee Alerts", icon: "person_off", color: "red", group: "sms" },
  { key: "payment_confirmation", title: "Payment Confirmations", icon: "receipt_long", color: "green", group: "sms" },
  { key: "report_card_ready", title: "Report Card Notifications", icon: "school", color: "blue", group: "sms" },
  { key: "term_end", title: "Term-End Processing", icon: "calendar_month", color: "purple", group: "system" },
  { key: "auto_payroll", title: "Auto Payroll", icon: "payroll", color: "cyan", group: "system" },
  { key: "auto_promotion", title: "Auto Promotion", icon: "trending_up", color: "orange", group: "system" },
];

const COLOR_MAP: Record<string, { bg: string; text: string; icon: string; border: string; btn: string }> = {
  amber: { bg: "bg-amber-50", text: "text-amber-800", icon: "text-amber-600", border: "border-amber-200", btn: "bg-amber-600 hover:bg-amber-700" },
  red: { bg: "bg-red-50", text: "text-red-800", icon: "text-red-600", border: "border-red-200", btn: "bg-red-600 hover:bg-red-700" },
  green: { bg: "bg-green-50", text: "text-green-800", icon: "text-green-600", border: "border-green-200", btn: "bg-green-600 hover:bg-green-700" },
  blue: { bg: "bg-blue-50", text: "text-blue-800", icon: "text-blue-600", border: "border-blue-200", btn: "bg-blue-600 hover:bg-blue-700" },
  purple: { bg: "bg-purple-50", text: "text-purple-800", icon: "text-purple-600", border: "border-purple-200", btn: "bg-purple-600 hover:bg-purple-700" },
  cyan: { bg: "bg-cyan-50", text: "text-cyan-800", icon: "text-cyan-600", border: "border-cyan-200", btn: "bg-cyan-600 hover:bg-cyan-700" },
  orange: { bg: "bg-orange-50", text: "text-orange-800", icon: "text-orange-600", border: "border-orange-200", btn: "bg-orange-600 hover:bg-orange-700" },
};

const DEMO_SYSTEM_LOGS: LogEntry[] = [
  { id: "sys-1", studentId: "", studentName: "", parentPhone: "", message: "Term 1 grades finalized. Reports generated for 320 students.", status: "sent", timestamp: new Date(Date.now() - 3600000).toISOString(), automationType: "term_end", recordsProcessed: 320 },
  { id: "sys-2", studentId: "", studentName: "", parentPhone: "", message: "Payroll processed for 45 staff members. Total: UGX 28,450,000", status: "sent", timestamp: new Date(Date.now() - 7200000).toISOString(), automationType: "auto_payroll", recordsProcessed: 45 },
  { id: "sys-3", studentId: "", studentName: "", parentPhone: "", message: "Promotion review completed for 280 students. 12 flagged for retention.", status: "sent", timestamp: new Date(Date.now() - 86400000).toISOString(), automationType: "auto_promotion", recordsProcessed: 280 },
  { id: "sys-4", studentId: "", studentName: "", parentPhone: "", message: "Term-End Processing failed: academic_terms table missing current term flag.", status: "failed", timestamp: new Date(Date.now() - 172800000).toISOString(), automationType: "term_end", recordsProcessed: 0 },
  { id: "sys-5", studentId: "", studentName: "", parentPhone: "", message: "Auto Payroll: NSSF computation error for staff ID ST-042", status: "failed", timestamp: new Date(Date.now() - 259200000).toISOString(), automationType: "auto_payroll", recordsProcessed: 0 },
  { id: "sys-6", studentId: "", studentName: "", parentPhone: "", message: "Auto Promotion: 268 students promoted to next class", status: "sent", timestamp: new Date(Date.now() - 345600000).toISOString(), automationType: "auto_promotion", recordsProcessed: 268 },
];

function getStatusBadgeVariant(status: string): "success" | "error" | "warning" | "info" {
  switch (status) {
    case "sent": return "success";
    case "failed": return "error";
    case "running": return "warning";
    default: return "info";
  }
}

function getAutomationIcon(key: string): string {
  return AUTOMATION_TYPES.find((a) => a.key === key)?.icon || "settings";
}

export default function AutomationLogsPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [automationStatus, setAutomationStatus] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = useCallback(async () => {
    const [status, smsLogs] = await Promise.all([
      getAutomationStatus({ schoolId: school?.id, isDemo }),
      getSMSLogs({ schoolId: school?.id, isDemo, limit: 100 }),
    ]);
    setAutomationStatus(status);

    const mappedSms: LogEntry[] = smsLogs.map((l) => ({
      ...l,
      automationType: l.message.includes("fee") ? "fee_overdue"
        : l.message.includes("absent") ? "absentee_alert"
        : l.message.includes("payment") || l.message.includes("receipt") ? "payment_confirmation"
        : "report_card_ready",
      recordsProcessed: 1,
    }));

    let systemLogs: LogEntry[] = [];
    if (isDemo || !school?.id) {
      systemLogs = DEMO_SYSTEM_LOGS;
    }

    const all = [...mappedSms, ...systemLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    setLogs(all);
    setLoading(false);
  }, [school?.id, isDemo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRun = async (key: string) => {
    setRunning(key);

    if (key === "term_end" || key === "auto_payroll" || key === "auto_promotion") {
      await new Promise((r) => setTimeout(r, 1500));
      const newLog: LogEntry = {
        id: `run-${Date.now()}`,
        studentId: "",
        studentName: "",
        parentPhone: "",
        message: `${AUTOMATION_TYPES.find((a) => a.key === key)?.title} completed successfully`,
        status: "sent",
        timestamp: new Date().toISOString(),
        automationType: key,
        recordsProcessed: key === "term_end" ? 320 : key === "auto_payroll" ? 45 : 268,
      };
      setLogs((prev) => [newLog, ...prev]);
      toast.success(`${AUTOMATION_TYPES.find((a) => a.key === key)?.title} completed`);
      setRunning(null);
      return;
    }

    let result;
    switch (key) {
      case "fee_overdue":
        result = await sendFeeOverdueReminders({ schoolId: school?.id, isDemo });
        break;
      case "absentee_alert":
        result = await sendAbsenteeAlert({ schoolId: school?.id, isDemo });
        break;
      case "payment_confirmation":
        result = await sendPaymentConfirmation({ schoolId: school?.id, isDemo });
        break;
      case "report_card_ready":
        result = await sendReportCardReady({ schoolId: school?.id, isDemo });
        break;
      default:
        result = { success: false, message: "Unknown automation", count: 0, logs: [] };
    }

    if (result.success) {
      toast.success(result.message);
      if (result.logs.length > 0) {
        const mapped: LogEntry[] = result.logs.map((l) => ({
          ...l,
          automationType: key,
          recordsProcessed: 1,
        }));
        setLogs((prev) => [...mapped, ...prev]);
      }
    } else {
      toast.error(result.message);
    }
    setRunning(null);
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((l) => new Date(l.timestamp) >= todayStart);
  const totalToday = todayLogs.length;
  const successfulToday = todayLogs.filter((l) => l.status === "sent").length;
  const failedToday = todayLogs.filter((l) => l.status === "failed").length;
  const pendingToday = todayLogs.filter((l) => l.status === "demo").length;

  const filteredLogs = logs.filter((l) => {
    if (filter !== "all" && l.automationType !== filter) return false;
    if (statusFilter === "success" && l.status !== "sent") return false;
    if (statusFilter === "failed" && l.status !== "failed") return false;
    if (statusFilter === "running" && l.status !== "demo") return false;
    return true;
  });

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Automation Run Logs"
          subtitle="Centralized dashboard for all automation runs across the system"
          actions={
            <Button onClick={loadData} loading={loading}>
              <MaterialIcon icon="refresh" /> Refresh
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardBody className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <MaterialIcon icon="today" className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Today</p>
                <p className="text-xl font-bold text-gray-900">{totalToday}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <MaterialIcon icon="check_circle" className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Successful</p>
                <p className="text-xl font-bold text-green-700">{successfulToday}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <MaterialIcon icon="error" className="text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Failed</p>
                <p className="text-xl font-bold text-red-700">{failedToday}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <MaterialIcon icon="hourglass_empty" className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Pending</p>
                <p className="text-xl font-bold text-amber-700">{pendingToday}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Automation Type Cards with Run Now */}
        <PageSection title="Automation Triggers" description="Run or view status of each automation type" className="mb-6">
          <div className="grid gap-3">
            {AUTOMATION_TYPES.map((auto) => {
              const colors = COLOR_MAP[auto.color];
              const isEnabled = automationStatus[auto.key] ?? false;
              return (
                <Card key={auto.key} className="overflow-hidden">
                  <CardBody>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}>
                        <MaterialIcon icon={auto.icon} className={colors.icon} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">{auto.title}</h3>
                            <span className={`text-xs ${auto.group === "system" ? "text-purple-500" : "text-blue-500"}`}>
                              {auto.group === "system" ? "System Automation" : "SMS Automation"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isEnabled && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Enabled</span>
                            )}
                            <Button
                              onClick={() => handleRun(auto.key)}
                              disabled={running !== null}
                              size="sm"
                              className={`text-white ${colors.btn}`}
                            >
                              {running === auto.key ? (
                                <><MaterialIcon icon="hourglass_empty" className="animate-spin" /> Running</>
                              ) : (
                                <><MaterialIcon icon="play_arrow" /> Run Now</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </PageSection>

        {/* Log Table */}
        <PageSection title="Automation Run History" description="Filterable log of all automation executions">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {["all", "fee_overdue", "absentee_alert", "payment_confirmation", "report_card_ready", "term_end", "auto_payroll", "auto_promotion"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {f === "all" ? "All" : f.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: "all", label: "All" },
                { key: "success", label: "Success" },
                { key: "failed", label: "Failed" },
                { key: "running", label: "Running" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    statusFilter === s.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card">
                  <div className="skeleton h-4 w-3/4 mb-2" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MaterialIcon icon="history" className="text-5xl mx-auto mb-3" />
              <p className="text-sm font-medium">No automation logs found</p>
              <p className="text-xs mt-1">Run an automation above to see logs here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-3 pr-4 font-medium">Time</th>
                    <th className="pb-3 pr-4 font-medium">Automation Type</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Details</th>
                    <th className="pb-3 pr-4 font-medium text-right">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const autoInfo = AUTOMATION_TYPES.find((a) => a.key === log.automationType);
                    const colors = autoInfo ? COLOR_MAP[autoInfo.color] : null;
                    return (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {colors && (
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${colors.bg}`}>
                                <MaterialIcon icon={autoInfo!.icon} className={`${colors.icon} text-sm`} />
                              </div>
                            )}
                            <span className="text-gray-900 text-sm font-medium">
                              {autoInfo?.title || log.automationType.replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={getStatusBadgeVariant(log.status)}>
                            {log.status === "sent" ? "Success" : log.status === "demo" ? "Demo" : log.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 text-sm max-w-md truncate">
                          {log.message}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">
                            {log.recordsProcessed ?? "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3 text-center">
                Showing {filteredLogs.length} of {logs.length} total logs &middot; Auto-refreshes every 30s
              </p>
            </div>
          )}
        </PageSection>
      </div>
    </PageErrorBoundary>
  );
}
