"use client";

import { useCallback, useEffect, useState } from "react";

type SchoolAcceptance = {
  id: string;
  name: string;
  district: string | null;
  upToDate: boolean;
  accepted: null | {
    terms_version: string;
    privacy_notice_version: string;
    accepted_at: string;
    accepted_by_user_id: string;
  };
};

type Report = {
  current: { termsVersion: string; privacyNoticeVersion: string };
  total: number;
  limit: number;
  offset: number;
  schools: SchoolAcceptance[];
};

export default function LegalAcceptanceReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/super-admin/legal-acceptances/?limit=100&offset=${offset}`, {
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success || !body.data)
        throw new Error(body.error || "Could not load acceptance records.");
      setReport(body.data as Report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load acceptance records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-[var(--t1)]">School agreement acceptance</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--t3)]">
        Current versions: Terms {report?.current.termsVersion ?? "…"} · Privacy notice{" "}
        {report?.current.privacyNoticeVersion ?? "…"}. This report shows the latest recorded acceptance for each school.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-[var(--t3)]" role="status">
          Loading school records…
        </p>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <p>{error}</p>
          <button className="mt-2 font-semibold underline" type="button" onClick={() => void load(report?.offset ?? 0)}>
            Try again
          </button>
        </div>
      ) : null}
      {report && !loading && !error ? (
        <>
          <div className="mt-4 space-y-3 md:hidden">
            {report.schools.map((school) => (
              <article className="rounded-xl border border-[var(--border)] p-4" key={school.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[var(--t1)]">{school.name}</h3>
                    <p className="text-sm text-[var(--t3)]">{school.district || "District not set"}</p>
                  </div>
                  <StatusBadge current={school.upToDate} />
                </div>
                <p className="mt-2 text-xs text-[var(--t3)]">{acceptanceText(school)}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-[var(--border)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-container-low)] text-[var(--t2)]">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Latest record</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {report.schools.map((school) => (
                  <tr key={school.id}>
                    <td className="px-4 py-3 font-medium text-[var(--t1)]">{school.name}</td>
                    <td className="px-4 py-3 text-[var(--t2)]">{school.district || "—"}</td>
                    <td className="px-4 py-3 text-[var(--t2)]">{acceptanceText(school)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge current={school.upToDate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[var(--t3)]">
            <span>
              {report.total
                ? `${report.offset + 1}–${Math.min(report.offset + report.schools.length, report.total)} of ${report.total}`
                : "No schools found"}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-[var(--border)] px-3 py-2 disabled:opacity-40"
                type="button"
                disabled={loading || report.offset <= 0}
                onClick={() => void load(Math.max(0, report.offset - report.limit))}
              >
                Previous
              </button>
              <button
                className="rounded-lg border border-[var(--border)] px-3 py-2 disabled:opacity-40"
                type="button"
                disabled={loading || report.offset + report.schools.length >= report.total}
                onClick={() => void load(report.offset + report.limit)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function acceptanceText(school: SchoolAcceptance): string {
  if (!school.accepted) return "No acceptance recorded";
  const date = new Date(school.accepted.accepted_at).toLocaleDateString();
  return `Terms ${school.accepted.terms_version} · Privacy ${school.accepted.privacy_notice_version} · ${date}`;
}

function StatusBadge({ current }: { current: boolean }) {
  return current ? (
    <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
      Current
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
      Needs acceptance
    </span>
  );
}
