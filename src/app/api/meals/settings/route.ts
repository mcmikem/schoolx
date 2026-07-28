import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError, requireUserWithSchool } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const ADMIN_ROLES = new Set(["school_admin", "admin", "headmaster", "super_admin"]);
const VALID_MEALS = new Set(["breakfast", "lunch", "supper"]);
const VALID_ELIGIBILITY = new Set(["all", "boarding_only"]);

interface MealRuleInput {
  meal_type: "breakfast" | "lunch" | "supper";
  is_enabled: boolean;
  eligibility: "all" | "boarding_only";
  start_time?: string | null;
  end_time?: string | null;
  max_servings_per_day?: number;
}

interface MealRuleUpsert extends MealRuleInput {
  school_id: string;
}

function defaultRules(schoolId: string): MealRuleUpsert[] {
  const rules: MealRuleInput[] = [
    {
      meal_type: "breakfast",
      is_enabled: false,
      eligibility: "boarding_only",
      max_servings_per_day: 1,
    },
    {
      meal_type: "lunch",
      is_enabled: true,
      eligibility: "all",
      max_servings_per_day: 1,
    },
    {
      meal_type: "supper",
      is_enabled: false,
      eligibility: "boarding_only",
      max_servings_per_day: 1,
    },
  ];

  return rules.map((rule) => ({ ...rule, school_id: schoolId }));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!auth.context.schoolId) {
      return apiError("School context required", 403);
    }

    const supabase = await createSupabaseServerClient();

    let { data, error } = await supabase
      .from("meal_service_rules")
      .select("id, meal_type, is_enabled, eligibility, start_time, end_time, max_servings_per_day")
      .eq("school_id", auth.context.schoolId)
      .order("meal_type", { ascending: true });

    if (error) {
      logger.error("Failed to load meal settings:", error);
      return apiError(error.message, 500);
    }

    if (!data || data.length === 0) {
      const seeded = defaultRules(auth.context.schoolId);
      const { data: seededData, error: seedError } = await supabase
        .from("meal_service_rules")
        .upsert(
          seeded.map((rule) => ({
            school_id: auth.context.schoolId,
            meal_type: rule.meal_type,
            is_enabled: rule.is_enabled,
            eligibility: rule.eligibility,
            max_servings_per_day: rule.max_servings_per_day,
          })),
          { onConflict: "school_id,meal_type" },
        )
        .select("id, meal_type, is_enabled, eligibility, start_time, end_time, max_servings_per_day")
        .order("meal_type", { ascending: true });

      if (seedError) {
        logger.error("Failed to initialize meal settings:", seedError);
        return apiError(seedError.message, 500);
      }
      data = seededData || [];
    }

    return apiSuccess({ rules: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!auth.context.schoolId) {
      return apiError("School context required", 403);
    }

    if (!ADMIN_ROLES.has(auth.context.user.role)) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const rules = Array.isArray(body?.rules) ? body.rules : [];

    if (rules.length === 0) {
      return apiError("Rules are required", 400);
    }

    const sanitized = [] as Array<Record<string, unknown>>;

    for (const raw of rules as MealRuleInput[]) {
      const meal_type = String(raw.meal_type || "").toLowerCase();
      const eligibility = String(raw.eligibility || "").toLowerCase();
      const is_enabled = Boolean(raw.is_enabled);
      const max_servings_per_day = Number(raw.max_servings_per_day || 1);

      if (!VALID_MEALS.has(meal_type)) {
        return apiError(`Invalid meal type: ${meal_type}`, 400);
      }

      if (!VALID_ELIGIBILITY.has(eligibility)) {
        return apiError(`Invalid eligibility: ${eligibility}`, 400);
      }

      sanitized.push({
        school_id: auth.context.schoolId,
        meal_type,
        is_enabled,
        eligibility,
        start_time: raw.start_time || null,
        end_time: raw.end_time || null,
        max_servings_per_day: Number.isFinite(max_servings_per_day)
          ? Math.max(1, Math.min(3, max_servings_per_day))
          : 1,
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("meal_service_rules")
      .upsert(sanitized, { onConflict: "school_id,meal_type" })
      .select("id, meal_type, is_enabled, eligibility, start_time, end_time, max_servings_per_day")
      .order("meal_type", { ascending: true });

    if (error) {
      logger.error("Failed to save meal settings:", error);
      return apiError(error.message, 500);
    }

    return apiSuccess({ rules: data || [] }, "Meal settings updated");
  } catch (error) {
    return handleApiError(error);
  }
}
