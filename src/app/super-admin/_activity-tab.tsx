"use client";
import { useState, useEffect, useCallback } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { logger } from "@/lib/logger";
import { StatCard } from "./_atoms";

export function AppActivityTab() {
  const [view, setView] = useState<"summary" | "errors" | "usage">("summary");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [errorEvents, setErrorEvents] = useState<any[]>([]);
  const [usageEvents, setUsageEvents] = useState<any[]>([]);
  const [range, setRange] = useState("24h");
  const [err, setErr] = useState("");

  const fetchData = useCallback(
    async (v: string) => {
      setLoading(true);
      setErr("");
      try {
        if (v === "errors") {
          const res = await fetch("/api/analytics/app-events/?view=errors&limit=100");
          const body = await res.json();
          if (body.success) setErrorEvents(body.data?.events || []);
          else setErr(body.error || "Failed to load");
        } else if (v === "usage") {
          const res = await fetch(`/api/analytics/app-events/?view=usage&range=${range}`);
          const body = await res.json();
          if (body.success) {
            setUsageEvents(body.data?.events || []);
          } else setErr(body.error || "Failed to load");
        } else {
          const res = await fetch("/api/analytics/app-events/?view=summary");
          const body = await res.json();
          if (body.success) setSummary(body.data);
          else setErr(body.error || "Failed to load");
        }
      } catch (err) {
        logger.warn("AppActivityTab fetchData failed:", err);
        setErr(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    fetchData(view);
  }, [view, fetchData]);

  const tabs = [
    { id: "summary" as const, label: "Summary", icon: "bar_chart" },
    { id: "errors" as const, label: "Error Feed", icon: "bug_report" },
    { id: "usage" as const, label: "Usage", icon: "trending_up" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">App Activity</h2>
        <p className="text-[12px] text-[var(--t3)] mt-0.5">
          Page views, feature usage, and client-side errors across the platform.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all ${
              view === t.id
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "bg-[var(--surface)] border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--bg)]"
            }`}
          >
            <MaterialIcon icon={t.icon} style={{ fontSize: 15 }} />
            {t.label}
          </button>
        ))}
        {view === "usage" && (
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="ml-2 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[12px] text-[var(--t1)]"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{err}</div>
      ) : view === "summary" && summary ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total Events"
              value={summary.totalEvents.toLocaleString()}
              icon="insights"
              color="var(--navy)"
            />
            <StatCard label="Page Views" value={summary.pageViews.toLocaleString()} icon="visibility" color="#0d9488" />
            <StatCard label="Errors" value={summary.errors.toLocaleString()} icon="bug_report" color="#dc2626" />
            <StatCard
              label="Unique Schools"
              value={summary.uniqueSchools.toLocaleString()}
              icon="school"
              color="#7c3aed"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="font-semibold text-[13px] text-[var(--t1)] mb-3">Top Pages</h3>
              {summary.topPages.length === 0 ? (
                <p className="text-[12px] text-[var(--t4)]">No page views recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {summary.topPages.slice(0, 8).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--t2)] truncate mr-2 max-w-[250px]">{p.name}</span>
                      <span className="text-[11px] font-semibold text-[var(--t3)]">{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="font-semibold text-[13px] text-[var(--t1)] mb-3">Top Features</h3>
              {summary.topFeatures.length === 0 ? (
                <p className="text-[12px] text-[var(--t4)]">No feature usage recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {summary.topFeatures.slice(0, 8).map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--t2)] truncate mr-2 max-w-[250px]">{f.name}</span>
                      <span className="text-[11px] font-semibold text-[var(--t3)]">{f.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {summary.recentErrors.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-[var(--surface)] p-4">
              <h3 className="font-semibold text-[13px] text-red-700 mb-3 flex items-center gap-1.5">
                <MaterialIcon icon="warning" style={{ fontSize: 16 }} />
                Recent Errors
              </h3>
              <div className="space-y-2">
                {summary.recentErrors.slice(0, 10).map((e: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[12px]">
                    <span className="text-[var(--t4)] whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString("en-UG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-red-600 font-medium break-all">{e.event_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : view === "errors" ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          {errorEvents.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--t4)]">No errors recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Time</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">User</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Error</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {errorEvents.map((ev: any) => (
                    <tr key={ev.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                      <td className="px-4 py-2.5 text-[var(--t3)] whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleString("en-UG", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--t2)]">
                        {ev.users?.full_name || ev.user_id?.slice(0, 8) || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-red-600 font-medium max-w-[300px] truncate" title={ev.event_name}>
                        {ev.event_name}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--t3)] max-w-[200px] truncate" title={ev.url || ""}>
                        {ev.url ? (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-[var(--primary)]"
                          >
                            {ev.url.length > 40 ? ev.url.slice(0, 40) + "…" : ev.url}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : view === "usage" ? (
        <div className="space-y-4">
          {usageEvents.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-[13px] text-[var(--t4)]">
              No events in this period.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Total Events"
                  value={usageEvents.length.toLocaleString()}
                  icon="insights"
                  color="var(--navy)"
                />
                <StatCard
                  label="Page Views"
                  value={usageEvents.filter((e: any) => e.event_type === "page_view").length.toLocaleString()}
                  icon="visibility"
                  color="#0d9488"
                />
                <StatCard
                  label="Feature Uses"
                  value={usageEvents.filter((e: any) => e.event_type === "feature_use").length.toLocaleString()}
                  icon="touch_app"
                  color="#7c3aed"
                />
                <StatCard
                  label="Errors"
                  value={usageEvents.filter((e: any) => e.event_type === "error").length.toLocaleString()}
                  icon="bug_report"
                  color="#dc2626"
                />
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-[12px]">
                    <thead className="sticky top-0 bg-[var(--surface)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Time</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Type</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Event</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageEvents.map((ev: any) => (
                        <tr
                          key={ev.id}
                          className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors"
                        >
                          <td className="px-4 py-2 text-[var(--t3)] whitespace-nowrap">
                            {new Date(ev.created_at).toLocaleString("en-UG", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                ev.event_type === "error"
                                  ? "bg-red-100 text-red-700"
                                  : ev.event_type === "page_view"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {ev.event_type === "page_view"
                                ? "page"
                                : ev.event_type === "feature_use"
                                  ? "feature"
                                  : "error"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-[var(--t2)] max-w-[300px] truncate">{ev.event_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
