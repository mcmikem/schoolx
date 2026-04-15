"use client";

import { useState, useEffect, useCallback } from "react";

export interface TablePreferences {
  sortBy: string;
  sortOrder: "asc" | "desc";
  pageSize: number;
  visibleColumns: string[];
}

const DEFAULT_PREFERENCES: TablePreferences = {
  sortBy: "name",
  sortOrder: "asc",
  pageSize: 20,
  visibleColumns: [],
};

const STORAGE_PREFIX = "table_prefs_";

export function useTablePreferences(tableId: string) {
  const [preferences, setPreferences] =
    useState<TablePreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_PREFIX + tableId);
    if (stored) {
      try {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
      } catch {
        setPreferences(DEFAULT_PREFERENCES);
      }
    }
    setIsLoaded(true);
  }, [tableId]);

  const updatePreferences = useCallback(
    (updates: Partial<TablePreferences>) => {
      setPreferences((prev) => {
        const next = { ...prev, ...updates };
        localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(next));
        return next;
      });
    },
    [tableId],
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.removeItem(STORAGE_PREFIX + tableId);
  }, [tableId]);

  return {
    preferences,
    updatePreferences,
    resetPreferences,
    isLoaded,
  };
}
