"use client";
import { memo, useMemo } from "react";
import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

export interface WeeklyPayment {
  payment_date: string;
  amount_paid: number | string;
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function compactCurrency(amount: number) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return `${amount}`;
}

/** Monday (local) of the week containing `now`. */
function mondayOfWeek(now: Date) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

const WeeklyCollections = memo(function WeeklyCollections({ payments }: { payments: WeeklyPayment[] }) {
  const { days, total, max, todayIndex } = useMemo(() => {
    const now = new Date();
    const monday = mondayOfWeek(now);
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const p of payments) {
      const dt = new Date(p.payment_date);
      if (Number.isNaN(dt.getTime())) continue;
      const local = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
      const idx = Math.round((local.getTime() - monday.getTime()) / 86400000);
      if (idx >= 0 && idx < 7) totals[idx] += Number(p.amount_paid || 0);
    }
    const sum = totals.reduce((a, b) => a + b, 0);
    const peak = Math.max(...totals);
    return { days: totals, total: sum, max: peak, todayIndex: (now.getDay() + 6) % 7 };
  }, [payments]);

  return (
    <div className="card h-full flex flex-col">
      <div className="panel-head !mb-3">
        <h2 className="panel-title">Collections this week</h2>
        <Link href="/dashboard/reports" className="card-action-pill" aria-label="Open collections report">
          Reports
          <MaterialIcon icon="arrow_outward" style={{ fontSize: 13 }} />
        </Link>
      </div>

      <div
        className="flex items-stretch gap-3 h-44"
        role="img"
        aria-label={`Collections Monday to Sunday, total UGX ${total.toLocaleString()}`}
      >
        {days.map((value, i) => {
          const isMax = max > 0 && value === max;
          const height = max > 0 ? Math.max(9, Math.round((value / max) * 100)) : 9;
          return (
            <div key={i} className="weekbar-col">
              <span className={`weekbar-val ${isMax ? "" : "invisible"}`} aria-hidden={!isMax}>
                {compactCurrency(value)}
              </span>
              <div
                className={`weekbar ${value > 0 ? (isMax ? "weekbar-max" : "weekbar-solid") : "weekbar-empty"}`}
                style={{ height: `${height}%` }}
                title={`${"MTWTFSS"[i]}: UGX ${value.toLocaleString()}`}
              />
              <span className="weekbar-day" style={i === todayIndex ? { color: "var(--primary)" } : undefined}>
                {DAY_LETTERS[i]}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] font-medium text-[var(--t3)]">
        {total > 0 ? (
          <>
            <span className="font-bold text-[var(--t1)]">UGX {total.toLocaleString()}</span> collected Mon–Sun
          </>
        ) : (
          "No collections recorded yet this week."
        )}
      </p>
    </div>
  );
});

export default WeeklyCollections;
