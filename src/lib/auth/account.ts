// Account actions extracted from auth-context.tsx: signUp + refreshSchool.
// Pure functions taking setters as params; no React state hooks.
import type { User, School } from "@/types";
import { buildAuthEmailFromPhone } from "../auth-login";
import { computeTrialExpired } from "../auth-context-types";
import { DEFAULT_FEATURE_STAGE, type FeatureStage } from "../featureStages";
import { logger } from "../logger";
import { supabase } from "../supabase";
import { withSupabaseLockRetry } from "../supabase-lock";

export async function doSignUp(phone: string, password: string, name: string) {
  try {
    const normalizedPhone = phone;
    const email = buildAuthEmailFromPhone(normalizedPhone);
    const { data, error } = await withSupabaseLockRetry(
      async () =>
        await supabase!.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, phone: normalizedPhone },
          },
        }),
    );
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function doRefreshSchool(params: {
  user: User | null;
  setSchool: (s: School) => void;
  setIsTrialExpired: (v: boolean) => void;
}) {
  const { user, setSchool, setIsTrialExpired } = params;
  if (!user?.school_id || !supabase) return;
  try {
    const { data: schoolData } = await supabase.from("schools").select("*").eq("id", user.school_id).single();
    if (schoolData) {
      setSchool({
        ...schoolData,
        is_tester: Boolean(schoolData.is_tester),
        feature_stage: (schoolData.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE,
      });
      setIsTrialExpired(computeTrialExpired(schoolData, user?.role));
    }
  } catch (error) {
    logger.error("Error refreshing school:", error);
  }
}

export async function doRefreshSchoolFromAPI(params: {
  user: User | null;
  setSchool: (s: School) => void;
  setIsTrialExpired: (v: boolean) => void;
}) {
  const { user, setSchool, setIsTrialExpired } = params;
  try {
    const { data: sessionData } = await supabase!.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/auth/me/", { headers: { Authorization: `Bearer ${token}` } });
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
