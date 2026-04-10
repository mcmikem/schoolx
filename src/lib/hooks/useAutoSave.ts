"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseAutoSaveOptions<T> {
  data: T;
  interval?: number; // in milliseconds, default 30000 (30 seconds)
  storageKey: string;
  onSave?: (data: T) => void;
  enabled?: boolean;
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
}: UseAutoSaveOptions<T>) {
  const lastSavedRef = useRef<string>("");
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
        localStorage.setItem(`draft_${storageKey}`, JSON.stringify(state));
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
        // Return data if less than 24 hours old
        if (Date.now() - state.savedAt < 24 * 60 * 60 * 1000) {
          return state.data;
        }
      }
    } catch (e) {
      console.error("Failed to load draft:", e);
    }
    return null;
  }, [storageKey]);

  // Clear saved draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem(`draft_${storageKey}`);
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
      saveToStorage(data);
    };
  }, [data, saveToStorage]);

  return {
    loadFromStorage,
    clearDraft,
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

  if (
    rules.required &&
    (value === "" || value === null || value === undefined)
  ) {
    errors.push(rules.message || "This field is required");
  }

  if (
    rules.minLength &&
    typeof value === "string" &&
    value.length < rules.minLength
  ) {
    errors.push(
      rules.message || `Minimum ${rules.minLength} characters required`,
    );
  }

  if (
    rules.maxLength &&
    typeof value === "string" &&
    value.length > rules.maxLength
  ) {
    errors.push(
      rules.message || `Maximum ${rules.maxLength} characters allowed`,
    );
  }

  if (
    rules.pattern &&
    typeof value === "string" &&
    !rules.pattern.test(value)
  ) {
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
