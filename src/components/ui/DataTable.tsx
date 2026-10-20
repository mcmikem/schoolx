"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { TableSkeleton } from "@/components/ui/Skeleton";

export interface DataColumn<T> {
  /** Stable identifier, also used as the sort key when `sortValue` is set. */
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
  /** Hidden in the stacked mobile cards. */
  hideOnMobile?: boolean;
  className?: string;
  headerClassName?: string;
  /** Keep column pinned to the left edge when table scrolls horizontally */
  pinned?: boolean;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Card contents under `sm`. Defaults to a label/value list of visible columns. */
  renderMobileCard?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: React.ReactNode;
  caption?: string;
  footer?: React.ReactNode;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  /** Rows visible per page when paging is handled by the parent. */
  initialSort?: { key: string; dir: "asc" | "desc" };
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  renderMobileCard,
  onRowClick,
  loading = false,
  empty,
  caption,
  footer,
  className = "",
  rowClassName,
  initialSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sort, columns]);

  const toggleSort = (column: DataColumn<T>) => {
    if (!column.sortValue) return;
    setSort((current) => {
      if (current?.key !== column.key) return { key: column.key, dir: "asc" };
      if (current.dir === "asc") return { key: column.key, dir: "desc" };
      return null;
    });
  };

  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4", className)}>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (rows.length === 0) {
    return <>{empty ?? null}</>;
  }

  const mobileColumns = columns.filter((c) => !c.hideOnMobile);

  return (
    <div className={cn("rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh1)]", className)}>
      <div className="overflow-x-auto">
        <table className="hidden w-full border-collapse text-sm sm:table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-0 z-10 bg-[var(--surface)]">
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--t3)]">
              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "whitespace-nowrap px-3 py-3 font-semibold",
                      column.pinned && "sticky left-0 z-20 bg-[var(--surface)] shadow-[2px_0_4px_rgba(0,0,0,0.06)]",
                      alignClass[column.align ?? "left"],
                      column.headerClassName,
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 hover:text-[var(--t1)]"
                      >
                        {column.header}
                        <MaterialIcon
                          icon={active ? (sort!.dir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                          className={cn("text-[14px]", active ? "text-[var(--primary)]" : "opacity-50")}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "border-b border-[var(--border)]/70 last:border-0",
                  onRowClick &&
                    "cursor-pointer hover:bg-[var(--surface-container-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                  rowClassName?.(row),
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-3 align-middle text-[var(--t1)]",
                      column.pinned && "sticky left-0 z-10 bg-[var(--surface)] shadow-[2px_0_4px_rgba(0,0,0,0.06)]",
                      alignClass[column.align ?? "left"],
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-[var(--border)]/70 sm:hidden">
        {sorted.map((row) => (
          <li key={getRowId(row)}>
            <div
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn("px-4 py-3", onRowClick && "cursor-pointer active:bg-[var(--surface-container-low)]")}
            >
              {renderMobileCard ? (
                renderMobileCard(row)
              ) : (
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5">
                  {mobileColumns.map((column) => (
                    <div key={column.key} className="contents">
                      <dt className="min-w-0 text-xs text-[var(--t3)]">{column.header}</dt>
                      <dd className="min-w-0 text-right text-sm text-[var(--t1)]">{column.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        ))}
      </ul>

      {footer && <div className="border-t border-[var(--border)] px-4 py-3 text-sm">{footer}</div>}
    </div>
  );
}
