"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Client-side module access context.
//
// The proxy (src/proxy.ts) already enforces module access server-side on every
// page navigation. This hook mirrors that logic on the client so guards can
// same-instant render rather than falsely redirecting, and it understands BOTH
// billing modes:
//   full_suite → gated by the plan's feature stage (school.feature_stage)
//   modular    → core-by-size-band OR an active purchased entitlement
//
// Previously only feature_stage was checked client-side, so a modular school
// that purchased a module got in through the proxy and was immediately
// kicked out by the client guard.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getRequiredModuleForPath,
  isModuleAccessible,
  isModuleInFeatureStage,
  type ModuleKey,
} from "@/lib/modules/catalog";
import { DEFAULT_FEATURE_STAGE, type FeatureStage } from "@/lib/featureStages";

interface EntitlementLite {
  module_key: string;
  status: string;
  ends_at: string | null;
}

interface AccessContext {
  v: number;
  billing_mode: "full_suite" | "modular";
  feature_stage: string | null;
  school_size_band: string | null;
  entitlements: EntitlementLite[];
}

const CACHE_PREFIX = "skoolmate_module_access:";
const CACHE_VERSION = 2; // bump to invalidate stale caches (e.g. after billing mode change)

function readCache(schoolId: string): AccessContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + schoolId);
    if (raw) {
      const parsed = JSON.parse(raw) as AccessContext;
      if (parsed.v === CACHE_VERSION) return parsed;
    }
  } catch {
    // ignore malformed cache
  }
  return null;
}

function writeCache(schoolId: string, ctx: AccessContext) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_PREFIX + schoolId, JSON.stringify({ ...ctx, v: CACHE_VERSION }));
  } catch {
    // storage full/blocked — cache is best-effort
  }
}

/** Invalidate when billing changes (module purchase, billing mode switch). */
export function invalidateModuleAccessCache(schoolId?: string) {
  if (typeof window === "undefined") return;
  if (schoolId) sessionStorage.removeItem(CACHE_PREFIX + schoolId);
  else {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
    }
  }
}

export function useModuleAccess() {
  const { school, user } = useAuth();
  const [ctx, setCtx] = useState<AccessContext | null>(null);
  const [loaded, setLoaded] = useState(false);

  const schoolId = school?.id;
  const featureStage = (school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE;

  useEffect(() => {
    if (!schoolId || !user) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    const cached = readCache(schoolId);
    if (cached) {
      setCtx(cached);
      setLoaded(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/modules/entitlements/");
        if (!res.ok) throw new Error("unavailable");
        const body = await res.json();
        if (!body?.success || cancelled) return;
        const next: AccessContext = {
          v: CACHE_VERSION,
          billing_mode: body.data?.school?.billing_mode || "full_suite",
          feature_stage: body.data?.school?.feature_stage || null,
          school_size_band: body.data?.school?.school_size_band || null,
          entitlements: Array.isArray(body.data?.entitlements) ? body.data.entitlements : [],
        };
        writeCache(schoolId, next);
        if (!cancelled) {
          setCtx(next);
          setLoaded(true);
        }
      } catch {
        // Fail closed to the feature-stage-only check, like before; the proxy
        // is the real gate, this is presentation only.
        if (!cancelled) {
          setCtx(null);
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId, user]);

  function isModuleAllowed(moduleKey: ModuleKey): boolean {
    if (!ctx) {
      // Cached/fetched context unavailable: fall back to feature-stage logic
      // exactly as the proxy does for full-suite schools.
      return isModuleInFeatureStage(featureStage, moduleKey);
    }
    if (ctx.billing_mode === "modular") {
      return isModuleAccessible({
        billingMode: "modular",
        sizeBand: (ctx.school_size_band as any) || "small",
        activeEntitlements: new Set(
          ctx.entitlements
            .filter((e) => ["active", "trial", "lifetime"].includes(e.status))
            .filter((e) => !e.ends_at || new Date(e.ends_at).getTime() > Date.now())
            .map((e) => e.module_key),
        ),
        moduleKey,
      });
    }
    return isModuleInFeatureStage((ctx.feature_stage as FeatureStage) || featureStage, moduleKey);
  }

  const canAccessPath = useCallback(
    (pathname: string): boolean => {
      const moduleKey = getRequiredModuleForPath(pathname);
      if (!moduleKey) return true;
      return isModuleAllowed(moduleKey);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, featureStage],
  );

  return { loaded, ctx, isModuleAllowed, canAccessPath, invalidateModuleAccessCache };
}
