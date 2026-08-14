import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createMobileMoneyPaymentLink, verifyMobileMoneyPayment } from "@/lib/payments/mobile-money";
import { requireUserWithSchool, rateLimit, supabaseClientOptions } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeAuthPhone } from "@/lib/validation";
import { logger } from "@/lib/logger";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Server configuration error");
  }
  return createClient(url, key, supabaseClientOptions({ auth: { persistSession: false } }));
}

export async function POST(request: NextRequest) {
  try {
    const { success: rlOk } = rateLimit(request, 10, 600_000);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many payment requests. Try again later." }, { status: 429 });
    }

    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const user = auth.context.user as unknown as { id: string; role: string; school_id?: string | null };
    if (user.role !== "parent") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const action = body.action as string;
    const { childId, provider, phoneNumber, amount } = body as {
      childId?: string;
      provider?: "mtn" | "airtel";
      phoneNumber?: string;
      amount?: number;
    };

    if (!childId) {
      return NextResponse.json({ success: false, error: "Missing required field: childId" }, { status: 400 });
    }

    const { data: link } = await supabase
      .from("parent_students")
      .select("student_id, students(school_id)")
      .eq("parent_id", user.id)
      .eq("student_id", childId)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ success: false, error: "No linked child found for this account" }, { status: 403 });
    }

    const schoolId =
      (link.students as unknown as { school_id?: string | null } | null)?.school_id || user.school_id || null;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "School context required" }, { status: 403 });
    }

    if (action === "create") {
      if (!provider || !phoneNumber) {
        return NextResponse.json(
          { success: false, error: "Missing required fields: provider, phoneNumber" },
          { status: 400 },
        );
      }
      if (provider !== "mtn" && provider !== "airtel") {
        return NextResponse.json(
          { success: false, error: 'Invalid provider. Use "mtn" or "airtel".' },
          { status: 400 },
        );
      }
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 20_000_000) {
        return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
      }
      const normalizedPhone = normalizeAuthPhone(phoneNumber);
      if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith("256")) {
        return NextResponse.json(
          { success: false, error: "Invalid phone number format. Use a valid Ugandan number." },
          { status: 400 },
        );
      }

      const payment = await createMobileMoneyPaymentLink({
        provider,
        amount: parsedAmount,
        phone: normalizedPhone,
        email: auth.context.user.email || "pay@omuto.org",
        name: "School Fee Payment",
        schoolId,
        plan: "FEE",
        returnUrl: `${BASE_URL}/parent-portal/fees?payments=true&reference={reference}`,
      });

      return NextResponse.json(
        {
          success: true,
          txRef: payment.txRef,
          link: payment.link,
          amount: parsedAmount,
          provider: provider.toUpperCase(),
          instructions:
            provider === "mtn"
              ? "A payment request has been sent to your phone. Check for the MTN MoMo prompt and enter your PIN to confirm."
              : "A payment request has been sent to your phone. Check for the Airtel Money prompt and enter your PIN to confirm.",
        },
        { status: 200 },
      );
    }

    if (action === "verify") {
      const reference = body.reference as string | undefined;
      if (!reference) {
        return NextResponse.json({ success: false, error: "Missing reference" }, { status: 400 });
      }

      const status = await verifyMobileMoneyPayment(reference, provider);
      if (status.status === "completed") {
        const admin = serviceRoleClient();
        const { data: existing } = await admin
          .from("fee_payments")
          .select("id")
          .eq("payment_reference", reference)
          .maybeSingle();

        if (!existing) {
          const paidAmount = Number(status.amount || amount || 0);
          const { error: insertErr } = await admin.from("fee_payments").insert({
            student_id: childId,
            school_id: schoolId,
            amount: paidAmount,
            amount_paid: paidAmount,
            payment_date: new Date().toISOString(),
            payment_method: provider === "airtel" ? "Airtel Money" : "MTN MoMo",
            payment_reference: reference,
            transaction_reference: reference,
            deleted_at: null,
          });

          if (insertErr) {
            logger.error("[parent/fee-payment] Failed to record payment:", insertErr);
            return NextResponse.json(
              { success: false, error: "Payment was successful but recording failed." },
              { status: 500 },
            );
          }
        }

        return NextResponse.json(
          { success: true, status: "completed", amount: Number(status.amount || amount || 0) },
          { status: 200 },
        );
      }

      return NextResponse.json({ success: false, status: status.status, message: status.message }, { status: 202 });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logger.error("[parent/fee-payment] error:", error);
    const message = error instanceof Error ? error.message : "";
    const isConfigError = message.includes("not yet configured") || message.includes("environment variables");
    return NextResponse.json(
      {
        success: false,
        error: isConfigError
          ? "Online mobile money is not configured for your school yet. You can pay at the school office."
          : "Failed to process payment. Please try again or pay at the school office.",
        configError: isConfigError,
      },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
