"use client";
import { Card } from "@/components/ui/Card";
import { Button, Input } from "@/components/ui/index";
import MaterialIcon from "@/components/MaterialIcon";

interface MessageAutomationProps {
  triggers: any[];
  triggersLoading: boolean;
  absencePreview: { count: number; threshold: number };
  automationLogs: any[];
  showRuleModal: boolean;
  onShowRuleModalChange: (show: boolean) => void;
  editingTrigger: any | null;
  savingRule: boolean;
  ruleForm: {
    name: string;
    event_type: string;
    threshold_days: number;
    is_active: boolean;
  };
  onRuleFormChange: (form: any) => void;
  runningTriggerId: string | null;
  onToggleTrigger: (id: string, currentStatus: boolean) => void;
  onRunTrigger: (id: string) => void;
  onOpenCreateRule: () => void;
  onOpenEditRule: (trigger: any) => void;
  onSaveRule: (e: React.FormEvent) => void;
}

export default function MessageAutomation({
  triggers,
  triggersLoading,
  absencePreview,
  automationLogs,
  showRuleModal,
  onShowRuleModalChange,
  editingTrigger,
  savingRule,
  ruleForm,
  onRuleFormChange,
  runningTriggerId,
  onToggleTrigger,
  onRunTrigger,
  onOpenCreateRule,
  onOpenEditRule,
  onSaveRule,
}: MessageAutomationProps) {
  const ruleValidationError = !ruleForm.name.trim()
    ? "Add a rule name to continue."
    : Number(ruleForm.threshold_days) < 1 || Number(ruleForm.threshold_days) > 30
      ? "Threshold days must be between 1 and 30."
      : "";

  return (
    <>
      {triggersLoading ? (
        <div className="p-8 text-center">Loading automation rules...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {triggers.map((trigger) => (
              <Card key={trigger.id} className="relative overflow-hidden p-6">
                <div
                  className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-20 transition-all ${trigger.is_active ? "bg-green-500" : "bg-gray-300"}`}
                />
                <div className="flex items-center justify-between mb-6">
                  <div
                    className={`p-3 rounded-2xl ${trigger.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    <MaterialIcon>{trigger.event_type === "fee_overdue" ? "payments" : "person_off"}</MaterialIcon>
                  </div>
                  <button
                    onClick={() => onToggleTrigger(trigger.id, trigger.is_active)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${trigger.is_active ? "bg-green-600" : "bg-gray-300"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${trigger.is_active ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--t1)]">{trigger.name}</h3>
                    <p className="text-xs text-[var(--t3)] uppercase tracking-widest">
                      {trigger.event_type.replace("_", " ")}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
                    <div className="flex items-center gap-2 text-sm text-[var(--t3)]">
                      <MaterialIcon className="text-xs">bolt</MaterialIcon>
                      <span>Threshold: {trigger.threshold_days} days</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
                    <p className="text-[10px] text-[var(--t3)] italic">
                      Last run: {trigger.last_run_at ? new Date(trigger.last_run_at).toLocaleDateString() : "Never"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={runningTriggerId === trigger.id || !trigger.is_active}
                        onClick={() => onRunTrigger(trigger.id)}
                      >
                        {runningTriggerId === trigger.id ? "Running..." : "Run Now"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onOpenEditRule(trigger)}>
                        Edit Rule
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            <button
              onClick={onOpenCreateRule}
              className="border-2 border-dashed border-[var(--border)] hover:border-blue-300 hover:bg-blue-50/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--surface-container)] flex items-center justify-center text-[var(--t3)] group-hover:text-blue-500 group-hover:bg-blue-100 transition-all">
                <MaterialIcon>add</MaterialIcon>
              </div>
              <p className="text-sm font-medium text-[var(--t3)] group-hover:text-[var(--t2)]">New Automation Rule</p>
            </button>
          </div>

          <Card className="p-6">
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">Attendance trigger preview</div>
              <div className="mt-1 text-sm text-amber-800">
                {absencePreview.count} student
                {absencePreview.count === 1 ? "" : "s"} currently meet the {absencePreview.threshold}-day consecutive
                absence threshold.
              </div>
            </div>
            <h2 className="text-xl font-bold text-[var(--t1)] mb-6">Automation Logs</h2>
            <div className="space-y-3">
              {automationLogs.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container)] p-4 text-sm text-[var(--t3)]">
                  No automation runs recorded yet.
                </div>
              ) : (
                automationLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-2 h-2 rounded-full ${log.status === "sent" ? "bg-green-500" : "bg-red-500"}`}
                      />
                      <div>
                        <p className="text-sm font-medium text-[var(--t1)]">
                          {log.sms_triggers?.name || "Automation Rule"}{" "}
                          {log.status === "sent" ? "processed successfully" : "failed"}
                        </p>
                        <p className="text-[10px] text-[var(--t3)]">
                          {new Date(log.sent_at || log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <MaterialIcon className="text-[var(--t3)]">
                      {log.status === "sent" ? "check_circle" : "error"}
                    </MaterialIcon>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}

      {showRuleModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-4 overflow-y-auto flex items-start sm:items-center justify-center"
          onClick={() => onShowRuleModalChange(false)}
        >
          <Card
            className="w-full max-w-md p-6 max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
              {editingTrigger ? "Edit Automation Rule" : "Create Automation Rule"}
            </h2>
            <form className="space-y-4" onSubmit={onSaveRule}>
              <Input
                label="Rule Name"
                value={ruleForm.name}
                onChange={(e) => onRuleFormChange({ ...ruleForm, name: e.target.value })}
                required
              />
              <div>
                <label className="block text-sm font-medium text-[var(--on-surface)] mb-2">Trigger Event</label>
                <select
                  value={ruleForm.event_type}
                  disabled={Boolean(editingTrigger)}
                  onChange={(e) =>
                    onRuleFormChange({
                      ...ruleForm,
                      event_type: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <option value="student_absent">Student Absent</option>
                  <option value="fee_overdue">Fee Overdue</option>
                </select>
              </div>
              <Input
                label="Threshold Days"
                type="number"
                inputMode="numeric"
                min={0}
                value={String(ruleForm.threshold_days)}
                onChange={(e) =>
                  onRuleFormChange({
                    ...ruleForm,
                    threshold_days: Number(e.target.value) || 0,
                  })
                }
                required
              />
              <label className="flex items-center gap-3 text-sm text-[var(--t1)]">
                <input
                  type="checkbox"
                  checked={ruleForm.is_active}
                  onChange={(e) =>
                    onRuleFormChange({
                      ...ruleForm,
                      is_active: e.target.checked,
                    })
                  }
                />
                Active
              </label>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => onShowRuleModalChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  loading={savingRule}
                  disabled={savingRule || Boolean(ruleValidationError)}
                >
                  Save Rule
                </Button>
              </div>
              {ruleValidationError && <p className="text-sm text-[var(--t3)]">{ruleValidationError}</p>}
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
