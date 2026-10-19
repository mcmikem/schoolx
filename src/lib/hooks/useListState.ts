"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SortDir = "asc" | "desc";

export interface ListStateOptions {
  pageSize?: number;
  defaultSort?: { key: string; dir: SortDir };
  /** Query params owned by other features that must survive writes (e.g. "action", "tab"). */
  preserve?: string[];
}

interface CoreState {
  q: string;
  page: number;
  pageSize: number;
  sortKey: string | null;
  sortDir: SortDir;
  filters: Record<string, string>;
}

const RESERVED = ["q", "page", "size", "sort", "dir"] as const;

function defaults(options: ListStateOptions): CoreState {
  return {
    q: "",
    page: 1,
    pageSize: options.pageSize ?? 20,
    sortKey: options.defaultSort?.key ?? null,
    sortDir: options.defaultSort?.dir ?? "asc",
    filters: {},
  };
}

function readFromLocation(options: ListStateOptions): CoreState {
  const base = defaults(options);
  if (typeof window === "undefined") return base;

  const params = new URLSearchParams(window.location.search);
  const filters: Record<string, string> = {};
  params.forEach((value, key) => {
    if (!(RESERVED as readonly string[]).includes(key) && !(options.preserve ?? []).includes(key)) {
      filters[key] = value;
    }
  });

  const size = Number(params.get("size"));
  const page = Number(params.get("page"));

  return {
    q: params.get("q") ?? "",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: Number.isFinite(size) && size > 0 ? Math.floor(size) : base.pageSize,
    sortKey: params.get("sort") ?? base.sortKey,
    sortDir: params.get("dir") === "desc" ? "desc" : params.get("dir") === "asc" ? "asc" : base.sortDir,
    filters,
  };
}

/**
 * List state (search / page / page size / sort / filters) mirrored into the URL
 * so a bursar can share "fee defaulters in P.3" as a link and use the browser's
 * back button. Reads the URL after mount to stay hydration-safe, then writes
 * with `history.replaceState` (no navigation, no Suspense boundary needed).
 */
export function useListState(options: ListStateOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<CoreState>(() => defaults(options));
  const mounted = useRef(false);
  const writtenFilters = useRef<Set<string>>(new Set());

  useEffect(() => {
    setState(readFromLocation(optionsRef.current));
    mounted.current = true;

    const onPopState = () => setState(readFromLocation(optionsRef.current));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!mounted.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    for (const key of RESERVED) params.delete(key);
    for (const key of writtenFilters.current) params.delete(key);

    if (state.q) params.set("q", state.q);
    if (state.page > 1) params.set("page", String(state.page));
    if (state.pageSize !== (optionsRef.current.pageSize ?? 20)) params.set("size", String(state.pageSize));
    if (state.sortKey) {
      params.set("sort", state.sortKey);
      params.set("dir", state.sortDir);
    }
    for (const [key, value] of Object.entries(state.filters)) {
      if (value) params.set(key, value);
    }
    writtenFilters.current = new Set(Object.keys(state.filters).filter((key) => state.filters[key]));

    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
  }, [state]);

  const setQ = useCallback((q: string) => setState((current) => ({ ...current, q, page: 1 })), []);

  const setPage = useCallback(
    (page: number) => setState((current) => ({ ...current, page: Math.max(1, Math.floor(page)) })),
    [],
  );

  const setPageSize = useCallback((pageSize: number) => setState((current) => ({ ...current, pageSize, page: 1 })), []);

  const toggleSort = useCallback(
    (key: string) =>
      setState((current) =>
        current.sortKey === key
          ? { ...current, sortDir: current.sortDir === "asc" ? "desc" : "asc" }
          : { ...current, sortKey: key, sortDir: "asc" },
      ),
    [],
  );

  const setFilter = useCallback(
    (key: string, value: string) =>
      setState((current) => {
        const filters = { ...current.filters };
        if (value) filters[key] = value;
        else delete filters[key];
        return { ...current, filters, page: 1 };
      }),
    [],
  );

  const clearFilters = useCallback(() => setState((current) => ({ ...current, q: "", filters: {}, page: 1 })), []);

  const reset = useCallback(() => setState(defaults(optionsRef.current)), []);

  const totalPages = useCallback((total: number) => Math.max(1, Math.ceil(total / state.pageSize)), [state.pageSize]);

  return {
    ...state,
    setQ,
    setPage,
    setPageSize,
    toggleSort,
    setFilter,
    clearFilters,
    reset,
    totalPages,
  };
}
