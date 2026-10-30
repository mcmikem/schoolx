"use client";

import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

export interface ActionLinkItem {
  label: string;
  href: string;
  icon: string;
}

interface ActionLinksProps {
  items: ActionLinkItem[];
  label?: string;
  columns?: 2 | 3 | 4 | 7;
  className?: string;
}

const GRID_COLUMNS: Record<NonNullable<ActionLinksProps["columns"]>, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  7: "grid-cols-2 sm:grid-cols-4 xl:grid-cols-7",
};

/**
 * Flat shortcut row: hairline-underlined links instead of a card of buttons.
 * Matches the Headmaster and Bursar dashboards, where the shortcuts are part
 * of the page rhythm rather than another floating panel.
 */
export function ActionLinks({ items, label = "Common actions", columns = 4, className = "" }: ActionLinksProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={label} className={`min-w-0 ${className}`}>
      <div className={`grid gap-x-5 ${GRID_COLUMNS[columns]}`}>
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className="group flex min-h-12 min-w-0 items-center gap-2 border-b border-[var(--border)] py-2 text-[13px] font-semibold text-[var(--t1)] transition-colors hover:text-[var(--primary)]"
          >
            <MaterialIcon
              icon={item.icon}
              className="text-lg text-[var(--t3)] transition-colors group-hover:text-[var(--primary)]"
            />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
