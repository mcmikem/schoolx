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
import { PlanType } from "./payments/subscription-client";
import { FeatureStage, DEFAULT_FEATURE_STAGE } from "./featureStages";
import type { User, School } from "@/types";
import { logger } from "./logger";

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
  // Default to headmaster for any other/unknown role
  return "headmaster";
}

const DEMO_KEY = "skoolmate_demo_v1";
const DEMO_MODE_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

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
}

// Local extensions for Auth context if needed, otherwise use imported types.
// We keep the AuthContextType interfaces using the imported User/School.

interface AuthContextType {
  user: User | null;
  school: School | null;
  loading: boolean;
  isDemo: boolean;
  isTrialExpired: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: any }>;
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
    return school?.subscription_plan as PlanType | null;
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
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", authId)
          .maybeSingle();

        if (userError) {
          logger.error("Error fetching user:", userError);
          setLoading(false);
          return null;
        }

        if (!userData) {
          if (retryCount < 3) {
            logger.warn(
              `[Auth] User profile not found for auth_id: ${authId}. Retrying...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (retryCount + 1)),
            );
            return fetchUserData(authId, retryCount + 1);
          }
          logger.error(
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

        // Super admins don't have a school - they manage all schools
        if (userData.role === "super_admin") {
          setSchool(null);
          setLoading(false);
          return { role: userData.role };
        }

        if (userData.school_id) {
          const { data: schoolData, error: schoolError } = await supabase
            .from("schools")
            .select("*")
            .eq("id", userData.school_id)
            .single();

          if (schoolError) {
            logger.error("Error fetching school profile:", schoolError);
          }

          if (schoolData) {
            setSchool({
              ...schoolData,
              feature_stage:
                (schoolData.feature_stage as FeatureStage) ||
                DEFAULT_FEATURE_STAGE,
            });
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
        logger.error("Error fetching user data:", error);
        setLoading(false);
        return null;
      }
    },
    [],
  );

  const checkUser = useCallback(async () => {
    // Don't use timeout - only set loading false after actual check completes

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
          const {
            data: { session },
          } = await supabase!.auth.getSession();
          if (session && session.user) {
            await fetchUserData(session.user.id);
            setIsDemo(false);
            setLoading(false);
          } else {
            // No valid session - clear user and redirect
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
    }
  }, [fetchUserData]);

  useEffect(() => {
    // Only run on mount
    checkUser();

    if (supabase) {
      const {
        data: { subscription },
      } = supabase!.auth.onAuthStateChange(async (event, session) => {
        // If we are in demo mode, auth state changes should be ignored
        // unless it's a sign out that clears the demo.
        // Note: we don't depend on isDemo here to avoid re-running the effect
        const isCurrentlyDemo = readDemoStorage() !== null;

        if (isCurrentlyDemo && event !== "SIGNED_OUT") return;

        if (
          (event === "SIGNED_IN" ||
            event === "INITIAL_SESSION" ||
            event === "TOKEN_REFRESHED") &&
          session &&
          session.user
        ) {
          await fetchUserData(session.user.id);
          setIsDemo(false);
          setLoading(false);
        } else if (event === "INITIAL_SESSION" && !session) {
          // No session on initial load — clear state and stop loading
          setUser(null);
          setSchool(null);
          setIsDemo(false);
          setLoading(false);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setSchool(null);
          setIsDemo(false);
          setIsTrialExpired(false);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [checkUser, fetchUserData]);

  async function signIn(phone: string, password: string) {
    try {
      const email = `${phone}@omuto.org`;
      const { data, error } = await supabase!.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };
      if (!data.user)
        return { error: { message: "No user returned from Supabase" } };

      // fetchUserData populates user state AND returns the role — no second query needed
      const userData = await fetchUserData(data.user.id);

      if (!userData) {
        // Auth succeeded but no matching profile in the users table
        await supabase!.auth.signOut();
        return {
          error: {
            message:
              "No user profile found. Please contact your school administrator.",
          },
        };
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  async function signUp(phone: string, password: string, name: string) {
    try {
      const email = `${phone}@omuto.org`;
      const { data, error } = await supabase!.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: phone,
          },
        },
      });

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
    // Clear demo data if present
    clearDemoStorage();

    try {
      await supabase!.auth.signOut();
    } catch (e) {
      // Continue even if signOut fails
    }
    setUser(null);
    setSchool(null);
    setIsDemo(false);
    setIsTrialExpired(false);
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
