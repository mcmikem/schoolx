"use client";
import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";

export function AuditLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (moduleFilter) params.set("module", moduleFilter);
      const res = await fetch(`/api/audit/?${params}`);
      const body = await res.json();
      if (body.success) setLogs(body.data?.logs || []);
      else setError(body.error || "Failed to load");
    } catch (err) {
      logger.warn("AuditLogTab fetchLogs failed:", err);
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [moduleFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const modules = [...new Set(logs.map((l: any) => l.module).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">Audit Log</h2>
        <p className="text-[12px] text-[var(--t3)] mt-0.5">System-wide audit trail of all actions.</p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter by module..."
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="w-48 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[12px] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        />
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[12px] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        >
          <option value="">All Modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-[var(--t4)]">{logs.length} entries</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-[13px] text-[var(--t4)]">
          No audit log entries found.
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Time</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">User</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Action</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Module</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">School</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                    <td className="px-4 py-2.5 text-[var(--t3)] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("en-UG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--t2)]">
                      {log.users?.full_name || log.user_id?.slice(0, 8) || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          log.action === "delete"
                            ? "bg-red-100 text-red-700"
                            : log.action === "create"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--t2)]">{log.module || "—"}</td>
                    <td className="px-4 py-2.5 text-[var(--t2)]">{log.schools?.name || "—"}</td>
                    <td className="px-4 py-2.5 text-[var(--t3)] max-w-[200px] truncate" title={log.details || ""}>
                      {log.details || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
