"use client";
import { memo } from "react";
import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  // Retained for API compatibility; the Donezo-style card carries no icon box
  // or accent bar, so these don't affect rendering.
  icon: string;
  accentColor: string;
  loading?: boolean;
  variant?: "standard" | "compact" | "premium-teal" | "premium-navy" | "premium-amber";
  href?: string;
  hrefLabel?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label: string;
  };
}

const StatCard = memo(function StatCard({
  label,
  value,
  subValue,
  loading,
  variant = "standard",
  href,
  hrefLabel,
  trend,
}: StatCardProps) {
  const isPremium = variant.startsWith("premium");

  const trendIcon =
    trend?.direction === "up" ? "trending_up" : trend?.direction === "down" ? "trending_down" : "trending_flat";

  // ── Featured card (Donezo "Total Projects" pattern: filled, white type) ───
  if (isPremium) {
    const cardClass = `stat-card ${
      variant === "premium-teal"
        ? "card-gradient-teal"
        : variant === "premium-navy"
          ? "card-gradient-navy"
          : "card-gradient-amber"
    }`;
    return (
      <div className={`${cardClass} shadow-[0_22px_48px_rgba(15,23,42,0.07)]`}>
        <div className="stat-inner !p-6">
          <div className="stat-meta">
            <div className="stat-label !text-white/80 !normal-case !tracking-normal !text-[13px] !font-medium">
              {label}
            </div>
            {href && !loading && (
              <Link
                href={href}
                aria-label={hrefLabel || `Open ${label}`}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[var(--t1)] transition-transform hover:scale-105 flex-shrink-0 no-underline"
              >
                <MaterialIcon icon="arrow_outward" style={{ fontSize: 16 }} />
              </Link>
            )}
          </div>
          <div className="stat-val !text-white !text-[40px] !font-semibold">{loading ? "..." : value}</div>
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-[11px] font-medium text-white/80">
              <MaterialIcon icon={trendIcon} style={{ fontSize: 13 }} />
              <span>
                {trend.value}% {trend.label}
              </span>
            </div>
          )}
          {subValue && !trend && <div className="text-[11px] font-medium mt-2 text-white/70">{subValue}</div>}
        </div>
      </div>
    );
  }

  // ── Standard card (Donezo anatomy: label + arrow, hero number, footnote) ───
  return (
    <div
      className="relative bg-white border border-[var(--border)] rounded-[20px] p-5 flex flex-col transition-all duration-200 cursor-default group hover:-translate-y-0.5 overflow-hidden"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.06)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-[var(--t2)] leading-snug">{label}</p>
        {href && !loading ? (
          <Link href={href} aria-label={hrefLabel || `Open ${label}`} className="stat-link-arrow">
            <MaterialIcon icon="arrow_outward" style={{ fontSize: 16 }} />
          </Link>
        ) : (
          <span className="stat-link-arrow opacity-0 group-hover:opacity-100 pointer-events-none" aria-hidden="true">
            <MaterialIcon icon="arrow_outward" style={{ fontSize: 16 }} />
          </span>
        )}
      </div>

      <div
        className="mt-1 text-[40px] font-semibold tracking-[-0.03em] leading-none text-[var(--t1)]"
        style={{ fontFamily: "'Sora', sans-serif" }}
      >
        {loading ? <span className="inline-block h-10 w-24 rounded-lg bg-[var(--border)] animate-pulse" /> : value}
      </div>

      <div className="mt-2 min-h-[16px]">
        {trend && !loading ? (
          <p
            className="flex items-center gap-1 text-[11px] font-medium"
            style={{
              color:
                trend.direction === "up" ? "var(--green)" : trend.direction === "down" ? "var(--red)" : "var(--t3)",
            }}
          >
            <MaterialIcon icon={trendIcon} style={{ fontSize: 13 }} />
            <span className="truncate">
              {trend.value}% {trend.label}
            </span>
          </p>
        ) : subValue && !loading ? (
          <p className="text-[11px] font-medium text-[var(--t3)] truncate">{subValue}</p>
        ) : null}
      </div>
    </div>
  );
});

export default StatCard;
