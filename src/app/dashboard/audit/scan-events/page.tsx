"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useAuth } from "@/lib/auth-context";
import { withTimeout } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Button, Input, Select, Modal, ModalFooter } from "@/components/ui/index";
import { Card, CardBody } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

const ENTITY_OPTIONS = [
  { value: "all", label: "All events" },
  { value: "student_meal", label: "Meal scans" },
  { value: "staff_attendance", label: "Staff attendance" },
];

const DECISION_OPTIONS = [
  { value: "all", label: "All decisions" },
  { value: "allowed", label: "Allowed" },
  { value: "blocked", label: "Blocked" },
];

type ScanEventRow = {
  id: string;
  created_at: string;
  entity_type: "student_meal" | "staff_attendance";
  target_id: string | null;
  meal_type: string | null;
  attendance_action: "check_in" | "check_out" | null;
  operator_user_id: string | null;
  operator_name: string;
  operator_role: string | null;
  scanner_id: string | null;
  source: string | null;
  raw_scan_hash: string | null;
  is_signed: boolean | null;
  signature_valid: boolean | null;
  decision: "allowed" | "blocked";
  reason_code: string;
  reason_message: string | null;
  target_label: string;
  metadata: Record<string, unknown> | null;
};

type ScanEventsResponse = {
  events: ScanEventRow[];
  total: number;
  summary: {
    allowed: number;
    blocked: number;
    invalidSignatures: number;
  };
};

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEntity(row: ScanEventRow) {
  if (row.entity_type === "student_meal") {
    return `Meal • ${row.meal_type || "Unknown"}`;
  }
  return `Attendance • ${row.attendance_action || "Unknown"}`;
}

function formatSignature(row: ScanEventRow) {
  if (row.signature_valid === true) return "Verified";
  if (row.signature_valid === false) return "Rejected";
  return row.is_signed ? "Signed" : "Unsigned";
}

function formatDecision(decision: ScanEventRow["decision"]) {
  return decision === "allowed" ? "Allowed" : "Blocked";
}

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekAgoISO() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

function toLocalStartOfDayISO(dateString: string) {
  const [year, month, day] = dateString.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function toLocalEndOfDayISO(dateString: string) {
  const [year, month, day] = dateString.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export default function ScanEventsPage() {
  const router = useRouter();
  const { school } = useAuth();

  const [entityType, setEntityType] = useState("all");
  const [decision, setDecision] = useState("all");
  const [scannerId, setScannerId] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [dateFrom, setDateFrom] = useState(getWeekAgoISO());
  const [dateTo, setDateTo] = useState(getTodayISO());
  const [appliedFilters, setAppliedFilters] = useState({
    entityType: "all",
    decision: "all",
    scannerId: "",
    reasonCode: "",
    dateFrom: getWeekAgoISO(),
    dateTo: getTodayISO(),
  });

  const [rows, setRows] = useState<ScanEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ScanEventsResponse["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [detailRow, setDetailRow] = useState<ScanEventRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!school?.id) return;

    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      entityType: appliedFilters.entityType,
      decision: appliedFilters.decision,
      scannerId: appliedFilters.scannerId || "all",
      reasonCode: appliedFilters.reasonCode || "all",
      dateFrom: appliedFilters.dateFrom ? toLocalStartOfDayISO(appliedFilters.dateFrom) : "",
      dateTo: appliedFilters.dateTo ? toLocalEndOfDayISO(appliedFilters.dateTo) : "",
    });

    const fallback: ScanEventsResponse = { events: [], total: 0, summary: { allowed: 0, blocked: 0, invalidSignatures: 0 } };
    const result = await withTimeout(
      fetch(`/api/audit/scan-events/?${params.toString()}`, { credentials: "include" }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load scan events (${response.status})`);
        }
        return (await response.json()) as ScanEventsResponse;
      }),
      15000,
      fallback,
    );

    setRows(result.events);
    setTotal(result.total);
    setSummary(result.summary);
    setLoading(false);
  }, [school?.id, page, appliedFilters]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({
      entityType,
      decision,
      scannerId: scannerId.trim(),
      reasonCode: reasonCode.trim(),
      dateFrom,
      dateTo,
    });
  };

  const hasChanges =
    entityType !== appliedFilters.entityType ||
    decision !== appliedFilters.decision ||
    scannerId.trim() !== appliedFilters.scannerId ||
    reasonCode.trim() !== appliedFilters.reasonCode ||
    dateFrom !== appliedFilters.dateFrom ||
    dateTo !== appliedFilters.dateTo;

  const exportCSV = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        entityType: appliedFilters.entityType,
        decision: appliedFilters.decision,
        scannerId: appliedFilters.scannerId || "all",
        reasonCode: appliedFilters.reasonCode || "all",
        dateFrom: appliedFilters.dateFrom ? toLocalStartOfDayISO(appliedFilters.dateFrom) : "",
        dateTo: appliedFilters.dateTo ? toLocalEndOfDayISO(appliedFilters.dateTo) : "",
        format: "csv",
        limit: "5000",
      });

      const response = await fetch(`/api/audit/scan-events/?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to export scan events (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `scan-events-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader
          title="Scan Events"
          subtitle="Monitor meal and attendance scans, terminal IDs, and signature checks."
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                icon={<MaterialIcon icon="download" />}
                onClick={exportCSV}
                disabled={exporting || loading}
              >
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<MaterialIcon icon="history" />}
                onClick={() => router.push("/dashboard/audit/")}
              >
                Audit Log
              </Button>
            </div>
          }
        />

        <Card>
          <CardBody className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <Select
              label="Event type"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              options={ENTITY_OPTIONS}
            />
            <Select
              label="Decision"
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              options={DECISION_OPTIONS}
            />
            <Input
              label="Scanner ID"
              value={scannerId}
              onChange={(event) => setScannerId(event.target.value)}
              placeholder="Filter by terminal ID"
            />
            <Input
              label="Reason code"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              placeholder="e.g. missing_student"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="From"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
          </CardBody>
          <div className="px-5 pb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--t3)]">
              Filters are applied to the school-scoped event stream.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => {
                setEntityType("all");
                setDecision("all");
                setScannerId("");
                setReasonCode("");
                setDateFrom(getWeekAgoISO());
                setDateTo(getTodayISO());
                setPage(1);
                setAppliedFilters({
                  entityType: "all",
                  decision: "all",
                  scannerId: "",
                  reasonCode: "",
                  dateFrom: getWeekAgoISO(),
                  dateTo: getTodayISO(),
                });
              }}>
                Reset
              </Button>
              <Button
                size="sm"
                onClick={applyFilters}
                disabled={!hasChanges}
                icon={<MaterialIcon icon="filter_alt" />}
              >
                Apply filters
              </Button>
            </div>
          </div>
        </Card>

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardBody className="p-5">
                <div className="text-sm text-[var(--t3)]">Matching events</div>
                <div className="text-3xl font-semibold mt-2">{total}</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-5">
                <div className="text-sm text-[var(--t3)]">Allowed</div>
                <div className="text-3xl font-semibold mt-2 text-[var(--green)]">{summary.allowed}</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-5">
                <div className="text-sm text-[var(--t3)]">Blocked / invalid</div>
                <div className="text-3xl font-semibold mt-2 text-[var(--red)]">{summary.blocked} / {summary.invalidSignatures}</div>
              </CardBody>
            </Card>
          </div>
        )}

        <Card>
          <CardBody className="p-0 overflow-hidden">
            {loading ? (
              <TableSkeleton rows={6} />
            ) : rows.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  icon="qr_code_scanner"
                  title="No scan events found"
                  description="Try widening the date range or clearing the terminal filters."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-container)] text-[var(--t3)]">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Time</th>
                      <th className="text-left px-4 py-3 font-medium">Event</th>
                      <th className="text-left px-4 py-3 font-medium">Target</th>
                      <th className="text-left px-4 py-3 font-medium">Decision</th>
                      <th className="text-left px-4 py-3 font-medium">Reason</th>
                      <th className="text-left px-4 py-3 font-medium">Scanner</th>
                      <th className="text-left px-4 py-3 font-medium">Signature</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-container)]/40">
                        <td className="px-4 py-3 whitespace-nowrap text-[var(--t2)]">{formatTimestamp(row.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-[var(--t1)]">{formatEntity(row)}</div>
                          <div className="text-xs text-[var(--t3)]">{row.operator_name}{row.operator_role ? ` • ${row.operator_role}` : ""}</div>
                        </td>
                        <td className="px-4 py-3 text-[var(--t2)]">{row.target_label}</td>
                        <td className="px-4 py-3"><Badge variant={row.decision === "allowed" ? "success" : "error"}>{formatDecision(row.decision)}</Badge></td>
                        <td className="px-4 py-3 text-[var(--t2)]">{row.reason_code}{row.reason_message ? ` • ${row.reason_message}` : ""}</td>
                        <td className="px-4 py-3 text-[var(--t2)]">{row.scanner_id || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={row.signature_valid === true ? "success" : row.signature_valid === false ? "error" : "default"}>
                            {formatSignature(row)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setDetailRow(row)}>
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-[var(--t3)]">
            Page {page} of {totalPages} • {rows.length} rows shown
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        </div>

        <Modal
          isOpen={Boolean(detailRow)}
          onClose={() => setDetailRow(null)}
          title={detailRow ? `Event ${detailRow.id.slice(0, 8)}` : "Event details"}
          size="xl"
        >
          {detailRow && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><div className="text-[var(--t3)]">Time</div><div className="font-medium">{formatTimestamp(detailRow.created_at)}</div></div>
                <div><div className="text-[var(--t3)]">Scanner</div><div className="font-medium">{detailRow.scanner_id || "—"}</div></div>
                <div><div className="text-[var(--t3)]">Operator</div><div className="font-medium">{detailRow.operator_name}</div></div>
                <div><div className="text-[var(--t3)]">Target</div><div className="font-medium">{detailRow.target_label}</div></div>
                <div><div className="text-[var(--t3)]">Entity</div><div className="font-medium">{formatEntity(detailRow)}</div></div>
                <div><div className="text-[var(--t3)]">Decision</div><div className="font-medium">{formatDecision(detailRow.decision)}</div></div>
                <div><div className="text-[var(--t3)]">Reason</div><div className="font-medium">{detailRow.reason_code}</div></div>
                <div><div className="text-[var(--t3)]">Signature</div><div className="font-medium">{formatSignature(detailRow)}</div></div>
              </div>
              <div>
                <div className="text-[var(--t3)] mb-2">Metadata</div>
                <pre className="rounded-xl bg-[var(--surface-container)] p-4 overflow-x-auto text-xs leading-5">{JSON.stringify(detailRow.metadata || {}, null, 2)}</pre>
              </div>
              <div>
                <div className="text-[var(--t3)] mb-2">Raw scan hash</div>
                <div className="font-mono text-xs break-all rounded-xl bg-[var(--surface-container)] p-4">{detailRow.raw_scan_hash || "—"}</div>
              </div>
              <ModalFooter>
                <Button variant="secondary" onClick={() => setDetailRow(null)}>Close</Button>
              </ModalFooter>
            </div>
          )}
        </Modal>
      </div>
    </PageErrorBoundary>
  );
}
