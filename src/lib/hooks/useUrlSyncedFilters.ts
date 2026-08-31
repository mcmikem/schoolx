"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * Lightweight URL-synced filter helper.
 * - Keeps specified keys in the query string via `router.replace` (no entry push).
 * - Debounced writes avoid history spam while typing.
 * - Returns helpers to read/write a single key.
 */
export function useUrlSyncedFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<number | null>(null);

  const get = useCallback((key: string) => searchParams?.get(key) ?? null, [searchParams]);

  const set = useCallback(
    (key: string, value: string | null, opts: { replace?: boolean; debounce?: number } = {}) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // reset page when filters change (unless we're setting page itself)
      if (key !== "page") params.delete("page");
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;

      if (opts.debounce) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          router.replace(url, { scroll: false });
        }, opts.debounce) as unknown as number;
        return;
      }
      if (opts.replace === false) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setMany = useCallback(
    (entries: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      for (const [k, v] of Object.entries(entries)) {
        if (v === null || v === "" || v === "all") params.delete(k);
        else params.set(k, v);
      }
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(
    (keys: string[]) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      keys.forEach((k) => params.delete(k));
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { get, set, setMany, clear, searchParams };
}
