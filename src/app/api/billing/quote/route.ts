import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, requireAuthenticatedUser, supabaseClientOptions } from "@/lib/api-utils";
import { BillingError, buildQuote, type QuoteParams } from "@/lib/billing/service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/quote/
 * Body: { action: "renew" | "upgrade" | "module", plan?, cycle?, moduleKeys?, promoCode? }
 * → exact money math (promo codes included) before any money moves.
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
    const action = body.action;
    if (!["renew", "upgrade", "module"].includes(action)) {
      return apiError("Invalid quote action", 400);
    }

    const params: QuoteParams = {
      schoolId: profile.school_id,
      action,
      plan: body.plan,
      cycle: body.cycle === "annual" ? "annual" : "term",
      moduleKeys: Array.isArray(body.moduleKeys) ? body.moduleKeys : undefined,
      promoCode: body.promoCode ?? null,
    };

    const built = await buildQuote(admin, params);

    return apiSuccess({
      ...built.quote,
      intent: built.intent,
      context: {
        schoolName: built.context.name,
        studentCount: built.context.student_count,
        billingMode: built.context.billing_mode,
        sizeBand: built.context.school_size_band,
      },
    });
  } catch (error) {
    if (error instanceof BillingError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
