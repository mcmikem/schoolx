"use client";
import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/index";

export default function StudentLookupPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (q.length < 2 || !school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id, first_name, last_name, admission_number, gender, classes(name), parent_phone, parent_name, fee_balance")
      .eq("school_id", school.id)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,admission_number.ilike.%${q}%`)
      .limit(20);
    if (error) toast.error("Search failed");
    else setStudents(data || []);
    setLoading(false);
  }, [school?.id]);

  const handleSMSParent = (student: any) => {
    setSelectedStudent(student);
    setShowModal(true);
    setMessage("");
  };

  const handleFeeReminder = () => {
    setMessage(
      `Dear parent, this is a reminder that school fees for ${selectedStudent.first_name} ${selectedStudent.last_name} are now due. Please kindly clear the outstanding balance. Thank you.`
    );
  };

  const sendSMS = async () => {
    if (!message || !selectedStudent?.parent_phone) return;
    setSending(true);
    const res = await fetch("/api/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: school?.id,
        recipients: [{ phone: selectedStudent.parent_phone, name: selectedStudent.parent_name }],
        message,
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("SMS sent to parent");
      setShowModal(false);
    } else {
      toast.error("Failed to send SMS: " + (data.error || "Unknown error"));
    }
    setSending(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Student Lookup" subtitle="Search and find student information" />

      <div className="mt-6 mb-4">
        <label htmlFor="student-search" className="text-sm font-medium mb-1 block">Student Search</label>
        <div className="relative max-w-md">
          <input
            id="student-search"
            type="text"
            placeholder="Search by name or admission number..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="input w-full pr-10"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
          )}
        </div>
      </div>

      {search.length >= 2 && students.length === 0 && !loading && (
        <div className="text-center py-12 text-[var(--on-surface-variant)]">
          <MaterialIcon icon="search_off" className="text-4xl mb-2" />
          <p className="font-medium">No students found for "{search}"</p>
        </div>
      )}

      {students.length > 0 && (
        <div className="overflow-x-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Student","Adm. No","Class","Parent","Fee Balance","Actions"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--surface-container-low)] transition-colors">
                  <td className="px-5 py-4 font-bold text-[var(--on-surface)]">{s.first_name} {s.last_name}</td>
                  <td className="px-5 py-4 font-mono text-sm text-[var(--on-surface-variant)]">{s.admission_number}</td>
                  <td className="px-5 py-4 text-sm text-[var(--on-surface-variant)]">{s.classes?.name || "—"}</td>
                  <td className="px-5 py-4 text-sm text-[var(--on-surface-variant)]">{s.parent_name || "—"}</td>
                  <td className="px-5 py-4">
                    {s.fee_balance > 0 ? (
                      <span className="text-red-600 font-bold text-sm">UGX {s.fee_balance?.toLocaleString()}</span>
                    ) : (
                      <span className="text-emerald-600 font-bold text-sm">Cleared</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <Button size="sm" variant="outline" onClick={() => handleSMSParent(s)}>
                      <MaterialIcon icon="sms" style={{ fontSize: 16 }} /> SMS Parent
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-3xl w-full max-w-md shadow-2xl p-8 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-[var(--on-surface)]">Send SMS to Parent</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[var(--surface-container)] rounded-xl">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <div className="p-3 bg-[var(--surface-container)] rounded-2xl">
              <p className="font-bold text-[var(--on-surface)]">{selectedStudent.first_name} {selectedStudent.last_name}</p>
              <p className="text-xs text-[var(--on-surface-variant)]">Parent: {selectedStudent.parent_name} · {selectedStudent.parent_phone}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleFeeReminder}>Use Fee Reminder Template</Button>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your message..."
                className="w-full px-4 py-3 bg-[var(--surface-container)] border border-[var(--border)] rounded-2xl text-sm outline-none resize-none"
              />
              <p className="text-[10px] text-[var(--on-surface-variant)] mt-1">{message.length} characters</p>
            </div>
            <Button onClick={sendSMS} disabled={!message || sending} className="w-full" loading={sending}>
              Send SMS
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
