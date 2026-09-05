"use client";
import { memo, useMemo } from "react";
import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

function compactCurrency(amount: number) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return `${amount}`;
}

const SIZE = 180;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const CollectionDonut = memo(function CollectionDonut({
  collected,
  expected,
}: {
  collected: number;
  expected: number;
}) {
  const { rate, arrears } = useMemo(() => {
    const r = expected > 0 ? Math.min(1, Math.max(0, collected / expected)) : 0;
    return { rate: Math.round(r * 100), arrears: Math.max(0, expected - collected) };
  }, [collected, expected]);

  return (
    <div className="card h-full flex flex-col">
      <div className="panel-head !mb-3">
        <h2 className="panel-title">Collection progress</h2>
        <Link href="/dashboard/fees?tab=defaulters" className="card-action-pill" aria-label="Open fee defaulters">
          Arrears
          <MaterialIcon icon="arrow_outward" style={{ fontSize: 13 }} />
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-1">
        <div
          className="relative"
          style={{ width: SIZE, height: SIZE }}
          role="img"
          aria-label={`${rate}% of expected fees collected`}
        >
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--green)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE}`}
              strokeDashoffset={CIRCUMFERENCE * (1 - rate / 100)}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[40px] font-extrabold tracking-tight leading-none text-[var(--t1)]"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {rate}%
            </span>
            <span className="text-[10px] font-semibold text-[var(--t3)] mt-1 uppercase tracking-wider">Collected</span>
          </div>
        </div>

        <div className="donut-legend">
          <span className="donut-legend-item">
            <span className="donut-dot" style={{ background: "var(--green)" }} aria-hidden="true" />
            UGX {compactCurrency(collected)}
          </span>
          <span className="donut-legend-item">
            <span className="donut-dot" style={{ background: "var(--amber)" }} aria-hidden="true" />
            UGX {compactCurrency(arrears)} left
          </span>
        </div>
      </div>
    </div>
  );
});

export default CollectionDonut;
