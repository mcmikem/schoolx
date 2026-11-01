import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, requireAuthenticatedUser, supabaseClientOptions } from "@/lib/api-utils";
import {
  BillingError,
  confirmManualPayment,
  rejectManualPayment,
  submitManualPayment,
  type QuoteParams,
} from "@/lib/billing/service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = "force-dynamic";

function makeAdmin() {
  return createClient(
    supabaseUrl,
    supabaseServiceKey,
    supabaseClientOptions({
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}

async function getProfile(admin: ReturnType<typeof makeAdmin>, authUserId: string) {
  const { data: profile } = await admin
    .from("users")
    .select("id, role, school_id")
    .eq("auth_id", authUserId)
    .maybeSingle();
  return profile;
}

async function isSuperAdmin(admin: ReturnType<typeof makeAdmin>, authUserId: string) {
  const profile = await getProfile(admin, authUserId);
  return profile?.role === "super_admin" ? profile : null;
}

/**
 * GET /api/billing/manual-payment/?scope=pending
 * Super admin lists manual payment submissions awaiting confirmation.
 */
export async function GET(request: NextRequest) {
  try {
    if (!supabaseServiceKey) return apiError("Server configuration error", 500);
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const admin = makeAdmin();
    const superAdmin = await isSuperAdmin(admin, auth.context.authUserId);
    if (!superAdmin) return apiError("Super admin only", 403);

    const scope = request.nextUrl.searchParams.get("scope") || "pending";
    let query = admin
      .from("subscription_payments")
      .select(
        "id, school_id, plan, amount, currency, provider, transaction_id, payment_status, phone_number, description, payment_method_detail, intent, created_at, schools(name, school_code)",
      )
      .in("provider", ["cash", "bank"]);

    if (scope === "pending") query = query.eq("payment_status", "pending");

    const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
    if (error) return apiError("Failed to load manual payments", 500);

    return apiSuccess({ submissions: data || [] });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/billing/manual-payment/
 * School (admin): submit a cash/bank payment for verification.
 *   Body: { method, reference, note?, action: "renew"|"upgrade"|"module",
 *           plan?, cycle?, moduleKeys?, promoCode? }
 * Super admin: confirm or reject a submission.
 *   Body: { paymentId, decision: "confirm" | "reject", reason? }
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) return apiError("Server configuration error", 500);
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const admin = makeAdmin();

    // ── Super admin decision path ───────────────────────────────────────────
    const body = await request.json();
    if (body.decision) {
      const superAdmin = await isSuperAdmin(admin, auth.context.authUserId);
      if (!superAdmin) return apiError("Super admin only", 403);
      if (!body.paymentId) return apiError("Missing paymentId", 400);

      if (body.decision === "confirm") {
        const result = await confirmManualPayment(admin, body.paymentId, auth.context.authUserId);
        return apiSuccess(result, "Payment confirmed and subscription activated");
      }
      if (body.decision === "reject") {
        await rejectManualPayment(admin, body.paymentId, auth.context.authUserId, body.reason || "");
        return apiSuccess({ rejected: true }, "Payment marked as failed");
      }
      return apiError("Invalid decision", 400);
    }

    // ── School submission path ──────────────────────────────────────────────
    const profile = await getProfile(admin, auth.context.authUserId);
    if (!profile?.school_id) return apiError("No school associated with this account", 403);
    if (!["school_admin", "admin", "headmaster", "super_admin"].includes(profile.role)) {
      return apiError("Forbidden", 403);
    }

    const method = body.method;
    if (!["cash", "bank"].includes(method)) return apiError("Method must be cash or bank", 400);
    if (!body.reference || String(body.reference).trim().length < 3) {
      return apiError("Enter the mobile money code, receipt number or bank reference", 400);
    }

    const quoteParams: QuoteParams = {
      schoolId: profile.school_id,
      action: body.action,
      plan: body.plan,
      cycle: body.cycle === "annual" ? "annual" : "term",
      moduleKeys: Array.isArray(body.moduleKeys) ? body.moduleKeys : undefined,
      promoCode: body.promoCode ?? null,
    };

    const result = await submitManualPayment(admin, {
      schoolId: profile.school_id,
      method,
      reference: String(body.reference),
      note: body.note,
      quoteParams,
      createdById: auth.context.authUserId,
    });

    return apiSuccess(
      {
        paymentId: (result.payment as any).id,
        reference: (result.payment as any).transaction_id,
        amount: (result.payment as any).amount,
        totalDue: 0, // kept for API stability, UI reads amount
        instructions: result.instructions,
      },
      "Payment submitted for confirmation",
    );
  } catch (error) {
    if (error instanceof BillingError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
