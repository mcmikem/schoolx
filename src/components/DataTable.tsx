"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string | number;
  align?: "left" | "center" | "right";
}

interface BulkAction<T> {
  label: string;
  icon: string;
  action: (selectedRows: T[]) => void;
  variant?: "primary" | "danger" | "ghost";
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  showSearch?: boolean;
  searchPlaceholder?: string;
  idField?: string;
  className?: string;
  virtualize?: boolean;
  rowHeight?: number;
  overscan?: number;
  onExport?: () => void;
  enableBulkSelect?: boolean;
  bulkActions?: BulkAction<T>[];
  premium?: boolean;
}

type SortDirection = "asc" | "desc" | null;

const DEFAULT_ROW_HEIGHT = 48;
const DEFAULT_OVERSCAN = 5;

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = "No data available",
  onRowClick,
  pageSize = 20,
  showSearch = true,
  searchPlaceholder = "Search...",
  idField = "id",
  className,
  virtualize = false,
  rowHeight = DEFAULT_ROW_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  onExport,
  enableBulkSelect = false,
  bulkActions,
  premium = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Filter and search
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const value = row[col.key];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        }),
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) {
        result = result.filter((row) => {
          const cellValue = row[key];
          if (cellValue === null || cellValue === undefined) return false;
          return String(cellValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    return result;
  }, [data, search, filters, columns]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = useCallback(
    (columnKey: string) => {
      if (sortColumn === columnKey) {
        if (sortDirection === "asc") setSortDirection("desc");
        else if (sortDirection === "desc") {
          setSortColumn(null);
          setSortDirection(null);
        }
      } else {
        setSortColumn(columnKey);
        setSortDirection("asc");
      }
      setCurrentPage(1);
    },
    [sortColumn, sortDirection],
  );

  const handleFilter = useCallback((columnKey: string, value: string) => {
    setFilters((prev) => ({ ...prev, [columnKey]: value }));
    setCurrentPage(1);
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map((r) => String(r[idField]))));
    }
  }, [paginatedData, idField, selectedIds.size]);

  const toggleSelectRow = useCallback((rowId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const selectedRows = useMemo(() => {
    return paginatedData.filter((r) => selectedIds.has(String(r[idField])));
  }, [paginatedData, selectedIds, idField]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Reset to page 1 when total pages changes and current page is invalid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Virtualization scroll handler
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollTop(scrollContainerRef.current.scrollTop);
    }
  }, []);

  // Compute visible rows for virtualization
  const virtualRows = useMemo(() => {
    if (!virtualize) return null;

    const container = scrollContainerRef.current;
    if (!container) return null;

    const containerHeight = container.clientHeight - (showSearch ? 60 : 0) - 70;
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / rowHeight) - overscan,
    );
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const endIndex = Math.min(
      paginatedData.length,
      startIndex + visibleCount + overscan,
    );

    const totalHeight = paginatedData.length * rowHeight;
    const offsetY = startIndex * rowHeight;

    return { startIndex, endIndex, totalHeight, offsetY };
  }, [scrollTop, paginatedData, rowHeight, overscan, virtualize, showSearch]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b border-outline flex gap-4">
            {columns.map((_, j) => (
              <div
                key={j}
                className="h-4 bg-surface-container rounded flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const renderTableRows = (rows: T[]) => {
    if (virtualize && virtualRows) {
      const { startIndex, endIndex, totalHeight, offsetY } = virtualRows;
      const visibleRows = rows.slice(startIndex, endIndex);

      return (
        <tbody
          className="divide-y divide-outline"
          style={{ height: totalHeight, position: "relative" }}
        >
          <tr style={{ height: offsetY }}>
            <td style={{ padding: 0 }} colSpan={columns.length} />
          </tr>
          {visibleRows.map((row, index) => {
            const actualIndex = startIndex + index;
            return (
              <tr
                key={row[idField] || actualIndex}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "group transition-colors",
                  onRowClick
                    ? "cursor-pointer hover:bg-surface-container-low"
                    : "hover:bg-surface-container-lowest",
                )}
                style={{ height: rowHeight }}
              >
                {enableBulkSelect && (
                  <td className="p-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(String(row[idField]))}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectRow(String(row[idField]));
                      }}
                      className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "p-3 px-4 text-sm text-onSurface-variant",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                    )}
                  >
                    <div className="truncate">
                      {col.render ? col.render(row) : row[col.key]}
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      );
    }

    return (
      <tbody className="divide-y divide-outline">
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              className="p-12 text-center text-outline"
            >
              <span className="material-symbols-outlined text-[48px] block mb-3 opacity-30 mx-auto">
                inbox
              </span>
              <div className="text-sm font-medium">
                {search ? `No results for "${search}"` : emptyMessage}
              </div>
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr
              key={row[idField] || index}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "group transition-all duration-200",
                onRowClick ? "cursor-pointer" : "",
                premium ? "table-hover-premium" : "hover:bg-surface-container-low"
              )}
            >
              {enableBulkSelect && (
                <td className="p-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(String(row[idField]))}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelectRow(String(row[idField]));
                    }}
                    className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                  />
                </td>
              )}
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "p-3 px-4 text-sm text-onSurface-variant",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                  )}
                >
                  <div className="truncate">
                    {col.render ? col.render(row) : row[col.key]}
                  </div>
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    );
  };

  return (
    <div
      className={cn(
        "bg-surface rounded-xl border border-outline overflow-hidden flex flex-col",
        className,
      )}
    >
      {/* Bulk Actions Bar */}
      {enableBulkSelect && selectedIds.size > 0 && (
        <div className="p-3 px-4 bg-primary/5 border-b border-primary/20 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions?.map((action, i) => (
              <button
                key={i}
                onClick={() => action.action(selectedRows)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  action.variant === "danger" &&
                    "bg-red-50 text-red-700 hover:bg-red-100",
                  action.variant === "primary" &&
                    "bg-primary text-white hover:bg-primary/90",
                  (!action.variant || action.variant === "ghost") &&
                    "bg-surface-container text-onSurface-variant hover:bg-surface-container-high",
                )}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {action.icon}
                </span>
                {action.label}
              </button>
            ))}
          </div>
          <button
            onClick={clearSelection}
            className="ml-auto text-xs text-onSurface-variant hover:text-onSurface"
          >
            Clear
          </button>
        </div>
      )}

      {/* Search and Controls */}
      {showSearch && (
        <div className="p-3 px-4 border-b border-outline flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 bg-surface-container-low rounded-lg px-3 py-2 flex-1 min-w-[200px] border border-transparent focus-within:border-primary focus-within:bg-surface transition-all">
            <span className="material-symbols-outlined text-[18px] text-outline">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="border-none bg-transparent text-sm text-onSurface outline-none w-full placeholder:text-outline"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="bg-transparent border-none cursor-pointer p-0 hover:text-error transition-colors"
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined text-[16px]">
                  close
                </span>
              </button>
            )}
          </div>
          <div className="text-[13px] text-outline font-medium">
            {filteredData.length} {filteredData.length === 1 ? "item" : "items"}
          </div>
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container text-onSurface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">
                download
              </span>
              Export
            </button>
          )}
        </div>
      )}

      {/* Table Container */}
      <div
        ref={scrollContainerRef}
        onScroll={virtualize ? handleScroll : undefined}
        className={cn("overflow-x-auto", virtualize && "overflow-y-auto")}
        style={virtualize ? { maxHeight: "70vh" } : undefined}
      >
        <table className="w-full border-collapse table-auto" role="grid">
          <thead>
            <tr className="bg-surface-container-lowest">
              {enableBulkSelect && (
                <th className="p-3 px-4 w-12">
                  <input
                    type="checkbox"
                    checked={
                      paginatedData.length > 0 &&
                      selectedIds.size === paginatedData.length
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "p-3 px-4 text-xs font-bold text-outline border-b border-outline uppercase tracking-wider select-none truncate",
                    col.sortable &&
                      "cursor-pointer hover:text-onSurface transition-colors",
                  )}
                  style={{ width: col.width, textAlign: col.align || "left" }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  aria-sort={
                    sortColumn === col.key
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <div
                    className={cn(
                      "flex items-center gap-1.5",
                      col.align === "right" && "justify-end",
                      col.align === "center" && "justify-center",
                    )}
                  >
                    {col.label}
                    {col.sortable && (
                      <span
                        className={cn(
                          "material-symbols-outlined text-[14px] transition-opacity",
                          sortColumn === col.key
                            ? "text-primary opacity-100"
                            : "text-outline opacity-40",
                        )}
                      >
                        {sortColumn === col.key
                          ? sortDirection === "asc"
                            ? "arrow_upward"
                            : "arrow_downward"
                          : "import_export"}
                      </span>
                    )}
                  </div>
                  {col.filterable && (
                    <input
                      type="text"
                      value={filters[col.key] || ""}
                      onChange={(e) => handleFilter(col.key, e.target.value)}
                      placeholder={`Filter...`}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 py-1 mt-2 border border-outline rounded text-[11px] font-normal bg-surface text-onSurface focus:border-primary outline-none"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {renderTableRows(paginatedData)}
        </table>
      </div>

      {/* Pagination Container */}
      {totalPages > 1 && (
        <div className="p-3 px-4 border-top border-outline flex justify-between items-center flex-wrap gap-3 bg-surface-container-lowest mt-auto">
          <div className="text-[13px] text-outline font-medium">
            Showing{" "}
            <span className="text-onSurface font-bold">
              {(currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="text-onSurface font-bold">
              {Math.min(currentPage * pageSize, filteredData.length)}
            </span>{" "}
            of{" "}
            <span className="text-onSurface font-bold">
              {filteredData.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 border border-outline rounded-lg bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-low transition-colors"
              title="First page"
            >
              <span className="material-symbols-outlined text-[18px]">
                first_page
              </span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-outline rounded-lg bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-low transition-colors"
              title="Previous page"
            >
              <span className="material-symbols-outlined text-[18px]">
                chevron_left
              </span>
            </button>

            <div className="px-3 text-[13px] font-bold text-onSurface">
              {currentPage} <span className="text-outline font-normal">/</span>{" "}
              {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-outline rounded-lg bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-low transition-colors"
              title="Next page"
            >
              <span className="material-symbols-outlined text-[18px]">
                chevron_right
              </span>
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 border border-outline rounded-lg bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-low transition-colors"
              title="Last page"
            >
              <span className="material-symbols-outlined text-[18px]">
                last_page
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
