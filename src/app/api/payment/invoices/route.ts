import { NextRequest, NextResponse } from "next/server";
import { getSchoolPaymentHistory } from "@/lib/payments/utils";
import { logger } from "@/lib/logger";
import { requireUserWithSchool, assertUserRoleOrDeny } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const BILLING_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "bursar"];

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

    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!auth.context.schoolId) {
      return NextResponse.json({ error: "Missing school context" }, { status: 400 });
    }

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: BILLING_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const payments = ((await getSchoolPaymentHistory(auth.context.schoolId, limit)) ?? []) as InvoicePayment[];

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
    logger.error("Get invoices error:", error);
    return NextResponse.json({ error: "Failed to get invoices" }, { status: 500 });
  }
}
