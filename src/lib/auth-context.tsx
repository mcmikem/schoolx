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
import * as demoService from "./demo-service";

// Local extensions for Auth context if needed, otherwise use imported types.
// We keep the AuthContextType interfaces using the imported User/School.

interface AuthContextType {
  user: User | null;
  school: School | null;
  loading: boolean;
  isDemo: boolean;
  isAccessBlocked: boolean;
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
  const [isAccessBlocked, setIsAccessBlocked] = useState(false);
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
        let userData: any = null;
        let lastError: unknown = null;

        const profileByAuth = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", authId)
          .maybeSingle();

        userData = profileByAuth.data;
        lastError = profileByAuth.error;

        if (!userData) {
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
              lastError = fallbackProfile.error;
              continue;
            }

            if (fallbackProfile.data) {
              userData = fallbackProfile.data;
              lastError = null;

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
                  userData = { ...fallbackProfile.data, auth_id: authId };
                }
              }
              break;
            }
          }
        }

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
              setTimeout(resolve, 1000 * (retryCount + 1)),
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
        logger.error("Error fetching user data:", getErrorMessage(error));
        setLoading(false);
        return null;
      }
    },
    [],
  );

  const checkUser = useCallback(async () => {
    // Don't use timeout - only set loading false after actual check completes

    try {
      const demoData = demoService.getDemoData();

      if (demoData) {
        setUser(demoData.user);
        setSchool(demoData.school);
        setIsDemo(true);
        setIsTrialExpired(false);
        setLoading(false);
        return;
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
        const isCurrentlyDemo = demoService.isDemoSession();

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
      const attempts = buildAuthLoginAttempts(phone);
      let lastError: any = null;

      for (const attempt of attempts) {
        const { data, error } =
          attempt.type === "email"
            ? await supabase!.auth.signInWithPassword({
                email: attempt.value,
                password,
              })
            : await supabase!.auth.signInWithPassword({
                phone: attempt.value,
                password,
              });

        if (error) {
          lastError = error;
          continue;
        }

        if (!data.user) {
          lastError = { message: "No user returned from Supabase" };
          continue;
        }

        const userData: any = await fetchUserData(data.user.id);

        if (!userData) {
          await supabase!.auth.signOut();
          return {
            error: {
              message:
                "No user profile found. Please contact your school administrator.",
            },
          };
        }

        if (userData.is_active === false) {
          await supabase!.auth.signOut();
          return {
            error: {
              message:
                "Your account has been deactivated. Please contact your school administrator.",
            },
          };
        }

        return { error: null };
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
      const { data, error } = await supabase!.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: normalizedPhone,
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
        const blockedStatuses = ["expired", "suspended", "unpaid", "past_due"];
        if (blockedStatuses.includes(schoolData.subscription_status)) {
          setIsAccessBlocked(true);
        } else if (
          schoolData.subscription_status === "trial" &&
          schoolData.trial_ends_at
        ) {
          setIsAccessBlocked(new Date(schoolData.trial_ends_at) < new Date());
        } else {
          setIsAccessBlocked(false);
        }
      }
    } catch (error) {
      logger.error("Error refreshing school:", error);
    }
  }

  async function signOut() {
    // Clear demo data if present
    demoService.clearDemoData();

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
        isAccessBlocked,
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
