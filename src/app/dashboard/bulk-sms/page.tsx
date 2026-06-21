"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { withTimeout } from "@/lib/hooks/utils";
import { format } from "date-fns";

type MessageTemplate = {
  id: string;
  label: string;
  icon: string;
  body: string;
  category: string;
};

interface ClassItem {
  id: string;
  name: string;
  stream: string | null;
}

interface SmsLogItem {
  id: string;
  status: string;
  message: string;
  parent_phone: string;
  sent_at: string;
}

interface StudentSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
  class_id: string;
}

interface AcademicTermItem {
  id: string;
  is_current: boolean;
  term_number: number;
  academic_year: string;
}

interface ParentPhoneItem {
  phone: string;
  full_name: string;
}

const TEMPLATES: MessageTemplate[] = [
  { id: "fee_reminder", label: "Fee Reminder", icon: "payments", category: "Finance", body: "Dear Parent, this is a reminder that school fees for {student_name} are outstanding. Please clear UGX {amount} by {deadline}. Thank you." },
  { id: "absentee", label: "Absent Alert", icon: "event_busy", category: "Attendance", body: "Dear Parent, your child {student_name} was absent today ({date}). Please contact the school if this was unplanned. \u2014 {school_name}" },
  { id: "exam_notice", label: "Exam Notice", icon: "fact_check", category: "Academic", body: "Dear Parent, {student_name}'s end-of-term examinations begin on {date}. Ensure your child is prepared and school fees are cleared. \u2014 {school_name}" },
  { id: "report_ready", label: "Report Card Ready", icon: "description", category: "Academic", body: "Dear Parent, {student_name}'s report card for Term {term} is ready. Please collect it from the school office or view it on the Parent Portal. \u2014 {school_name}" },
  { id: "visitation", label: "Visitation Day", icon: "groups", category: "Events", body: "Dear Parent, Visitation Day is on {date}. You are welcome to visit and meet your child's teachers from 9AM to 3PM. \u2014 {school_name}" },
  { id: "custom", label: "Custom Message", icon: "edit_note", category: "General", body: "" },
];

type Segment = "all" | "class" | "overdue" | "balance" | "student";

const SEGMENT_OPTIONS: { value: Segment; label: string; icon: string; description: string }[] = [
  { value: "all", label: "All Parents", icon: "groups", description: "Send to every parent in the school" },
  { value: "class", label: "Parents of a Specific Class", icon: "school", description: "Target parents by their child\u2019s class" },
  { value: "overdue", label: "Parents with Overdue Fees", icon: "payments", description: "Parents whose children have unpaid fees" },
  { value: "balance", label: "Outstanding Balance > Amount", icon: "trending_up", description: "Parents with balance above a threshold" },
  { value: "student", label: "Specific Student", icon: "person_search", description: "Send to a particular student\u2019s parent" },
];

export default function SMSCenterPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [activeTemplate, setActiveTemplate] = useState<MessageTemplate>(TEMPLATES[0]);
  const [message, setMessage] = useState(TEMPLATES[0].body);
  const [segment, setSegment] = useState<Segment>("all");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [minBalance, setMinBalance] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<SmsLogItem[]>([]);
  const [charCount, setCharCount] = useState(0);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [currentTerm, setCurrentTerm] = useState<AcademicTermItem | null>(null);
  const studentSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  useEffect(() => {
    if (!school?.id) return;
    withTimeout(
      supabase.from("classes").select("id, name, stream").eq("school_id", school.id).then(r => r.data),
      5000, [] as ClassItem[]
    ).then((data) => setClasses(data || []));

    withTimeout(
      supabase.from("sms_logs").select("*").eq("school_id", school.id).order("sent_at", { ascending: false }).limit(20).then(r => r.data),
      5000, [] as SmsLogItem[]
    ).then((data) => setLogs(data || []));

    withTimeout(
      supabase.from("academic_terms").select("*").eq("school_id", school.id).eq("is_current", true).maybeSingle().then(r => r.data),
      5000, null as AcademicTermItem | null
    ).then((data) => setCurrentTerm(data || null));
  }, [school?.id]);

  useEffect(() => {
    if (!school?.id) return;
    const timer = setTimeout(async () => {
      const count = await getRecipientCount();
      setRecipientCount(count);
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, selectedClass, minBalance, selectedStudent, school?.id, currentTerm]);

  useEffect(() => {
    if (!school?.id || segment !== "student" || studentQuery.length < 2) {
      setStudentResults([]);
      setShowStudentDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      const data = await withTimeout(
        supabase
          .from("students")
          .select("id, first_name, last_name, student_number, class_id")
          .eq("school_id", school.id)
          .or(`first_name.ilike.%${studentQuery}%,last_name.ilike.%${studentQuery}%,student_number.ilike.%${studentQuery}%`)
          .limit(10)
          .then(r => r.data),
        5000, [] as StudentSearchResult[]
      );
      setStudentResults(data || []);
      setShowStudentDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [studentQuery, segment, school?.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (studentSearchRef.current && !studentSearchRef.current.contains(e.target as Node)) {
        setShowStudentDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectTemplate = (t: MessageTemplate) => {
    setActiveTemplate(t);
    setMessage(t.body);
  };

  const switchSegment = (s: Segment) => {
    setSegment(s);
    if (s !== "student") {
      setSelectedStudent(null);
      setStudentQuery("");
      setStudentResults([]);
      setShowStudentDropdown(false);
    }
  };

  const getRecipientCount = async (): Promise<number> => {
    if (!school?.id) return 0;
    try {
      const parents = await fetchParentPhones(true);
      return parents.length;
    } catch {
      return 0;
    }
  };

  const fetchParentPhones = async (countOnly = false): Promise<{ phone: string; full_name: string }[]> => {
    if (!school?.id) return [];

    if (segment === "all") {
      const data = await withTimeout(
        supabase
          .from("users")
          .select("phone, full_name")
          .eq("school_id", school.id)
          .eq("role", "parent")
          .not("phone", "is", null)
          .then(r => r.data),
        5000, [] as ParentPhoneItem[]
      );
      return (data || []).map((p) => ({ phone: p.phone, full_name: p.full_name }));
    }

    let studentIds: string[] = [];

    switch (segment) {
      case "class": {
        if (!selectedClass) return [];
        const data = await withTimeout(
          supabase.from("students").select("id").eq("school_id", school.id).eq("class_id", selectedClass).then(r => r.data),
          5000, [] as { id: string }[]
        );
        studentIds = (data || []).map((s) => s.id);
        break;
      }
      case "overdue": {
        let query = supabase.from("student_fees").select("student_id").gt("balance", 0).eq("school_id", school.id);
        if (currentTerm) {
          query = query.eq("academic_year", currentTerm.academic_year).eq("term", currentTerm.term_number);
        }
        const data = await withTimeout(query.then(r => r.data), 5000, [] as { student_id: string }[]);
        studentIds = [...new Set((data || []).map((f) => f.student_id))];
        break;
      }
      case "balance": {
        const bal = parseFloat(minBalance) || 0;
        let query = supabase.from("student_fees").select("student_id").gt("balance", bal).eq("school_id", school.id);
        if (currentTerm) {
          query = query.eq("academic_year", currentTerm.academic_year).eq("term", currentTerm.term_number);
        }
        const data = await withTimeout(query.then(r => r.data), 5000, [] as { student_id: string }[]);
        studentIds = [...new Set((data || []).map((f) => f.student_id))];
        break;
      }
      case "student": {
        if (!selectedStudent) return [];
        studentIds = [selectedStudent.id];
        break;
      }
    }

    if (studentIds.length === 0) return [];

    const psData = await withTimeout(
      supabase.from("parent_students").select("parent_id").in("student_id", studentIds).then(r => r.data),
      5000, [] as { parent_id: string }[]
    );

    const parentIds = [...new Set((psData || []).map((p) => p.parent_id))];
    if (parentIds.length === 0) return [];

    const parents = await withTimeout(
      supabase
        .from("users")
        .select("phone, full_name")
        .in("id", parentIds)
        .eq("role", "parent")
        .not("phone", "is", null)
        .then(r => r.data),
      5000, [] as ParentPhoneItem[]
    );

    return (parents || []).map((p) => ({ phone: p.phone, full_name: p.full_name }));
  };

  const handleSend = async () => {
    if (!message || !school?.id) return;
    setSending(true);
    try {
      const recipients = await fetchParentPhones(false);

      if (recipients.length === 0) {
        toast.error("No recipients found with phone numbers");
        setSending(false);
        return;
      }

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
        supabase.from("sms_logs").select("*").eq("school_id", school.id).order("sent_at", { ascending: false }).limit(20).then(({ data }) => setLogs(data || []));
      } else {
        toast.error("Failed to send SMS: " + (result.error || "Unknown error"));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const smsCount = Math.ceil(charCount / 160);
  const canSend = message && !sending && (recipientCount !== null ? recipientCount > 0 : true);

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <PageHeader
          title="SMS Centre"
          subtitle="Send targeted messages to parents"
          actions={
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-100">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Gateway Active</span>
            </div>
          }
        />

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
            {/* Target Audience */}
            <Card>
              <CardBody className="p-6 space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Target Audience</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SEGMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => switchSegment(opt.value)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                          segment === opt.value
                            ? "bg-slate-800 text-white border-slate-800 shadow-md"
                            : "bg-white text-slate-600 border-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          segment === opt.value ? "bg-white/10" : "bg-slate-50"
                        }`}>
                          <MaterialIcon icon={opt.icon} style={{ fontSize: 18 }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{opt.label}</p>
                          <p className={`text-[9px] font-semibold uppercase tracking-wider ${
                            segment === opt.value ? "opacity-50" : "text-slate-400"
                          }`}>{opt.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Segment-specific options */}
                {segment === "class" && (
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

                {segment === "balance" && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Minimum Outstanding Balance (UGX)</p>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={minBalance}
                      onChange={(e) => setMinBalance(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 text-sm"
                    />
                  </div>
                )}

                {segment === "student" && (
                  <div ref={studentSearchRef} className="relative">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Search Student</p>
                    {selectedStudent ? (
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-800 truncate">
                            {selectedStudent.first_name} {selectedStudent.last_name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">{selectedStudent.student_number}</p>
                        </div>
                        <button
                          onClick={() => { setSelectedStudent(null); setStudentQuery(""); }}
                          className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 transition-colors"
                        >
                          <MaterialIcon icon="close" style={{ fontSize: 16 }} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={studentQuery}
                          onChange={(e) => setStudentQuery(e.target.value)}
                          onFocus={() => { if (studentResults.length > 0) setShowStudentDropdown(true); }}
                          placeholder="Type student name or number..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 text-sm"
                        />
                        {showStudentDropdown && studentResults.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
                            {studentResults.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => { setSelectedStudent(s); setShowStudentDropdown(false); setStudentQuery(""); }}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0"
                              >
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                  <MaterialIcon icon="person" style={{ fontSize: 16 }} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-sm text-slate-800 truncate">{s.first_name} {s.last_name}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">{s.student_number}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {recipientCount !== null && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-100">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <MaterialIcon icon="people" style={{ fontSize: 18, color: "#6366f1" }} />
                    </div>
                    <p className="text-sm font-bold text-indigo-800">
                      SMS will be sent to <span className="text-indigo-600">{recipientCount}</span> parent{recipientCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Message Composer */}
            <Card>
              <CardBody className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Message Body</p>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold ${charCount > 160 ? "text-amber-500" : "text-slate-400"}`}>{charCount} chars &middot; {smsCount} SMS</span>
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
                  disabled={!canSend}
                  className="w-full py-4 bg-slate-800 text-white rounded-[28px] font-black uppercase tracking-[2px] hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
                >
                  {sending
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><MaterialIcon icon="send" /> Send Message</>
                  }
                </button>
              </CardBody>
            </Card>

            {/* Sent Logs */}
            {logs.length > 0 && (
              <Card>
                <CardBody className="p-0 overflow-hidden">
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
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
