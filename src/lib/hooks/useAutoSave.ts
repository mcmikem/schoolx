"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { logger } from "@/lib/logger";

interface UseAutoSaveOptions<T> {
  data: T;
  interval?: number; // in milliseconds, default 30000 (30 seconds)
  storageKey: string;
  onSave?: (data: T) => void;
  enabled?: boolean;
  maxAgeMs?: number;
}

interface SavedState<T> {
  data: T;
  savedAt: number;
}

export function useAutoSave<T>({
  data,
  interval = 30000,
  storageKey,
  onSave,
  enabled = true,
  maxAgeMs = 24 * 60 * 60 * 1000,
}: UseAutoSaveOptions<T>) {
  const lastSavedRef = useRef<string>("");
  const [storageAvailable, setStorageAvailable] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Save to localStorage
  const saveToStorage = useCallback(
    (dataToSave: T) => {
      const serialized = JSON.stringify(dataToSave);
      if (serialized !== lastSavedRef.current) {
        const state: SavedState<T> = {
          data: dataToSave,
          savedAt: Date.now(),
        };
        try {
          localStorage.setItem(`draft_${storageKey}`, JSON.stringify(state));
          setStorageAvailable(true);
        } catch {
          setStorageAvailable(false);
          return;
        }
        lastSavedRef.current = serialized;
        onSave?.(dataToSave);
      }
    },
    [storageKey, onSave],
  );

  // Load from localStorage
  const loadFromStorage = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(`draft_${storageKey}`);
      if (stored) {
        const state: SavedState<T> = JSON.parse(stored);
        if (Date.now() - state.savedAt < maxAgeMs) {
          return state.data;
        }
      }
    } catch (e) {
      setStorageAvailable(false);
      logger.error("Failed to load draft:", e);
    }
    return null;
  }, [storageKey, maxAgeMs]);

  // Clear saved draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(`draft_${storageKey}`);
    } catch {
      setStorageAvailable(false);
    }
    lastSavedRef.current = "";
  }, [storageKey]);

  // Set up auto-save interval
  useEffect(() => {
    if (!enabled) return;

    timerRef.current = setInterval(() => {
      saveToStorage(data);
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [data, interval, enabled, saveToStorage]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (enabled) saveToStorage(data);
    };
  }, [data, saveToStorage, enabled]);

  return {
    loadFromStorage,
    clearDraft,
    storageAvailable,
    lastSaved: lastSavedRef.current ? JSON.parse(lastSavedRef.current) : null,
  };
}

// Hook for inline form validation
interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  message?: string;
}

interface FieldValidation {
  value: any;
  rules: ValidationRule;
}

export function useFieldValidation({ value, rules }: FieldValidation) {
  const errors: string[] = [];

  if (rules.required && (value === "" || value === null || value === undefined)) {
    errors.push(rules.message || "This field is required");
  }

  if (rules.minLength && typeof value === "string" && value.length < rules.minLength) {
    errors.push(rules.message || `Minimum ${rules.minLength} characters required`);
  }

  if (rules.maxLength && typeof value === "string" && value.length > rules.maxLength) {
    errors.push(rules.message || `Maximum ${rules.maxLength} characters allowed`);
  }

  if (rules.pattern && typeof value === "string" && !rules.pattern.test(value)) {
    errors.push(rules.message || "Invalid format");
  }

  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) errors.push(customError);
  }

  return {
    isValid: errors.length === 0,
    errors,
    error: errors[0] || null,
  };
}
