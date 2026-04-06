"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  parent_phone?: string;
  parent_name?: string;
}

interface QuickTemplate {
  label: string;
  category: string;
  build: (student: StudentInfo, vars?: Record<string, string>) => string;
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    label: "Fee Reminder",
    category: "fee_reminder",
    build: (student, vars) =>
      `Dear parent, ${student.first_name} ${student.last_name} has outstanding fees of UGX ${vars?.amount || "... Please pay by " + (vars?.date || "end of term")}. Thank you.`,
  },
  {
    label: "Attendance Alert",
    category: "attendance",
    build: (student, vars) =>
      `Dear parent, ${student.first_name} ${student.last_name} was absent today ${vars?.date || new Date().toLocaleDateString()}. Please explain. Thank you.`,
  },
  {
    label: "Discipline Notice",
    category: "discipline",
    build: (student, vars) =>
      `Dear parent, ${student.first_name} ${student.last_name} was reported for ${vars?.incident || "a disciplinary issue"}. Please visit school. Thank you.`,
  },
  {
    label: "Performance Update",
    category: "performance",
    build: (student, vars) =>
      `Dear parent, ${student.first_name} ${student.last_name} scored ${vars?.marks || "..."} in ${vars?.subject || "..."} . ${vars?.advice || "Keep supporting your child."} Thank you.`,
  },
];

interface SendSMSModalProps {
  student: StudentInfo;
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}

export function SendSMSModal({
  student,
  isOpen,
  onClose,
  onSent,
}: SendSMSModalProps) {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<
    "idle" | "sent" | "delivered" | "failed"
  >("idle");
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDeliveryStatus("idle");
      setLastMessageId(null);
      setShowPreview(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (
      !lastMessageId ||
      deliveryStatus === "delivered" ||
      deliveryStatus === "failed"
    )
      return;

    const poll = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("messages")
          .select("status")
          .eq("id", lastMessageId)
          .single();
        if (data?.status === "delivered") {
          setDeliveryStatus("delivered");
          clearInterval(poll);
        } else if (data?.status === "failed") {
          setDeliveryStatus("failed");
          clearInterval(poll);
        }
      } catch {
        clearInterval(poll);
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [lastMessageId, deliveryStatus]);

  if (!isOpen) return null;

  const handleTemplateSelect = (index: number) => {
    setSelectedTemplate(index);
    setMessage(QUICK_TEMPLATES[index].build(student, templateVars));
  };

  const handleSend = async () => {
    if (!message.trim() || !student.parent_phone || !school?.id || !user?.id)
      return;

    setSending(true);
    setDeliveryStatus("sent");
    try {
      if (isDemo) {
        toast.success("SMS sent successfully");
        setTimeout(() => setDeliveryStatus("delivered"), 1500);
        setMessage("");
        setSelectedTemplate(null);
        setTemplateVars({});
        onSent?.();
        return;
      }

      const response = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: student.parent_phone,
          message,
          schoolId: school.id,
          studentId: student.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const { data } = await supabase
          .from("messages")
          .insert({
            school_id: school.id,
            recipient_type: "individual",
            phone: student.parent_phone,
            message,
            status: "sent",
            sent_by: user.id,
            sent_at: new Date().toISOString(),
            student_id: student.id,
          })
          .select("id")
          .single();

        if (data?.id) setLastMessageId(data.id);

        toast.success("SMS sent successfully");
        setMessage("");
        setSelectedTemplate(null);
        setTemplateVars({});
        onSent?.();
      } else {
        setDeliveryStatus("failed");
        toast.error(result.message || "Failed to send SMS");
      }
    } catch (err: unknown) {
      setDeliveryStatus("failed");
      toast.error(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#e8eaed]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#191c1d]">
              SMS Parent of {student.first_name} {student.last_name}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-[#5c6670] hover:text-[#191c1d]"
            >
              <MaterialIcon icon="close" className="text-xl" />
            </button>
          </div>
          {student.parent_phone && (
            <p className="text-sm text-[#5c6670] mt-1">
              <MaterialIcon
                icon="phone"
                className="text-sm align-text-bottom mr-1"
              />
              {student.parent_phone}
            </p>
          )}
        </div>

        <div className="p-6 space-y-4">
          {!student.parent_phone ? (
            <div className="text-center py-4">
              <MaterialIcon
                icon="phone_disabled"
                className="text-3xl text-[#c62828] mb-2"
              />
              <p className="text-sm text-[#c62828]">
                No parent phone number on record
              </p>
            </div>
          ) : (
            <>
              {/* Delivery Status */}
              {deliveryStatus !== "idle" && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    deliveryStatus === "sent"
                      ? "bg-blue-50 text-blue-700"
                      : deliveryStatus === "delivered"
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                  }`}
                >
                  <MaterialIcon className="text-lg">
                    {deliveryStatus === "sent"
                      ? "cloud_upload"
                      : deliveryStatus === "delivered"
                        ? "check_circle"
                        : "error"}
                  </MaterialIcon>
                  {deliveryStatus === "sent" && "Sent"}
                  {deliveryStatus === "delivered" && "Delivered"}
                  {deliveryStatus === "failed" && "Delivery failed"}
                </div>
              )}

              {/* Preview Toggle */}
              {message.length > 0 && (
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[#191c1d]">
                    Message Preview
                  </label>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showPreview ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showPreview ? "translate-x-5" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>
              )}

              {/* Phone Mockup Preview */}
              {showPreview && message.length > 0 && (
                <div className="flex justify-center py-2">
                  <div className="w-[220px] bg-[#1a1a2e] rounded-[24px] p-3 shadow-xl">
                    <div className="w-[16px] h-[16px] bg-[#333] rounded-full mx-auto mb-3" />
                    <div className="bg-[#0b4f6c] rounded-xl rounded-tl-none p-2.5 max-w-[180px]">
                      <p className="text-white text-[11px] leading-relaxed break-words">
                        {message}
                      </p>
                      <p className="text-[#a0d2db] text-[9px] text-right mt-1">
                        {new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-[#555] text-[9px]">
                        {student.parent_phone}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Templates */}
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Quick Templates
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_TEMPLATES.map((tmpl, i) => (
                    <button
                      key={i}
                      onClick={() => handleTemplateSelect(i)}
                      className={`p-3 rounded-xl border-2 text-left text-sm transition-all ${
                        selectedTemplate === i
                          ? "border-[#002045] bg-[#002045]/5"
                          : "border-[#e8eaed] hover:border-[#c4c6cf]"
                      }`}
                    >
                      <MaterialIcon
                        icon={
                          tmpl.category === "fee_reminder"
                            ? "payments"
                            : tmpl.category === "attendance"
                              ? "event_busy"
                              : tmpl.category === "discipline"
                                ? "gavel"
                                : "trending_up"
                        }
                        className={`text-lg mb-1 ${selectedTemplate === i ? "text-[#002045]" : "text-[#5c6670]"}`}
                      />
                      <div
                        className={`font-medium ${selectedTemplate === i ? "text-[#002045]" : "text-[#5c6670]"}`}
                      >
                        {tmpl.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Variables */}
              {selectedTemplate !== null && (
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_TEMPLATES[selectedTemplate].category ===
                    "fee_reminder" && (
                    <>
                      <div>
                        <label
                          htmlFor="sms-template-amount"
                          className="text-xs font-medium text-[#5c6670] mb-1 block"
                        >
                          Amount
                        </label>
                        <input
                          id="sms-template-amount"
                          type="text"
                          placeholder="e.g. 50,000"
                          value={templateVars.amount || ""}
                          onChange={(e) => {
                            const newVars = {
                              ...templateVars,
                              amount: e.target.value,
                            };
                            setTemplateVars(newVars);
                            setMessage(
                              QUICK_TEMPLATES[selectedTemplate].build(
                                student,
                                newVars,
                              ),
                            );
                          }}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="sms-template-date"
                          className="text-xs font-medium text-[#5c6670] mb-1 block"
                        >
                          Due Date
                        </label>
                        <input
                          id="sms-template-date"
                          type="date"
                          value={templateVars.date || ""}
                          onChange={(e) => {
                            const newVars = {
                              ...templateVars,
                              date: e.target.value,
                            };
                            setTemplateVars(newVars);
                            setMessage(
                              QUICK_TEMPLATES[selectedTemplate].build(
                                student,
                                newVars,
                              ),
                            );
                          }}
                          className="input text-sm"
                        />
                      </div>
                    </>
                  )}
                  {QUICK_TEMPLATES[selectedTemplate].category ===
                    "attendance" && (
                    <div>
                      <label
                        htmlFor="sms-attendance-date"
                        className="text-xs font-medium text-[#5c6670] mb-1 block"
                      >
                        Date
                      </label>
                      <input
                        id="sms-attendance-date"
                        type="date"
                        value={
                          templateVars.date ||
                          new Date().toISOString().split("T")[0]
                        }
                        onChange={(e) => {
                          const newVars = {
                            ...templateVars,
                            date: e.target.value,
                          };
                          setTemplateVars(newVars);
                          setMessage(
                            QUICK_TEMPLATES[selectedTemplate].build(
                              student,
                              newVars,
                            ),
                          );
                        }}
                        className="input text-sm"
                      />
                    </div>
                  )}
                  {QUICK_TEMPLATES[selectedTemplate].category ===
                    "discipline" && (
                    <div className="col-span-2">
                      <label
                        htmlFor="sms-incident"
                        className="text-xs font-medium text-[#5c6670] mb-1 block"
                      >
                        Incident
                      </label>
                      <input
                        id="sms-incident"
                        type="text"
                        placeholder="e.g. fighting"
                        value={templateVars.incident || ""}
                        onChange={(e) => {
                          const newVars = {
                            ...templateVars,
                            incident: e.target.value,
                          };
                          setTemplateVars(newVars);
                          setMessage(
                            QUICK_TEMPLATES[selectedTemplate].build(
                              student,
                              newVars,
                            ),
                          );
                        }}
                        className="input text-sm"
                      />
                    </div>
                  )}
                  {QUICK_TEMPLATES[selectedTemplate].category ===
                    "performance" && (
                    <>
                      <div>
                        <label
                          htmlFor="sms-marks"
                          className="text-xs font-medium text-[#5c6670] mb-1 block"
                        >
                          Marks
                        </label>
                        <input
                          id="sms-marks"
                          type="text"
                          placeholder="e.g. 85%"
                          value={templateVars.marks || ""}
                          onChange={(e) => {
                            const newVars = {
                              ...templateVars,
                              marks: e.target.value,
                            };
                            setTemplateVars(newVars);
                            setMessage(
                              QUICK_TEMPLATES[selectedTemplate].build(
                                student,
                                newVars,
                              ),
                            );
                          }}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="sms-subject"
                          className="text-xs font-medium text-[#5c6670] mb-1 block"
                        >
                          Subject
                        </label>
                        <input
                          id="sms-subject"
                          type="text"
                          placeholder="e.g. Mathematics"
                          value={templateVars.subject || ""}
                          onChange={(e) => {
                            const newVars = {
                              ...templateVars,
                              subject: e.target.value,
                            };
                            setTemplateVars(newVars);
                            setMessage(
                              QUICK_TEMPLATES[selectedTemplate].build(
                                student,
                                newVars,
                              ),
                            );
                          }}
                          className="input text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label
                          htmlFor="sms-advice"
                          className="text-xs font-medium text-[#5c6670] mb-1 block"
                        >
                          Advice
                        </label>
                        <input
                          id="sms-advice"
                          type="text"
                          placeholder="e.g. Please encourage revision"
                          value={templateVars.advice || ""}
                          onChange={(e) => {
                            const newVars = {
                              ...templateVars,
                              advice: e.target.value,
                            };
                            setTemplateVars(newVars);
                            setMessage(
                              QUICK_TEMPLATES[selectedTemplate].build(
                                student,
                                newVars,
                              ),
                            );
                          }}
                          className="input text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Message */}
              <div>
                <label
                  htmlFor="sms-message"
                  className="text-sm font-medium text-[#191c1d] mb-2 block"
                >
                  Message
                </label>
                <textarea
                  id="sms-message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setSelectedTemplate(null);
                  }}
                  placeholder="Type your message..."
                  className="input min-h-[100px] resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <p
                    className={`text-xs ${message.length > 160 ? "text-[#c62828]" : "text-[#5c6670]"}`}
                  >
                    {message.length}/160 characters
                  </p>
                  {message.length > 0 && (
                    <div className="text-xs text-[#5c6670] flex items-center gap-2">
                      <span className="font-medium">
                        {Math.ceil(message.length / 160)} SMS segment
                        {Math.ceil(message.length / 160) > 1 ? "s" : ""}
                      </span>
                      <span className="text-[#c4c6cf]">•</span>
                      <span className="text-[#191c1d] font-semibold">
                        Est. cost: UGX{" "}
                        {(
                          Math.ceil(message.length / 160) * 25
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="btn btn-primary flex-1"
                >
                  <MaterialIcon icon="send" className="text-lg" />
                  {sending ? "Sending..." : "Send SMS"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
