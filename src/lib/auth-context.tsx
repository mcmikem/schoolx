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
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import { useRouter } from "next/navigation";
import type { User, School } from "@/types";
import { logger } from "./logger";
import { getErrorMessage } from "./validation";
import { buildAuthEmailFromPhone, buildAuthLoginAttempts } from "./auth-login";
import { isSupabaseLockAbortError, withSupabaseLockRetry } from "./supabase-lock";
import {
  AuthContextType,
  sanitizeDemoRole,
  OFFLINE_USER_KEY,
  OFFLINE_SCHOOL_KEY,
  computeTrialExpired,
  isSubscriptionActiveCheck,
  getSubscriptionPlan as getPlan,
} from "./auth-context-types";
import { decryptDemoData, readDemoStorage, clearDemoStorage } from "./auth-demo";
import { buildPhoneLookupCandidates } from "./auth-phone";
import { FeatureStage, DEFAULT_FEATURE_STAGE } from "./featureStages";
import type { PlanType } from "./payments/subscription-client";

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const router = useRouter();

  const authFetchAborted = useRef(false);
  const authCheckedRef = useRef(false);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setSchool(null);
    setIsDemo(false);
    setIsTrialExpired(false);
    try {
      localStorage.removeItem(OFFLINE_USER_KEY);
      localStorage.removeItem(OFFLINE_SCHOOL_KEY);
    } catch {
      // Ignore storage errors while clearing invalid cached auth data.
    }
  }, []);

  const isSubscriptionActive = useCallback(() => {
    return isSubscriptionActiveCheck(school);
  }, [school]);

  const getSubscriptionPlan = useCallback((): PlanType | null => {
    return getPlan(school);
  }, [school]);

  const fetchUserData = useCallback(
    async (authId: string, retryCount = 0): Promise<{ role: string } | null> => {
      if (authFetchAborted.current || !supabase) return null;

      try {
        // getSession() can return a stale access_token if it hasn't refreshed yet.
        // Prefer refreshSession() so we always send a current token to /api/auth/me/.
        // Both calls have 6s timeouts to prevent infinite loading when Supabase hangs.
        // Reduced dynamically on slow connections (3G/2G) via getConnectionTimeout().
        let session = (
          (await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("getSession timed out")), getConnectionTimeout(6000)),
            ),
          ])) as Awaited<ReturnType<typeof supabase.auth.getSession>>
        ).data.session;
        if (session && session.expires_at && session.expires_at * 1000 < Date.now() + 6000) {
          const { data: refreshed } = (await Promise.race([
            supabase.auth.refreshSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("refreshSession timed out")), getConnectionTimeout(6000)),
            ),
          ])) as Awaited<ReturnType<typeof supabase.auth.refreshSession>>;
          if (refreshed.session) session = refreshed.session;
        }
        const token = session?.access_token;
        if (!token) {
          if (typeof navigator !== "undefined" && navigator.onLine) {
            clearAuthState();
          }
          setLoading(false);
          return null;
        }

        const res = await fetch("/api/auth/me/", {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(getConnectionTimeout(6000)),
        });
        if (!res.ok) {
          // Retry once on transient server errors (502, 503, 504)
          if (retryCount < 1 && (res.status === 502 || res.status === 503 || res.status === 504)) {
            logger.warn(`[Auth] Profile fetch got ${res.status}, retrying...`);
            await new Promise((r) => setTimeout(r, 1000));
            return fetchUserData(authId, retryCount + 1);
          }
          if (res.status === 404) {
            logger.error("[Auth] User profile not found in database for auth_id:", authId);
            // Profile doesn't exist even though auth succeeded — sign out fully.
            await supabase.auth.signOut();
            clearAuthState();
            return null;
          } else if (res.status === 401) {
            // Token might be stale; retry once with a refreshed session.
            if (retryCount < 1) {
              logger.warn("[Auth] Profile fetch 401 — refreshing session and retrying");
              await supabase.auth.refreshSession();
              await new Promise((r) => setTimeout(r, 500));
              return fetchUserData(authId, retryCount + 1);
            }
            logger.warn("[Auth] Profile fetch auth token rejected after refresh — clearing state");
            clearAuthState();
            return null;
          } else {
            logger.error("[Auth] Profile fetch failed with status:", res.status);
          }
          setLoading(false);
          return null;
        }

        const { user: userData, school: schoolData } = await res.json();

        const newUser = {
          ...userData,
          role: userData.role as User["role"],
        };
        setUser((prev) => {
          if (prev && prev.id === newUser.id && prev.role === newUser.role) {
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
          setIsTrialExpired(computeTrialExpired(schoolObj));
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
          return fetchUserData(authId, retryCount + 1);
        }
        if (typeof navigator !== "undefined" && navigator.onLine) {
          clearAuthState();
        }
        logger.error("Error fetching user data:", errMsg);
        setLoading(false);
        return null;
      }
    },
    [clearAuthState],
  );

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
            const profile = await fetchUserData(authUser.id);
            if (!profile && navigator.onLine) {
              clearAuthState();
            }
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
  }, [fetchUserData, clearAuthState]);

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
            // Fast path: no session means no user — skip getUser() entirely.
            if (event === "INITIAL_SESSION" && !session) {
              setUser(null);
              setSchool(null);
              setIsDemo(false);
              setLoading(false);
              setAuthInitialized(true);
              return;
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
              const {
                data: { user: verifiedUser },
              }: { data: { user: User | null } } = (await Promise.race([
                withSupabaseLockRetry(async () => await supabase!.auth.getUser()),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("getUser() timed out in auth state handler")), 10000),
                ),
              ])) as { data: { user: User | null } };

              if (verifiedUser) {
                authCheckedRef.current = true;
                // Always fetch user data here — this is the single source of truth
                // for populating the user after auth. signIn() no longer calls
                // fetchUserData to avoid race conditions and timeouts.
                try {
                  const profile = await fetchUserData(verifiedUser.id);
                  if (!profile && navigator.onLine) {
                    clearAuthState();
                  }
                } catch {
                  logger.warn("[Auth] fetchUserData failed in state change handler");
                }
                if (!handlerSafetyFired) {
                  setIsDemo(false);
                  setLoading(false);
                  setAuthInitialized(true);
                }
              } else if (!handlerSafetyFired) {
                // If getUser() returned null without a network error, the session
                // is genuinely invalid. Only then do we clear user state.
                setUser(null);
                setSchool(null);
                setIsDemo(false);
                setLoading(false);
                setAuthInitialized(true);
              }
            } finally {
              clearTimeout(handlerSafetyTimer);
            }
          } else if (event === "SIGNED_OUT") {
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
  }, [checkUser, clearAuthState, fetchUserData]);

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

  async function signIn(phone: string, password: string) {
    try {
      // Prevent duplicate sign-in attempts (e.g. double-click)
      if (signInLock.current) {
        return { error: { message: "Login already in progress" } };
      }
      signInLock.current = true;
      // Safety: if a request hangs forever (poor internet), auto-release the
      // lock after 15s so the user can retry without refreshing the page.
      signInLockTimer.current = setTimeout(() => {
        logger.warn("[Auth] signInLock auto-released after timeout");
        signInLock.current = false;
        signInLockTimer.current = null;
      }, 15000);

      const attempts = buildAuthLoginAttempts(phone);
      let lastError: unknown = null;

      for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        // Short delay between attempts to avoid hammering Supabase and
        // triggering rate limits on poor networks.
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

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
              setTimeout(() => reject(new Error("Login attempt timed out")), getConnectionTimeout(8000)),
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

            // Only fast-fail on explicit "wrong password" - we can't distinguish
            // "user doesn't exist" from "wrong password" when Supabase returns
            // "invalid credentials". Try all formats to be safe.
            const isExplicitWrongPassword =
              isInvalidCredentials && (errMsg.includes("wrong password") || errMsg.includes("incorrect password"));

            if (isExplicitWrongPassword && attempts.length === 1) {
              // Only fail fast if there's exactly one attempt and we got explicit
              // "wrong password" - otherwise try all formats
              break;
            }
            // Try next format on "user not found", generic "invalid credentials",
            // or any transient error
            if (isUserNotFound || !isExplicitWrongPassword) {
              continue;
            }
            break;
          }

          if (!data.user) {
            lastError = { message: "No user returned from Supabase" };
            continue;
          }

          // Refresh offline cache in the background — don't await
          import("@/lib/offline")
            .then(({ offlineDB }) => {
              offlineDB
                .refreshAll([
                  "students",
                  "classes",
                  "subjects",
                  "attendance",
                  "grades",
                  "fee_payments",
                  "fee_structure",
                  "fee_adjustments",
                  "messages",
                  "events",
                  "timetable",
                ])
                .catch((err) => logger.warn("[auth] Background offlineDB refresh failed", err));
            })
            .catch((err) => logger.warn("[auth] Dynamic import of offlineDB failed", err));

          releaseSignInLock();
          // Return success — onAuthStateChange handler is the single source of
          // truth for fetching user profile. This avoids race conditions where
          // fetchUserData times out and leaves the user stranded on the login page.
          return {
            error: null,
            role: data.user.user_metadata?.role || "admin",
          };
        } catch (attemptError) {
          if (attemptError instanceof Error && attemptError.message === "Login attempt timed out") {
            lastError = {
              message: "Connection timed out. Please check your internet and try again.",
            };
          } else {
            lastError = attemptError;
          }
        }
      }

      releaseSignInLock();
      return {
        error: lastError || { message: "Invalid phone number or password" },
      };
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
        setIsTrialExpired(computeTrialExpired(schoolData));
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
        setIsTrialExpired(computeTrialExpired(data.school));
      }
    } catch (error) {
      logger.error("Error refreshing school from API:", error);
    }
  }

  const signOut = useCallback(async () => {
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
