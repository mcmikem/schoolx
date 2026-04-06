"use client";
import { useState, useMemo, useCallback, ReactNode } from "react";
import MaterialIcon from "@/components/MaterialIcon";

type SortDir = "asc" | "desc";

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  keyExtractor?: (row: T) => string;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  emptyDescription?: string;
  loading?: boolean;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  keyExtractor = (row) => row.id,
  pageSize = 20,
  searchable = false,
  searchPlaceholder = "Search...",
  searchKeys = [],
  onRowClick,
  emptyMessage = "No data",
  emptyDescription,
  loading = false,
  className = "",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
      setPage(1);
    },
    [sortKey],
  );

  const filtered = useMemo(() => {
    if (!search || searchKeys.length === 0) return data;
    const term = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((key) => {
        const value = row[key];
        if (typeof value === "string")
          return value.toLowerCase().includes(term);
        if (typeof value === "number") return value.toString().includes(term);
        return false;
      }),
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey as keyof T];
      const bVal = b[sortKey as keyof T];
      const mul = sortDir === "asc" ? 1 : -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return mul * aVal.localeCompare(bVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return mul * (aVal - bVal);
      }
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) {
      return (
        <MaterialIcon className="text-xs ml-1 text-on-surface-variant/40">
          swap_vert
        </MaterialIcon>
      );
    }
    return (
      <MaterialIcon className="text-xs ml-1 text-primary">
        {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
      </MaterialIcon>
    );
  };

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-surface-container-low" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-t border-outline-variant/10" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {searchable && (
        <div className="mb-4">
          <div className="relative">
            <MaterialIcon
              icon="search"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-container-lowest border-none rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                <MaterialIcon className="text-lg">close</MaterialIcon>
              </button>
            )}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl p-12 text-center">
          <MaterialIcon className="text-4xl text-on-surface-variant/30 mb-4">
            search_off
          </MaterialIcon>
          <h3 className="text-lg font-semibold text-on-surface mb-2">
            {search ? "No matching results" : emptyMessage}
          </h3>
          <p className="text-sm text-on-surface-variant">
            {search
              ? `No results for "${search}". Try a different search term.`
              : emptyDescription}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-left">
                    {columns.map((col) => (
                      <th
                        key={String(col.key)}
                        className={`px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant ${
                          col.sortable
                            ? "cursor-pointer select-none hover:text-on-surface-variant/80"
                            : ""
                        } ${col.className || ""}`}
                        onClick={() =>
                          col.sortable && handleSort(String(col.key))
                        }
                      >
                        <span className="flex items-center">
                          {col.header}
                          {col.sortable && (
                            <SortIcon columnKey={String(col.key)} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {paginated.map((row) => (
                    <tr
                      key={keyExtractor(row)}
                      className={`hover:bg-surface-bright transition-colors ${
                        onRowClick ? "cursor-pointer" : ""
                      }`}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((col) => (
                        <td
                          key={String(col.key)}
                          className={`px-6 py-4 ${col.className || ""}`}
                        >
                          {col.render
                            ? col.render(row)
                            : String(row[col.key as keyof T] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">
                  Showing {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, sorted.length)} of{" "}
                  {sorted.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="p-2 rounded-lg hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <MaterialIcon className="text-lg">
                      chevron_left
                    </MaterialIcon>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - safePage) <= 1,
                    )
                    .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                        acc.push("ellipsis");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "ellipsis" ? (
                        <span
                          key={`e-${idx}`}
                          className="px-2 text-on-surface-variant"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item as number)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                            safePage === item
                              ? "bg-[var(--primary)] text-white"
                              : "hover:bg-surface-container text-on-surface-variant"
                          }`}
                        >
                          {item}
                        </button>
                      ),
                    )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="p-2 rounded-lg hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <MaterialIcon className="text-lg">
                      chevron_right
                    </MaterialIcon>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
