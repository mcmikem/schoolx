"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { format } from "date-fns";

type MessageTemplate = {
  id: string;
  label: string;
  icon: string;
  body: string;
  category: string;
};

const TEMPLATES: MessageTemplate[] = [
  { id: "fee_reminder", label: "Fee Reminder", icon: "payments", category: "Finance", body: "Dear Parent, this is a reminder that school fees for {student_name} are outstanding. Please clear UGX {amount} by {deadline}. Thank you." },
  { id: "absentee", label: "Absent Alert", icon: "event_busy", category: "Attendance", body: "Dear Parent, your child {student_name} was absent today ({date}). Please contact the school if this was unplanned. — {school_name}" },
  { id: "exam_notice", label: "Exam Notice", icon: "fact_check", category: "Academic", body: "Dear Parent, {student_name}'s end-of-term examinations begin on {date}. Ensure your child is prepared and school fees are cleared. — {school_name}" },
  { id: "report_ready", label: "Report Card Ready", icon: "description", category: "Academic", body: "Dear Parent, {student_name}'s report card for Term {term} is ready. Please collect it from the school office or view it on the Parent Portal. — {school_name}" },
  { id: "visitation", label: "Visitation Day", icon: "groups", category: "Events", body: "Dear Parent, Visitation Day is on {date}. You are welcome to visit and meet your child's teachers from 9AM to 3PM. — {school_name}" },
  { id: "custom", label: "Custom Message", icon: "edit_note", category: "General", body: "" },
];

export default function SMSCenterPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [activeTemplate, setActiveTemplate] = useState<MessageTemplate>(TEMPLATES[0]);
  const [message, setMessage] = useState(TEMPLATES[0].body);
  const [recipient, setRecipient] = useState<"all" | "class" | "individual">("all");
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  useEffect(() => {
    if (!school?.id) return;
    supabase.from("classes").select("id, name, stream").eq("school_id", school.id).then(({ data }) => setClasses(data || []));
    supabase.from("sms_logs").select("*").eq("school_id", school.id).order("sent_at", { ascending: false }).limit(20).then(({ data }) => setLogs(data || []));
  }, [school?.id]);

  const selectTemplate = (t: MessageTemplate) => {
    setActiveTemplate(t);
    setMessage(t.body);
  };

  const handleSend = async () => {
    if (!message || !school?.id) return;
    setSending(true);
    try {
      // Build recipient list from DB based on selection
      let recipients: { phone: string; name: string }[] = [];
      if (recipient === "individual" && phone) {
        recipients = [{ phone, name: "Parent" }];
      } else {
        let query = supabase
          .from("students")
          .select("parent_phone, parent_name")
          .eq("school_id", school.id)
          .not("parent_phone", "is", null);
        if (recipient === "class" && selectedClass) {
          query = query.eq("class_id", selectedClass);
        }
        const { data: studentData } = await query;
        recipients = (studentData || [])
          .filter((s: any) => s.parent_phone)
          .map((s: any) => ({ phone: s.parent_phone, name: s.parent_name || "Parent" }));
      }

      if (recipients.length === 0) {
        toast.error("No recipients found with phone numbers");
        setSending(false);
        return;
      }

      // Call the Africa's Talking SMS API route
      // POST = single recipient, PUT = bulk (up to 100)
      const isBulk = recipients.length > 1;
      const res = await fetch("/api/sms", {
        method: isBulk ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isBulk
            ? { schoolId: school.id, phones: recipients.map((r) => r.phone), message }
            : { schoolId: school.id, phone: recipients[0].phone, message }
        ),
      });
      const result = await res.json();
      if (result.success) {
        const sent = isBulk ? result.totalSent : 1;
        const failed = isBulk ? result.totalFailed : 0;
        toast.success(`SMS sent to ${sent} recipient(s)${failed > 0 ? ` (${failed} failed)` : ""}`);
        // Refresh logs
        supabase.from("sms_logs").select("*").eq("school_id", school.id).order("sent_at", { ascending: false }).limit(20).then(({ data }) => setLogs(data || []));
      } else {
        toast.error("Failed to send SMS: " + (result.error || "Unknown error"));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const smsCount = Math.ceil(charCount / 160);

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">SMS Centre</h1>
          <p className="text-slate-500 font-medium tracking-tight">Send targeted messages to parents and staff</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Gateway Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Templates Panel */}
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Message Templates</p>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={`w-full p-4 rounded-[24px] flex items-center gap-4 transition-all text-left border ${
                activeTemplate.id === t.id
                  ? "bg-slate-800 text-white border-slate-800 shadow-xl"
                  : "bg-white text-slate-700 border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${activeTemplate.id === t.id ? "bg-white/10" : "bg-slate-50"}`}>
                <MaterialIcon icon={t.icon} style={{ fontSize: 20 }} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{t.label}</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${activeTemplate.id === t.id ? "opacity-50" : "text-slate-400"}`}>{t.category}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Compose Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recipient Selector */}
          <div className={cardClassName + " p-6 space-y-6"}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Send To</p>
              <div className="flex bg-slate-100 rounded-2xl p-1">
                {(["all", "class", "individual"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRecipient(r)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${recipient === r ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {r === "all" ? "All Parents" : r === "class" ? "By Class" : "Individual"}
                  </button>
                ))}
              </div>
            </div>

            {recipient === "class" && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Select Class</p>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 text-sm"
                >
                  <option value="">Choose class...</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name} {c.stream || ""}</option>)}
                </select>
              </div>
            )}

            {recipient === "individual" && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Phone Number</p>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+256 700 000 000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 text-sm"
                />
              </div>
            )}
          </div>

          {/* Message Composer */}
          <div className={cardClassName + " p-6 space-y-4"}>
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Message Body</p>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold ${charCount > 160 ? "text-amber-500" : "text-slate-400"}`}>{charCount} chars · {smsCount} SMS</span>
              </div>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-slate-100 transition-all text-sm font-medium text-slate-800 resize-none"
              placeholder="Type your message here..."
            />
            <p className="text-[10px] text-slate-400 italic">Variables: {"{student_name}"}, {"{date}"}, {"{amount}"}, {"{school_name}"}</p>

            <button
              onClick={handleSend}
              disabled={!message || sending}
              className="w-full py-4 bg-slate-800 text-white rounded-[28px] font-black uppercase tracking-[2px] hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
            >
              {sending
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><MaterialIcon icon="send" /> Send Message</>
              }
            </button>
          </div>

          {/* Sent Logs */}
          {logs.length > 0 && (
            <div className={cardClassName + " overflow-hidden"}>
              <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent Activity</p>
              </div>
              <div className="divide-y divide-slate-50">
                {logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="px-5 py-4 flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === "sent" ? "bg-emerald-400" : "bg-red-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{log.message}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{log.parent_phone}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 shrink-0">{format(new Date(log.sent_at), "MMM dd HH:mm")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
