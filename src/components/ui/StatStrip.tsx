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
  /** "flat" drops the boxed cards for one hairline-divided strip. */
  variant?: "cards" | "flat";
}

const columnClass: Record<2 | 3 | 4 | 5, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
};

const toneClass: Record<StatTone, string> = {
  default: "text-[var(--t1)]",
  positive: "text-[var(--green-ink)]",
  warning: "text-[var(--amber-ink)]",
  negative: "text-[var(--error)]",
  info: "text-[var(--primary)]",
};

export function StatStrip({ items, columns = 4, className = "", ariaLive = "off", variant = "cards" }: StatStripProps) {
  const flat = variant === "flat";
  const mobileColumns = 2;
  const tabletColumns = columns === 4 ? 2 : columns === 5 ? 3 : columns;
  const lastRowStart = (columnCount: number) => {
    const remainder = items.length % columnCount;
    return remainder === 0 ? items.length - columnCount : items.length - remainder;
  };
  const mobileLastRowStart = lastRowStart(mobileColumns);
  const tabletLastRowStart = lastRowStart(tabletColumns);
  const desktopLastRowStart = lastRowStart(columns);
  return (
    <dl
      aria-live={ariaLive === "off" ? undefined : ariaLive}
      className={cn(
        flat
          ? "grid grid-cols-2 gap-x-4 border-y border-[var(--border)] sm:gap-x-0"
          : "grid grid-cols-2 gap-3 sm:gap-4",
        columnClass[columns],
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            flat
              ? "min-w-0 py-3 sm:px-4 sm:first:pl-0 sm:last:pr-0"
              : "min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--sh1)]",
            flat && items.length % mobileColumns === 1 && index === items.length - 1 && "col-span-2 sm:col-span-1",
            flat && index < mobileLastRowStart && "border-b border-[var(--border)]",
            flat && index >= mobileLastRowStart && "border-b-0",
            flat && index < tabletLastRowStart && "sm:border-b sm:border-[var(--border)]",
            flat && index >= tabletLastRowStart && "sm:border-b-0",
            flat && index < desktopLastRowStart && "lg:border-b lg:border-[var(--border)]",
            flat && index >= desktopLastRowStart && "lg:border-b-0",
          )}
        >
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--t3)]">{item.label}</dt>
          <dd
            className={cn(
              "mt-1 truncate text-2xl font-bold tabular-nums leading-tight",
              toneClass[item.tone ?? "default"],
            )}
            title={typeof item.value === "string" ? item.value : undefined}
          >
            {item.value}
          </dd>
          {item.hint && <p className="mt-0.5 truncate text-xs text-[var(--t3)]">{item.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
