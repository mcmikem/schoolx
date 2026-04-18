"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";
import {
  mapParentStudentLinks,
  ParentPortalChild,
  ParentPortalMessageThreadItem,
  resolveSelectedChild,
} from "@/lib/parent-portal";
import { getDemoChildren, getDemoMessages } from "@/lib/parent-portal-demo";
import { getErrorMessage } from "@/lib/validation";

const MAX_PARENT_MESSAGE_SUBJECT = 200;
const MAX_PARENT_MESSAGE_BODY = 5000;

export default function ParentMessagesPage() {
  const { user, isDemo } = useAuth();
  const { isAuthorized, isChecking } = useParentPortalGuard();
  const toast = useToast();
  const [children, setChildren] = useState<ParentPortalChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentPortalChild | null>(
    null,
  );
  const [messages, setMessages] = useState<ParentPortalMessageThreadItem[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchChildren = useCallback(async () => {
    if (isDemo) {
      setChildren(getDemoChildren());
      return;
    }
    const parentId = user?.id;
    if (!parentId) return;
    const { data } = await supabase
      .from("parent_students")
      .select(
        "student:students(id, first_name, last_name, school_id, class_id, class:classes(name))",
      )
      .eq("parent_id", parentId);
    setChildren(mapParentStudentLinks(data || []));
  }, [user?.id, isDemo]);

  useEffect(() => {
    setSelectedChild((current) => resolveSelectedChild(children, current?.id));
  }, [children]);

  const fetchMessages = useCallback(async () => {
    const parentId = user?.id;
    if (!parentId && !isDemo) return;
    setLoading(true);

    if (isDemo) {
      setMessages(getDemoMessages());
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("parent_messages")
      .select("id, subject, body, sender_role, created_at, is_read")
      .eq("parent_id", parentId!)
      .order("created_at", { ascending: true });

    setMessages((data || []) as ParentPortalMessageThreadItem[]);
    setLoading(false);
  }, [user?.id, isDemo]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const trimmedBody = newMessage.trim();
    const trimmedSubject = subject.trim() || "Message from Parent";
    const schoolId = selectedChild?.school_id || children[0]?.school_id || null;

    const parentId = user?.id;
    if (!trimmedBody || !parentId) return;
    if (!schoolId && !isDemo) {
      toast.error("No linked school was found for this parent account.");
      return;
    }
    if (trimmedSubject.length > MAX_PARENT_MESSAGE_SUBJECT) {
      toast.error(`Subject is too long. Keep it under ${MAX_PARENT_MESSAGE_SUBJECT} characters.`);
      return;
    }
    if (trimmedBody.length > MAX_PARENT_MESSAGE_BODY) {
      toast.error(`Message is too long. Keep it under ${MAX_PARENT_MESSAGE_BODY} characters.`);
      return;
    }

    setSending(true);

    if (isDemo) {
      setMessages((current) => [
        ...current,
        {
          id: `demo-${Date.now()}`,
          subject: trimmedSubject,
          body: trimmedBody,
          sender_role: "parent",
          created_at: new Date().toISOString(),
          is_read: false,
        },
      ]);
      setNewMessage("");
      setSubject("");
      setShowCompose(false);
      setSending(false);
      toast.success("Message sent to school");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("parent_messages")
        .insert({
          parent_id: parentId,
          school_id: schoolId,
          student_id: selectedChild?.id || null,
          subject: trimmedSubject,
          body: trimmedBody,
          sender_role: "parent",
          is_read: false,
        })
        .select("id, subject, body, sender_role, created_at, is_read")
        .single();

      if (error) throw error;
      if (data) {
        setMessages((current) => [
          ...current,
          data as ParentPortalMessageThreadItem,
        ]);
        toast.success("Message sent to school");
        setNewMessage("");
        setSubject("");
        setShowCompose(false);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to send message"));
    } finally {
      setSending(false);
    }
  };

  if (isChecking || !isAuthorized) {
    return null;
  }

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
          <PageHeader
            title="Message School"
            subtitle="Keep a written thread with administration and class support staff"
          />
          <Button onClick={() => setShowCompose(true)}>
            <MaterialIcon icon="edit" /> Compose
          </Button>
        </div>

        {children.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                  selectedChild?.id === child.id
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                }`}
              >
                {child.first_name} {child.last_name}
              </button>
            ))}
          </div>
        )}

        <Card>
          <CardBody>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 bg-[var(--surface-container)] rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-[var(--on-surface-variant)]">
                <MaterialIcon
                  icon="chat_bubble_outline"
                  className="text-5xl mb-3 opacity-30"
                />
                <p className="font-bold">No messages yet</p>
                <p className="text-sm">
                  Click Compose to send your first message to the school
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 rounded-2xl ${
                      message.sender_role === "parent"
                        ? "bg-[var(--primary)]/10 ml-8"
                        : "bg-[var(--surface-container-low)] mr-8"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-1">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--on-surface-variant)]">
                          {message.sender_role === "parent"
                            ? "You"
                            : "School Administration"}
                        </p>
                        {message.subject && (
                          <p className="font-bold text-sm text-[var(--on-surface)]">
                            {message.subject}
                          </p>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--on-surface-variant)] whitespace-nowrap">
                        {new Date(message.created_at).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </p>
                    </div>
                    <p className="text-sm text-[var(--on-surface)]">
                      {message.body}
                    </p>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </CardBody>
        </Card>

        {showCompose && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-[var(--surface)] rounded-3xl w-full max-w-lg shadow-2xl p-8 space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-[var(--on-surface)]">
                    New Message
                  </h2>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {selectedChild
                      ? `Current learner context: ${selectedChild.first_name} ${selectedChild.last_name}`
                      : "This message will go to school administration"}
                  </p>
                </div>
                <button
                  onClick={() => setShowCompose(false)}
                  className="p-2 hover:bg-[var(--surface-container)] rounded-xl"
                >
                  <MaterialIcon icon="close" />
                </button>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="e.g. Fee Inquiry, Absence Notification..."
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                  Message
                </label>
                <textarea
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  rows={5}
                  placeholder="Type your message to the school..."
                  className="w-full px-4 py-3 bg-[var(--surface-container)] border border-[var(--border)] rounded-2xl text-sm outline-none resize-none"
                />
              </div>
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                loading={sending}
                className="w-full"
              >
                <MaterialIcon icon="send" /> Send Message
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
