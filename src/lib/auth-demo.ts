// ============================================================================
// 🔒 LOCKED DOWN — AUTH DEMO HELPERS (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// encryptDemoData(), decryptDemoData(), readDemoStorage(), clearDemoStorage()
// Handles demo user/school data persistence with base64 encoding.
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
"use client";
import { DEMO_KEY, DEMO_MODE_ENABLED } from "./auth-context-types";

export function decryptDemoData(encrypted: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return atob(encrypted);
  } catch {
    return null;
  }
}

export function readDemoStorage(): string | null {
  if (typeof window === "undefined") return null;
  if (!DEMO_MODE_ENABLED) {
    clearDemoStorage();
    return null;
  }

  const sessionValue = sessionStorage.getItem(DEMO_KEY);
  if (sessionValue) return sessionValue;

  const legacyValue = localStorage.getItem(DEMO_KEY);
  if (legacyValue) {
    sessionStorage.setItem(DEMO_KEY, legacyValue);
    localStorage.removeItem(DEMO_KEY);
    return legacyValue;
  }

  return null;
}

export function clearDemoStorage() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(DEMO_KEY);
  document.cookie = `${DEMO_KEY}=; Max-Age=0; path=/`;
  document.cookie = `${DEMO_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
