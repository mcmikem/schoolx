"use client";
import { useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import MaterialIcon from "@/components/MaterialIcon";

type AudienceType = "all" | "class" | "outstanding_fees" | "custom";

interface StudentItem {
  id: string;
  first_name: string;
  last_name: string;
  parent_phone: string;
  class_id: string;
  classes?: { name: string };
}

interface ClassItem {
  id: string;
  name: string;
}

interface SMSTemplate {
  id: string;
  name: string;
  category: string;
  message: string;
  is_active: boolean;
}

interface MessageRecipientsProps {
  audience: AudienceType;
  onAudienceChange: (type: AudienceType) => void;
  bulkSelectedClass: string;
  onBulkSelectedClassChange: (cls: string) => void;
  selectedStudents: string[];
  onToggleStudent: (id: string) => void;
  bulkMessage: string;
  onBulkMessageChange: (msg: string) => void;
  selectedTemplateId: string;
  onTemplateSelect: (id: string) => void;
  templates: SMSTemplate[];
  classes: ClassItem[];
  allStudents: StudentItem[];
  showConfirm: boolean;
  onShowConfirmChange: (show: boolean) => void;
  bulkSending: boolean;
  onBulkSend: () => void;
}

const audienceOptions = [
  { value: "all" as AudienceType, label: "All Parents", icon: "groups" },
  { value: "class" as AudienceType, label: "By Class", icon: "school" },
  { value: "outstanding_fees" as AudienceType, label: "Outstanding Fees", icon: "payments" },
  { value: "custom" as AudienceType, label: "Custom Selection", icon: "checklist" },
];

export default function MessageRecipients({
  audience,
  onAudienceChange,
  bulkSelectedClass,
  onBulkSelectedClassChange,
  selectedStudents,
  onToggleStudent,
  bulkMessage,
  onBulkMessageChange,
  selectedTemplateId,
  onTemplateSelect,
  templates,
  classes,
  allStudents,
  showConfirm,
  onShowConfirmChange,
  bulkSending,
  onBulkSend,
}: MessageRecipientsProps) {
  const bulkRecipients = useMemo(() => {
    let filtered = allStudents.filter((s) => s.parent_phone);
    if (audience === "class" && bulkSelectedClass)
      filtered = filtered.filter((s) => s.class_id === bulkSelectedClass);
    else if (audience === "custom")
      filtered = filtered.filter((s) => selectedStudents.includes(s.id));
    const phones = new Set(filtered.map((s) => s.parent_phone));
    return { students: filtered, phoneCount: phones.size };
  }, [allStudents, audience, bulkSelectedClass, selectedStudents]);

  const smsCount = useMemo(
    () => Math.ceil(bulkMessage.length / 160) || 0,
    [bulkMessage],
  );

  const costEstimate = useMemo(
    () => bulkRecipients.phoneCount * smsCount * 30,
    [bulkRecipients.phoneCount, smsCount],
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
              Target Audience
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {audienceOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onAudienceChange(opt.value)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${audience === opt.value ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)] hover:border-[var(--t3)]"}`}
                >
                  <MaterialIcon
                    className={`text-2xl mb-1 ${audience === opt.value ? "text-[var(--primary)]" : "text-[var(--t3)]"}`}
                  >
                    {opt.icon}
                  </MaterialIcon>
                  <div
                    className={`text-sm font-medium ${audience === opt.value ? "text-[var(--primary)]" : "text-[var(--t3)]"}`}
                  >
                    {opt.label}
                  </div>
                </button>
              ))}
            </div>
            {audience === "class" && (
              <div className="mt-4">
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                  Select Class
                </label>
                {classes.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                    No classes available
                  </div>
                ) : (
                  <select
                    value={bulkSelectedClass}
                    onChange={(e) => onBulkSelectedClassChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
                  >
                    <option value="">Choose class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {audience === "custom" && (
              <div className="mt-4">
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                  Select Students ({selectedStudents.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-[var(--border)] rounded-xl">
                  {allStudents.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 p-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-container)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(s.id)}
                        onChange={() => onToggleStudent(s.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[var(--t1)]">
                        {s.first_name} {s.last_name}
                        <span className="text-[var(--t3)] ml-1">
                          ({s.classes?.name || "No class"})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
              Message
            </h2>
            {templates.length > 0 && (
              <div className="mb-4">
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                  Use Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => onTemplateSelect(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
                >
                  <option value="">Write custom message</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <textarea
                value={bulkMessage}
                onChange={(e) => {
                  onBulkMessageChange(e.target.value);
                  onTemplateSelect("");
                }}
                placeholder="Type your message here..."
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] min-h-[120px] resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p
                  className={`text-xs ${bulkMessage.length > 160 ? "text-red-600 font-medium" : "text-[var(--t3)]"}`}
                >
                  {bulkMessage.length} characters ({smsCount} SMS
                  {smsCount > 1 ? "es" : ""} per recipient)
                </p>
                {bulkMessage.length > 160 && (
                  <p className="text-xs text-red-600">
                    Message will be split into {smsCount} SMS segments
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
              Summary
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                <span className="text-sm text-[var(--t3)]">Recipients</span>
                <span className="font-bold text-[var(--t1)]">
                  {bulkRecipients.phoneCount} parents
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                <span className="text-sm text-[var(--t3)]">
                  SMS per parent
                </span>
                <span className="font-bold text-[var(--t1)]">{smsCount}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                <span className="text-sm text-[var(--t3)]">Total SMS</span>
                <span className="font-bold text-[var(--t1)]">
                  {bulkRecipients.phoneCount * smsCount}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-[var(--t3)]">Est. Cost</span>
                <span className="font-bold text-[var(--t1)]">
                  UGX {costEstimate.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-[var(--surface-container)]">
            <p className="text-sm text-[var(--t3)]">
              <MaterialIcon className="text-sm align-text-bottom mr-1">
                info
              </MaterialIcon>
              This SMS will be sent to{" "}
              <strong className="text-[var(--t1)]">
                {bulkRecipients.phoneCount} parent
                {bulkRecipients.phoneCount !== 1 ? "s" : ""}
              </strong>
              {smsCount > 0 && (
                <span>
                  {" "}
                  ({bulkRecipients.phoneCount * smsCount} total SMS segment
                  {bulkRecipients.phoneCount * smsCount > 1 ? "s" : ""})
                </span>
              )}
            </p>
          </Card>

          <Button
            onClick={() => onShowConfirmChange(true)}
            disabled={!bulkMessage.trim() || bulkRecipients.phoneCount === 0}
            className="w-full"
          >
            <MaterialIcon icon="send" className="text-lg" />
            Send Bulk SMS
          </Button>
        </div>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => onShowConfirmChange(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--t1)]">
                Confirm Bulk SMS
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[var(--surface-container)] rounded-xl p-4">
                <div className="text-sm text-[var(--t3)] mb-1">Message</div>
                <p className="text-sm text-[var(--t1)]">{bulkMessage}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--surface-container)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[var(--t1)]">
                    {bulkRecipients.phoneCount}
                  </div>
                  <div className="text-xs text-[var(--t3)]">Recipients</div>
                </div>
                <div className="bg-[var(--surface-container)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[var(--t1)]">
                    UGX {costEstimate.toLocaleString()}
                  </div>
                  <div className="text-xs text-[var(--t3)]">Est. Cost</div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => onShowConfirmChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={bulkSending}
                  onClick={onBulkSend}
                >
                  {bulkSending ? "Sending..." : "Confirm & Send"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
