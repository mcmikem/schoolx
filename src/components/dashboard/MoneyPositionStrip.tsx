"use client";

import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";
import { formatCompactCurrency } from "@/lib/currency";
import { useMoney } from "@/lib/hooks/money";
import { useAuth } from "@/lib/auth-context";

/**
 * The school's cash position, for the people who have to answer for it.
 *
 * A bursar is asked two questions every month: how much came in, and how much
 * went out. The dashboard previously showed only fees coming in, so the second
 * question had no answer on it at all — the headmaster and bursar were looking
 * at a one-sided picture.
 *
 * Deliberately shows other income and pending spending separately. Committed
 * spend is money that is gone; pending spend is money we are likely to lose but
 * have not yet authorised. Collapsing the two would make the balance wrong.
 */
export default function MoneyPositionStrip() {
  const { school } = useAuth();
  const { position, loading } = useMoney(school?.id);

  return (
    <section aria-label="money position" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-[var(--t1)]">Money in and out</h2>
        <Link
          href="/dashboard/money"
          className="flex min-h-[44px] items-center gap-1 px-2 text-[13px] font-semibold text-[var(--primary)]"
        >
          Open
          <MaterialIcon className="text-base">chevron_right</MaterialIcon>
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure
          label="Money in"
          value={position.moneyIn}
          hint={`Fees ${formatCompactCurrency(position.feesCollected)}`}
          loading={loading}
        />
        <Figure
          label="Money out"
          value={position.committedOut}
          hint={`${formatCompactCurrency(position.pendingOut)} pending`}
          loading={loading}
        />
        <Figure
          label="Available"
          value={position.available}
          hint={position.unebHeld > 0 ? `${formatCompactCurrency(position.unebHeld)} UNEB held` : "Spendable"}
          colour={position.available >= 0 ? "var(--green)" : "var(--red)"}
          loading={loading}
        />
        <Figure label="Other income" value={position.otherIncome} hint="Not fees" loading={loading} />
      </div>

      {position.pendingOut > 0 && (
        <p className="mt-3 text-xs text-[var(--t3)]">
          {formatCompactCurrency(position.pendingOut)} is waiting for approval and is not yet counted as spent.
        </p>
      )}
    </section>
  );
}

function Figure({
  label,
  value,
  hint,
  colour,
  loading,
}: {
  label: string;
  value: number;
  hint?: string;
  colour?: string;
  loading: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-bold uppercase tracking-wide text-[var(--t3)]">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-5 w-20 animate-pulse rounded bg-[var(--surface-container-high)]" />
      ) : (
        <p className="mt-0.5 truncate text-[17px] font-bold tabular-nums" style={{ color: colour ?? "var(--t1)" }}>
          UGX {formatCompactCurrency(value)}
        </p>
      )}
      {hint && <p className="truncate text-xs text-[var(--t3)]">{hint}</p>}
    </div>
  );
}
