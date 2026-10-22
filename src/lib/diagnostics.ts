import { hasAnyRole } from "./roles";

export const DIAGNOSTICS_ROLES = ["school_admin", "admin", "super_admin", "headmaster"] as const;

export type DebugFlag = "on" | "off" | null;

export function parseDebugFlag(search: string): DebugFlag {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const value = params.get("debug");
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off" ? "off" : "on";
}

export function canViewDiagnostics(roles: readonly (string | null | undefined)[] | string | null | undefined): boolean {
  return hasAnyRole(roles, [...DIAGNOSTICS_ROLES]);
}

export function formatClockSkew(skewMs: number | null): string {
  if (skewMs === null || !Number.isFinite(skewMs)) return "unknown";
  const abs = Math.abs(skewMs);
  if (abs < 2_000) return "in sync";
  const value = abs >= 60_000 ? `${Math.round(abs / 60_000)} min` : `${Math.round(abs / 1_000)} s`;
  return skewMs < 0 ? `${value} ahead` : `${value} behind`;
}

export interface ServerTimeSnapshot {
  serverTime: number;
  clientTime: number;
  skewMs: number;
  latencyMs: number;
}

export async function fetchServerTime(timeoutMs = 8_000): Promise<ServerTimeSnapshot> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`/api/health/?_=${started}`, { cache: "no-store", signal: controller.signal });
    const received = Date.now();
    if (!res.ok) throw new Error(`Health check returned ${res.status}`);
    const body = (await res.json()) as { timestamp?: unknown };
    const parsed = typeof body.timestamp === "string" ? Date.parse(body.timestamp) : Number.NaN;
    const serverTime = Number.isFinite(parsed) ? parsed : Date.parse(res.headers.get("date") ?? "");
    if (!Number.isFinite(serverTime)) throw new Error("Server did not return a usable timestamp");
    const midpoint = started + (received - started) / 2;
    return {
      serverTime,
      clientTime: received,
      skewMs: Math.round(serverTime - midpoint),
      latencyMs: received - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface ServiceWorkerSnapshot {
  activeVersion: string | null;
  controlled: boolean;
  registrations: number;
  caches: string[];
}

export async function getServiceWorkerSnapshot(timeoutMs = 6_000): Promise<ServiceWorkerSnapshot> {
  const activeVersion = await readActiveServiceWorkerVersion(timeoutMs);
  const hasServiceWorker = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  let registrations = 0;
  let controlled = false;
  if (hasServiceWorker) {
    try {
      registrations = (await navigator.serviceWorker.getRegistrations()).length;
      controlled = Boolean(navigator.serviceWorker.controller);
    } catch {
      registrations = 0;
    }
  }
  let cacheNames: string[] = [];
  if (typeof caches !== "undefined") {
    try {
      cacheNames = (await caches.keys()).filter((name) => name.startsWith("skoolmate"));
    } catch {
      cacheNames = [];
    }
  }
  return { activeVersion, controlled, registrations, caches: cacheNames };
}

async function readActiveServiceWorkerVersion(timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`/sw.js?_=${Date.now()}`, { cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    const text = await res.text();
    return text.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface StoredSessionSnapshot {
  found: boolean;
  expiresAt: number | null;
  storage: "local" | "session" | null;
}

export function readStoredSession(): StoredSessionSnapshot {
  if (typeof window === "undefined") return { found: false, expiresAt: null, storage: null };
  const stores: Array<["local" | "session", Storage]> = [];
  try {
    stores.push(["local", window.localStorage]);
  } catch {}
  try {
    stores.push(["session", window.sessionStorage]);
  } catch {}
  for (const [name, store] of stores) {
    let length = 0;
    try {
      length = store.length;
    } catch {
      continue;
    }
    for (let i = 0; i < length; i += 1) {
      let key: string | null = null;
      try {
        key = store.key(i);
      } catch {
        continue;
      }
      if (!key || !key.includes("auth-token")) continue;
      let raw: string | null = null;
      try {
        raw = store.getItem(key);
      } catch {
        continue;
      }
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as { expires_at?: unknown };
        const expiresAt =
          typeof parsed.expires_at === "number" && Number.isFinite(parsed.expires_at) ? parsed.expires_at : null;
        return { found: true, expiresAt, storage: name };
      } catch {
        return { found: true, expiresAt: null, storage: name };
      }
    }
  }
  return { found: false, expiresAt: null, storage: null };
}

export interface StorageSnapshot {
  usageMb: number | null;
  quotaMb: number | null;
}

export async function getStorageSnapshot(): Promise<StorageSnapshot> {
  if (typeof navigator === "undefined" || typeof navigator.storage?.estimate !== "function") {
    return { usageMb: null, quotaMb: null };
  }
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return {
      usageMb: typeof usage === "number" ? Math.round(usage / 1024 / 1024) : null,
      quotaMb: typeof quota === "number" ? Math.round(quota / 1024 / 1024) : null,
    };
  } catch {
    return { usageMb: null, quotaMb: null };
  }
}

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface EnvironmentSnapshot {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  displayMode: "standalone" | "browser";
  online: boolean;
  viewport: string;
  pixelRatio: number;
  connection: {
    effectiveType: string | null;
    downlinkMbps: number | null;
    rttMs: number | null;
    saveData: boolean;
  };
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
}

export function getEnvironmentSnapshot(): EnvironmentSnapshot {
  if (typeof window === "undefined") {
    return {
      userAgent: "",
      platform: "",
      language: "",
      timezone: "",
      displayMode: "browser",
      online: false,
      viewport: "",
      pixelRatio: 1,
      connection: { effectiveType: null, downlinkMbps: null, rttMs: null, saveData: false },
      deviceMemoryGb: null,
      hardwareConcurrency: null,
    };
  }
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    deviceMemory?: number;
    standalone?: boolean;
  };
  const connection = nav.connection;
  const standalone =
    nav.standalone === true ||
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches);
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    timezone = "";
  }
  return {
    userAgent: nav.userAgent,
    platform: nav.platform ?? "",
    language: nav.language ?? "",
    timezone,
    displayMode: standalone ? "standalone" : "browser",
    online: nav.onLine,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pixelRatio: window.devicePixelRatio || 1,
    connection: {
      effectiveType: connection?.effectiveType ?? null,
      downlinkMbps: typeof connection?.downlink === "number" ? connection.downlink : null,
      rttMs: typeof connection?.rtt === "number" ? connection.rtt : null,
      saveData: connection?.saveData === true,
    },
    deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    hardwareConcurrency: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
  };
}

export interface ApiErrorEntry {
  at: number;
  method: string;
  url: string;
  status: number;
}

const MAX_API_ERRORS = 8;
let apiErrors: ApiErrorEntry[] = [];

export function recordApiError(entry: ApiErrorEntry): void {
  apiErrors = [entry, ...apiErrors].slice(0, MAX_API_ERRORS);
}

export function getRecentApiErrors(): ApiErrorEntry[] {
  return [...apiErrors];
}

export function resetApiErrors(): void {
  apiErrors = [];
}

export function installApiErrorRecorder(): () => void {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return () => {};
  const original = window.fetch.bind(window);
  const wrapped: typeof window.fetch = async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    try {
      const response = await original(input, init);
      if (!response.ok) recordApiError({ at: Date.now(), method, url, status: response.status });
      return response;
    } catch (error) {
      recordApiError({ at: Date.now(), method, url, status: 0 });
      throw error;
    }
  };
  window.fetch = wrapped;
  return () => {
    if (window.fetch === wrapped) window.fetch = original;
  };
}
