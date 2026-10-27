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
import { safeLocalStorage, safeSessionStorage } from "./safe-storage";

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

  const sessionValue = safeSessionStorage.getItem(DEMO_KEY);
  if (sessionValue) return sessionValue;

  const legacyValue = safeLocalStorage.getItem(DEMO_KEY);
  if (legacyValue) {
    safeSessionStorage.setItem(DEMO_KEY, legacyValue);
    safeLocalStorage.removeItem(DEMO_KEY);
    return legacyValue;
  }

  return null;
}

export function saveDemoStorage(demoUser: unknown, demoSchool: unknown) {
  if (typeof window === "undefined") return;
  const payload = btoa(JSON.stringify({ demoUser, demoSchool }));
  safeSessionStorage.setItem(DEMO_KEY, payload);
  document.cookie = `${DEMO_KEY}=${encodeURIComponent(payload)}; Max-Age=86400; path=/; SameSite=Lax`;
}

export function clearDemoStorage() {
  if (typeof window === "undefined") return;
  safeSessionStorage.removeItem(DEMO_KEY);
  safeLocalStorage.removeItem(DEMO_KEY);
  document.cookie = `${DEMO_KEY}=; Max-Age=0; path=/`;
  document.cookie = `${DEMO_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
