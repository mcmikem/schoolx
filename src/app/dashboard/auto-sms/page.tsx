"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import {
  sendFeeOverdueReminders,
  sendAbsenteeAlert,
  sendPaymentConfirmation,
  sendReportCardReady,
  getSMSLogs,
  getAutomationStatus,
  toggleAutomation,
  type SMSLogEntry,
} from "@/lib/sms-automation";

const AUTOMATIONS = [
  {
    key: "fee_overdue",
    title: "Fee Overdue Reminders",
    description: "Auto-send SMS to parents when fees are overdue (7, 14, 30 days)",
    icon: "payments",
    color: "amber",
  },
  {
    key: "absentee_alert",
    title: "Absentee Alerts",
    description: "Notify parents immediately when their child is marked absent",
    icon: "person_off",
    color: "red",
  },
  {
    key: "payment_confirmation",
    title: "Payment Confirmations",
    description: "Send receipt confirmation SMS after fee payment is recorded",
    icon: "receipt_long",
    color: "green",
  },
  {
    key: "report_card_ready",
    title: "Report Card Notifications",
    description: "Alert parents when term report cards are ready for collection",
    icon: "school",
    color: "blue",
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; icon: string; border: string; btn: string }> = {
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    icon: "text-amber-600",
    border: "border-amber-200",
    btn: "bg-amber-600 hover:bg-amber-700",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-800",
    icon: "text-red-600",
    border: "border-red-200",
    btn: "bg-red-600 hover:bg-red-700",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-800",
    icon: "text-green-600",
    border: "border-green-200",
    btn: "bg-green-600 hover:bg-green-700",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    icon: "text-blue-600",
    border: "border-blue-200",
    btn: "bg-blue-600 hover:bg-blue-700",
  },
};

export default function AutoSMSPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const [automationStatus, setAutomationStatus] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<SMSLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"automations" | "logs">("automations");
  const [logFilter, setLogFilter] = useState("all");
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [status, smsLogs] = await Promise.all([
        getAutomationStatus({ schoolId: school?.id, isDemo }),
        getSMSLogs({ schoolId: school?.id, isDemo, limit: 50 }),
      ]);
      setAutomationStatus(status);
      setLogs(smsLogs);
      setLoading(false);
    };

    loadData();
  }, [school?.id, isDemo]);

  const handleToggle = async (key: string) => {
    // Unguarded, a double-tap on 2G fired two concurrent toggles that both read
    // the same stale automationStatus[key], producing two contradictory toasts
    // and leaving the switch in a position the server never agreed with.
    if (pendingToggle) return;
    const next = !automationStatus[key];
    setPendingToggle(key);
    try {
      const result = await toggleAutomation({
        schoolId: school?.id || "",
        automationType: key,
        isActive: next,
        isDemo,
      });
      if (result.success) {
        toast.success(result.message);
        setAutomationStatus((prev) => ({ ...prev, [key]: next }));
      } else {
        toast.error(result.message);
      }
    } finally {
      setPendingToggle(null);
    }
  };

  const handleRun = async (key: string) => {
    setRunning(key);
    let result;
    switch (key) {
      case "fee_overdue":
        result = await sendFeeOverdueReminders({
          schoolId: school?.id,
          isDemo,
        });
        break;
      case "absentee_alert":
        result = await sendAbsenteeAlert({ schoolId: school?.id, isDemo });
        break;
      case "payment_confirmation":
        result = await sendPaymentConfirmation({
          schoolId: school?.id,
          isDemo,
        });
        break;
      case "report_card_ready":
        result = await sendReportCardReady({ schoolId: school?.id, isDemo });
        break;
      default:
        result = {
          success: false,
          message: "Unknown automation",
          count: 0,
          logs: [],
        };
    }

    if (result.success) {
      toast.success(result.message);
      if (result.logs.length > 0) {
        setLogs((prev) => [...result.logs, ...prev]);
      }
    } else {
      toast.error(result.message);
    }
    setRunning(null);
  };

  const filteredLogs =
    logFilter === "all" ? logs : logs.filter((l) => l.message.toLowerCase().includes(logFilter.replace("_", " ")));

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Smart SMS Triggers"
          subtitle="Automate parent notifications for fees, attendance, and reports"
          // These automations are built-in (AUTOMATIONS above) and are switched on
          // and off individually; there is no user-defined rule to create. The page
          // used to offer a "New Automation Rule" button whose form had no state,
          // no onChange and no submit handler, so a headmaster could fill in a whole
          // fee-reminder rule, tap Create, and watch the modal close with nothing
          // created, no error, and no sign their work was gone. Removed rather than
          // left silently discarding input.
        />

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--surface-container-low)] rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab("automations")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "automations" ? "bg-[var(--surface)] text-[var(--t1)] shadow-sm" : "text-[var(--t3)] hover:text-[var(--t2)]"}`}
          >
            Automations
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "logs" ? "bg-[var(--surface)] text-[var(--t1)] shadow-sm" : "text-[var(--t3)] hover:text-[var(--t2)]"}`}
          >
            SMS Logs ({logs.length})
          </button>
        </div>

        {activeTab === "automations" ? (
          <div className="grid gap-4">
            {AUTOMATIONS.map((auto) => {
              const colors = COLOR_MAP[auto.color];
              const isEnabled = automationStatus[auto.key] ?? false;
              return (
                <Card key={auto.key} className="overflow-hidden">
                  <CardBody>
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}>
                        <MaterialIcon icon={auto.icon} className={colors.icon} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-[var(--t1)]">{auto.title}</h3>
                            <p className="text-sm text-[var(--t3)] mt-0.5">{auto.description}</p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isEnabled}
                            aria-label={`${isEnabled ? "Disable" : "Enable"} ${auto.title}`}
                            disabled={pendingToggle === auto.key}
                            onClick={() => handleToggle(auto.key)}
                            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-60 ${isEnabled ? "bg-green-500" : "bg-gray-300"}`}
                          >
                            <div
                              className={`absolute top-0.5 w-6 h-6 bg-[var(--surface)] rounded-full shadow transition-transform ${isEnabled ? "left-5" : "left-0.5"}`}
                            />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-4">
                          <Button
                            onClick={() => handleRun(auto.key)}
                            disabled={running !== null}
                            className={`text-white text-sm ${colors.btn}`}
                          >
                            {running === auto.key ? (
                              <>
                                <MaterialIcon icon="hourglass_empty" className="animate-spin" /> Running...
                              </>
                            ) : (
                              <>
                                <MaterialIcon icon="play_arrow" /> Run Now
                              </>
                            )}
                          </Button>
                          <span className="text-xs text-[var(--t3)]">{isEnabled ? "Enabled" : "Disabled"}</span>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        ) : (
          <div>
            {/* Log Filter */}
            <div className="flex gap-2 mb-4">
              {["all", "fee_overdue", "absentee_alert", "payment_confirmation", "report_card_ready"].map((f) => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${logFilter === f ? "bg-[var(--navy)] text-white" : "bg-[var(--surface-container-low)] text-[var(--t3)] hover:bg-gray-200"}`}
                >
                  {f === "all" ? "All" : f.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card">
                    <div className="skeleton h-4 w-3/4 mb-2"></div>
                    <div className="skeleton h-3 w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-[var(--t3)]">
                <MaterialIcon icon="sms" className="text-4xl mx-auto mb-2" />
                <p className="text-sm">No SMS logs found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.status === "sent"
                              ? "bg-green-100 text-green-700"
                              : log.status === "demo"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {log.status}
                        </span>
                        <span className="text-sm font-medium text-[var(--t1)]">{log.studentName || log.studentId}</span>
                      </div>
                      <span className="text-xs text-[var(--t3)]">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-[var(--t3)] line-clamp-2">{log.message}</p>
                    <div className="text-xs text-[var(--t3)] mt-1">To: {log.parentPhone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Automation Rule Modal */}
      </div>
    </PageErrorBoundary>
  );
}
