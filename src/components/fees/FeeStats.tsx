"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { formatCurrency } from "@/lib/currency";
import type { FeeRosterPartition } from "@/lib/fee-triage";

export type FeeStatusFilter = "all" | "paid" | "partial" | "unpaid" | "unbilled";

interface FeeStatsProps {
  stats: FeeRosterPartition;
  paymentsCount: number;
  onFilter?: (status: FeeStatusFilter) => void;
  activeFilter?: FeeStatusFilter;
  onSetFees?: () => void;
}

/**
 * One ring, one basis: every arc is a share of BILLED pupils. The old donut
 * mixed money (collected ÷ expected) with headcount (partial, unpaid) on the
 * same circle, so the arcs could never sum to 100% — a school 0% collected in
 * money still drew a nearly-full red arc.
 */
function RosterDonut({
  stats,
  onFilter,
  activeFilter,
}: {
  stats: FeeRosterPartition;
  onFilter?: (status: FeeStatusFilter) => void;
  activeFilter?: FeeStatusFilter;
}) {
  const billed = Math.max(stats.billed, 1);
  const segments = [
    {
      key: "paid" as const,
      label: "Cleared",
      count: stats.cleared,
      pct: (stats.cleared / billed) * 100,
      fill: "var(--green)",
    },
    {
      key: "partial" as const,
      label: "Part paid",
      count: stats.partial,
      pct: (stats.partial / billed) * 100,
      fill: "var(--amber)",
    },
    {
      key: "unpaid" as const,
      label: "Owes all",
      count: stats.owing,
      pct: (stats.owing / billed) * 100,
      fill: "var(--red)",
    },
  ];

  const R = 42;
  const C = 2 * Math.PI * R;
  let offsetAcc = 0;

  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full -rotate-90"
        role="img"
        aria-label={`${stats.collectionRate}% of billed pupils cleared`}
      >
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-container)" strokeWidth="13" />
        {stats.billed === 0 ? (
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--border)" strokeWidth="13" />
        ) : (
          segments.map((s) => {
            const dash = (s.pct / 100) * C;
            const el = (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={s.fill}
                strokeWidth={activeFilter === s.key ? 17 : 13}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offsetAcc}
                strokeLinecap="butt"
                className="cursor-pointer transition-[stroke-width]"
                onClick={() => onFilter?.(s.key)}
              />
            );
            offsetAcc += dash;
            return el;
          })
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-extrabold tabular-nums text-[var(--t1)]">{stats.collectionRate}%</span>
        {/* "cleared" alone read as a share of MONEY; it is a share of PUPILS.
            The money rate is stated once, in the footer. */}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--t3)]">pupils cleared</span>
      </div>
    </div>
  );
}

export default function FeeStats({ stats, paymentsCount, onFilter, activeFilter = "all", onSetFees }: FeeStatsProps) {
  const rows: Array<{ key: FeeStatusFilter; label: string; count: number; dot: string }> = [
    { key: "paid", label: "Cleared", count: stats.cleared, dot: "bg-[var(--green)]" },
    { key: "partial", label: "Part paid", count: stats.partial, dot: "bg-[var(--amber)]" },
    { key: "unpaid", label: "Owes in full", count: stats.owing, dot: "bg-[var(--red)]" },
    ...(stats.unbilled > 0
      ? [{ key: "unbilled" as const, label: "No fees", count: stats.unbilled, dot: "bg-[var(--t3)]" }]
      : []),
  ];

  return (
    <section aria-label="Fee collection overview" className="border-t border-[var(--border)] pt-5">
      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
        <RosterDonut stats={stats} onFilter={onFilter} activeFilter={activeFilter} />

        <div className="flex-1 w-full min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-base font-bold text-[var(--t1)]">Who has paid</h3>
            <span className="text-xs text-[var(--t3)] tabular-nums">
              {stats.billed} of {stats.roster} pupils billed
            </span>
          </div>

          <div
            className={`mt-3 grid grid-cols-1 divide-y divide-[var(--border)] border-y border-[var(--border)] ${
              rows.length > 3 ? "sm:grid-cols-4" : "sm:grid-cols-3"
            } sm:divide-x sm:divide-y-0`}
          >
            {rows.map((r) => {
              const active = activeFilter === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onFilter?.(r.key)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-left transition-colors ${
                    active ? "bg-[var(--primary)]/[0.06]" : "hover:bg-[var(--surface-container-low)]"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.dot}`} />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] truncate">
                      {r.label}
                    </span>
                    <span className="block text-lg font-extrabold tabular-nums text-[var(--t1)] leading-tight">
                      {r.count}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/*
        Unbilled pupils are the quiet killer: a class with no fee structure owes
        nothing, so they never appear as debtors and never count as payers. If
        that number is non-zero the bursar is looking at a wrong ledger, not a
        quiet school — so it gets its own line and a route to the fix.
      */}
      {stats.unbilled > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-[var(--border2)] bg-[var(--surface-container-low)] px-3.5 py-3">
          <MaterialIcon icon="warning" className="text-[var(--t3)] text-[18px] shrink-0" />
          <p className="text-xs text-[var(--t2)] leading-snug min-w-0 flex-1">
            <strong className="font-bold text-[var(--t1)] tabular-nums">{stats.unbilled}</strong>{" "}
            {stats.unbilled === 1 ? "pupil has" : "pupils have"} no fee structure for{" "}
            {stats.unbilled === 1 ? "their class" : "their class"} — excluded from the rate above.
          </p>
          <button
            type="button"
            onClick={() => onFilter?.("unbilled")}
            aria-pressed={activeFilter === "unbilled"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 min-h-[44px] text-xs font-bold text-[var(--t1)] hover:bg-[var(--surface-container-low)]"
          >
            <MaterialIcon icon="visibility" className="text-[16px]" />
            Show {stats.unbilled === 1 ? "pupil" : "pupils"}
          </button>
          <button
            type="button"
            onClick={() => onSetFees?.()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 min-h-[44px] text-xs font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]"
          >
            <MaterialIcon icon="add" className="text-[16px]" />
            Set fees
          </button>
        </div>
      )}

      {stats.billed > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--t3)]">
          <span className="inline-flex items-center gap-1.5">
            <MaterialIcon icon="payments" className="text-[15px]" />
            {paymentsCount} {paymentsCount === 1 ? "transaction" : "transactions"} recorded
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MaterialIcon icon="percent" className="text-[15px]" />
            {stats.realizationRate}% of {formatCurrency(stats.totalExpected)} collected in money
          </span>
        </div>
      )}
    </section>
  );
}
