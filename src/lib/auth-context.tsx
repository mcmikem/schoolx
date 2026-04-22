"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "./supabase";
import { useRouter } from "next/navigation";
import { normalizePlanType, PlanType } from "./payments/subscription-client";
import { FeatureStage, DEFAULT_FEATURE_STAGE } from "./featureStages";
import type { User, School } from "@/types";
import { logger } from "./logger";
import { getErrorMessage, normalizeAuthPhone } from "./validation";
import { buildAuthEmailFromPhone, buildAuthLoginAttempts } from "./auth-login";
import {
  isSupabaseLockAbortError,
  withSupabaseLockRetry,
} from "./supabase-lock";

// Roles that demo sessions are allowed to assume.
// super_admin / school_admin are intentionally excluded to prevent privilege injection.
export type UserRoleValue =
  | "headmaster"
  | "dean_of_studies"
  | "bursar"
  | "teacher"
  | "student"
  | "parent"
  | "secretary"
  | "dorm_master"
  | "admin"
  | "school_admin"
  | "board"
  | "super_admin";

// Demo sessions must never be able to assume elevated roles.
const DEMO_ALLOWED_ROLES: string[] = [
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
];

function sanitizeDemoRole(raw: unknown): User["role"] {
  if (typeof raw === "string" && DEMO_ALLOWED_ROLES.includes(raw)) {
    return raw as User["role"];
  }
  // Default to lowest-privilege role for unknown/invalid input
  return "teacher";
}

const DEMO_KEY = "skoolmate_demo_v1";
const OFFLINE_USER_KEY = "skoolmate_offline_user_v1";
const OFFLINE_SCHOOL_KEY = "skoolmate_offline_school_v1";
const DEMO_MODE_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

function buildPhoneLookupCandidates(rawPhone: unknown): string[] {
  if (typeof rawPhone !== "string" || !rawPhone.trim()) return [];

  const normalized = normalizeAuthPhone(rawPhone);
  const digits = normalized.replace(/\D/g, "");
  const candidates = new Set<string>();

  if (normalized) candidates.add(normalized);
  if (digits.length === 9) {
    candidates.add(`0${digits}`);
    candidates.add(`256${digits}`);
  }
  if (digits.startsWith("0") && digits.length === 10) {
    candidates.add(`256${digits.slice(1)}`);
  }
  if (digits.startsWith("256") && digits.length === 12) {
    candidates.add(`0${digits.slice(3)}`);
  }

  return Array.from(candidates);
}

function decryptDemoData(encrypted: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return atob(encrypted);
  } catch {
    return null;
  }
}

function readDemoStorage(): string | null {
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

function clearDemoStorage() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(DEMO_KEY);
  document.cookie = `${DEMO_KEY}=; Max-Age=0; path=/`;
  document.cookie = `${DEMO_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// Local extensions for Auth context if needed, otherwise use imported types.
// We keep the AuthContextType interfaces using the imported User/School.

interface AuthContextType {
  user: User | null;
  school: School | null;
  loading: boolean;
  isDemo: boolean;
  isTrialExpired: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: any; role?: string }>;
  signUp: (
    phone: string,
    password: string,
    name: string,
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshSchool: () => Promise<void>;
  // Subscription status checking methods
  isSubscriptionActive: () => boolean;
  getSubscriptionPlan: () => PlanType | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const router = useRouter();

  // Subscription status checking methods
  const isSubscriptionActive = () => {
    if (school?.subscription_status === "trial" && school?.trial_ends_at) {
      return new Date(school.trial_ends_at) > new Date();
    }
    return school?.subscription_status === "active";
  };

  const getSubscriptionPlan = () => {
    return school?.subscription_plan
      ? (normalizePlanType(school.subscription_plan) as PlanType)
      : null;
  };

  const fetchUserData = useCallback(
    async (
      authId: string,
      retryCount = 0,
    ): Promise<{ role: string } | null> => {
      if (!supabase) {
        setLoading(false);
        return null;
      }
      try {
        const { userData, lastError } = await withSupabaseLockRetry(
          async () => {
            let resolvedUserData: any = null;
            let resolvedLastError: unknown = null;

            const profileByAuth = await supabase
              .from("users")
              .select("*")
              .eq("auth_id", authId)
              .maybeSingle();

            resolvedUserData = profileByAuth.data;
            resolvedLastError = profileByAuth.error;

            if (!resolvedUserData) {
              const authResult = await supabase.auth.getUser();
              const authUser = authResult.data.user;

              const phoneCandidates = buildPhoneLookupCandidates(
                authUser?.phone ?? authUser?.user_metadata?.phone,
              );

              for (const phoneCandidate of phoneCandidates) {
                const fallbackProfile = await supabase
                  .from("users")
                  .select("*")
                  .eq("phone", phoneCandidate)
                  .maybeSingle();

                if (fallbackProfile.error) {
                  resolvedLastError = fallbackProfile.error;
                  continue;
                }

                if (fallbackProfile.data) {
                  resolvedUserData = fallbackProfile.data;
                  resolvedLastError = null;

                  if (fallbackProfile.data.auth_id !== authId) {
                    const { error: relinkError } = await supabase
                      .from("users")
                      .update({ auth_id: authId })
                      .eq("id", fallbackProfile.data.id);

                    if (relinkError) {
                      logger.warn(
                        "[Auth] Profile found but auth_id relink failed:",
                        getErrorMessage(relinkError),
                      );
                    } else {
                      resolvedUserData = {
                        ...fallbackProfile.data,
                        auth_id: authId,
                      };
                    }
                  }
                  break;
                }
              }
            }

            return {
              userData: resolvedUserData,
              lastError: resolvedLastError,
            };
          },
        );

        if (!userData) {
          if (lastError) {
            logger.warn(
              "[Auth] Unable to load user profile:",
              getErrorMessage(lastError),
            );
          }

          if (retryCount < 3) {
            logger.warn(
              `[Auth] User profile not found for auth_id: ${authId}. Retrying...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 300 * (retryCount + 1)),
            );
            return fetchUserData(authId, retryCount + 1);
          }
          logger.warn(
            "No user profile found for auth_id after retries:",
            authId,
          );
          setLoading(false);
          return null;
        }

        setUser({
          ...userData,
          role: userData.role as User["role"],
        });
        // Persist for offline use
        try { localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify({ ...userData, role: userData.role as User["role"] })); } catch {}

        // Super admins don't have a school - they manage all schools
        if (userData.role === "super_admin") {
          setSchool(null);
          setLoading(false);
          return { role: userData.role };
        }

        if (userData.school_id) {
          const { data: schoolData, error: schoolError } =
            await withSupabaseLockRetry(async () =>
              await supabase
                .from("schools")
                .select("*")
                .eq("id", userData.school_id)
                .single(),
            );

          if (schoolError) {
            logger.error("Error fetching school profile:", schoolError);
          }

          if (schoolData) {
            const schoolObj = {
              ...schoolData,
              feature_stage:
                (schoolData.feature_stage as FeatureStage) ||
                DEFAULT_FEATURE_STAGE,
            };
            setSchool(schoolObj);
            // Persist for offline use
            try { localStorage.setItem(OFFLINE_SCHOOL_KEY, JSON.stringify(schoolObj)); } catch {}
            if (
              schoolData.subscription_status === "trial" &&
              schoolData.trial_ends_at
            ) {
              setIsTrialExpired(
                new Date(schoolData.trial_ends_at) < new Date(),
              );
            } else if (schoolData.subscription_status === "expired") {
              setIsTrialExpired(true);
            } else {
              setIsTrialExpired(false);
            }
          }
        }

        setLoading(false);
        return { role: userData.role };
      } catch (error) {
        if (isSupabaseLockAbortError(error) && retryCount < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 300 * (retryCount + 1)),
          );
          return fetchUserData(authId, retryCount + 1);
        }

        logger.error("Error fetching user data:", getErrorMessage(error));
        setLoading(false);
        return null;
      }
    },
    [],
  );

  const checkUser = useCallback(async () => {
    // Safety timeout: never stay in loading state for more than 2.5 seconds
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

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
            return;
          }
        } catch (e) {
          logger.error("[Auth] Error parsing demo data:", e);
          clearDemoStorage();
        }
      }

      // Check for real auth session
      if (supabase?.auth) {
        try {
          // Fast path: getSession() reads from localStorage — no network call.
          // If null, there are no tokens stored and the user is definitely not
          // logged in. Skip the getUser() server round-trip entirely.
          const { data: { session } } = await supabase!.auth.getSession();
          if (!session) {
            setUser(null);
            setSchool(null);
            setIsDemo(false);
            setLoading(false);
            return;
          }

          // Offline path: if no connectivity, restore from localStorage cache
          if (!navigator.onLine) {
            try {
              const cachedUser = localStorage.getItem(OFFLINE_USER_KEY);
              const cachedSchool = localStorage.getItem(OFFLINE_SCHOOL_KEY);
              if (cachedUser) {
                setUser(JSON.parse(cachedUser) as User);
                setSchool(cachedSchool ? JSON.parse(cachedSchool) : null);
                setIsDemo(false);
                setLoading(false);
                return;
              }
            } catch {}
          }

          // Session tokens exist locally — validate with the server.
          const {
            data: { user: authUser },
          } = await withSupabaseLockRetry(
            async () => await supabase!.auth.getUser(),
          );
          if (authUser) {
            await fetchUserData(authUser.id);
            setIsDemo(false);
            setLoading(false);
          } else {
            // Token was invalid / revoked
            setUser(null);
            setSchool(null);
            setIsDemo(false);
            setLoading(false);
          }
        } catch (sessionError) {
          // On session error, still clear user to prevent stuck state
          setUser(null);
          setSchool(null);
          setIsDemo(false);
          setLoading(false);
        }
        setLoading(false);
      } else {
        setIsDemo(false);
        setLoading(false);
      }
    } catch (error) {
      setIsDemo(false);
      setLoading(false);
    } finally {
      clearTimeout(safetyTimer);
    }
  }, [fetchUserData]);

  useEffect(() => {
    // Only run on mount
    checkUser();

    if (supabase) {
      const {
        data: { subscription },
      } = supabase!.auth.onAuthStateChange(async (event, session) => {
        try {
          // If we are in demo mode, auth state changes should be ignored
          // unless it's a sign out that clears the demo.
          // Note: we don't depend on isDemo here to avoid re-running the effect
          const isCurrentlyDemo = readDemoStorage() !== null;

          if (isCurrentlyDemo && event !== "SIGNED_OUT") return;

          if (
            (event === "SIGNED_IN" ||
              event === "INITIAL_SESSION" ||
              event === "TOKEN_REFRESHED")
          ) {
            // Mark loading before async work so any route guard (e.g. DashboardRouter)
            // that renders concurrently sees loading=true instead of loading=false+user=null.
            if (session) setLoading(true);
            const {
              data: { user: verifiedUser },
            } = await withSupabaseLockRetry(async () =>
              await supabase!.auth.getUser(),
            );

            if (verifiedUser) {
              await fetchUserData(verifiedUser.id);
              setIsDemo(false);
              setLoading(false);
            } else if (event === "INITIAL_SESSION" && !session) {
              setUser(null);
              setSchool(null);
              setIsDemo(false);
              setLoading(false);
            }
          } else if (event === "SIGNED_OUT") {
            setUser(null);
            setSchool(null);
            setIsDemo(false);
            setIsTrialExpired(false);
            setLoading(false);
            try { localStorage.removeItem(OFFLINE_USER_KEY); localStorage.removeItem(OFFLINE_SCHOOL_KEY); } catch {}
          }
        } catch (error) {
          if (!isSupabaseLockAbortError(error)) {
            logger.error(
              "[Auth] Auth state change handler failed:",
              getErrorMessage(error),
            );
          }
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [checkUser, fetchUserData]);

  // Refresh session when tab regains focus (catches expired tokens after backgrounding)
  useEffect(() => {
    if (!supabase) return;
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        try {
          const { data: { user: freshUser } } = await supabase!.auth.getUser();
          if (!freshUser && user) {
            // Session expired while tab was backgrounded
            setUser(null);
            setSchool(null);
            setLoading(false);
            router.push("/login");
          }
        } catch {
          // Silently ignore — network offline etc.
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, router]);

  async function signIn(phone: string, password: string) {
    try {
      const attempts = buildAuthLoginAttempts(phone);
      let lastError: any = null;

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

        const userData = await fetchUserData(data.user.id);

        if (!userData) {
          await supabase!.auth.signOut();
          return {
            error: {
              message:
                "No user profile found. Please contact your school administrator.",
            },
          };
        }

        // Background preload of critical tables for offline use — fire and forget
        import("@/lib/offline").then(({ offlineDB }) => {
          offlineDB.refreshAll([
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
          ]).catch(() => {});
        }).catch(() => {});

        return { error: null, role: userData.role };
      }

      return {
        error: lastError || { message: "Invalid phone number or password" },
      };
    } catch (error) {
      return { error };
    }
  }

  async function signUp(phone: string, password: string, name: string) {
    try {
      const normalizedPhone = normalizeAuthPhone(phone);
      const email = buildAuthEmailFromPhone(normalizedPhone);
      const { data, error } = await withSupabaseLockRetry(async () =>
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
        if (
          schoolData.subscription_status === "trial" &&
          schoolData.trial_ends_at
        ) {
          setIsTrialExpired(new Date(schoolData.trial_ends_at) < new Date());
        } else if (schoolData.subscription_status === "expired") {
          setIsTrialExpired(true);
        } else {
          setIsTrialExpired(false);
        }
      }
    } catch (error) {
      logger.error("Error refreshing school:", error);
    }
  }

  async function signOut() {
    // Clear all local state first (before async call) to prevent stale access
    setUser(null);
    setSchool(null);
    setIsDemo(false);
    setIsTrialExpired(false);
    clearDemoStorage();

    try {
      // Sign out from all sessions (scope: global) to invalidate tokens
      await supabase!.auth.signOut({ scope: "global" });
    } catch (e) {
      // State already cleared above, so user is effectively logged out locally
      logger.warn("signOut API call failed, local state already cleared");
    }
    router.push("/login");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        school,
        loading,
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
