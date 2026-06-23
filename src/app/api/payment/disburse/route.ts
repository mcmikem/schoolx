import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserWithSchool, rateLimit } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { errorWithWhatsApp } from "@/lib/support-contact";

const BILLING_ROLES = ["school_admin", "admin", "headmaster", "bursar"];

interface DisbursementRequest {
  student_id: string;
  parent_phone: string;
  provider: "mtn" | "airtel";
  amount: number;
  reason?: string;
}

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

    const body: DisbursementRequest = await request.json();
    const { student_id, parent_phone, provider, amount, reason } = body;

    if (!student_id || !parent_phone || !provider || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (amount < 1000) {
      return NextResponse.json({ error: "Minimum disbursement is UGX 1,000" }, { status: 400 });
    }

    if (amount > 2000000) {
      return NextResponse.json({ error: "Maximum disbursement is UGX 2,000,000" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Create disbursement record
    const reference = `DSP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { data: disbursement, error: insertError } = await supabase
      .from("momo_disbursements")
      .insert({
        school_id: auth.context.schoolId,
        student_id,
        parent_phone,
        provider,
        amount,
        reference,
        status: "pending",
        created_by: auth.context.user.id,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Disbursement insert error:", insertError);
      return NextResponse.json({ error: "Failed to create disbursement" }, { status: 500 });
    }

    logger.info(`Disbursement record created: ${reference} — pending actual MOMO API call (integration not yet wired)`);

    // MOMO API integration placeholder — uncomment when Flutterwave/MOMO SDK is set up:
    // const momoResult = await momoDisbursement({ phone: parent_phone, amount, provider, reference });

    return NextResponse.json({
      success: true,
      disbursement: {
        id: disbursement.id,
        reference: disbursement.reference,
        status: "pending",
        amount,
        provider,
        phone: parent_phone,
      },
      message: "Disbursement initiated successfully",
    });
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