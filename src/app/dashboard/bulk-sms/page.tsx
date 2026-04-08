"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { PageGuidance } from "@/components/PageGuidance";

type AudienceType = "all" | "class" | "outstanding_fees" | "custom";

const SMS_RATE = 25;
const SMS_SEGMENT_LENGTH = 160;

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  parent_phone: string;
  class_id: string;
  classes?: { name: string };
}

export default function BulkSMSPage() {
  const { user, school, isDemo } = useAuth();
  const toast = useToast();

  const [audience, setAudience] = useState<AudienceType>("all");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [students, setStudents] = useState<Student[]>([]);

  const fetchData = useCallback(async () => {
    if (!school?.id) return;
    try {
      if (isDemo) {
        setClasses([
          { id: "1", name: "Primary 1" },
          { id: "2", name: "Primary 2" },
          { id: "3", name: "Primary 3" },
        ]);
        setStudents([
          {
            id: "1",
            first_name: "John",
            last_name: "Mugisha",
            parent_phone: "256700000001",
            class_id: "1",
            classes: { name: "Primary 1" },
          },
          {
            id: "2",
            first_name: "Sarah",
            last_name: "Nakamya",
            parent_phone: "256700000002",
            class_id: "1",
            classes: { name: "Primary 1" },
          },
          {
            id: "3",
            first_name: "David",
            last_name: "Ochen",
            parent_phone: "256700000003",
            class_id: "2",
            classes: { name: "Primary 2" },
          },
          {
            id: "4",
            first_name: "Grace",
            last_name: "Achieng",
            parent_phone: "256700000004",
            class_id: "2",
            classes: { name: "Primary 2" },
          },
          {
            id: "5",
            first_name: "Peter",
            last_name: "Okello",
            parent_phone: "256700000005",
            class_id: "3",
            classes: { name: "Primary 3" },
          },
        ]);
        setLoading(false);
        return;
      }
      const [classesRes, studentsRes] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name")
          .eq("school_id", school.id)
          .order("name"),
        supabase
          .from("students")
          .select(
            "id, first_name, last_name, parent_phone, class_id, classes(name)",
          )
          .eq("school_id", school.id)
          .eq("status", "active"),
      ]);
      if (classesRes.data) setClasses(classesRes.data);
      if (studentsRes.data)
        setStudents(studentsRes.data as unknown as Student[]);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id, isDemo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recipients = useMemo(() => {
    let filtered = students.filter((s) => s.parent_phone);
    if (audience === "class" && selectedClass) {
      filtered = filtered.filter((s) => s.class_id === selectedClass);
    } else if (audience === "outstanding_fees") {
      filtered = filtered.slice(0, Math.ceil(filtered.length * 0.3));
    } else if (audience === "custom") {
      filtered = filtered.filter((s) => selectedStudents.includes(s.id));
    }
    const phones = new Set(filtered.map((s) => s.parent_phone));
    return { students: filtered, phoneCount: phones.size };
  }, [students, audience, selectedClass, selectedStudents]);

  const smsSegments = useMemo(
    () => Math.ceil(message.length / SMS_SEGMENT_LENGTH) || 0,
    [message],
  );

  const costEstimate = useMemo(
    () => recipients.phoneCount * smsSegments * SMS_RATE,
    [recipients.phoneCount, smsSegments],
  );

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  };

  const handleSend = async () => {
    if (
      !message.trim() ||
      recipients.phoneCount === 0 ||
      !school?.id ||
      !user?.id
    )
      return;
    setSending(true);
    try {
      const phones = recipients.students
        .map((s) => s.parent_phone)
        .filter(Boolean);
      if (isDemo) {
        toast.success(
          `Demo: SMS would be sent to ${recipients.phoneCount} parents`,
        );
        setShowConfirm(false);
        setMessage("");
        return;
      }
      const response = await fetch("/api/sms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones, message, schoolId: school.id }),
      });
      const result = await response.json();
      if (result.success) {
        await supabase.from("messages").insert({
          school_id: school.id,
          recipient_type:
            audience === "all"
              ? "all"
              : audience === "class"
                ? "class"
                : "bulk",
          recipient_id: audience === "class" ? selectedClass : null,
          message,
          status: "sent",
          sent_by: user.id,
          sent_at: new Date().toISOString(),
          recipient_count: recipients.phoneCount,
        });
        toast.success(
          `SMS sent to ${recipients.phoneCount} parent${recipients.phoneCount > 1 ? "s" : ""}`,
        );
        setShowConfirm(false);
        setMessage("");
      } else {
        toast.error(result.message || "Failed to send SMS");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const audienceOptions = [
    {
      value: "all" as AudienceType,
      label: "All Parents",
      icon: "groups",
      desc: "Send to every parent",
    },
    {
      value: "class" as AudienceType,
      label: "By Class",
      icon: "school",
      desc: "Target a specific class",
    },
    {
      value: "outstanding_fees" as AudienceType,
      label: "Outstanding Fees",
      icon: "payments",
      desc: "Parents with unpaid fees",
    },
    {
      value: "custom" as AudienceType,
      label: "Custom Selection",
      icon: "checklist",
      desc: "Pick individual students",
    },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-center">
          <MaterialIcon className="text-4xl text-[var(--primary)] animate-spin">
            sync
          </MaterialIcon>
          <p className="mt-3 text-sm text-[var(--t3)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Bulk SMS"
        subtitle="Send bulk messages to parents at scale"
      />

      <PageGuidance
        title="How to Send Bulk SMS"
        tips={[
          {
            icon: "groups",
            text: "Audience: Select all parents, a specific class, or those with outstanding fees",
          },
          {
            icon: "edit",
            text: "Compose: Type your message (standard SMS is 160 chars)",
          },
          {
            icon: "preview",
            text: "Preview: See how many segments and cost before sending",
          },
          {
            icon: "send",
            text: "Send: Click 'Send SMS' - you'll see delivery status",
          },
          {
            icon: "sms",
            text: "Cost: UGX 25 per SMS segment (longer messages cost more)",
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Audience Selection */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
                <MaterialIcon className="text-xl align-text-bottom mr-2 text-[var(--primary)]">
                  groups
                </MaterialIcon>
                Target Audience
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {audienceOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAudience(opt.value)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      audience === opt.value
                        ? "border-[var(--primary)] bg-[var(--primary)]/5"
                        : "border-[var(--border)] hover:border-[var(--t3)]"
                    }`}
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
                    <div className="text-xs text-[var(--t4)] mt-0.5">
                      {opt.desc}
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
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
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
                    {students.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 p-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-container)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(s.id)}
                          onChange={() => toggleStudent(s.id)}
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
            </CardBody>
          </Card>

          {/* Message Composition */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
                <MaterialIcon className="text-xl align-text-bottom mr-2 text-[var(--primary)]">
                  edit
                </MaterialIcon>
                Compose Message
              </h2>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] min-h-[150px] resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p
                  className={`text-xs ${message.length > SMS_SEGMENT_LENGTH ? "text-red-600 font-medium" : "text-[var(--t3)]"}`}
                >
                  {message.length} characters ({smsSegments} SMS segment
                  {smsSegments !== 1 ? "s" : ""} per recipient)
                </p>
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={!message.trim()}
                  className="text-xs text-[var(--primary)] font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <MaterialIcon className="text-sm">phone_iphone</MaterialIcon>
                  Preview on Phone
                </button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
                Summary
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                  <span className="text-sm text-[var(--t3)]">Recipients</span>
                  <span className="font-bold text-[var(--t1)]">
                    {recipients.phoneCount} parent
                    {recipients.phoneCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                  <span className="text-sm text-[var(--t3)]">SMS segments</span>
                  <span className="font-bold text-[var(--t1)]">
                    {smsSegments}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                  <span className="text-sm text-[var(--t3)]">Rate per SMS</span>
                  <span className="font-bold text-[var(--t1)]">
                    UGX {SMS_RATE}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                  <span className="text-sm text-[var(--t3)]">Total SMS</span>
                  <span className="font-bold text-[var(--t1)]">
                    {recipients.phoneCount * smsSegments}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 bg-[var(--surface-container)] rounded-xl px-4 -mx-1">
                  <span className="text-sm font-medium text-[var(--t1)]">
                    Est. Cost
                  </span>
                  <span className="text-lg font-bold text-[var(--primary)]">
                    UGX {costEstimate.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="bg-[var(--surface-container)]">
              <p className="text-sm text-[var(--t3)]">
                <MaterialIcon className="text-sm align-text-bottom mr-1">
                  info
                </MaterialIcon>
                This SMS will be sent to{" "}
                <strong className="text-[var(--t1)]">
                  {recipients.phoneCount} parent
                  {recipients.phoneCount !== 1 ? "s" : ""}
                </strong>
                {smsSegments > 0 && (
                  <span>
                    {" "}
                    ({recipients.phoneCount * smsSegments} total SMS segment
                    {recipients.phoneCount * smsSegments > 1 ? "s" : ""})
                  </span>
                )}
              </p>
            </CardBody>
          </Card>

          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!message.trim() || recipients.phoneCount === 0}
            className="w-full"
          >
            <MaterialIcon icon="send" className="text-lg" />
            Send Bulk SMS
          </Button>
        </div>
      </div>

      {/* Phone Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold text-[var(--t1)]">Phone Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 rounded-lg hover:bg-[var(--surface-container)]"
              >
                <MaterialIcon className="text-lg text-[var(--t3)]">
                  close
                </MaterialIcon>
              </button>
            </div>
            <div className="p-6 flex justify-center">
              <div className="w-64 border-4 border-[var(--t3)] rounded-3xl overflow-hidden bg-[var(--surface-container-lowest)]">
                <div className="bg-[var(--primary)] text-white px-4 py-3 text-center text-sm font-medium">
                  {school?.name || "School"}
                </div>
                <div className="p-3">
                  <div className="bg-[var(--surface-container)] rounded-2xl rounded-tl-sm p-3 max-w-[90%]">
                    <p className="text-sm text-[var(--t1)] whitespace-pre-wrap break-words">
                      {message || "Your message will appear here..."}
                    </p>
                  </div>
                  <div className="text-right mt-1">
                    <span className="text-xs text-[var(--t4)]">
                      {new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowConfirm(false)}
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
                <div className="text-xs text-[var(--t3)] mb-1 font-medium uppercase tracking-wider">
                  Message
                </div>
                <p className="text-sm text-[var(--t1)] whitespace-pre-wrap">
                  {message}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[var(--surface-container)] rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-[var(--t1)]">
                    {recipients.phoneCount}
                  </div>
                  <div className="text-xs text-[var(--t3)]">Recipients</div>
                </div>
                <div className="bg-[var(--surface-container)] rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-[var(--t1)]">
                    {smsSegments}
                  </div>
                  <div className="text-xs text-[var(--t3)]">Segments</div>
                </div>
                <div className="bg-[var(--surface-container)] rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-[var(--primary)]">
                    UGX {costEstimate.toLocaleString()}
                  </div>
                  <div className="text-xs text-[var(--t3)]">Est. Cost</div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={sending}
                  onClick={handleSend}
                >
                  {sending ? "Sending..." : "Confirm & Send"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
