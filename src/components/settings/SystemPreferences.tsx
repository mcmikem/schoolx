"use client";
import { Card, CardBody } from "@/components/ui/Card";

type SettingsData = {
  sms_notifications: boolean;
  attendance_alerts: boolean;
  fee_reminders: boolean;
  attendance_threshold: number;
  grade_threshold: number;
  fee_threshold: number;
};

interface SystemPreferencesProps {
  settings: SettingsData;
  onSettingChange: (key: keyof SettingsData, value: boolean | number) => void;
}

export default function SystemPreferences({ settings, onSettingChange }: SystemPreferencesProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-6">Notification Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
              <div>
                <div className="font-medium text-[var(--on-surface)]">SMS Notifications</div>
                <div className="text-sm text-[var(--t3)]">Send SMS to parents for fee reminders</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.sms_notifications}
                  onChange={(e) => onSettingChange("sms_notifications", e.target.checked)}
                />
                <div className="w-11 h-6 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]" />
              </label>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
              <div>
                <div className="font-medium text-[var(--on-surface)]">Attendance Alerts</div>
                <div className="text-sm text-[var(--t3)]">Notify when student is absent</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.attendance_alerts}
                  onChange={(e) => onSettingChange("attendance_alerts", e.target.checked)}
                />
                <div className="w-11 h-6 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]" />
              </label>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium text-[var(--on-surface)]">Fee Reminders</div>
                <div className="text-sm text-[var(--t3)]">Send automatic fee balance reminders</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.fee_reminders}
                  onChange={(e) => onSettingChange("fee_reminders", e.target.checked)}
                />
                <div className="w-11 h-6 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]" />
              </label>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-6">Warning Thresholds</h2>
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                Attendance Rate Threshold (%)
              </label>
              <p className="text-sm text-[var(--t3)] mb-2">Students below this attendance rate will be flagged</p>
              <input
                type="number"
                inputMode="numeric"
                value={settings.attendance_threshold}
                onChange={(e) => onSettingChange("attendance_threshold", parseInt(e.target.value) || 80)}
                className="w-32 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                min={0}
                max={100}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Grade Threshold (%)</label>
              <p className="text-sm text-[var(--t3)] mb-2">
                Students scoring below this in 2+ subjects will be flagged
              </p>
              <input
                type="number"
                inputMode="numeric"
                value={settings.grade_threshold}
                onChange={(e) => onSettingChange("grade_threshold", parseInt(e.target.value) || 50)}
                className="w-32 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                min={0}
                max={100}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Fee Threshold (UGX)</label>
              <p className="text-sm text-[var(--t3)] mb-2">Students with payments below this amount will be flagged</p>
              <input
                type="number"
                inputMode="numeric"
                value={settings.fee_threshold}
                onChange={(e) => onSettingChange("fee_threshold", parseInt(e.target.value) || 50000)}
                className="w-32 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                min={0}
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
