// ============================================================================
// 🔒 LOCKED DOWN — AUTH CORE (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// This file is part of the critical auth flow. Changes here can break login,
// registration, session management, and offline mode for ALL users.
//
// Last audited: 2026-05-12 | Bugs fixed: 60+
// Known pitfalls:
//   - signIn() must NOT call fetchUserData (onAuthStateChange is single source)
//   - loading=true ONLY on SIGNED_IN event, never on INITIAL_SESSION/TOKEN_REFRESHED
//   - Network errors must NEVER clear user state (offline mode)
//   - router.replace() not router.push() for all redirects
//   - All Supabase calls in signIn() must use withSupabaseLockRetry()
//   - authFetchAborted ref must be reset on mount (StrictMode compat)
//   - signOut() MUST force-clear auth cookies even on API failure (prevents auto re-login)
//   - Visibility handler MUST delay 3s and check getSession() before getUser()
//   - Safety timers reduced to 6s (profile fetch) / 8s (sign-in) for mobile/poor networks
//   - getConnectionTimeout() further reduces to 60% on 3G/2G connections
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
"use client";
import { useRouter } from "next/navigation";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { School, User } from "@/types";
import {
  AuthContextType,
  computeTrialExpired,
  getSubscriptionPlan as getPlan,
  isSubscriptionActiveCheck,
  OFFLINE_SCHOOL_KEY,
  OFFLINE_USER_KEY,
  sanitizeDemoRole,
} from "./auth-context-types";
import { clearDemoStorage, decryptDemoData, readDemoStorage } from "./auth-demo";
import { classifyAuthFailure } from "./auth-failure";
import { buildAuthEmailFromPhone, buildAuthLoginAttempts, type AuthLoginAttempt } from "./auth-login";
import { buildPhoneLookupCandidates } from "./auth-phone";
import { DEFAULT_FEATURE_STAGE, FeatureStage } from "./featureStages";
import { timeoutSignal } from "./hooks/utils";
import { logger } from "./logger";
import type { PlanType } from "./payments/subscription-client";
import { supabase } from "./supabase";
import { isSupabaseLockAbortError, withSupabaseLockRetry } from "./supabase-lock";
import { clearUserScopedStorage } from "./user-scoped-storage";
import { getErrorMessage } from "./validation";

// ---------------------------------------------------------------------------
// Role normalisation
// ---------------------------------------------------------------------------
// Staff in rural schools routinely hold more than one hat, so the API returns
// the full set. These keep the client honest whether the multi-role migration
// has been applied or not: the primary role is always present, duplicates are
// dropped, and unknown values never reach the permission layer.
function normaliseRoles(roles: unknown, primary: unknown): User["roles"] {
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

function sameRoles(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((role, i) => role === right[i]);
}

// ---------------------------------------------------------------------------
// Network error detection — critical for poor internet (e.g. Uganda 3G)
// We must NOT log users out just because a network request timed out.
// ---------------------------------------------------------------------------
function isNetworkError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const msg = getErrorMessage(error, "").toLowerCase();
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined;

  // Status 0 = network failure (fetch aborted, no connection, CORS blocked)
  if (status === 0) return true;

  // Common network error messages across browsers and Supabase
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

function isAuthSessionMissingError(error: unknown): boolean {
  const msg = getErrorMessage(error, "").toLowerCase();
  return msg.includes("session") && (msg.includes("missing") || msg.includes("not found"));
}

// Connection quality detection — reduces timeouts dynamically on slow networks.
// Uses the Network Information API where available (Chrome, Edge, Samsung Internet).
const SLOW_CONNECTION_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);
function getConnectionTimeout(base: number): number {
  if (typeof navigator === "undefined" || !("connection" in navigator)) return base;
  const conn = (navigator as any).connection as { effectiveType?: string; downlink?: number; rtt?: number } | undefined;
  if (!conn) return base;
  if (conn.effectiveType && SLOW_CONNECTION_EFFECTIVE_TYPES.has(conn.effectiveType)) return Math.round(base * 0.6);
  if (conn.downlink !== undefined && conn.downlink < 1) return Math.round(base * 0.6);
  return base;
}

function isSlowConnection(): boolean {
  if (typeof navigator === "undefined" || !("connection" in navigator)) return false;
  const conn = (navigator as any).connection as { effectiveType?: string; downlink?: number } | undefined;
  if (!conn) return false;
  if (conn.effectiveType && SLOW_CONNECTION_EFFECTIVE_TYPES.has(conn.effectiveType)) return true;
  if (conn.downlink !== undefined && conn.downlink < 1) return true;
  return false;
}

// Remembers which login format (e.g. legacy `0XXX@omuto.org` vs normalized)
// worked last for an identifier, so repeat logins try it first instead of
// burning seconds failing the primary format on every single sign-in.
const LOGIN_FORMAT_KEY_PREFIX = "skoolmate_login_format_v1";

// A device that has already felt a slow link. The Network Information API
// reports "4g" until it has measured something, so on a brand new phone --
// exactly the phone that has never logged in -- the API says the connection
// is fast while the connection is anything but. The sign-in deadline
// therefore cannot trust it, and a device that has seen a slow link keeps the
// longer deadline next time.
const SLOW_DEVICE_KEY = "skoolmate_slow_device_v1";

function wasSlowDevice(): boolean {
  try {
    return localStorage.getItem(SLOW_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberSlowDevice(): void {
  try {
    localStorage.setItem(SLOW_DEVICE_KEY, "1");
  } catch {
    // Private mode: the hint is a nicety, not a requirement.
  }
}

function rememberedFormatKey(identifier: string): string {
  const trimmed = identifier.trim();
  const canonical = trimmed.includes("@") ? trimmed.toLowerCase() : buildAuthEmailFromPhone(trimmed);
  return `${LOGIN_FORMAT_KEY_PREFIX}:${canonical}`;
}

function getRememberedFormat(identifier: string): string | null {
  try {
    return localStorage.getItem(rememberedFormatKey(identifier));
  } catch {
    return null;
  }
}

function setRememberedFormat(identifier: string, signature: string): void {
  try {
    localStorage.setItem(rememberedFormatKey(identifier), signature);
  } catch {
    // Ignore storage errors (private mode) — just means no fast-path next time.
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [profileDegraded, setProfileDegraded] = useState(false);
  const router = useRouter();

  const authFetchAborted = useRef(false);
  const authCheckedRef = useRef(false);
  const degradedUserIdRef = useRef<string | null>(null);
  const explicitSignOutRef = useRef(false);

  // Restore the last signed-in profile from localStorage without touching the
  // network. Used when the device is offline (or a session read times out):
  // auth-js cannot refresh an expired token without signal, so it reports no
  // session and the old code signed the user out mid-lesson. The cache is
  // cleared by signOut(), so its presence still means "signed in".
  const restoreCachedProfile = useCallback(() => {
    try {
      const cachedUser = localStorage.getItem(OFFLINE_USER_KEY);
      if (!cachedUser) return false;
      const parsedUser = JSON.parse(cachedUser) as User;
      const cachedSchool = localStorage.getItem(OFFLINE_SCHOOL_KEY);
      setUser(parsedUser);
      setSchool(cachedSchool ? (JSON.parse(cachedSchool) as School) : null);
      setIsDemo(false);
      setLoading(false);
      setAuthInitialized(true);
      return true;
    } catch (error) {
      logger.warn("Failed to restore cached profile:", error);
      return false;
    }
  }, []);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setSchool(null);
    setIsDemo(false);
    setIsTrialExpired(false);
    setProfileDegraded(false);
    degradedUserIdRef.current = null;
    try {
      localStorage.removeItem(OFFLINE_USER_KEY);
      localStorage.removeItem(OFFLINE_SCHOOL_KEY);
      // Per-user state (recent pages, assistant transcript). Key-scoping is the
      // real fix -- this is belt and braces for the common case where someone
      // signs out properly on a shared device.
      clearUserScopedStorage();
    } catch {
      // Ignore storage errors while clearing invalid cached auth data.
    }
  }, []);

  const isSubscriptionActive = useCallback(() => {
    return isSubscriptionActiveCheck(school, user?.role);
  }, [school, user?.role]);

  const getSubscriptionPlan = useCallback((): PlanType | null => {
    return getPlan(school);
  }, [school]);

  const fetchUserData = useCallback(
    async (
      authId: string,
      knownSession?: { access_token?: string; expires_at?: number } | null,
      retryCount = 0,
    ): Promise<{ role: string } | null> => {
      if (authFetchAborted.current || !supabase) return null;

      // Declared out here so the retry below can hand the same session on.
      let session = knownSession ?? null;

      try {
        // The session the caller already holds is used as it is.
        //
        // Asking the auth client for the session here was the single biggest
        // reason a sign-in took half a minute on a slow phone and then
        // failed: this function runs INSIDE the library's auth-state
        // callback, which the library delivers while it still holds its own
        // storage lock, so getSession() could not get in, waited five
        // seconds and gave up. The profile was never fetched, the login page
        // never moved on, and the teacher was told the sign-in had failed
        // seconds after it had actually worked.
        if (!session) {
          session = (
            (await Promise.race([
              supabase.auth.getSession(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("getSession timed out")), getConnectionTimeout(6000)),
              ),
            ])) as Awaited<ReturnType<typeof supabase.auth.getSession>>
          ).data.session;
        }
        // Never refresh here. This function runs inside the auth-state
        // callback, which the library awaits while it still holds its own
        // storage lock, so refreshSession() waits on the lock that can only be
        // released after this function returns. On a device whose clock is
        // ahead of the server's, even a freshly issued token looks expired,
        // which made every Windows sign-in wait out the refresh deadline and
        // then report a failure for a password the server had accepted. The
        // server is the authority on the token: call /api/auth/me/ with it and
        // let a 401 trigger the refresh path below, outside this callback.
        const token = session?.access_token;
        if (!token) {
          // No access token yet (e.g. right after sign-in fires). Never clear
          // the auth state here — the caller decides whether to fall back to a
          // degraded login instead of stranding the user.
          setLoading(false);
          return null;
        }

        // timeoutSignal, not AbortSignal.timeout: the latter is Chrome 88+ and
        // throws on old Android WebViews before any request is made.
        const { signal: meSignal, cancel: cancelMeSignal } = timeoutSignal(getConnectionTimeout(30000));
        const res = await fetch("/api/auth/me/", {
          headers: { authorization: `Bearer ${token}` },
          // Generous timeout for /api/auth/me/: on a cold-started Supabase the
          // first profile request can take >6s, and aborting early zeroes the
          // school (bouncing admins to the setup wizard with empty dashboards).
          signal: meSignal,
        });
        cancelMeSignal();
        if (!res.ok) {
          // Retry once on transient server errors (502, 503, 504)
          if (retryCount < 1 && (res.status === 502 || res.status === 503 || res.status === 504)) {
            logger.warn(`[Auth] Profile fetch got ${res.status}, retrying...`);
            await new Promise((r) => setTimeout(r, 1000));
            return fetchUserData(authId, session, retryCount + 1);
          }
          if (res.status === 404) {
            logger.error("[Auth] User profile not found in database for auth_id:", authId);
            // Profile doesn't exist even though auth succeeded — sign out fully.
            // (Generic fetch failures fall through to degraded login below;
            // 404 is the genuinely-missing case, so clear the orphaned session
            // rather than stranding the user in a degraded empty dashboard.)
            await supabase.auth.signOut();
            clearAuthState();
            return null;
          } else if (res.status === 401) {
            // Token might be stale; retry once with a refreshed session. The
            // refresh itself races a timeout: on a dead/flaky connection an
            // unguarded refreshSession() never settles and the login screen
            // sits on "Checking your session…" forever.
            if (retryCount < 1) {
              logger.warn("[Auth] Profile fetch 401 — refreshing session and retrying");
              await Promise.race([
                supabase.auth.refreshSession(),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("refreshSession timed out")), getConnectionTimeout(6000)),
                ),
              ]).catch(() => null);
              await new Promise((r) => setTimeout(r, 500));
              return fetchUserData(authId, session, retryCount + 1);
            }
            logger.warn("[Auth] Profile fetch auth token rejected after refresh — keeping session for degraded login");
            return null;
          } else {
            logger.error("[Auth] Profile fetch failed with status:", res.status);
          }
          setLoading(false);
          return null;
        }

        const { user: userData, school: schoolData } = await res.json();
        setProfileDegraded(false);

        const newUser = {
          ...userData,
          role: userData.role as User["role"],
          // Normalise to a de-duplicated list that always contains the primary
          // role, so `canAccessAny` behaves identically whether or not the
          // multi-role migration has been applied.
          roles: normaliseRoles(userData.roles, userData.role),
        };
        setUser((prev) => {
          if (prev && prev.id === newUser.id && prev.role === newUser.role && sameRoles(prev.roles, newUser.roles)) {
            return prev;
          }
          return newUser;
        });
        try {
          localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(newUser));
        } catch (error) {
          logger.warn("Failed to persist offline user data:", error);
        }

        if (userData.role === "super_admin") {
          setSchool(null);
          setLoading(false);
          return { role: userData.role };
        }

        if (schoolData) {
          const schoolObj = {
            ...schoolData,
            feature_stage: (schoolData.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE,
          };
          setSchool(schoolObj);
          try {
            localStorage.setItem(OFFLINE_SCHOOL_KEY, JSON.stringify(schoolObj));
          } catch (error) {
            logger.warn("Failed to persist offline school data:", error);
          }
          setIsTrialExpired(computeTrialExpired(schoolObj, userData.role));
        }

        setLoading(false);
        return { role: userData.role };
      } catch (error) {
        const errMsg = getErrorMessage(error);
        // Retry once on network errors
        if (
          retryCount < 1 &&
          (errMsg.includes("network") ||
            errMsg.includes("fetch") ||
            errMsg.includes("timed out") ||
            errMsg.includes("abort"))
        ) {
          logger.warn("[Auth] Profile fetch network error, retrying...");
          await new Promise((r) => setTimeout(r, 1500));
          return fetchUserData(authId, session, retryCount + 1);
        }
        // Never clear the auth state on transient failures — a valid Supabase
        // session exists; the profile endpoint was just unreachable. The caller
        // falls back to a degraded (metadata/cache) login instead of stranding
        // the user with a misleading "logged in elsewhere" error.
        logger.error("Error fetching user data:", errMsg);
        setLoading(false);
        return null;
      }
    },
    [clearAuthState],
  );

  // Degraded login fallback: the profile endpoint (/api/auth/me/) is down or
  // unreachable but Supabase issued a valid session. Restore the user from the
  // offline cache first (best fidelity), else build a minimal user from the
  // auth token's user_metadata (every account provisioning path stores the role
  // there). This prevents valid logins from failing with a misleading
  // "session conflict" error.
  const applyDegradedUser = useCallback(
    (verifiedUser: {
      id: string;
      email?: string | null;
      phone?: string | null;
      created_at?: string;
      user_metadata?: unknown;
    }) => {
      let restored: User | null = null;
      try {
        const raw = localStorage.getItem(OFFLINE_USER_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as User;
          if (cached && (cached.auth_id === verifiedUser.id || cached.id === verifiedUser.id)) {
            restored = cached;
          }
        }
      } catch (error) {
        logger.warn("[Auth] Failed to read cached user for degraded login:", error);
      }
      if (!restored) {
        const meta = (verifiedUser.user_metadata ?? {}) as Record<string, unknown>;
        restored = {
          id: verifiedUser.id,
          auth_id: verifiedUser.id,
          school_id: null,
          full_name: typeof meta.full_name === "string" ? meta.full_name : verifiedUser.email || "Account",
          phone: verifiedUser.phone ?? (typeof meta.phone === "string" ? meta.phone : ""),
          email: verifiedUser.email ?? undefined,
          role: (typeof meta.role === "string" ? (meta.role as User["role"]) : undefined) || "school_admin",
          is_active: true,
          created_at: verifiedUser.created_at || new Date().toISOString(),
        };
      }
      setUser(restored);
      try {
        const rawSchool = localStorage.getItem(OFFLINE_SCHOOL_KEY);
        if (rawSchool) setSchool(JSON.parse(rawSchool));
      } catch (error) {
        logger.warn("[Auth] Failed to restore cached school for degraded login:", error);
      }
      setIsDemo(false);
      setLoading(false);
      setAuthInitialized(true);
      setProfileDegraded(true);
      degradedUserIdRef.current = verifiedUser.id;
      logger.warn("[Auth] Degraded login fallback applied — profile endpoint unreachable");
    },
    [setAuthInitialized, setIsDemo, setLoading, setProfileDegraded, setSchool, setUser],
  );

  // Background profile heal: when a cold-start or temporary outage forced the
  // degraded fallback (profile/school not reachable), keep retrying
  // /api/auth/me/ in the background so the full profile + school populate as
  // soon as the backend recovers — instead of leaving an empty dashboard
  // (which previously bounced school admins into the setup wizard).
  useEffect(() => {
    if (!profileDegraded) return;
    let cancelled = false;
    const attempt = async () => {
      if (cancelled || !navigator.onLine) return;
      const id = degradedUserIdRef.current;
      if (!id) return;
      const profile = await fetchUserData(id);
      if (!cancelled && profile) setProfileDegraded(false);
    };
    const interval = window.setInterval(attempt, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fetchUserData, profileDegraded]);

  const checkUser = useCallback(async () => {
    // Safety timer: fallback to non-loading state if auth takes too long.
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setAuthInitialized(true);
    }, 2000);

    try {
      const demoUserStr = readDemoStorage();

      if (demoUserStr) {
        try {
          const decrypted = decryptDemoData(demoUserStr);
          if (decrypted) {
            const { demoUser, demoSchool } = JSON.parse(decrypted);

            setUser({
              id: "demo-user",
              auth_id: "demo",
              school_id: demoSchool.id,
              full_name: demoUser.name,
              phone: "0700000000",
              role: sanitizeDemoRole(demoUser.role),
              avatar_url: undefined,
              is_active: true,
              created_at: new Date().toISOString(),
            } as User);
            setSchool({
              id: demoSchool.id,
              name: demoSchool.name,
              school_code: demoSchool.school_code || "DEMO001",
              district: demoSchool.district || "Kampala",
              school_type: demoSchool.school_type || "primary",
              ownership: demoSchool.ownership || "private",
              primary_color: demoSchool.primary_color || "#001F3F",
              logo_url: demoSchool.logo_url || "",
              subscription_plan: demoSchool.subscription_plan || "growth",
              subscription_status: demoSchool.subscription_status || "active",
              feature_stage: (demoSchool.feature_stage as FeatureStage) || "full",
              created_at: new Date().toISOString(),
            });
            setIsDemo(true);
            setIsTrialExpired(false);
            setLoading(false);
            setAuthInitialized(true);
            return;
          }
        } catch (e) {
          logger.error("[Auth] Error parsing demo data:", e);
          clearDemoStorage();
        }
      }

      if (supabase?.auth) {
        // Offline fast path: paint the cached profile before asking Supabase
        // anything. getSession() may try to refresh an expired token first,
        // which on a phone with no signal means waiting out a fetch timeout
        // before the dashboard can open.
        if (typeof navigator !== "undefined" && !navigator.onLine && restoreCachedProfile()) {
          return;
        }

        try {
          const {
            data: { session },
          } = (await Promise.race([
            supabase!.auth.getSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("getSession timed out")), getConnectionTimeout(6000)),
            ),
          ])) as Awaited<ReturnType<typeof supabase.auth.getSession>>;
          if (!session) {
            setUser(null);
            setSchool(null);
            setIsDemo(false);
            setLoading(false);
            setAuthInitialized(true);
            return;
          }

          // If offline, restore from cache immediately so the user isn't
          // locked out during network outages (common in rural Uganda).
          if (!navigator.onLine) {
            try {
              const cachedUser = localStorage.getItem(OFFLINE_USER_KEY);
              const cachedSchool = localStorage.getItem(OFFLINE_SCHOOL_KEY);
              if (cachedUser) {
                setUser(JSON.parse(cachedUser) as User);
                setSchool(cachedSchool ? JSON.parse(cachedSchool) : null);
                setIsDemo(false);
                setLoading(false);
                setAuthInitialized(true);
                return;
              }
            } catch (error) {
              logger.error("Failed to load cached user data:", error);
            }
          }

          // Optimistic hydration.
          //
          // The cached profile is enough to paint the dashboard and costs
          // nothing — localStorage, no network. Previously the cache was only
          // consulted when the browser was offline, so every *online* load sat
          // behind getUser() and then /api/auth/me/: two sequential round trips,
          // with a blank loading screen for the whole of it. On a rural 2G
          // connection that is the three seconds the app appeared to take, and
          // the 2s safety timer was what usually rescued it.
          //
          // The cached copy is a display placeholder only. Supabase's session
          // still decides who you are, RLS still authorises every query, and
          // the fresh fetch immediately below overwrites this the moment it
          // lands. Signing out clears the cache, so this cannot outlive a
          // session on a shared device.
          try {
            const cachedUser = localStorage.getItem(OFFLINE_USER_KEY);
            if (cachedUser) {
              const cachedSchool = localStorage.getItem(OFFLINE_SCHOOL_KEY);
              setUser(JSON.parse(cachedUser) as User);
              setSchool(cachedSchool ? JSON.parse(cachedSchool) : null);
              setIsDemo(false);
              setLoading(false);
              setAuthInitialized(true);
            }
          } catch (error) {
            // Malformed cache must not block the real fetch below.
            logger.warn("Optimistic profile hydration failed:", error);
          }

          const sessionUser = session.user;
          const profile = await fetchUserData(sessionUser.id, session);
          if (profile) {
            setIsDemo(false);
            setLoading(false);
            setAuthInitialized(true);
            return;
          }

          let authUserError: unknown = null;
          let authUser: User | null = null;
          try {
            const result = (await Promise.race([
              withSupabaseLockRetry(async () => await supabase!.auth.getUser()),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("getUser timed out in checkUser")), getConnectionTimeout(6000)),
              ),
            ])) as { data: { user: User | null } };
            authUser = result.data.user;
          } catch (err) {
            authUserError = err;
          }

          if (authUser) {
            if (typeof navigator !== "undefined" && navigator.onLine) applyDegradedUser(authUser);
            setIsDemo(false);
            setLoading(false);
            setAuthInitialized(true);
            return;
          }

          // If getUser() failed because of a network error, do NOT log the
          // user out. They may have a valid session but poor connectivity.
          // Keep the cached user data so they can continue working offline.
          if (authUserError && isNetworkError(authUserError)) {
            logger.warn(
              "[Auth] getUser() failed due to network error — keeping cached user:",
              getErrorMessage(authUserError),
            );
            try {
              const cachedUser = localStorage.getItem(OFFLINE_USER_KEY);
              const cachedSchool = localStorage.getItem(OFFLINE_SCHOOL_KEY);
              if (cachedUser) {
                setUser(JSON.parse(cachedUser) as User);
                setSchool(cachedSchool ? JSON.parse(cachedSchool) : null);
              }
            } catch {
              /* ignore cache parse errors */
            }
            setIsDemo(false);
            setLoading(false);
            setAuthInitialized(true);
            return;
          }

          // Only clear user state if we are confident the session is gone.
          setUser(null);
          setSchool(null);
          setIsDemo(false);
          setLoading(false);
          setAuthInitialized(true);
        } catch (err) {
          logger.error("[Auth] getUser failed in auth state handler:", err);
          // A timed-out session read is a connectivity problem, not a sign-out.
          // Keep the cached profile so the classroom keeps working offline.
          if (restoreCachedProfile()) return;
          setUser(null);
          setSchool(null);
          setIsDemo(false);
          setLoading(false);
        }
      } else {
        setIsDemo(false);
        setLoading(false);
        setAuthInitialized(true);
      }
    } catch (err) {
      logger.error("[Auth] onAuthStateChange handler failed:", err);
      setIsDemo(false);
      setLoading(false);
    } finally {
      clearTimeout(safetyTimer);
      setAuthInitialized(true);
    }
  }, [applyDegradedUser, fetchUserData, clearAuthState, restoreCachedProfile]);

  useEffect(() => {
    // Reset the abort flag on (re)mount — React StrictMode unmounts/remounts
    // effects, and the cleanup sets authFetchAborted=true. Without this reset,
    // fetchUserData returns null on every subsequent call in dev mode.
    authFetchAborted.current = false;

    // Deduplicate: INITIAL_SESSION fires immediately after subscribing and
    // would race with the manual checkUser() call below. Skip checkUser()
    // since the onAuthStateChange handler will handle INITIAL_SESSION.
    // Only run checkUser() if the handler didn't fire within 500ms.
    let handlerFired = false;
    let checkUserRan = false;
    const timer = setTimeout(() => {
      if (!handlerFired && !authCheckedRef.current) {
        checkUserRan = true;
        checkUser();
        authCheckedRef.current = true;
      }
    }, 500);

    if (supabase) {
      const {
        data: { subscription },
      } = supabase!.auth.onAuthStateChange(async (event, session) => {
        handlerFired = true;
        clearTimeout(timer);
        try {
          const isCurrentlyDemo = readDemoStorage() !== null;

          if (isCurrentlyDemo && event !== "SIGNED_OUT") {
            // On SIGNED_IN with a real Supabase session, clear demo storage
            // and fall through to the normal auth flow instead of short-circuiting.
            if (event === "SIGNED_IN") {
              clearDemoStorage();
              setLoading(true);
            } else {
              try {
                const demoUserStr = readDemoStorage();
                if (!demoUserStr) {
                  clearDemoStorage();
                  setLoading(false);
                  setAuthInitialized(true);
                  return;
                }
                const decrypted = decryptDemoData(demoUserStr);
                if (decrypted) {
                  const { demoUser, demoSchool } = JSON.parse(decrypted);
                  setUser({
                    id: "demo-user",
                    auth_id: "demo",
                    school_id: demoSchool.id,
                    full_name: demoUser.name,
                    phone: "0700000000",
                    role: sanitizeDemoRole(demoUser.role),
                    avatar_url: undefined,
                    is_active: true,
                    created_at: new Date().toISOString(),
                  } as User);
                  setSchool({
                    id: demoSchool.id,
                    name: demoSchool.name,
                    school_code: demoSchool.school_code || "DEMO001",
                    district: demoSchool.district || "Kampala",
                    school_type: demoSchool.school_type || "primary",
                    ownership: demoSchool.ownership || "private",
                    primary_color: demoSchool.primary_color || "#001F3F",
                    logo_url: demoSchool.logo_url || "",
                    subscription_plan: demoSchool.subscription_plan || "growth",
                    subscription_status: demoSchool.subscription_status || "active",
                    feature_stage: (demoSchool.feature_stage as FeatureStage) || "full",
                    created_at: new Date().toISOString(),
                  });
                  setIsDemo(true);
                  setIsTrialExpired(false);
                }
              } catch (e) {
                logger.error("[Auth] Error parsing demo data in onAuthStateChange:", e);
                clearDemoStorage();
              }
              setLoading(false);
              setAuthInitialized(true);
              return;
            }
          }

          if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
            if (event === "SIGNED_IN") explicitSignOutRef.current = false;
            // Fast path: no session means no user — skip getUser() entirely.
            if (event === "INITIAL_SESSION" && !session) {
              // Offline cold start: auth-js cannot refresh an expired token
              // without signal and reports no session. The cached profile is
              // still the signed-in user; keep them on the dashboard instead
              // of bouncing to /login (which, uncached, is offline.html).
              if (typeof navigator !== "undefined" && !navigator.onLine && restoreCachedProfile()) {
                return;
              }
              setUser(null);
              setSchool(null);
              setIsDemo(false);
              setLoading(false);
              setAuthInitialized(true);
              return;
            }

            // On a returning session, paint the last-known profile immediately
            // instead of leaving the dashboard blank while getUser() and the
            // profile endpoint make sequential network requests. The session
            // remains authoritative; the verified profile below reconciles
            // this display cache as soon as the network responds.
            if (event === "INITIAL_SESSION" && session) {
              try {
                const cachedUser = localStorage.getItem(OFFLINE_USER_KEY);
                if (cachedUser) {
                  const parsedUser = JSON.parse(cachedUser) as User;
                  const belongsToSession = parsedUser.auth_id === session.user.id || parsedUser.id === session.user.id;
                  if (belongsToSession) {
                    const cachedSchool = localStorage.getItem(OFFLINE_SCHOOL_KEY);
                    setUser(parsedUser);
                    setSchool(cachedSchool ? JSON.parse(cachedSchool) : null);
                    setIsDemo(false);
                    setLoading(false);
                    setAuthInitialized(true);
                  }
                }
              } catch (error) {
                logger.warn("Initial cached profile hydration failed:", error);
              }
            }

            // Only set loading=true on explicit SIGNED_IN (user just logged in).
            // INITIAL_SESSION and TOKEN_REFRESHED should NOT toggle loading
            // because they can fire during normal navigation and cause
            // loading flickers / infinite loading loops.
            if (event === "SIGNED_IN") setLoading(true);

            // Safety timer: if getUser+fetchUserData take too long, unblock UI.
            // 8s covers: slow Supabase calls + retry on poor networks.
            let handlerSafetyFired = false;
            const handlerSafetyTimer = setTimeout(() => {
              handlerSafetyFired = true;
              logger.warn("[Auth] onAuthStateChange handler safety timer — forcing authInitialized");
              setLoading(false);
              setAuthInitialized(true);
            }, 8000);

            try {
              const sessionUser = session?.user;
              const profile = sessionUser ? await fetchUserData(sessionUser.id, session) : null;
              if (profile) {
                authCheckedRef.current = true;
                if (!handlerSafetyFired) {
                  setIsDemo(false);
                  setLoading(false);
                  setAuthInitialized(true);
                }
              } else {
                // /api/auth/me verifies the bearer token in the normal path. If
                // it cannot provide a profile, verify via Supabase before using
                // cached/metadata fallback or clearing the session.
                let authUserError: unknown = null;
                let verifiedUser: User | null = null;
                try {
                  const result = (await Promise.race([
                    withSupabaseLockRetry(async () => await supabase!.auth.getUser()),
                    new Promise<never>((_, reject) =>
                      setTimeout(() => reject(new Error("getUser() timed out in auth state handler")), 10000),
                    ),
                  ])) as { data: { user: User | null } };
                  verifiedUser = result.data.user;
                } catch (error) {
                  authUserError = error;
                }

                if (verifiedUser && typeof navigator !== "undefined" && navigator.onLine) {
                  applyDegradedUser(verifiedUser);
                } else if (!verifiedUser && !authUserError && !handlerSafetyFired) {
                  setUser(null);
                  setSchool(null);
                  setIsDemo(false);
                  setLoading(false);
                  setAuthInitialized(true);
                } else if (authUserError && isNetworkError(authUserError) && !handlerSafetyFired) {
                  setLoading(false);
                  setAuthInitialized(true);
                }
              }
            } finally {
              clearTimeout(handlerSafetyTimer);
            }
          } else if (event === "SIGNED_OUT") {
            // A failed token refresh while offline also emits SIGNED_OUT.
            // Only a deliberate sign-out should clear the cached profile.
            if (
              !explicitSignOutRef.current &&
              typeof navigator !== "undefined" &&
              !navigator.onLine &&
              restoreCachedProfile()
            ) {
              return;
            }
            setUser(null);
            setSchool(null);
            setIsDemo(false);
            setIsTrialExpired(false);
            setLoading(false);
            setAuthInitialized(true);
            try {
              localStorage.removeItem(OFFLINE_USER_KEY);
              localStorage.removeItem(OFFLINE_SCHOOL_KEY);
            } catch (error) {
              logger.error("Failed to clear offline data on sign out:", error);
            }
          }
        } catch (error) {
          setLoading(false);
          setAuthInitialized(true);
          if (!isSupabaseLockAbortError(error)) {
            logger.error("[Auth] Auth state change handler failed:", getErrorMessage(error));
          }
        }
      });

      return () => {
        clearTimeout(timer);
        subscription.unsubscribe();
        authFetchAborted.current = true;
      };
    }

    return () => {
      clearTimeout(timer);
      authFetchAborted.current = true;
    };
  }, [checkUser, clearAuthState, fetchUserData, applyDegradedUser]);

  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!supabase) return;
    const visibilityTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
      visibilityTimerRef.current = setTimeout(async () => {
        visibilityTimerRef.current = null;
        if (!userRef.current) return;
        try {
          const {
            data: { session },
          } = await supabase!.auth.getSession();
          if (session) return;
          const {
            data: { user: freshUser },
            error: freshError,
          } = await supabase!.auth.getUser();
          if (!freshUser && !isNetworkError(freshError)) {
            setUser(null);
            setSchool(null);
            router.replace("/login");
          }
        } catch (err) {
          if (!isNetworkError(err)) {
            logger.error("[Auth] Visibility change check failed:", getErrorMessage(err));
          }
        }
      }, 3000);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, [router]);

  const SESSION_TIMEOUT_MS_REF = useRef(30 * 60 * 1000);
  const CHECK_INTERVAL_MS_REF = useRef(60 * 1000);

  const signInLock = useRef(false);
  const signInLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function releaseSignInLock() {
    signInLock.current = false;
    if (signInLockTimer.current) {
      clearTimeout(signInLockTimer.current);
      signInLockTimer.current = null;
    }
  }

  /**
   * Wait for a sign-in answer that was still in flight when its deadline
   * fired.
   *
   * The request was never cancelled -- it is still running -- so the session
   * lands in the client the moment it arrives. Reading the local session is
   * free (no network) and finds it as soon as it is there. This is the
   * difference between "the phone took half a minute and then said the
   * password was wrong" and the same phone taking half a minute and letting
   * the teacher in.
   */
  async function waitForLateSignIn(maxWaitMs: number): Promise<{ role: string } | null> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        // getSession() can itself wait on the auth storage lock. Bound each
        // read so this helper can never outlive the deadline it was given.
        const {
          data: { session },
        } = await Promise.race([
          supabase!.auth.getSession(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("getSession timed out")), 2000)),
        ]);
        if (session?.user) {
          return { role: session.user.user_metadata?.role || "admin" };
        }
      } catch {
        // The session is not there yet. Keep waiting.
      }
    }
    return null;
  }

  /**
   * Sign in through our own API: one request, and the server works out which
   * account the number belongs to.
   *
   * The client used to guess. Accounts are stored as `256XXXXXXXXX@omuto.org`,
   * a few legacy ones as `0777777777@omuto.org` or `@omuto.sms`, and most of
   * them also carry a phone identity -- so the client tried each format in
   * turn and paid a round trip for every wrong guess. On a slow phone each
   * guess had its own deadline, and the sign-in failed after half a minute
   * with the password never actually checked.
   *
   * The server can look the number up, so the phone travels once. The
   * password is used to sign in and is never stored or logged.
   *
   * Returns null when the API could not be reached or is not available, so
   * the caller can fall back to the client-side attempts.
   */
  async function apiSignIn(
    identifier: string,
    password: string,
    controller: AbortController,
    onAuthoritativeAnswer?: () => void,
  ): Promise<{ error: any; role?: string; definitive?: boolean } | null> {
    // Our own API is the fast path, but it must not hold the button forever.
    // Some proxies and antivirus products stall a POST instead of failing it:
    // the request never reaches the server, so no log entry appears and the
    // user sits on "Signing in..." for minutes while every later click is
    // swallowed by the in-flight guard. The deadline covers the whole
    // exchange (headers and body), and the caller can also abort it the
    // moment a direct sign-in wins.
    const timeout = setTimeout(() => controller.abort(), getConnectionTimeout(30000));
    try {
      const res = await fetch("/api/auth/signin/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
        signal: controller.signal,
      });

      let payload: {
        success?: boolean;
        data?: { access_token?: string; refresh_token?: string; role?: string };
        error?: string;
      } = {};
      try {
        payload = await res.json();
      } catch {
        // A non-JSON answer is a proxy error page, not a decision.
      }

      // A direct attempt may have signed the same person in while this
      // response was travelling. Starting a second session would emit a
      // duplicate SIGNED_IN and a duplicate profile fetch.
      if (controller.signal.aborted) return null;

      if (res.ok && payload.data?.access_token && payload.data.refresh_token) {
        // The server has answered and is setting the session. There is
        // nothing to gain from starting the direct attempts behind it. If
        // setSession fails or times out, the caller starts them instead.
        onAuthoritativeAnswer?.();
        // setSession also delivers SIGNED_IN to the subscribers, and the
        // profile fetch runs inside that delivery. A stuck session must not
        // hold the whole login: bound it.
        try {
          const { data, error } = await Promise.race([
            supabase!.auth.setSession({
              access_token: payload.data.access_token,
              refresh_token: payload.data.refresh_token,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("setSession timed out")), getConnectionTimeout(10000)),
            ),
          ]);
          if (!error && data.session) {
            return { error: null, role: payload.data.role || "admin" };
          }
        } catch {
          // Fall through: the direct attempts are still available.
        }
        return { error: { message: "Could not start your session. Please try again." } };
      }

      // The server answered, so it is the authority on this sign-in: it
      // already tried every identity the number could belong to.
      if (res.status === 401 || res.status === 400) {
        // The password was checked against every identity: this is the final
        // answer, not a reason to try the direct path.
        onAuthoritativeAnswer?.();
      }
      if (res.status === 401 || res.status === 400 || res.status === 429 || res.status === 503) {
        return {
          error: { message: payload.error || "Invalid phone number or password" },
          // 401/400 is a verdict on the password; 429/503 is an outage or a
          // rate limit, which the direct path may get around.
          definitive: res.status === 401 || res.status === 400,
        };
      }

      return null;
    } catch {
      // Our own API is unreachable: offline, a captive portal, or a proxy
      // that blocks or stalls the path. The client-side attempts below still
      // work.
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Sign in directly against Supabase, trying every identity the typed number
   * could belong to at the same time.
   *
   * The identities are independent calls, so serialising them only adds their
   * latencies together. On a phone the network is the whole cost; a wrong
   * format answers as quickly as a right one. The first identity that
   * authenticates wins and the rest are ignored.
   *
   * This is the fallback for a stalled `/api/auth/signin/`: it talks straight
   * to Supabase and therefore works on the devices where our own POST never
   * gets through.
   */
  async function runDirectSignInAttempts(
    attempts: AuthLoginAttempt[],
    password: string,
    phone: string,
  ): Promise<{ error: any; role?: string; definitive?: boolean } | null> {
    // Slow networks need LONGER per-attempt deadlines, not shorter: a deadline
    // that fires while the real answer is still in flight reports an outage
    // for a password that was never checked.
    const attemptTimeoutMs = isSlowConnection() || wasSlowDevice() ? 15000 : 10000;
    let lastError: unknown = null;
    // The first answer Supabase actually checked the password against. A
    // fallback format timing out must not turn a wrong password into an
    // outage message (or the other way round).
    let credentialError: unknown = null;
    let sawTimeout = false;

    const runOne = async (attempt: AuthLoginAttempt) => {
      try {
        const { data, error } = await Promise.race([
          withSupabaseLockRetry(async () =>
            attempt.type === "email"
              ? await supabase!.auth.signInWithPassword({
                  email: attempt.value,
                  password,
                })
              : await supabase!.auth.signInWithPassword({
                  phone: attempt.value,
                  password,
                }),
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Login attempt timed out")), attemptTimeoutMs),
          ),
        ]);

        if (error) {
          lastError = error;
          const errMsg = (error.message || "").toLowerCase();
          const isInvalidCredentials =
            errMsg.includes("invalid login credentials") ||
            errMsg.includes("invalid login") ||
            errMsg.includes("wrong password") ||
            errMsg.includes("incorrect password");
          const isUserNotFound =
            errMsg.includes("user not found") || errMsg.includes("no user") || errMsg.includes("email not found");
          if ((isInvalidCredentials || isUserNotFound) && !credentialError) {
            credentialError = error;
          }
          throw error;
        }

        if (!data.user) {
          const noUser = new Error("No user returned from Supabase");
          lastError = noUser;
          throw noUser;
        }

        // Remember the winning format so the next login starts with it.
        setRememberedFormat(phone, `${attempt.type}:${attempt.value.toLowerCase()}`);
        // Return success — onAuthStateChange is the single source of truth for
        // fetching the profile, so a slow profile fetch cannot strand a
        // successful sign-in on the login page.
        return {
          error: null,
          role: data.user.user_metadata?.role || "admin",
        };
      } catch (attemptError) {
        if (attemptError instanceof Error && attemptError.message === "Login attempt timed out") {
          rememberSlowDevice();
          sawTimeout = true;
          lastError = {
            message: "Connection timed out. Please check your internet and try again.",
          };
        } else {
          lastError = attemptError;
        }
        throw attemptError;
      }
    };

    try {
      return await Promise.any(attempts.map(runOne));
    } catch {
      // Every identity failed. A timed-out request can still land after its
      // deadline (cold project, slow phone), so look for a session once more
      // before reporting failure -- the login may have actually worked.
      if (sawTimeout) {
        const landed = await waitForLateSignIn(4000);
        if (landed) {
          return { error: null, role: landed.role };
        }
      }
      return {
        error: credentialError || lastError || { message: "Invalid phone number or password" },
        // Every format actually answered, and at least one said the password
        // was wrong. No amount of waiting will change that verdict.
        definitive: !sawTimeout && Boolean(credentialError),
      };
    }
  }

  async function signIn(phone: string, password: string) {
    try {
      // Prevent duplicate sign-in attempts (e.g. double-click)
      if (signInLock.current) {
        return { error: { message: "Login already in progress" } };
      }
      signInLock.current = true;
      // Backstop only: every path below is bounded, so this should never fire.
      // It exists so a future regression cannot leave the form disabled
      // forever after a single stalled request.
      signInLockTimer.current = setTimeout(() => {
        logger.warn("[Auth] signInLock auto-released after timeout");
        signInLock.current = false;
        signInLockTimer.current = null;
      }, 45000);

      const attempts = buildAuthLoginAttempts(phone);
      // Fast path: try the format that worked last time first, so legacy
      // accounts do not lead with a format that is known to fail for them.
      const remembered = getRememberedFormat(phone);
      if (remembered) {
        const hitIndex = attempts.findIndex((a) => `${a.type}:${a.value.toLowerCase()}` === remembered);
        if (hitIndex > 0) {
          const [hit] = attempts.splice(hitIndex, 1);
          attempts.unshift(hit);
        }
      }

      // Both paths race, so a stalled POST cannot hold the button while a
      // direct sign-in that would have worked sits idle. The API gets a short
      // head start because it resolves the identity server-side in one round
      // trip: on a healthy link it answers first, and starting the direct
      // calls at the same instant would sign the same person in twice and
      // fetch the profile twice on every login.
      const apiController = new AbortController();
      let apiAnswered = false;
      const markApiAnswered = () => {
        apiAnswered = true;
      };
      const apiPromise = apiSignIn(phone, password, apiController, markApiAnswered);

      // The direct attempts are started on demand: immediately if the API has
      // not answered by the head-start deadline, or as soon as the API fails
      // (including a session that could not be set). They are never started
      // behind a healthy API answer, which would sign the same person in
      // twice and fetch the profile twice.
      let directStarted = false;
      let resolveDirect!: (result: { error: any; role?: string } | null) => void;
      const directPromise = new Promise<{ error: any; role?: string } | null>((resolve) => {
        resolveDirect = resolve;
      });
      const startDirect = () => {
        if (directStarted) return;
        directStarted = true;
        runDirectSignInAttempts(attempts, password, phone).then(resolveDirect, (error) => resolveDirect({ error }));
      };

      const headStartTimer = setTimeout(() => {
        // A 401/400 marks the API as answered: its verdict is final, so the
        // direct path is not started. A 429/503 does not mark it answered --
        // that is our route or its upstream failing, and the direct path
        // reaches Supabase over a different route.
        if (!apiAnswered) startDirect();
      }, getConnectionTimeout(3000));

      apiPromise.then((result) => {
        if (!result) {
          // Unreachable, blocked, or timed out.
          startDirect();
          return;
        }
        if (!result.error) {
          if (!directStarted) resolveDirect(null);
          return;
        }
        if (result.definitive) {
          // A real credential answer: do not fire more auth requests.
          if (!directStarted) resolveDirect(null);
          return;
        }
        // A 429/503, or a session that could not be set. The direct path is
        // still worth a try.
        startDirect();
      });

      // Resolve on the first success. If both fail, prefer a real credential
      // answer over a timeout so the login page reports the right thing.
      const isTimeoutError = (error: any) =>
        /timed? out|timeout|network|fetch|connection/i.test(String(error?.message || error || ""));

      const outcome = await new Promise<{ error: any; role?: string; source: "api" | "direct" }>((resolve) => {
        let pending = 2;
        let bestError: any = null;
        let definitiveError: any = null;
        let graceTimer: ReturnType<typeof setTimeout> | null = null;
        let settled = false;

        const finish = (
          result: { error: any; role?: string; definitive?: boolean } | null,
          source: "api" | "direct",
        ) => {
          pending -= 1;
          if (result && !result.error) {
            if (!settled) {
              settled = true;
              if (graceTimer) clearTimeout(graceTimer);
              resolve({ ...result, source });
            }
            return;
          }
          if (result?.error && (!bestError || (isTimeoutError(bestError) && !isTimeoutError(result.error)))) {
            bestError = result.error;
          }
          // A wrong password is final. Do not keep the user on "Signing in..."
          // for the other path's full network deadline; give it a short grace
          // in case it is about to succeed through a different identity.
          if (result?.definitive && !definitiveError) {
            definitiveError = result.error;
            if (pending > 0 && !settled) {
              graceTimer = setTimeout(() => {
                if (!settled) {
                  settled = true;
                  resolve({ error: definitiveError, source });
                }
              }, 2000);
            }
          }
          if (pending === 0 && !settled) {
            settled = true;
            if (graceTimer) clearTimeout(graceTimer);
            resolve({
              error: bestError || { message: "Invalid phone number or password" },
              source,
            });
          }
        };

        apiPromise.then(
          (result) => finish(result, "api"),
          (error) => finish({ error }, "api"),
        );
        directPromise.then(
          (result) => finish(result, "direct"),
          (error) => finish({ error }, "direct"),
        );
      });

      // The race is over. If the API is still in flight, cancel it before it
      // can call setSession and emit a second SIGNED_IN for the same person.
      clearTimeout(headStartTimer);
      apiController.abort();

      releaseSignInLock();
      return outcome.error ? { error: outcome.error } : { error: null, role: outcome.role };
    } catch (error) {
      releaseSignInLock();
      return { error };
    }
  }

  async function signUp(phone: string, password: string, name: string) {
    try {
      const normalizedPhone = phone;
      const email = buildAuthEmailFromPhone(normalizedPhone);
      const { data, error } = await withSupabaseLockRetry(
        async () =>
          await supabase!.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name,
                phone: normalizedPhone,
              },
            },
          }),
      );

      if (error) return { error };
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  async function refreshSchool() {
    if (!user?.school_id || !supabase) return;
    try {
      const { data: schoolData } = await supabase.from("schools").select("*").eq("id", user.school_id).single();
      if (schoolData) {
        setSchool({
          ...schoolData,
          feature_stage: (schoolData.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE,
        });
        setIsTrialExpired(computeTrialExpired(schoolData, user?.role));
      }
    } catch (error) {
      logger.error("Error refreshing school:", error);
    }
  }

  async function refreshSchoolFromAPI() {
    try {
      const { data: sessionData } = await supabase!.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/auth/me/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.school) {
        setSchool({
          ...data.school,
          feature_stage: (data.school.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE,
        });
        setIsTrialExpired(computeTrialExpired(data.school, user?.role));
      }
    } catch (error) {
      logger.error("Error refreshing school from API:", error);
    }
  }

  const signOut = useCallback(async () => {
    // Mark deliberate: a SIGNED_OUT event from this call must clear the
    // offline cache even if the browser is offline at the time.
    explicitSignOutRef.current = true;
    try {
      await supabase!.auth.signOut({ scope: "local" });
    } catch (e) {
      logger.warn("signOut API call failed, clearing session locally");
    }
    // Force-clear all auth cookies and storage even if the signOut call failed.
    // On slow networks, the Supabase API call can fail but cookies remain,
    // causing the user to be automatically logged back in on the next page load.
    try {
      localStorage.removeItem(OFFLINE_USER_KEY);
      localStorage.removeItem(OFFLINE_SCHOOL_KEY);
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const name = cookie.split("=")[0].trim();
        if (name.startsWith("sb-")) {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
      }
    } catch {
      // Ignore cookie/storage clearing errors
    }
    setUser(null);
    setSchool(null);
    setIsDemo(false);
    setIsTrialExpired(false);
    clearDemoStorage();
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        school,
        loading,
        authInitialized,
        isDemo,
        isTrialExpired,
        profileDegraded,
        signIn,
        signUp,
        signOut,
        refreshSchool,
        refreshSchoolFromAPI,
        isSubscriptionActive,
        getSubscriptionPlan,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
