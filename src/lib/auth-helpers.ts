// Pure helpers extracted from auth-context.tsx to keep the provider focused.
// These are stateless and have no React dependencies.

import type { User } from "@/types";
import { buildAuthEmailFromPhone } from "./auth-login";
import { getErrorMessage } from "./validation";

export function normaliseRoles(roles: unknown, primary: unknown): User["roles"] {
  const out: NonNullable<User["roles"]> = [];
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed && !out.includes(trimmed as User["role"])) out.push(trimmed as User["role"]);
  };
  if (Array.isArray(roles)) roles.forEach(push);
  push(primary);
  return out;
}

export function sameRoles(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((role, i) => role === right[i]);
}

export function isNetworkError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const msg = getErrorMessage(error, "").toLowerCase();
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined;

  if (status === 0) return true;

  const networkKeywords = [
    "fetch",
    "network",
    "timeout",
    "timed out",
    "abort",
    "failed to fetch",
    "networkerror",
    "net::err",
    "err_connection",
    "ns_error",
    "unable to connect",
  ];
  return networkKeywords.some((kw) => msg.includes(kw));
}

export function isAuthSessionMissingError(error: unknown): boolean {
  const msg = getErrorMessage(error, "").toLowerCase();
  return msg.includes("session") && (msg.includes("missing") || msg.includes("not found"));
}

const SLOW_CONNECTION_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);

export function getConnectionTimeout(base: number): number {
  if (typeof navigator === "undefined" || !("connection" in navigator)) return base;
  const conn = (navigator as any).connection as { effectiveType?: string; downlink?: number; rtt?: number } | undefined;
  if (!conn) return base;
  // Slow networks need LONGER deadlines, not shorter (see runDirectSignInAttempts,
  // which scales 10s → 15s on slow devices). The factor here was inverted
  // (×0.6), so 3G phones aborted sign-in calls that were still succeeding on
  // the wire — the browser saw "aborted", classifyAuthFailure called it
  // transient, and users with correct credentials read
  // "Couldn't reach the sign-in service". (2026-11-10)
  if (conn.effectiveType && SLOW_CONNECTION_EFFECTIVE_TYPES.has(conn.effectiveType)) return Math.round(base * 1.6);
  if (conn.downlink !== undefined && conn.downlink < 1) return Math.round(base * 1.6);
  return base;
}

export function isSlowConnection(): boolean {
  if (typeof navigator === "undefined" || !("connection" in navigator)) return false;
  const conn = (navigator as any).connection as { effectiveType?: string; downlink?: number } | undefined;
  if (!conn) return false;
  if (conn.effectiveType && SLOW_CONNECTION_EFFECTIVE_TYPES.has(conn.effectiveType)) return true;
  if (conn.downlink !== undefined && conn.downlink < 1) return true;
  return false;
}

const LOGIN_FORMAT_KEY_PREFIX = "skoolmate_login_format_v1";
const SLOW_DEVICE_KEY = "skoolmate_slow_device_v1";

export function wasSlowDevice(): boolean {
  try {
    return localStorage.getItem(SLOW_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberSlowDevice(): void {
  try {
    localStorage.setItem(SLOW_DEVICE_KEY, "1");
  } catch {
    // Private mode: the hint is a nicety, not a requirement.
  }
}

export function rememberedFormatKey(identifier: string): string {
  const trimmed = identifier.trim();
  const canonical = trimmed.includes("@") ? trimmed.toLowerCase() : buildAuthEmailFromPhone(trimmed);
  return `${LOGIN_FORMAT_KEY_PREFIX}:${canonical}`;
}

export function getRememberedFormat(identifier: string): string | null {
  try {
    return localStorage.getItem(rememberedFormatKey(identifier));
  } catch {
    return null;
  }
}

export function setRememberedFormat(identifier: string, signature: string): void {
  try {
    localStorage.setItem(rememberedFormatKey(identifier), signature);
  } catch {
    // Ignore storage errors (private mode) — just means no fast-path next time.
  }
}
