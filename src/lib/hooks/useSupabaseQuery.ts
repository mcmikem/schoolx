import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cacheResponse, getCachedResponse, isOnline } from "@/lib/offline-db";
import { logger } from "@/lib/logger";

export interface UseSupabaseQueryOptions<T> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  cacheEndpoint?: string;
  cacheParams?: Record<string, unknown>;
  ttl?: number;
  enabled?: boolean;
  staleTime?: number;
  onSuccess?: (data: T) => void;
}

export function useSupabaseQuery<T>(options: UseSupabaseQueryOptions<T>) {
  const {
    queryKey,
    queryFn,
    cacheEndpoint,
    cacheParams,
    ttl = 5 * 60 * 1000,
    enabled = true,
    staleTime = 5 * 60 * 1000,
    onSuccess,
  } = options;

  const [isStale, setIsStale] = useState(false);

  const offlineKey = useMemo(() => {
    if (cacheEndpoint) return cacheEndpoint;
    const firstKey = queryKey[0];
    return typeof firstKey === "string" ? firstKey : JSON.stringify(queryKey);
  }, [cacheEndpoint, queryKey]);

  const queryFnWithCache = useCallback(async () => {
    if (!isOnline()) {
      const cached = await getCachedResponse<T>(offlineKey, cacheParams);
      if (cached !== null) {
        setIsStale(true);
        return cached;
      }
      throw new Error("Offline and no cached result available");
    }

    const result = await queryFn();
    await cacheResponse(offlineKey, result, cacheParams, ttl);
    return result;
  }, [cacheEndpoint, cacheParams, offlineKey, queryFn, ttl]);

  const query = useQuery<T>({
    queryKey,
    queryFn: queryFnWithCache,
    enabled,
    staleTime,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
  });

  const { refetch } = query;

  useEffect(() => {
    if (query.data === undefined) return;

    setIsStale(!isOnline());
    onSuccess?.(query.data);
    cacheResponse(offlineKey, query.data, cacheParams, ttl).catch((error) =>
      logger.error("Failed to cache query result:", error),
    );
  }, [cacheParams, offlineKey, onSuccess, query.data, ttl]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleOnline = () => {
      setIsStale(true);
      refetch().catch(() => undefined);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [enabled, refetch]);

  return {
    ...query,
    isStale,
  };
}
