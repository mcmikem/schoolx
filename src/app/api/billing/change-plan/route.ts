import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, requireAuthenticatedUser, supabaseClientOptions } from "@/lib/api-utils";
import {
  BillingError,
  cancelScheduledChange,
  loadSchoolBillingContext,
  scheduleDowngrade,
} from "@/lib/billing/service";
import { PLANS_CONFIG, planLevel, type PlanKey } from "@/lib/billing/config";
import { changePlanBodySchema } from "@/lib/billing/schemas";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/change-plan/
 * Body: { action: "schedule-downgrade" | "cancel-scheduled", plan? }
 *
 * Downgrades never cut an already-paid period short — they land at
 * next_payment_date (the day the school would renew). Super admins may act
 * on any school via body.schoolId.
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) return apiError("Server configuration error", 500);
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const admin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      supabaseClientOptions({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );

    const { data: profile } = await admin
      .from("users")
      .select("id, role, school_id")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile?.school_id) return apiError("No school associated with this account", 403);
    if (!["school_admin", "admin", "headmaster", "super_admin"].includes(profile.role)) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = changePlanBodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const data = parsed.data;
    const schoolId = profile.role === "super_admin" && data.schoolId ? data.schoolId : profile.school_id;

    // Non-super-admins can only schedule on their own school and only read
    // their own scheduled state.
    const context = await loadSchoolBillingContext(admin, schoolId);

    if (data.action === "cancel-scheduled") {
      if (profile.role !== "super_admin" && profile.school_id !== schoolId) {
        return apiError("Forbidden", 403);
      }
      await cancelScheduledChange(admin, schoolId);
      return apiSuccess({ scheduledPlan: null }, "Scheduled plan change cancelled");
    }

    if (data.action === "schedule-downgrade") {
      if (profile.role !== "super_admin" && profile.school_id !== schoolId) {
        return apiError("Forbidden", 403);
      }

      const target = String(data.plan || "");
      if (!(target in PLANS_CONFIG)) return apiError("Invalid plan", 400);
      if (planLevel(target) >= planLevel(String(context.subscription_plan || ""))) {
        return apiError("Use a paid upgrade through Billing & Plans — downgrades must move to a lower plan", 400);
      }

      const result = await scheduleDowngrade(admin, schoolId, target as PlanKey);
      return apiSuccess(
        {
          scheduledPlan: target,
          effectiveAt: result.effectiveAt,
          context: { studentCount: context.student_count, sizeBand: context.school_size_band },
        },
        `Downgrade to ${target} scheduled`,
      );
    }

    if (data.action === "status") {
      return apiSuccess({
        scheduledPlan: (context as any).scheduled_plan ?? null,
        scheduledPlanChangeAt: (context as any).scheduled_plan_change_at ?? null,
      });
    }

    return apiError("Invalid action", 400);
  } catch (error) {
    if (error instanceof BillingError) return apiError(error.message, error.status);
    return handleApiError(error);
  }
}
