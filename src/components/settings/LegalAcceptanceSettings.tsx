"use client";

import { useCallback, useEffect, useState } from "react";

type AcceptanceRow = {
  terms_version: string;
  privacy_notice_version: string;
  accepted_at: string;
  accepted_by_user_id: string;
};

type AcceptanceState = {
  current: { termsVersion: string; privacyNoticeVersion: string };
  accepted: AcceptanceRow | null;
  upToDate: boolean;
};

export default function LegalAcceptanceSettings() {
  const [state, setState] = useState<AcceptanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [authorised, setAuthorised] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/legal/acceptance/", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error || "Could not load the agreement status.");
      }
      setState(body.data as AcceptanceState);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the agreement status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const acceptCurrent = async () => {
    if (!state || !authorised) return;
    setAccepting(true);
    setError(null);
    try {
      const response = await fetch("/api/legal/acceptance/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted: true,
          termsVersion: state.current.termsVersion,
          privacyNoticeVersion: state.current.privacyNoticeVersion,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) throw new Error(body.error || "Could not record acceptance.");
      setAuthorised(false);
      await loadStatus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record acceptance.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="material-symbols-rounded text-[var(--primary)]" aria-hidden="true">
          policy
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[var(--t1)]">School Agreement & Privacy Notice</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--t3)]">
            Review the current documents and record the school representative&apos;s acceptance. This records versions
            for the school; it does not replace notices or permissions the school must provide to learners and
            guardians.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <a
          className="rounded-lg border border-[var(--border)] px-3 py-2 font-medium text-[var(--primary)] hover:underline"
          href="/terms#school-data-processing"
          target="_blank"
          rel="noreferrer"
        >
          Read School Agreement
        </a>
        <a
          className="rounded-lg border border-[var(--border)] px-3 py-2 font-medium text-[var(--primary)] hover:underline"
          href="/privacy"
          target="_blank"
          rel="noreferrer"
        >
          Read Privacy Notice
        </a>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--t3)]" role="status">
          Checking the school&apos;s recorded versions…
        </p>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <p>{error}</p>
          <button className="mt-2 font-semibold underline" type="button" onClick={() => void loadStatus()}>
            Try again
          </button>
        </div>
      ) : state?.upToDate ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">The school has accepted the current versions.</p>
          <p className="mt-1">
            Terms {state.current.termsVersion} · Privacy notice {state.current.privacyNoticeVersion}
            {state.accepted?.accepted_at
              ? ` · Recorded ${new Date(state.accepted.accepted_at).toLocaleDateString()}`
              : ""}
          </p>
        </div>
      ) : state ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">A current-version acceptance is not recorded for this school.</p>
            <p className="mt-1">
              Terms {state.current.termsVersion} · Privacy notice {state.current.privacyNoticeVersion}
            </p>
            {state.accepted && (
              <p className="mt-1 text-amber-900">
                Last recorded: Terms {state.accepted.terms_version} · Privacy notice{" "}
                {state.accepted.privacy_notice_version}
              </p>
            )}
          </div>
          <label className="flex items-start gap-3 text-sm leading-6 text-[var(--t2)]">
            <input
              className="mt-1 h-4 w-4 accent-[var(--primary)]"
              type="checkbox"
              checked={authorised}
              onChange={(event) => setAuthorised(event.target.checked)}
            />
            <span>
              I am authorised to accept the current School Agreement and Privacy Notice on behalf of this school, and I
              have reviewed both documents.
            </span>
          </label>
          <button
            className="min-h-11 rounded-xl bg-[var(--primary)] px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!authorised || accepting}
            onClick={() => void acceptCurrent()}
          >
            {accepting ? "Recording acceptance…" : "Accept current versions"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
