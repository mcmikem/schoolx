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

const ALL_VALID_ROLES: string[] = [
  "super_admin",
  "school_admin",
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "student",
  "parent",
  "secretary",
  "dorm_master",
];

const DEMO_ALLOWED_ROLES: string[] = [
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "admin",
  "school_admin",
  "super_admin",
];

function sanitizeDemoRole(raw: unknown): User["role"] {
  if (typeof raw === "string" && DEMO_ALLOWED_ROLES.includes(raw)) {
    return raw as User["role"];
  }
  // Default to headmaster — admins and school_admins should get full access
  if (typeof raw === "string" && (raw === "admin" || raw === "school_admin")) {
    return "headmaster";
  }
  // Default to headmaster for any other role
  return "headmaster";
}

const DEMO_KEY = "omuto_demo_v1";

function encryptDemoData(data: string): string {
  if (typeof window === "undefined") return data;
  try {
    const encoded = btoa(data);
    return encoded;
  } catch {
    return data;
  }
}

function decryptDemoData(encrypted: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return atob(encrypted);
  } catch {
    return null;
  }
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

  const fetchUserData = useCallback(async (authId: string, retryCount = 0) => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", authId)
        .maybeSingle();

      if (userError) {
        console.error("Error fetching user:", userError);
        setLoading(false);
        return;
      }

      if (!userData) {
        if (retryCount < 3) {
          console.log(
            `[Auth] User profile not found for auth_id: ${authId}. Retrying...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (retryCount + 1)),
          );
          return fetchUserData(authId, retryCount + 1);
        }
        console.error(
          "No user profile found for auth_id after retries:",
          authId,
        );
        setLoading(false);
        return;
      }

      setUser({
        ...userData,
        role: userData.role as User["role"],
      });

      // Super admins don't have a school - they manage all schools
      if (userData.role === "super_admin") {
        setSchool(null);
        setLoading(false);
        return;
      }

      if (userData.school_id) {
        const { data: schoolData, error: schoolError } = await supabase
          .from("schools")
          .select("*")
          .eq("id", userData.school_id)
          .single();

        if (schoolError) {
          console.error("Error fetching school profile:", schoolError);
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
            setIsTrialExpired(new Date(schoolData.trial_ends_at) < new Date());
          } else if (schoolData.subscription_status === "expired") {
            setIsTrialExpired(true);
          } else {
            setIsTrialExpired(false);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setLoading(false);
    }
  }, []);

  const checkUser = useCallback(async () => {
    console.debug("[Auth] checkUser called");

    // Safety timeout - always set loading to false after 5 seconds
    const timeoutId = setTimeout(() => {
      console.log("[Auth] Safety timeout reached, forcing loading=false");
      setLoading(false);
    }, 5000);

    try {
      const demoUserStr = localStorage.getItem(DEMO_KEY);
      console.debug("[Auth] demoUserStr:", !!demoUserStr);

      if (demoUserStr) {
        try {
          const decrypted = decryptDemoData(demoUserStr);
          if (decrypted) {
            const { demoUser, demoSchool } = JSON.parse(decrypted);
            console.debug("[Auth] Demo user loaded:", demoUser.name);

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
              subscription_plan: demoSchool.subscription_plan || "premium",
              subscription_status: demoSchool.subscription_status || "active",
              feature_stage:
                (demoSchool.feature_stage as FeatureStage) || "full",
              created_at: new Date().toISOString(),
            });
            setIsDemo(true);
            setIsTrialExpired(false);
            clearTimeout(timeoutId);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("[Auth] Error parsing demo data:", e);
          localStorage.removeItem(DEMO_KEY);
        }
      }

      // Check for real auth session
      console.debug("[Auth] No demo data, checking supabase auth");
      if (supabase?.auth) {
        try {
          const {
            data: { session },
          } = await supabase!.auth.getSession();
          console.debug("[Auth] Session:", !!session);
          if (session && session.user) {
            await fetchUserData(session.user.id);
            setIsDemo(false);
            setLoading(false);
          } else {
            setIsDemo(false);
            console.debug("[Auth] No session, setting loading=false");
            setLoading(false);
          }
        } catch (sessionError) {
          console.error("[Auth] Session error:", sessionError);
          setIsDemo(false);
          setLoading(false);
        }
        clearTimeout(timeoutId);
        setLoading(false);
      } else {
        console.debug("[Auth] No supabase, setting loading=false");
        setIsDemo(false);
        clearTimeout(timeoutId);
        setLoading(false);
      }
    } catch (error) {
      console.error("[Auth] Error:", error);
      setIsDemo(false);
      clearTimeout(timeoutId);
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
        const DEMO_KEY = "omuto_demo_v1";
        const isCurrentlyDemo = localStorage.getItem(DEMO_KEY) !== null;

        if (isCurrentlyDemo && event !== "SIGNED_OUT") return;

        if (event === "SIGNED_IN" && session && session.user) {
          await fetchUserData(session.user.id);
          setIsDemo(false);
          setLoading(false);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setSchool(null);
          setIsDemo(false);
          setIsTrialExpired(false);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [checkUser, fetchUserData]);

  async function signIn(phone: string, password: string) {
    try {
      const email = `${phone}@omuto.sms`;
      const { data, error } = await supabase!.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };
      if (!data.user)
        return { error: { message: "No user returned from Supabase" } };

      // fetchUserData populates the user state including role — no second query needed
      await fetchUserData(data.user.id);

      // Read role directly from the state that fetchUserData just set.
      // We use a local ref pattern: access users table once via fetchUserData above.
      // To route correctly, we do a lightweight role-only query using the already-fetched session.
      let userRole: string = "school_admin";
      if (supabase) {
        const { data: roleRow } = await supabase
          .from("users")
          .select("role")
          .eq("auth_id", data.user.id)
          .maybeSingle();
        userRole = roleRow?.role ?? "school_admin";
      }

      if (userRole === "super_admin") {
        router.push("/super-admin");
      } else if (userRole === "school_admin") {
        router.push("/dashboard/schools");
      } else {
        router.push("/dashboard");
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  async function signUp(phone: string, password: string, name: string) {
    try {
      const email = `${phone}@omuto.sms`;
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
      console.error("Error refreshing school:", error);
    }
  }

  async function signOut() {
    // Clear demo data if present
    const DEMO_KEY = "omuto_demo_v1";
    localStorage.removeItem(DEMO_KEY);

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
