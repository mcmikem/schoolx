import { NextRequest, NextResponse } from "next/server";
import { getSchoolPaymentHistory } from "@/lib/payments/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/server/user-provisioning";

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

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const body = await request.json();
    const { plan, amount, currency, schoolId } = body;

    if (!plan || !amount || !schoolId) {
      return NextResponse.json(
        { error: "Missing required fields: plan, amount, schoolId" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: invoice, error } = await supabaseAdmin
      .from("payments")
      .insert({
        plan,
        amount,
        currency: currency || "UGX",
        provider: "manual",
        payment_status: "pending",
        school_id: schoolId,
      })
      .select()
      .single();

    if (error || !invoice) {
      return NextResponse.json(
        { error: "Failed to create invoice" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        invoice: {
          id: invoice.id,
          plan: invoice.plan,
          amount: invoice.amount,
          currency: invoice.currency,
          provider: invoice.provider,
          status: invoice.payment_status,
          createdAt: invoice.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create invoice error:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, payment_status, transaction_id, invoice_url, receipt_url } =
      body;

    if (!id) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const updateData: Record<string, unknown> = {};

    if (payment_status) updateData.payment_status = payment_status;
    if (transaction_id) updateData.transaction_id = transaction_id;
    if (invoice_url) updateData.invoice_url = invoice_url;
    if (receipt_url) updateData.receipt_url = receipt_url;
    if (payment_status === "completed" || payment_status === "paid") {
      updateData.paid_at = new Date().toISOString();
    }

    const { data: invoice, error } = await supabaseAdmin
      .from("payments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !invoice) {
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        invoice: {
          id: invoice.id,
          plan: invoice.plan,
          amount: invoice.amount,
          currency: invoice.currency,
          provider: invoice.provider,
          status: invoice.payment_status,
          transactionId: invoice.transaction_id,
          invoiceUrl: invoice.invoice_url,
          receiptUrl: invoice.receipt_url,
          paidAt: invoice.paid_at,
          createdAt: invoice.created_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Update invoice error:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("payments")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete invoice" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Invoice deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete invoice error:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 },
    );
  }
}
