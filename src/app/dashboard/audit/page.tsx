"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { getAuditLog, getAuditSummary, getDistinctModules, AuditEntry } from "@/lib/audit";
import { withTimeout } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, Select, Input, Modal } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "view", label: "View" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
];

const ACTION_ICONS: Record<string, string> = {
  create: "add_circle",
  update: "edit",
  delete: "delete",
  view: "visibility",
  login: "login",
  logout: "logout",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  view: "View",
  login: "Login",
  logout: "Logout",
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJSON(val: unknown): string {
  if (!val) return "—";
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

function truncateText(text: string, max = 80) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + "...";
}

function getTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function getWeekAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function AuditLogPage() {
  const { school } = useAuth();

  // Filters
  const [filterAction, setFilterAction] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterUser, setFilterUser] = useState("");
  const [dateFrom, setDateFrom] = useState(getWeekAgoISO());
  const [dateTo, setDateTo] = useState(getTodayISO());
  const [appliedFilters, setAppliedFilters] = useState<{
    action: string;
    module: string;
    user: string;
    dateFrom: string;
    dateTo: string;
  }>({
    action: "all",
    module: "all",
    user: "",
    dateFrom: getWeekAgoISO(),
    dateTo: getTodayISO(),
  });

  // Data
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Summary
  const [summary, setSummary] = useState<{
    todayCount: number;
    uniqueUsers: number;
    mostCommonAction: string;
  } | null>(null);

  // Detail modal
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);

    const options: Parameters<typeof getAuditLog>[1] = {
      action: appliedFilters.action,
      module: appliedFilters.module,
      userSearch: appliedFilters.user || undefined,
      dateFrom: appliedFilters.dateFrom
        ? new Date(appliedFilters.dateFrom).toISOString()
        : undefined,
      dateTo: appliedFilters.dateTo
        ? new Date(appliedFilters.dateTo + "T23:59:59").toISOString()
        : undefined,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };

    const fallback = { data: [] as AuditEntry[], total: 0 };
    const result = await withTimeout(
      getAuditLog(school.id, options),
      15000,
      fallback,
    );
    setLogs(result.data);
    setTotal(result.total);
    setLoading(false);
  }, [school?.id, appliedFilters, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!school?.id) return;
    withTimeout(getAuditSummary(school.id), 10000, {
      todayCount: 0,
      uniqueUsers: 0,
      mostCommonAction: "N/A",
      actionCounts: {},
    }).then(setSummary);
  }, [school?.id]);

  // Extract unique modules from loaded data for the entity filter
  const [allModules, setAllModules] = useState<string[]>([]);
  useEffect(() => {
    if (!school?.id) return;
    withTimeout(getDistinctModules(school.id), 10000, []).then(setAllModules);
  }, [school?.id]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({
      action: filterAction,
      module: filterModule,
      user: filterUser,
      dateFrom,
      dateTo,
    });
  };

  const hasChanges =
    filterAction !== appliedFilters.action ||
    filterModule !== appliedFilters.module ||
    filterUser !== appliedFilters.user ||
    dateFrom !== appliedFilters.dateFrom ||
    dateTo !== appliedFilters.dateTo;

  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = [
      "Timestamp",
      "User",
      "Action",
      "Entity Type",
      "Description",
      "IP Address",
      "Record ID",
    ];
    const rows = logs.map((l) => [
      l.created_at,
      l.user_name,
      l.action,
      l.module,
      `"${(l.description ?? "").replace(/"/g, '""')}"`,
      l.ip_address ?? "",
      l.record_id ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n",
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader
          title="Audit Log"
          subtitle="Track all system activities with full visibility"
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon={<MaterialIcon icon="download" />}
              onClick={exportCSV}
              disabled={logs.length === 0}
            >
              Export CSV
            </Button>
          }
        />

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardBody className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--navy-soft)] flex items-center justify-center">
                  <MaterialIcon
                    icon="today"
                    className="text-[var(--navy)]"
                    size={22}
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--t1)]">
                    {summary.todayCount}
                  </p>
                  <p className="text-xs text-[var(--t3)]">Logs Today</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--green-soft)] flex items-center justify-center">
                  <MaterialIcon
                    icon="people"
                    className="text-[var(--green)]"
                    size={22}
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--t1)]">
                    {summary.uniqueUsers}
                  </p>
                  <p className="text-xs text-[var(--t3)]">Unique Users</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--amber-soft)] flex items-center justify-center">
                  <MaterialIcon
                    icon="trending_up"
                    className="text-[var(--amber)]"
                    size={22}
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--t1)] capitalize">
                    {summary.mostCommonAction}
                  </p>
                  <p className="text-xs text-[var(--t3)]">Most Common Action</p>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardBody className="p-5">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-[var(--t3)] mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-[var(--t3)] mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <Select
                aria-label="Filter by action"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                options={ACTION_OPTIONS}
                className="flex-1 min-w-[140px]"
              />
              <Select
                aria-label="Filter by entity type"
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                options={[
                  { value: "all", label: "All Entities" },
                  ...allModules.map((m) => ({ value: m, label: m })),
                ]}
                className="flex-1 min-w-[140px]"
              />
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-[var(--t3)] mb-1">
                  User
                </label>
                <input
                  type="text"
                  placeholder="Search user..."
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={applyFilters}
                  disabled={!hasChanges}
                  icon={<MaterialIcon icon="filter_alt" />}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Table */}
        {loading ? (
          <TableSkeleton rows={5} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="description"
            title="No activity recorded"
            description="No audit entries match the current filters"
          />
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--surface-container-low)]">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)] whitespace-nowrap">
                        Timestamp
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)] whitespace-nowrap">
                        User
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)] whitespace-nowrap">
                        Action
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)] whitespace-nowrap">
                        Entity Type
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">
                        Details
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-[var(--t1)] whitespace-nowrap">
                        IP Address
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-t border-[var(--border)] hover:bg-[var(--surface-container-low)]/50 transition-colors"
                      >
                        <td className="p-3 text-[var(--t3)] whitespace-nowrap text-sm">
                          {formatTimestamp(log.created_at)}
                        </td>
                        <td className="p-3 font-medium text-[var(--t1)] text-sm">
                          {log.user_name || (
                            <span className="text-[var(--t4)]">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--surface-container)] text-[var(--t2)]">
                            <MaterialIcon
                              icon={ACTION_ICONS[log.action] || "help"}
                              size={14}
                            />
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="p-3 text-[var(--t3)] text-sm capitalize">
                          {log.module}
                        </td>
                        <td className="p-3 text-[var(--t3)] text-sm max-w-xs">
                          <div className="flex items-center gap-2">
                            <span className="truncate">
                              {truncateText(log.description || "", 60)}
                            </span>
                            {(log.old_value || log.new_value) && (
                              <button
                                onClick={() => setDetailEntry(log)}
                                className="shrink-0 p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--t4)] hover:text-[var(--primary)] transition-colors"
                                title="View full details"
                              >
                                <MaterialIcon icon="open_in_full" size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-[var(--t4)] text-xs font-mono whitespace-nowrap">
                          {log.ip_address || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm text-[var(--t3)]">
                    Showing {(page - 1) * pageSize + 1}–
                    {Math.min(page * pageSize, total)} of {total}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg hover:bg-[var(--surface-container)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <MaterialIcon icon="chevron_left" size={20} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let p: number;
                      if (totalPages <= 7) {
                        p = i + 1;
                      } else if (page <= 4) {
                        p = i + 1;
                      } else if (page >= totalPages - 3) {
                        p = totalPages - 6 + i;
                      } else {
                        p = page - 3 + i;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            page === p
                              ? "bg-[var(--primary)] text-white"
                              : "hover:bg-[var(--surface-container)] text-[var(--t3)]"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="p-2 rounded-lg hover:bg-[var(--surface-container)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <MaterialIcon icon="chevron_right" size={20} />
                    </button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Details Modal */}
        <Modal
          isOpen={!!detailEntry}
          onClose={() => setDetailEntry(null)}
          title="Audit Entry Details"
          size="lg"
        >
          {detailEntry && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider">
                    Timestamp
                  </p>
                  <p className="text-sm text-[var(--t1)] mt-0.5">
                    {new Date(detailEntry.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider">
                    User
                  </p>
                  <p className="text-sm text-[var(--t1)] mt-0.5">
                    {detailEntry.user_name || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider">
                    Action
                  </p>
                  <p className="text-sm text-[var(--t1)] mt-0.5 capitalize">
                    {detailEntry.action}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider">
                    Entity Type
                  </p>
                  <p className="text-sm text-[var(--t1)] mt-0.5 capitalize">
                    {detailEntry.module}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider">
                    IP Address
                  </p>
                  <p className="text-sm font-mono text-[var(--t1)] mt-0.5">
                    {detailEntry.ip_address || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider">
                    Record ID
                  </p>
                  <p className="text-sm font-mono text-[var(--t1)] mt-0.5 break-all">
                    {detailEntry.record_id || "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider mb-1">
                  Description
                </p>
                <p className="text-sm text-[var(--t1)] bg-[var(--surface-container-low)] rounded-lg p-3">
                  {detailEntry.description || "—"}
                </p>
              </div>

              {detailEntry.old_value && (
                <div>
                  <p className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider mb-1">
                    Old Value
                  </p>
                  <pre className="text-xs text-[var(--t1)] bg-[var(--surface-container-low)] rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
                    {formatJSON(detailEntry.old_value)}
                  </pre>
                </div>
              )}

              {detailEntry.new_value && (
                <div>
                  <p className="text-xs font-medium text-[var(--t3)] uppercase tracking-wider mb-1">
                    New Value
                  </p>
                  <pre className="text-xs text-[var(--t1)] bg-[var(--surface-container-low)] rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
                    {formatJSON(detailEntry.new_value)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </PageErrorBoundary>
  );
}
