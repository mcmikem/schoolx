"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";

interface ParentMessage {
  id: string;
  parent_id: string;
  school_id: string;
  student_id: string | null;
  subject: string | null;
  body: string;
  sender_role: string;
  created_at: string;
  is_read: boolean;
}

export default function ParentInboxPage() {
  const { user, school, isDemo } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<ParentMessage[]>([]);
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<ParentMessage | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!school?.id && !isDemo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    if (isDemo) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const { data } = await withTimeout(
      supabase
        .from("parent_messages")
        .select("id, parent_id, school_id, student_id, subject, body, sender_role, created_at, is_read")
        .eq("school_id", school!.id)
        .order("created_at", { ascending: true }),
      12000,
      timeoutFallback(),
    );
    const rows = (data || []) as ParentMessage[];
    setMessages(rows);

    const parentIds = Array.from(new Set(rows.map((m) => m.parent_id)));
    if (parentIds.length > 0) {
      const { data: users } = await withTimeout(
        supabase.from("users").select("id, full_name").in("id", parentIds),
        12000,
        timeoutFallback(),
      );
      const map: Record<string, string> = {};
      (users || []).forEach((u: any) => {
        map[u.id] = u.full_name || "Parent";
      });
      setParentNames(map);
    }
    setLoading(false);
  }, [school?.id, isDemo]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const sendReply = async () => {
    if (!replyTo || !replyBody.trim() || !school?.id || !user?.id) return;
    setSending(true);
    try {
      const { error } = await withTimeout(
        supabase.from("parent_messages").insert({
          parent_id: replyTo.parent_id,
          school_id: school.id,
          student_id: replyTo.student_id,
          subject: replyTo.subject ? `Re: ${replyTo.subject}` : "Reply from school",
          body: replyBody.trim(),
          sender_role: user.role || "school_admin",
          is_read: false,
        }),
        12000,
        timeoutFallback(),
      );
      if (error) throw error;
      toast.success("Reply sent to parent");
      setReplyBody("");
      setReplyTo(null);
      await fetchMessages();
    } catch (err) {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <PageHeader title="Parent Messages" subtitle="Messages sent by parents to the school" />
        {loading ? (
          <p className="text-sm text-[var(--on-surface-variant)]">Loading…</p>
        ) : messages.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm">No parent messages yet.</p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <Card key={m.id}>
                <CardBody>
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-[var(--on-surface-variant)]">
                        {parentNames[m.parent_id] || "Parent"} {m.sender_role === "parent" ? "(parent)" : ""}
                      </p>
                      {m.subject && <p className="font-bold text-sm">{m.subject}</p>}
                    </div>
                    <p className="text-xs text-[var(--on-surface-variant)] whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <p className="text-sm">{m.body}</p>
                  {m.sender_role === "parent" && (
                    <div className="mt-3">
                      <Button size="sm" onClick={() => setReplyTo(m)}>
                        <MaterialIcon icon="reply" /> Reply
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {replyTo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setReplyTo(null)} />
            <div className="relative bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg space-y-4">
              <h3 className="font-bold">Reply to {parentNames[replyTo.parent_id] || "parent"}</h3>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-xl text-sm"
                placeholder="Type your reply..."
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setReplyTo(null)}>
                  Cancel
                </Button>
                <Button onClick={sendReply} loading={sending} disabled={!replyBody.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
