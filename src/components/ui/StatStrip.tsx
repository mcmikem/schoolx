"use client";

import { cn } from "@/lib/utils";

export type StatTone = "default" | "positive" | "warning" | "negative" | "info";

export interface StatItem {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatTone;
}

interface StatStripProps {
  items: StatItem[];
  /** Column count from `sm` upward. Mobile always shows 2 columns. */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
  /** Announced to screen readers when values change (offline/sync screens). */
  ariaLive?: "polite" | "off";
}

const columnClass: Record<2 | 3 | 4 | 5, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
};

const toneClass: Record<StatTone, string> = {
  default: "text-[var(--t1)]",
  positive: "text-[var(--green)]",
  warning: "text-[var(--amber)]",
  negative: "text-[var(--error)]",
  info: "text-[var(--primary)]",
};

export function StatStrip({ items, columns = 4, className = "", ariaLive = "off" }: StatStripProps) {
  return (
    <dl
      aria-live={ariaLive === "off" ? undefined : ariaLive}
      className={cn("grid grid-cols-2 gap-3 sm:gap-4", columnClass[columns], className)}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--sh1)]"
        >
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--t3)]">{item.label}</dt>
          <dd
            className={cn(
              "mt-1 truncate text-2xl font-bold tabular-nums leading-tight",
              toneClass[item.tone ?? "default"],
            )}
            title={typeof item.value === "string" ? item.value : undefined}
          >
            {item.value}
          </dd>
          {item.hint && <p className="mt-0.5 truncate text-[11px] text-[var(--t3)]">{item.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
