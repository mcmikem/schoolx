import { useState, useEffect, useCallback } from "react";
import { cacheResponse, getCachedResponse, queueMutation, isOnline, getSession, saveSession, CachedSession } from "@/lib/offline-db";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export interface UseOfflineDataOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttl?: number;
  enabled?: boolean;
}

export interface UseOfflineDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  refetch: () => Promise<void>;
  mutate: (newData: T) => void;
}

export function useOfflineData<T>(options: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const { key, fetcher, ttl = 5 * 60 * 1000, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);

  const fetchData = useCallback(async (forceOnline = false) => {
    const online = isOnline();

    if (!forceOnline && !online) {
      const cached = await getCachedResponse<T>(key);
      if (cached !== null) {
        setData(cached);
        setLoading(false);
        setIsStale(true);
        setError(null);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
      setIsStale(false);
      await cacheResponse(key, result, undefined, ttl);
    } catch (err) {
      logger.error(`Offline fetch error for ${key}:`, err);
      const cached = await getCachedResponse<T>(key);
      if (cached !== null) {
        setData(cached);
        setIsStale(true);
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
  }, [enabled, fetchData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      fetchData(true);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchData]);

  const mutate = useCallback((newData: T) => {
    setData(newData);
    cacheResponse(key, newData, undefined, ttl);
  }, [key, ttl]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { data, loading, error, isStale, refetch, mutate };
}

export interface UseOfflineMutationOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useOfflineMutation<T extends unknown[], R>(
  mutationFn: (...args: T) => Promise<R>,
  options?: UseOfflineMutationOptions
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (...args: T) => {
      const online = isOnline();

      if (!online) {
        const mutationKey = `${mutationFn.name || "anonymous"}-${Date.now()}`;
        await queueMutation({
          endpoint: mutationKey,
          method: "POST",
          body: args,
        });
        setError(null);
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await mutationFn(...args);
        options?.onSuccess?.();
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn, options]
  );

  return { mutate, loading, error };
}

export async function syncPendingMutations(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) {
    return { synced: 0, failed: 0 };
  }

  const { getPendingMutations, markMutationSynced } = await import("@/lib/offline-db");
  const mutations = await getPendingMutations();

  let synced = 0;
  let failed = 0;

  for (const mutation of mutations) {
    try {
      const { endpoint, method, body } = mutation;
      const [url, params] = endpoint.split("?");

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await markMutationSynced(mutation.id!);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export async function initializeOfflineSession(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (error || !data.user) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function persistSession(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    await saveSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user: session.user,
      expires_at: session.expires_at || 0,
    });
  }
}