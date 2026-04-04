import { NextRequest, NextResponse } from "next/server";
import { getSchoolPaymentHistory } from "@/lib/payments/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoicePayment = {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  provider: string;
  payment_status: string;
  transaction_id: string | null;
  invoice_url: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("school_id")
      .eq("auth_id", user.id)
      .single();

    if (!userData?.school_id) {
      return NextResponse.json(
        { error: "School not found for user" },
        { status: 404 },
      );
    }

    const payments = ((await getSchoolPaymentHistory(
      userData.school_id,
      limit,
    )) ?? []) as InvoicePayment[];

    return NextResponse.json(
      {
        success: true,
        invoices: payments.map((payment) => ({
          id: payment.id,
          plan: payment.plan,
          amount: payment.amount,
          currency: payment.currency,
          provider: payment.provider,
          status: payment.payment_status,
          transactionId: payment.transaction_id,
          invoiceUrl: payment.invoice_url,
          receiptUrl: payment.receipt_url,
          paidAt: payment.paid_at,
          createdAt: payment.created_at,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Get invoices error:", error);
    return NextResponse.json(
      { error: "Failed to get invoices" },
      { status: 500 },
    );
  }
}
