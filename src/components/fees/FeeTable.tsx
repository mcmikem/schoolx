"use client";
import { useState, useMemo, Fragment } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { RollCallPhoto } from "@/components/attendance/RollCallPhoto";
import { formatCurrency } from "@/lib/currency";
import type { AllocatedFee } from "@/lib/fee-allocation";

export interface StudentBalance {
  id: string;
  name: string;
  student_number: string;
  class_name: string;
  class_id: string;
  photo_url?: string | null;
  expected: number;
  paid: number;
  balance: number;
  /** Unpaid charges brought forward from earlier terms. */
  arrears?: number;
  /** Portion of the balance attributable to the current term. */
  currentDue?: number;
  status?: "paid" | "partial" | "unpaid" | "written_off";
  /**
   * What each fee line still owes, and how far through it the pupil is.
   *
   * Without this the screen can only say "135,000 owing", which tells a bursar
   * nothing about whether the tuition is cleared and the uniform is not -- the
   * question they are actually being asked when they call about a balance.
   */
  feeBreakdown?: AllocatedFee[];
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string;
    date: string;
    /** Fee line this payment settled, when it names one. */
    fee?: string;
    /** When the row was written, to the minute. */
    recorded_at?: string | null;
    /** Who entered it. Null for a payment claimed in the parent portal. */
    recorded_by?: string | null;
  }>;
  adjustments: Array<{
    id: string;
    adjustment_type: string;
    amount: number;
    description: string;
    /** Fee line discounted, when the adjustment names one. */
    fee?: string;
    recorded_at?: string | null;
    recorded_by?: string | null;
  }>;
}

type SortKey = "name" | "balance" | "class_name";
type SortDir = "asc" | "desc";

/**
 * What each fee line owes, and how far through it the pupil is.
 *
 * Sits under the overall bar rather than replacing it: the bar answers "how far
 * through the bill", this answers "which fee", which is the question behind
 * every "why do I owe this?" a bursar gets.
 *
 * Settled lines are kept, muted, rather than hidden. Hiding them loses the
 * information that the tuition was paid at all -- which is exactly the confusion
 * this exists to remove.
 */
function FeeBreakdownLines({ fees }: { fees: AllocatedFee[] }) {
  if (!fees || fees.length === 0) return null;
  // A single line adds nothing under the overall bar that repeats it.
  if (fees.length === 1) return null;

  const shortFormat = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return String(n);
  };

  // A school sets Term 1, Term 2 and Term 3 lines all named "Tuition", and the
  // balance deliberately totals across terms rather than hiding charges. Left
  // alone that renders as "Tuition" three times over, which reads as a bug.
  // Where a name repeats, the term is what tells them apart.
  const nameCounts = new Map<string, number>();
  for (const fee of fees) nameCounts.set(fee.name, (nameCounts.get(fee.name) ?? 0) + 1);

  const MAX_LINES = 6;
  const visible = fees.slice(0, MAX_LINES);
  const hidden = fees.length - visible.length;

  return (
    <div className="mt-2.5 space-y-1.5" aria-label="Fee breakdown">
      {visible.map((fee) => {
        const settled = fee.status === "paid";
        return (
          <div key={fee.id ?? fee.name} className="text-xs leading-tight">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className="truncate"
                style={{ color: settled ? "var(--t3)" : "var(--t2)", opacity: settled ? 0.75 : 1 }}
              >
                {fee.name}
                {(nameCounts.get(fee.name) ?? 0) > 1 && fee.term != null && (
                  <span style={{ color: "var(--t3)" }}> · T{fee.term}</span>
                )}
              </span>
              <span className="tabular-nums whitespace-nowrap" style={{ color: "var(--t3)" }}>
                {settled ? (
                  <span className="inline-flex items-center gap-1">
                    <MaterialIcon style={{ fontSize: 12 }}>check_circle</MaterialIcon>
                    {shortFormat(fee.amount)}
                  </span>
                ) : (
                  <span style={{ color: "var(--red)", fontWeight: 600 }}>{shortFormat(fee.remaining)} left</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${fee.progress}%`,
                  background: settled ? "var(--green)" : fee.progress >= 50 ? "var(--amber)" : "var(--red)",
                }}
              />
            </div>
          </div>
        );
      })}
      {hidden > 0 && (
        <div className="text-xs" style={{ color: "var(--t3)" }}>
          +{hidden} more fee{hidden === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

interface EnhancedFeeTableProps {
  balances: StudentBalance[];
  /** id -> name, so the ledger can say who entered each row. */
  recordedByName?: Map<string, string>;
  onViewReceipt: (student: StudentBalance) => void;
  onRecordPayment?: (student: StudentBalance) => void;
  onSendSMS?: (students: StudentBalance[]) => void;
  onExport?: (students: StudentBalance[]) => void;
}

/**
 * The clock time a row was written, in the reader's own timezone.
 *
 * Rendered from created_at rather than from the payment_date the bursar typed:
 * a payment entered at 23:50 for "today" must be visible as late in the day, or
 * a correction made this morning is indistinguishable from one made at closing.
 * Returns null when there is no timestamp, so an imported row with only a date
 * shows the date and nothing invented.
 */
export function formatTimeOfDay(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Who entered the row.
 *
 * An audit trail that says "by Unknown" is worse than useless -- it reads as
 * suspicion where the truth is usually a payment claimed in the parent portal
 * or a row imported without a user. So each case says what it actually is.
 */
export function describeWho(recordedBy: string | null | undefined, names?: Map<string, string>): string {
  if (!recordedBy) return "Parent portal or an uncredited import";
  const name = names?.get(recordedBy);
  return name || "a staff member no longer on the account";
}

function FeeProgressBar({ percentage, amount, total }: { percentage: number; amount: number; total: number }) {
  // Soft system palette (not saturated 500s): quiet track, single confident fill.
  // Principle: hierarchy — progress supports scanning, it never shouts over the balance.
  const tone =
    percentage >= 100 || percentage >= 75
      ? { fill: "var(--green)", track: "var(--green-soft)", text: "var(--green)" }
      : percentage >= 50
        ? { fill: "var(--amber)", track: "var(--amber-soft)", text: "var(--amber)" }
        : { fill: "var(--red)", track: "var(--red-soft)", text: "var(--red)" };

  const shortFormat = (n: number) => {
    if (n >= 1000000) return `UGX ${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `UGX ${(n / 1000).toFixed(0)}K`;
    return `UGX ${n}`;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-[var(--t3)] font-medium tabular-nums">
          {shortFormat(amount)} / {shortFormat(total)}
        </span>
        <span className="font-bold tabular-nums" style={{ color: tone.text }}>
          {percentage >= 100 ? "Paid" : `${Math.min(percentage, 99)}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: tone.track }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%`, background: tone.fill }}
        />
      </div>
    </div>
  );
}

function getStatusBadge(status: string | undefined, percentage: number) {
  // Single badge system (.badge): quick to scan, never steals focus from the balance.
  if (status === "written_off") {
    return <span className="badge badge-navy">Written off</span>;
  }
  if (percentage >= 100) {
    return <span className="badge badge-green">Paid</span>;
  }
  if (percentage === 0) {
    return <span className="badge badge-red">Unpaid</span>;
  }
  return <span className="badge badge-amber">{Math.min(percentage, 99)}%</span>;
}

const ITEMS_PER_PAGE = 20;

function BalanceLedger({ student, recordedByName }: { student: StudentBalance; recordedByName?: Map<string, string> }) {
  const formatDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  };
  return (
    <div className="space-y-1.5 text-sm">
      {student.arrears ? (
        <div className="flex items-center justify-between text-[var(--t2)]">
          <span className="min-w-0 truncate">Brought forward · earlier terms</span>
          <span className="shrink-0 font-semibold tabular-nums text-[var(--red)]">
            {formatCurrency(student.arrears)}
          </span>
        </div>
      ) : null}
      <div className="flex items-center justify-between text-[var(--t2)]">
        <span>Expected</span>
        <span className="font-semibold tabular-nums">{formatCurrency(student.expected || 0)}</span>
      </div>
      {student.payments.map((p) => (
        <div key={p.id} className="flex items-start justify-between gap-3 text-[var(--t2)]">
          <span className="min-w-0">
            <span className="block truncate">
              Paid · {formatDate(p.date)}
              {formatTimeOfDay(p.recorded_at) ? ` at ${formatTimeOfDay(p.recorded_at)}` : ""}
              {p.method ? ` · ${p.method}` : ""}
              {p.reference ? ` · ${p.reference}` : ""}
              {p.fee ? ` · ${p.fee}` : ""}
            </span>
            <span className="block text-xs text-[var(--t3)]">by {describeWho(p.recorded_by, recordedByName)}</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-emerald-700">−{formatCurrency(p.amount || 0)}</span>
        </div>
      ))}
      {student.adjustments.map((a) => (
        <div key={a.id} className="flex items-start justify-between gap-3 text-[var(--t2)]">
          <span className="min-w-0">
            <span className="block truncate">
              {a.adjustment_type || "Adjustment"}
              {formatTimeOfDay(a.recorded_at) ? ` at ${formatTimeOfDay(a.recorded_at)}` : ""}
              {a.fee ? ` · ${a.fee}` : ""}
              {a.description ? ` · ${a.description}` : ""}
            </span>
            <span className="block text-xs text-[var(--t3)]">by {describeWho(a.recorded_by, recordedByName)}</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(a.amount || 0)}</span>
        </div>
      ))}
      {student.payments.length === 0 && student.adjustments.length === 0 && (
        <div className="text-xs text-[var(--t3)]">No payments or adjustments recorded yet.</div>
      )}
      <div
        className="flex items-center justify-between border-t border-[var(--border)] pt-1.5 font-bold tabular-nums"
        style={{ color: student.balance > 0 ? "var(--red)" : "var(--green)" }}
      >
        <span>Balance</span>
        <span>{formatCurrency(student.balance || 0)}</span>
      </div>
    </div>
  );
}

export default function FeeTable({
  balances,
  recordedByName,
  onViewReceipt,
  onRecordPayment,
  onSendSMS,
  onExport,
}: EnhancedFeeTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("balance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);
  // One expanded ledger at a time: who was charged what, paid what, and what
  // is left — without leaving the balances list.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    return [...balances].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return mul * a.name.localeCompare(b.name);
      if (sortKey === "class_name") return mul * a.class_name.localeCompare(b.class_name);
      return mul * (a.balance - b.balance);
    });
  }, [balances, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const allSelected = paginated.length > 0 && paginated.every((s) => selectedIds.has(s.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedStudents = useMemo(() => balances.filter((s) => selectedIds.has(s.id)), [balances, selectedIds]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column)
      return <MaterialIcon className="text-sm ml-1 text-on-surface-variant/40">swap_vert</MaterialIcon>;
    return (
      <MaterialIcon className="text-sm ml-1 text-primary">
        {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
      </MaterialIcon>
    );
  };

  return (
    <>
      {showBulkBar && selectedIds.size > 0 && (
        <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-xl px-4 py-3 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[var(--primary)]">
            {selectedIds.size} student{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2 flex-wrap">
            {onSendSMS && (
              <button
                onClick={() => {
                  onSendSMS(selectedStudents);
                  setSelectedIds(new Set());
                  setShowBulkBar(false);
                }}
                className="px-3 py-1.5 bg-[var(--green)] text-white text-xs font-bold rounded-lg hover:bg-[var(--green)]/90 transition-colors"
              >
                <MaterialIcon className="text-sm align-text-bottom mr-1">sms</MaterialIcon>
                Send SMS
              </button>
            )}
            {onExport && (
              <button
                onClick={() => {
                  onExport(selectedStudents);
                  setSelectedIds(new Set());
                  setShowBulkBar(false);
                }}
                className="px-3 py-1.5 bg-[var(--surface-container)] text-[var(--t1)] text-xs font-bold rounded-lg hover:bg-[var(--surface-container-high)] transition-colors"
              >
                <MaterialIcon className="text-sm align-text-bottom mr-1">download</MaterialIcon>
                Export
              </button>
            )}
            <button
              onClick={() => {
                setSelectedIds(new Set());
                setShowBulkBar(false);
              }}
              className="px-3 py-1.5 text-[var(--t3)] text-xs font-bold rounded-lg hover:bg-[var(--surface-container)] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[var(--sh1)] border border-[var(--border)] hidden md:block">
        <div className="overflow-x-auto table-responsive">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--surface-container-low)] text-left">
                <th className="px-6 py-3.5 w-12">
                  <label className="sr-only">Select all students</label>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => {
                      toggleAll();
                      setShowBulkBar(true);
                    }}
                    className="w-4 h-4 rounded"
                    aria-label="Select all students"
                  />
                </th>
                <th
                  className="px-6 py-3.5 text-xs uppercase tracking-[0.12em] font-bold text-[var(--t3)] cursor-pointer select-none hover:text-[var(--t1)]"
                  onClick={() => handleSort("name")}
                >
                  <span className="flex items-center">
                    Student
                    <SortIcon column="name" />
                  </span>
                </th>
                <th
                  className="px-6 py-3.5 text-xs uppercase tracking-[0.12em] font-bold text-[var(--t3)] cursor-pointer select-none hover:text-[var(--t1)]"
                  onClick={() => handleSort("class_name")}
                >
                  <span className="flex items-center">
                    Class
                    <SortIcon column="class_name" />
                  </span>
                </th>
                <th className="px-6 py-3.5 text-xs uppercase tracking-[0.12em] font-bold text-[var(--t3)]">Progress</th>
                <th className="px-6 py-3.5 text-xs uppercase tracking-[0.12em] font-bold text-[var(--t3)] text-right">
                  Paid
                </th>
                <th
                  className="px-6 py-3.5 text-xs uppercase tracking-[0.12em] font-bold text-[var(--t3)] cursor-pointer select-none hover:text-[var(--t1)] text-right"
                  onClick={() => handleSort("balance")}
                >
                  <span className="flex items-center justify-end">
                    Balance
                    <SortIcon column="balance" />
                  </span>
                </th>
                <th className="px-6 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60">
              {paginated.map((student) => {
                const total = student.expected || 0;
                const paid = student.paid || 0;
                const percentage = total > 0 ? Math.round((paid / total) * 100) : 0;

                return (
                  <Fragment key={student.id}>
                    <tr
                      className={`hover:bg-surface-bright transition-colors ${selectedIds.has(student.id) ? "bg-[var(--primary)]/5" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <label className="sr-only">Select {student.name}</label>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={() => {
                            toggleOne(student.id);
                            setShowBulkBar(true);
                          }}
                          className="w-4 h-4 rounded"
                          aria-label={`Select ${student.name}`}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <RollCallPhoto name={student.name} photoUrl={student.photo_url} decorative />
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--t1)] text-sm truncate">{student.name}</div>
                            {getStatusBadge(student.status, percentage)}
                          </div>
                        </div>
                        <div className="text-xs text-[var(--t3)] mt-0.5 tabular-nums">
                          {student.student_number} · {formatCurrency(total)} expected
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--t2)] whitespace-nowrap">{student.class_name}</td>
                      <td className="px-6 py-4 min-w-[180px] max-w-[260px]">
                        <FeeProgressBar percentage={percentage} amount={paid} total={total} />
                        <FeeBreakdownLines fees={student.feeBreakdown ?? []} />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-[var(--t2)] tabular-nums text-right whitespace-nowrap">
                        {formatCurrency(paid)}
                      </td>
                      <td
                        className="px-6 py-4 text-sm font-bold tabular-nums text-right whitespace-nowrap"
                        style={{ color: student.balance > 0 ? "var(--red)" : "var(--green)" }}
                      >
                        {formatCurrency(student.balance)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setExpandedId(expandedId === student.id ? null : student.id)}
                            className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-transparent text-[var(--t3)] transition-colors hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)] hover:border-[var(--border)]"
                            title={
                              expandedId === student.id
                                ? `Hide ledger for ${student.name}`
                                : `Show ledger for ${student.name}`
                            }
                            aria-label={
                              expandedId === student.id
                                ? `Hide ledger for ${student.name}`
                                : `Show ledger for ${student.name}`
                            }
                            aria-expanded={expandedId === student.id}
                          >
                            <MaterialIcon
                              icon={expandedId === student.id ? "expand_less" : "expand_more"}
                              className="text-lg"
                            />
                          </button>
                          {onRecordPayment && (
                            <button
                              onClick={() => onRecordPayment(student)}
                              className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] transition-colors hover:bg-[var(--surface-container-low)] hover:border-[var(--border2)]"
                              title={`Record payment for ${student.name}`}
                              aria-label={`Record payment for ${student.name}`}
                            >
                              <MaterialIcon icon="payment" className="text-lg" />
                            </button>
                          )}
                          <button
                            onClick={() => onViewReceipt(student)}
                            className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-transparent text-[var(--t3)] transition-colors hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)] hover:border-[var(--border)]"
                            title={`View receipt for ${student.name}`}
                            aria-label={`View receipt for ${student.name}`}
                          >
                            <MaterialIcon icon="visibility" className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === student.id && (
                      <tr className="bg-[var(--surface-container-low)]/60">
                        <td colSpan={7} className="px-6 py-4">
                          <BalanceLedger student={student} recordedByName={recordedByName} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-sm text-on-surface-variant">
              Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, sorted.length)} of{" "}
              {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-2 rounded-lg hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <MaterialIcon className="text-lg">chevron_left</MaterialIcon>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`e-${idx}`} className="px-2 text-on-surface-variant">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item as number)}
                      className={`w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg text-sm font-medium transition-colors ${safePage === item ? "bg-[var(--primary)] text-white" : "hover:bg-surface-container text-on-surface-variant"}`}
                    >
                      {item}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-2 rounded-lg hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <MaterialIcon className="text-lg">chevron_right</MaterialIcon>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile card layout — hierarchy: who → how much left → progress → act */}
      <div className="md:hidden space-y-3">
        {paginated.map((student) => {
          const total = student.expected || 0;
          const paid = student.paid || 0;
          const percentage = total > 0 ? Math.round((paid / total) * 100) : 0;

          return (
            <div
              key={student.id}
              className={`bg-[var(--surface)] rounded-2xl p-4 border shadow-[var(--sh1)] ${selectedIds.has(student.id) ? "border-[var(--primary)]" : "border-[var(--border)]"}`}
              style={
                selectedIds.has(student.id)
                  ? { background: "color-mix(in srgb, var(--primary) 4%, var(--surface))" }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(student.id)}
                    onChange={() => {
                      toggleOne(student.id);
                      setShowBulkBar(true);
                    }}
                    className="w-5 h-5 rounded mt-0.5 flex-shrink-0"
                    aria-label={`Select ${student.name}`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <RollCallPhoto name={student.name} photoUrl={student.photo_url} decorative />
                      <span className="font-semibold text-[var(--t1)] text-[15px] truncate">{student.name}</span>
                      {getStatusBadge(student.status, percentage)}
                    </div>
                    <div className="text-xs text-[var(--t3)] mt-0.5 truncate">
                      {student.student_number} · {student.class_name}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className="text-[17px] font-bold tabular-nums leading-none"
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      color: student.balance > 0 ? "var(--red)" : "var(--green)",
                    }}
                  >
                    {formatCurrency(student.balance)}
                  </div>
                  <div className="text-xs text-[var(--t3)] font-medium mt-1 tabular-nums">left to pay</div>
                </div>
              </div>

              <div className="mb-4">
                <FeeProgressBar percentage={percentage} amount={paid} total={total} />
                <FeeBreakdownLines fees={student.feeBreakdown ?? []} />
              </div>

              <div className="flex gap-2">
                {onRecordPayment && (
                  <button
                    onClick={() => onRecordPayment(student)}
                    className="flex-1 min-h-[44px] py-2.5 bg-[var(--primary)] text-[var(--on-primary)] text-[13px] font-semibold rounded-xl active:scale-[0.98] transition-transform"
                  >
                    <MaterialIcon className="text-base align-text-bottom mr-1">payment</MaterialIcon>
                    Pay {formatCurrency(student.balance)}
                  </button>
                )}
                <button
                  onClick={() => onViewReceipt(student)}
                  className="min-h-[44px] px-4 py-2.5 bg-[var(--surface-container-low)] text-[var(--t2)] text-[13px] font-semibold rounded-xl border border-[var(--border)] active:scale-[0.98] transition-transform"
                  aria-label={`View receipt for ${student.name}`}
                >
                  <MaterialIcon className="text-base align-text-bottom mr-1">visibility</MaterialIcon>
                  Receipt
                </button>
              </div>
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === student.id ? null : student.id)}
                aria-expanded={expandedId === student.id}
                className="mt-2 flex w-full items-center justify-center gap-1 py-1 text-xs font-semibold text-[var(--t3)]"
              >
                <MaterialIcon className="text-base">
                  {expandedId === student.id ? "expand_less" : "expand_more"}
                </MaterialIcon>
                {expandedId === student.id ? "Hide ledger" : "View ledger"}
              </button>
              {expandedId === student.id && (
                <div className="mt-2 rounded-xl bg-[var(--surface-container-low)] p-3">
                  <BalanceLedger student={student} recordedByName={recordedByName} />
                </div>
              )}
            </div>
          );
        })}

        {totalPages > 1 && (
          <div className="flex items-center justify-between py-3">
            <span className="text-xs text-on-surface-variant">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 bg-surface-container text-sm rounded-lg disabled:opacity-30"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 bg-[var(--primary)] text-white text-sm rounded-lg disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
