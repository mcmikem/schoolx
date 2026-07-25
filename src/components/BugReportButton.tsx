"use client";

import { useState, useCallback } from "react";
import MaterialIcon from "./MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

export default function BugReportButton() {
  const { user, school } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bug-report/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          page_url: window.location.href,
          browser_info: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit report");
      }
      toast.success("Bug report submitted. Thank you!");
      setTitle("");
      setDescription("");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }, [title, description, toast]);

  if (!user || !school?.is_tester) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-[#dc2626] text-white shadow-lg flex items-center justify-center hover:bg-[#b91c1c] transition-colors"
        title="Report a bug"
      >
        <MaterialIcon icon="bug_report" style={{ fontSize: 22 }} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="relative bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <MaterialIcon icon="bug_report" className="text-red-600" style={{ fontSize: 18 }} />
                </div>
                <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">Report a Bug</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--bg)] text-[var(--t3)] transition-colors"
              >
                <MaterialIcon icon="close" style={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What happened? What did you expect? Steps to reproduce..."
                  rows={5}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--primary)] transition-colors resize-none"
                />
              </div>
              <div className="rounded-xl bg-[var(--bg)] border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--t3)] font-semibold uppercase tracking-wide mb-1">
                  Auto-attached
                </div>
                <div className="text-[11px] text-[var(--t2)] space-y-0.5">
                  <div>School: {school.name}</div>
                  <div>
                    User: {user.full_name} ({user.role})
                  </div>
                  <div>
                    Page: <span className="break-all">{window.location.href}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--bg)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !title.trim() || !description.trim()}
                onClick={handleSubmit}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <MaterialIcon icon="send" style={{ fontSize: 14 }} />
                    Submit Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
