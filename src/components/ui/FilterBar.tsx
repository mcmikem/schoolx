"use client";
import MaterialIcon from "@/components/MaterialIcon";
import SearchField from "@/components/ui/SearchField";

interface FilterChip {
  key: string;
  label: string;
  value: string;
  display: string;
}

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  chips: FilterChip[];
  onRemoveChip: (key: string) => void;
  onClearAll?: () => void;
  resultCount?: number;
  totalCount?: number;
  children?: React.ReactNode; // extra filters (selects)
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchLabel = "Search",
  chips,
  onRemoveChip,
  onClearAll,
  resultCount,
  totalCount,
  children,
}: FilterBarProps) {
  const hasFilters = chips.length > 0 || (searchValue?.length ?? 0) > 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[18px] p-3 sm:p-4 shadow-[var(--sh1)] space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        {onSearchChange && (
          <SearchField
            label={searchLabel}
            value={searchValue ?? ""}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
        )}
        {children && <div className="flex flex-wrap gap-2 items-center">{children}</div>}
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span
              key={`${c.key}-${c.value}`}
              className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-[var(--primary-50)] border border-[var(--primary-200)] text-[12px] font-medium text-[var(--primary-700)]"
            >
              <span className="text-[var(--t3)] font-normal">{c.label}:</span> {c.display}
              <button
                type="button"
                onClick={() => onRemoveChip(c.key)}
                className="min-w-11 min-h-11 rounded-full bg-white/70 hover:bg-white flex items-center justify-center"
                aria-label={`Remove ${c.label} filter`}
              >
                <MaterialIcon icon="close" className="text-[14px]" />
              </button>
            </span>
          ))}
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="min-h-11 px-3 text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              Clear all
            </button>
          )}
          {typeof resultCount === "number" && typeof totalCount === "number" && (
            <span role="status" className="ml-auto text-xs text-[var(--t3)]">
              Showing <span className="font-semibold text-[var(--t1)]">{resultCount}</span> of {totalCount}
            </span>
          )}
        </div>
      )}
      {!hasFilters && typeof resultCount === "number" && typeof totalCount === "number" && (
        <div role="status" className="text-xs text-[var(--t3)]">
          Showing <span className="font-semibold text-[var(--t1)]">{resultCount}</span> of {totalCount} records
        </div>
      )}
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  totalPages,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
}: PaginationProps) {
  if (totalCount === 0) return null;
  const allRows = pageSize === -1;
  const canPrev = !allRows && page > 1;
  const canNext = !allRows && page < totalPages;
  const start = allRows ? 1 : (page - 1) * pageSize + 1;
  const end = allRows ? totalCount : Math.min(page * pageSize, totalCount);

  return (
    <nav aria-label="Pagination" className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-2">
      <div className="text-xs text-[var(--t3)]">
        {totalCount > 0 ? (
          <>
            <span className="font-semibold text-[var(--t1)]">
              {start}-{end}
            </span>{" "}
            of {totalCount} · Page {allRows ? 1 : page} of {allRows ? 1 : totalPages}
          </>
        ) : (
          "No results"
        )}
      </div>
      <div className="flex max-w-full flex-wrap justify-center items-center gap-2">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-xs text-[var(--t3)] hidden sm:inline">Rows:</span>
            <select
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="min-h-11 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--t1)]"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value={-1}>All</option>
            </select>
          </div>
        )}
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="min-h-11 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--t1)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-container-low)] flex items-center gap-1"
        >
          <MaterialIcon icon="chevron_left" className="text-[18px]" /> Prev
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="min-h-11 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--primary-600)] flex items-center gap-1"
        >
          Next <MaterialIcon icon="chevron_right" className="text-[18px]" />
        </button>
      </div>
    </nav>
  );
}
