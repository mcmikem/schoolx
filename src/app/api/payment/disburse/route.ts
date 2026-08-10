import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserWithSchool, rateLimit } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { errorWithWhatsApp } from "@/lib/support-contact";

const BILLING_ROLES = ["school_admin", "admin", "headmaster", "bursar"];

export async function POST(request: NextRequest) {
  try {
    const { success: rlOk } = rateLimit(request, 5, 60000);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!BILLING_ROLES.includes(auth.context.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    if (process.env.ENABLE_MOMO_DISBURSEMENTS !== "true") {
      return errorWithWhatsApp(
        "Mobile money disbursements are not yet available. Contact support or use manual bank transfer.",
        503,
      );
    }

    // Disbursements require the MoMo/FWP disbursement SDK, which is not yet wired.
    // Never claim success without actually moving money.
    logger.error("MOMO disbursements are enabled but the disbursement SDK is not implemented.");
    return errorWithWhatsApp(
      "Mobile money disbursements are not yet available. Contact support or use manual bank transfer.",
      503,
    );
  } catch (error) {
    logger.error("Disbursement error:", error);
    return errorWithWhatsApp("Failed to process disbursement. Contact support.", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");

    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("momo_disbursements")
      .select("*")
      .eq("school_id", auth.context.schoolId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: disbursements, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, disbursements });
  } catch (error) {
    return errorWithWhatsApp("Failed to fetch disbursements. Contact support.", 500);
  }
}
