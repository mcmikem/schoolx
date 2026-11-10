"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { getPrivacyRequestResponseTarget, isPrivacyRequestClosed } from "@/lib/privacy-request-timeline";

type PrivacyRequest = {
  id: string;
  reference_code: string;
  request_type: string;
  details: string;
  status: string;
  follow_up_at: string | null;
  resolution_note: string | null;
  created_at: string;
  requester: { full_name: string; email: string | null; phone: string; role: string } | null;
  school: { name: string } | null;
};

const STATUSES = ["open", "in_review", "needs_information", "completed", "declined"];

export function PrivacyRequestsTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: string; note: string; followUpAt: string }>>({});

  const localDateTimeValue = (value: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };

  const loadRequests = useCallback(async () => {
    if (!user || user.role !== "super_admin") return;
    setLoading(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch("/api/super-admin/privacy-requests/", {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to load privacy requests");
      const rows = Array.isArray(body.requests) ? (body.requests as PrivacyRequest[]) : [];
      setRequests(rows);
      setDrafts(
        Object.fromEntries(
          rows.map((row) => [
            row.id,
            {
              status: row.status,
              note: row.resolution_note || "",
              followUpAt: localDateTimeValue(row.follow_up_at),
            },
          ]),
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load privacy requests");
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const saveRequest = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in again to update this request.");
      const response = await fetch("/api/super-admin/privacy-requests/", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          status: draft.status,
          resolutionNote: draft.note,
          followUpAt: draft.followUpAt ? new Date(draft.followUpAt).toISOString() : null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to update request");
      toast.success("Privacy request updated");
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update request");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">Privacy requests</h2>
        <p className="mt-1 text-[12px] text-[var(--t3)]">
          Restricted queue for reviewing user data requests. Handle each case under the school agreement and applicable
          law.
        </p>
      </div>
      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--t3)]">
          Loading privacy requests…
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <MaterialIcon icon="verified_user" className="text-3xl text-[var(--t4)]" />
          <p className="mt-2 text-sm font-semibold text-[var(--t1)]">No open requests</p>
          <p className="mt-1 text-xs text-[var(--t3)]">New requests submitted in the privacy page will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const draft = drafts[request.id] || {
              status: request.status,
              note: request.resolution_note || "",
              followUpAt: localDateTimeValue(request.follow_up_at),
            };
            const responseTarget = getPrivacyRequestResponseTarget(request.request_type, request.created_at);
            const overdue = Boolean(
              responseTarget && !isPrivacyRequestClosed(request.status) && responseTarget.dueAt.getTime() < Date.now(),
            );
            return (
              <article
                key={request.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--t1)]">
                      {request.reference_code} · {request.request_type.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--t3)]">
                      {request.requester?.full_name || "Unknown requester"} · {request.requester?.role || "user"}
                      {request.school?.name ? ` · ${request.school.name}` : " · Platform account"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--t3)]">
                      {request.requester?.email || request.requester?.phone || "No contact on profile"} ·{" "}
                      {new Date(request.created_at).toLocaleString()}
                    </p>
                    {responseTarget && (
                      <p
                        className={`mt-1 text-xs font-semibold ${overdue ? "text-rose-700 dark:text-rose-300" : "text-[var(--t3)]"}`}
                        role={overdue ? "status" : undefined}
                      >
                        {overdue ? "Overdue response target" : "Response target"}:{" "}
                        {responseTarget.dueAt.toLocaleDateString("en-UG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {responseTarget.days} days
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-[var(--surface-container-low)] px-2.5 py-1 text-xs capitalize text-[var(--t2)]">
                    {request.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-[var(--bg)] p-3 text-sm text-[var(--t2)]">
                  {request.details || "No extra details provided."}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(9rem,0.3fr)_minmax(10rem,0.35fr)_1fr_auto] sm:items-end">
                  <label className="text-xs font-semibold text-[var(--t2)]">
                    Status
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [request.id]: { ...draft, status: event.target.value } }))
                      }
                      className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[var(--t2)]">
                    Internal follow-up target
                    <input
                      type="datetime-local"
                      value={draft.followUpAt}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [request.id]: { ...draft, followUpAt: event.target.value } }))
                      }
                      className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-[var(--t2)]">
                    Internal resolution note
                    <textarea
                      value={draft.note}
                      maxLength={2000}
                      rows={2}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [request.id]: { ...draft, note: event.target.value } }))
                      }
                      className="mt-1 block w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveRequest(request.id)}
                    disabled={savingId === request.id}
                    className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {savingId === request.id ? "Saving…" : "Save"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
