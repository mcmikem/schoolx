"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

export default function ParentMessagesPage() {
  const { user, isDemo } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchSchoolId = useCallback(async () => {
    if (isDemo) { setSchoolId("demo-school"); setLoading(false); return; }
    if (!user?.id) return;
    const { data } = await supabase
      .from("parent_students")
      .select("student:students(school_id)")
      .eq("parent_id", user.id)
      .limit(1)
      .single();
    setSchoolId((data as any)?.student?.school_id || null);
  }, [user?.id, isDemo]);

  const fetchMessages = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    if (isDemo) {
      setMessages([
        { id: "1", subject: "Fee Inquiry", body: "Hello, I would like to inquire about the Term 2 fee structure.", sender_role: "parent", created_at: new Date(Date.now() - 3 * 86400000).toISOString(), is_read: true },
        { id: "2", subject: "Re: Fee Inquiry", body: "Dear Parent, thank you for reaching out. The Term 2 fee structure is available on the fees page. Please let us know if you need further assistance.", sender_role: "school", created_at: new Date(Date.now() - 2 * 86400000).toISOString(), is_read: true },
        { id: "3", subject: "Visitation Day Confirmation", body: "I will be attending visitation day on Saturday. Please reserve a slot for me to meet with the class teacher.", sender_role: "parent", created_at: new Date(Date.now() - 86400000).toISOString(), is_read: false },
      ]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("parent_messages")
      .select("id, subject, body, sender_role, created_at, is_read")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
  }, [user?.id, isDemo]);

  useEffect(() => { fetchSchoolId(); }, [fetchSchoolId]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id) return;
    setSending(true);
    if (isDemo) {
      setMessages((prev) => [...prev, { id: `demo-${Date.now()}`, subject: subject || "Message", body: newMessage, sender_role: "parent", created_at: new Date().toISOString(), is_read: false }]);
      setNewMessage("");
      setSubject("");
      setShowCompose(false);
      setSending(false);
      toast.success("Message sent to school");
      return;
    }
    const { error } = await supabase.from("parent_messages").insert({
      parent_id: user.id,
      school_id: schoolId,
      subject: subject || "Message from Parent",
      body: newMessage,
      sender_role: "parent",
      is_read: false,
    });
    if (error) {
      toast.error("Failed to send message: " + error.message);
    } else {
      toast.success("Message sent to school");
      setNewMessage("");
      setSubject("");
      setShowCompose(false);
      fetchMessages();
    }
    setSending(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <PageHeader title="Message School" subtitle="Send messages directly to the school administration" />
        <Button onClick={() => setShowCompose(true)}>
          <MaterialIcon icon="edit" /> Compose
        </Button>
      </div>

      <Card>
        <CardBody>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-[var(--surface-container)] rounded-2xl animate-pulse" />)}</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-[var(--on-surface-variant)]">
              <MaterialIcon icon="chat_bubble_outline" className="text-5xl mb-3 opacity-30" />
              <p className="font-bold">No messages yet</p>
              <p className="text-sm">Click Compose to send your first message to the school</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className={`p-4 rounded-2xl ${m.sender_role === "parent" ? "bg-[var(--primary)]/10 ml-8" : "bg-[var(--surface-container-low)] mr-8"}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--on-surface-variant)]">
                      {m.sender_role === "parent" ? "You" : "School Administration"}
                    </p>
                    <p className="text-[10px] text-[var(--on-surface-variant)]">
                      {new Date(m.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {m.subject && m.sender_role === "parent" && (
                    <p className="font-bold text-sm text-[var(--on-surface)] mb-1">{m.subject}</p>
                  )}
                  <p className="text-sm text-[var(--on-surface)]">{m.body}</p>
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
              <h2 className="text-xl font-black text-[var(--on-surface)]">New Message</h2>
              <button onClick={() => setShowCompose(false)} className="p-2 hover:bg-[var(--surface-container)] rounded-xl">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Fee Inquiry, Absence Notification..." className="input w-full" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">Message</label>
              <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={5} placeholder="Type your message to the school..." className="w-full px-4 py-3 bg-[var(--surface-container)] border border-[var(--border)] rounded-2xl text-sm outline-none resize-none" />
            </div>
            <Button onClick={sendMessage} disabled={!newMessage.trim() || sending} loading={sending} className="w-full">
              <MaterialIcon icon="send" /> Send Message
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
