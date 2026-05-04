"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { supabase } from "./supabase";
import { useRouter } from "next/navigation";
import type { User, School } from "@/types";
import { logger } from "./logger";
import { getErrorMessage } from "./validation";
import { buildAuthEmailFromPhone, buildAuthLoginAttempts } from "./auth-login";
import {
  isSupabaseLockAbortError,
  withSupabaseLockRetry,
} from "./supabase-lock";
import {
  AuthContextType,
  sanitizeDemoRole,
  OFFLINE_USER_KEY,
  OFFLINE_SCHOOL_KEY,
  computeTrialExpired,
  isSubscriptionActiveCheck,
  getSubscriptionPlan as getPlan,
} from "./auth-context-types";
import {
  decryptDemoData,
  readDemoStorage,
  clearDemoStorage,
} from "./auth-demo";
import {
  buildPhoneLookupCandidates,
} from "./auth-phone";
import { FeatureStage, DEFAULT_FEATURE_STAGE } from "./featureStages";
import type { PlanType } from "./payments/subscription-client";

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

  const isSubscriptionActive = useCallback(() => {
    return isSubscriptionActiveCheck(school);
  }, [school]);

  const getSubscriptionPlan = useCallback((): PlanType | null => {
    return getPlan(school);
  }, [school]);

  const fetchUserData = useCallback(
    async (
      authId: string,
    ): Promise<{ role: string } | null> => {
      if (authFetchAborted.current || !supabase) return null;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setLoading(false);
          return null;
        }

        const res = await fetch("/api/auth/me/", {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          if (res.status === 404) {
            logger.warn("[Auth] No user profile found for auth_id:", authId);
          } else {
            logger.warn("[Auth] Profile fetch failed:", res.status);
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
          localStorage.setItem(
            OFFLINE_USER_KEY,
            JSON.stringify(newUser),
          );
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
            feature_stage:
              (schoolData.feature_stage as FeatureStage) ||
              DEFAULT_FEATURE_STAGE,
          };
          setSchool((prev) => {
            if (prev && prev.id === schoolObj.id) return prev;
            return schoolObj;
          });
          try {
            localStorage.setItem(
              OFFLINE_SCHOOL_KEY,
              JSON.stringify(schoolObj),
            );
          } catch (error) {
            logger.warn("Failed to persist offline school data:", error);
          }
          setIsTrialExpired(computeTrialExpired(schoolObj));
        }

        setLoading(false);
        return { role: userData.role };
      } catch (error) {
        logger.error("Error fetching user data:", getErrorMessage(error));
        setLoading(false);
        return null;
      }
    },
    [],
  );

  const checkUser = useCallback(async () => {
    // Safety timer: fallback to non-loading state if auth takes too long.
    // 12s accounts for slow connections (3G, VPN, cold-start Supabase).
    // Only fires if auth hasn't already resolved.
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setAuthInitialized(true);
    }, 12000);

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
              subscription_plan: demoSchool.subscription_plan || "growth",
              subscription_status: demoSchool.subscription_status || "active",
              feature_stage:
                (demoSchool.feature_stage as FeatureStage) || "full",
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
          } = await supabase!.auth.getSession();
          if (!session) {
            setUser(null);
            setSchool(null);
            setIsDemo(false);
            setLoading(false);
            setAuthInitialized(true);
            return;
          }

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

          const {
            data: { user: authUser },
          } = await withSupabaseLockRetry(
            async () => await supabase!.auth.getUser(),
          );
          if (authUser) {
            // fetchUserData has its own in-progress guard, so safe to call.
            await fetchUserData(authUser.id);
            setIsDemo(false);
            setLoading(false);
            setAuthInitialized(true);
          } else {
            setUser(null);
            setSchool(null);
            setIsDemo(false);
            setLoading(false);
            setAuthInitialized(true);
          }
        } catch {
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
    } catch {
      setIsDemo(false);
      setLoading(false);
    } finally {
      clearTimeout(safetyTimer);
      setAuthInitialized(true);
    }
  }, [fetchUserData]);

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

          if (isCurrentlyDemo && event !== "SIGNED_OUT") return;

          if (
            event === "SIGNED_IN" ||
            event === "INITIAL_SESSION" ||
            event === "TOKEN_REFRESHED"
          ) {
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
            const {
              data: { user: verifiedUser },
            } = await withSupabaseLockRetry(
              async () => await supabase!.auth.getUser(),
            );

            if (verifiedUser) {
              authCheckedRef.current = true;
              try {
                await fetchUserData(verifiedUser.id);
              } catch {
                logger.warn(
                  "[Auth] fetchUserData failed in state change handler",
                );
              }
              setIsDemo(false);
              setLoading(false);
              setAuthInitialized(true);
            } else {
              setUser(null);
              setSchool(null);
              setIsDemo(false);
              setLoading(false);
              setAuthInitialized(true);
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
            logger.error(
              "[Auth] Auth state change handler failed:",
              getErrorMessage(error),
            );
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
  }, [checkUser, fetchUserData]);

  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!supabase) return;
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        try {
          const {
            data: { user: freshUser },
          } = await supabase!.auth.getUser();
          if (!freshUser && userRef.current) {
            setUser(null);
            setSchool(null);
            router.push("/login");
          }
        } catch {
          // Silently ignore — network errors on visibility change are common
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [router]);

  const SESSION_TIMEOUT_MS_REF = useRef(30 * 60 * 1000);
  const CHECK_INTERVAL_MS_REF = useRef(60 * 1000);

  const signInLock = useRef(false);

  async function signIn(phone: string, password: string) {
    try {
      // Prevent duplicate sign-in attempts (e.g. double-click)
      if (signInLock.current) {
        return { error: { message: "Login already in progress" } };
      }
      signInLock.current = true;

      const attempts = buildAuthLoginAttempts(phone);
      let lastError: unknown = null;

      for (const attempt of attempts) {
        const { data, error } = await withSupabaseLockRetry(async () =>
          attempt.type === "email"
            ? await supabase!.auth.signInWithPassword({
                email: attempt.value,
                password,
              })
            : await supabase!.auth.signInWithPassword({
                phone: attempt.value,
                password,
              }),
        );

        if (error) {
          lastError = error;
          continue;
        }

        if (!data.user) {
          lastError = { message: "No user returned from Supabase" };
          continue;
        }

        // Don't call fetchUserData here — onAuthStateChange's SIGNED_IN
        // handler already calls fetchUserData. Calling it here too causes
        // duplicate /api/auth/me/ requests and loading flicker.
        // Just wait for auth state to propagate.
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
              .catch(() => {});
          })
          .catch(() => {});

        return { error: null, role: data.user.user_metadata?.role || "admin" };
      }

      return {
        error: lastError || { message: "Invalid phone number or password" },
      };
    } catch (error) {
      return { error };
    } finally {
      signInLock.current = false;
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
      const { data: schoolData } = await supabase
        .from("schools")
        .select("*")
        .eq("id", user.school_id)
        .single();
      if (schoolData) {
        setSchool({
          ...schoolData,
          feature_stage:
            (schoolData.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE,
        });
        setIsTrialExpired(computeTrialExpired(schoolData));
      }
    } catch (error) {
      logger.error("Error refreshing school:", error);
    }
  }

  const signOut = useCallback(async () => {
    try {
      await supabase!.auth.signOut({ scope: "local" });
    } catch (e) {
      logger.warn("signOut API call failed, proceeding with local clear");
    }
    setUser(null);
    setSchool(null);
    setIsDemo(false);
    setIsTrialExpired(false);
    clearDemoStorage();
    router.push("/login");
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
