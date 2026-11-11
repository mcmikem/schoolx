import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
  handleApiError,
  rateLimit,
  requireUserWithSchool,
} from "@/lib/api-utils";
import { loadFeeClearanceMap } from "@/lib/server/fee-clearance";
import { decryptProviderCredentials, paymentCredentialsEncryptionReady } from "@/lib/payments/credential-vault";
import {
  createParentMobileMoneyProviderClient,
  type ParentMobileMoneyProvider,
  type ProviderEnvironment,
  type ProviderSecrets,
} from "@/lib/payments/provider-client";
import { MobileMoneyProviderError } from "@/lib/payments/mobile-money";
import { normalizeAuthPhone } from "@/lib/validation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS = new Set<ParentMobileMoneyProvider>(["mtn", "airtel"]);
const VALID_PURPOSES = new Set(["wallet_topup", "fee_payment"]);
const MIN_AMOUNT_UGX = 500;
const MAX_AMOUNT_UGX = 5_000_000;

function providerCallbackUrl(): string {
  const appBase = process.env.NEXT_PUBLIC_APP_URL || "https://skoolmate.omuto.org";
  return new URL("/api/payment/webhook/parent-mobile-money/", appBase).toString();
}

type ProviderConfigRow = {
  provider: ParentMobileMoneyProvider;
  environment: ProviderEnvironment;
  credentials_ciphertext: string;
  enabled: boolean;
};

type PaymentRow = {
  id: string;
  school_id: string;
  student_id: string;
  parent_id: string;
  purpose: "wallet_topup" | "fee_payment";
  provider: ParentMobileMoneyProvider;
  amount: number | string;
  currency: string;
  phone_last4: string;
  status: "initiating" | "pending" | "initiation_unknown" | "completed" | "failed";
  provider_reference: string;
  provider_transaction_id: string | null;
  provider_status: string | null;
  failure_code: string | null;
  created_at: string;
};

function isParent(role: string) {
  return assertUserRoleOrDeny({ userRole: role, allowedRoles: ["parent"] });
}

function asClient(config: ProviderConfigRow) {
  const secrets = decryptProviderCredentials<ProviderSecrets & Record<string, string>>(config.credentials_ciphertext);
  return createParentMobileMoneyProviderClient(config.provider, config.environment, secrets);
}

function publicPayment(payment: PaymentRow, message?: string) {
  return {
    id: payment.id,
    purpose: payment.purpose,
    provider: payment.provider,
    amount: Number(payment.amount),
    currency: payment.currency,
    phoneLast4: payment.phone_last4,
    status: payment.status,
    providerStatus: payment.provider_status,
    failureCode: payment.failure_code,
    createdAt: payment.created_at,
    message,
  };
}

async function getProviderConfig(
  supabase: ReturnType<typeof createServiceRoleClientOrThrow>,
  schoolId: string,
  provider: ParentMobileMoneyProvider,
) {
  const { data, error } = await supabase
    .from("school_payment_provider_configs")
    .select("provider, environment, credentials_ciphertext, enabled")
    .eq("school_id", schoolId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  return (data as ProviderConfigRow | null) ?? null;
}

async function getPaymentStatus(
  supabase: ReturnType<typeof createServiceRoleClientOrThrow>,
  payment: PaymentRow,
): Promise<PaymentRow> {
  if (payment.status === "completed" || payment.status === "failed") return payment;
  if (!paymentCredentialsEncryptionReady()) return payment;

  const config = await getProviderConfig(supabase, payment.school_id, payment.provider);
  if (!config) return payment;

  let verified: Awaited<ReturnType<ReturnType<typeof asClient>["getPaymentStatus"]>>;
  try {
    const client = asClient(config);
    verified = await client.getPaymentStatus(payment.provider_transaction_id || payment.provider_reference);
  } catch (error) {
    logger.warn("Parent mobile-money status check failed", {
      paymentId: payment.id,
      provider: payment.provider,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return payment;
  }

  if (verified.status === "completed") {
    const exactAmount = Number(verified.amount) === Number(payment.amount);
    const correctCurrency = verified.currency?.toUpperCase() === "UGX";
    const correctReference =
      !verified.externalReference ||
      verified.externalReference === payment.id ||
      verified.externalReference === payment.provider_reference;

    if (!exactAmount || !correctCurrency || !correctReference) {
      logger.error("Parent mobile-money provider verification mismatch", {
        paymentId: payment.id,
        provider: payment.provider,
        exactAmount,
        correctCurrency,
        correctReference,
      });
      return payment;
    }

    const { error } = await supabase.rpc("settle_parent_mobile_money_payment", {
      p_payment_id: payment.id,
      p_provider_transaction_id:
        verified.providerTransactionId || payment.provider_transaction_id || payment.provider_reference,
      p_verified_amount: Number(verified.amount),
      p_verified_currency: verified.currency,
      p_provider_status: "SUCCESSFUL",
    });
    if (error) {
      logger.error("Parent mobile-money settlement failed", { paymentId: payment.id, provider: payment.provider });
      return payment;
    }
  } else if (verified.status === "failed") {
    const { error } = await supabase.rpc("fail_parent_mobile_money_payment", {
      p_payment_id: payment.id,
      p_provider_status: "FAILED",
      p_failure_code: verified.failureCode || "provider_failed",
    });
    if (error) {
      logger.error("Parent mobile-money failure update failed", { paymentId: payment.id, provider: payment.provider });
      return payment;
    }
  } else {
    if (payment.status !== "pending") {
      await supabase
        .from("parent_mobile_money_payments")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .in("status", ["initiating", "initiation_unknown"]);
    }
    return { ...payment, status: "pending" };
  }

  const { data, error } = await supabase
    .from("parent_mobile_money_payments")
    .select(
      "id, school_id, student_id, parent_id, purpose, provider, amount, currency, phone_last4, status, provider_reference, provider_transaction_id, provider_status, failure_code, created_at",
    )
    .eq("id", payment.id)
    .single();
  if (error || !data) return payment;
  return data as PaymentRow;
}

export async function POST(request: NextRequest) {
  try {
    const rate = rateLimit(request, 5, 10 * 60_000);
    if (!rate.success) return apiError("Too many payment requests. Please wait before trying again.", 429);

    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    const roleCheck = isParent(auth.context.user.role);
    if (!roleCheck.ok) return roleCheck.response;
    if (!auth.context.schoolId) return apiError("No school is linked to this parent account", 403);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const provider = typeof body.provider === "string" ? body.provider : "";
    const purpose = typeof body.purpose === "string" ? body.purpose : "";
    const amount = Number(body.amount);
    if (!studentId) return apiError("Choose a learner first", 400);
    if (!VALID_PROVIDERS.has(provider as ParentMobileMoneyProvider)) return apiError("Choose MTN or Airtel Money", 400);
    if (!VALID_PURPOSES.has(purpose)) return apiError("Choose a valid payment type", 400);
    if (!Number.isSafeInteger(amount) || amount < MIN_AMOUNT_UGX || amount > MAX_AMOUNT_UGX) {
      return apiError(
        `Enter an amount between UGX ${MIN_AMOUNT_UGX.toLocaleString()} and ${MAX_AMOUNT_UGX.toLocaleString()}.`,
        400,
      );
    }

    const phoneRaw = typeof body.phone === "string" ? body.phone : "";
    const phone = normalizeAuthPhone(phoneRaw);
    if (!/^2567\d{8}$/.test(phone)) return apiError("Enter a valid Ugandan mobile number", 400);

    const supabase = createServiceRoleClientOrThrow();
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, school_id, status")
      .eq("id", studentId)
      .eq("school_id", auth.context.schoolId)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) return apiError("Learner not found", 404);
    if (student.status !== "active") return apiError("Payments are available only for active learners", 409);

    const { data: parentLink, error: linkError } = await supabase
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", auth.context.user.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!parentLink) return apiError("You are not linked to this learner", 403);

    if (purpose === "fee_payment") {
      const clearance = await loadFeeClearanceMap(supabase, auth.context.schoolId, { studentIds: [studentId] });
      const outstanding = clearance.get(studentId)?.balance ?? 0;
      if (outstanding <= 0) return apiError("There are no outstanding fees for this learner", 409);
      if (amount > outstanding) {
        return apiError(`The outstanding fee balance is UGX ${Math.floor(outstanding).toLocaleString()}.`, 409);
      }
    }

    const providerName = provider as ParentMobileMoneyProvider;
    const config = await getProviderConfig(supabase, auth.context.schoolId, providerName);
    if (!config || !config.enabled || config.environment !== "production") {
      return apiError("This school has not enabled in-app payments for that network yet.", 503);
    }
    if (!paymentCredentialsEncryptionReady()) return apiError("Secure payment setup is unavailable right now.", 503);

    const { data: activeIntent, error: activeError } = await supabase
      .from("parent_mobile_money_payments")
      .select(
        "id, school_id, student_id, parent_id, purpose, provider, amount, currency, phone_last4, status, provider_reference, provider_transaction_id, provider_status, failure_code, created_at",
      )
      .eq("parent_id", auth.context.user.id)
      .eq("student_id", studentId)
      .eq("purpose", purpose)
      .in("status", ["initiating", "pending", "initiation_unknown"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeError) throw activeError;
    if (activeIntent) {
      return apiSuccess(
        {
          payment: publicPayment(activeIntent as PaymentRow, "A payment request is already waiting for confirmation."),
          reused: true,
        },
        "An existing payment request is still active.",
        200,
      );
    }

    const id = randomUUID();
    const { data: inserted, error: insertError } = await supabase
      .from("parent_mobile_money_payments")
      .insert({
        id,
        school_id: auth.context.schoolId,
        student_id: studentId,
        parent_id: auth.context.user.id,
        purpose,
        provider: providerName,
        amount,
        currency: "UGX",
        phone_last4: phone.slice(-4),
        status: "initiating",
        provider_reference: id,
        provider_transaction_id: id,
      })
      .select(
        "id, school_id, student_id, parent_id, purpose, provider, amount, currency, phone_last4, status, provider_reference, provider_transaction_id, provider_status, failure_code, created_at",
      )
      .single();
    if (insertError) {
      if (insertError.code === "23505") {
        const { data: concurrent } = await supabase
          .from("parent_mobile_money_payments")
          .select(
            "id, school_id, student_id, parent_id, purpose, provider, amount, currency, phone_last4, status, provider_reference, provider_transaction_id, provider_status, failure_code, created_at",
          )
          .eq("parent_id", auth.context.user.id)
          .eq("student_id", studentId)
          .eq("purpose", purpose)
          .in("status", ["initiating", "pending", "initiation_unknown"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (concurrent) return apiSuccess({ payment: publicPayment(concurrent as PaymentRow), reused: true });
      }
      throw insertError;
    }

    const payment = inserted as PaymentRow;
    let providerTransactionId: string = id;
    let providerAccepted = false;
    try {
      providerTransactionId = await asClient(config).requestPayment({
        amount,
        phone,
        reference: id,
        description: purpose === "wallet_topup" ? "Student wallet top-up" : "School fee payment",
        callbackUrl: providerCallbackUrl(),
      });
      providerAccepted = true;
      const { error } = await supabase
        .from("parent_mobile_money_payments")
        .update({
          status: "pending",
          provider_transaction_id: providerTransactionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      payment.status = "pending";
      payment.provider_transaction_id = providerTransactionId;
    } catch (error) {
      // Once the provider accepted the prompt, a database write failure must
      // remain recoverable as unknown; declaring it failed could invite a
      // second phone prompt while the first one is still payable.
      const unknown = providerAccepted || (error instanceof MobileMoneyProviderError && error.outcome === "unknown");
      const status = unknown ? "initiation_unknown" : "failed";
      const { error: updateError } = await supabase
        .from("parent_mobile_money_payments")
        .update({
          status,
          provider_transaction_id: providerTransactionId,
          provider_status: unknown ? "UNKNOWN" : "REJECTED",
          failure_code: unknown ? "provider_response_unknown" : "provider_rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (updateError) logger.error("Could not update payment initiation status", { paymentId: id });
      payment.status = status;
      payment.provider_transaction_id = providerTransactionId;
      payment.provider_status = unknown ? "UNKNOWN" : "REJECTED";
      payment.failure_code = unknown ? "provider_response_unknown" : "provider_rejected";
      if (!unknown) {
        logger.warn("Parent mobile-money request rejected", {
          paymentId: id,
          provider: providerName,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
      }
      return apiSuccess(
        {
          payment: publicPayment(
            payment,
            unknown
              ? "We are checking whether the phone request reached you. Do not start another payment yet."
              : "The payment provider did not accept the request. Check the number and try again.",
          ),
          reused: false,
        },
        unknown ? "Payment status is being checked." : "Payment request could not be started.",
        200,
      );
    }

    return apiSuccess(
      {
        payment: publicPayment(
          payment,
          "Approve the payment prompt on your phone. Your balance changes after confirmation.",
        ),
        reused: false,
      },
      "Payment request sent.",
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    const roleCheck = isParent(auth.context.user.role);
    if (!roleCheck.ok) return roleCheck.response;
    if (!auth.context.schoolId) return apiError("No school is linked to this parent account", 403);

    const { searchParams } = request.nextUrl;
    const paymentId = searchParams.get("paymentId");
    const studentId = searchParams.get("studentId");
    const purposeValue = searchParams.get("purpose");
    const purpose = VALID_PURPOSES.has(purposeValue || "") ? purposeValue : null;
    const supabase = createServiceRoleClientOrThrow();
    const { data: providerRows, error: providerError } = await supabase
      .from("school_payment_provider_configs")
      .select("provider, environment, enabled")
      .eq("school_id", auth.context.schoolId);
    if (providerError) throw providerError;
    const providerCapabilities = {
      mtn: (providerRows || []).some(
        (row: { provider: string; environment: string; enabled: boolean }) =>
          row.provider === "mtn" && row.enabled && row.environment === "production",
      ),
      airtel: (providerRows || []).some(
        (row: { provider: string; environment: string; enabled: boolean }) =>
          row.provider === "airtel" && row.enabled && row.environment === "production",
      ),
    };
    let query = supabase
      .from("parent_mobile_money_payments")
      .select(
        "id, school_id, student_id, parent_id, purpose, provider, amount, currency, phone_last4, status, provider_reference, provider_transaction_id, provider_status, failure_code, created_at",
      )
      .eq("parent_id", auth.context.user.id)
      .eq("school_id", auth.context.schoolId);

    if (paymentId) {
      query = query.eq("id", paymentId);
    } else {
      if (!studentId || !purpose) return apiError("Choose a learner and payment type", 400);
      query = query
        .eq("student_id", studentId)
        .eq("purpose", purpose)
        .in("status", ["initiating", "pending", "initiation_unknown"]);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return apiSuccess({ payment: null, providers: providerCapabilities });

    let payment = data as PaymentRow;
    if (payment.status !== "completed" && payment.status !== "failed") {
      const attempts = rateLimit(request, 12, 60_000);
      if (attempts.success) payment = await getPaymentStatus(supabase, payment);
    }
    return apiSuccess({
      payment: publicPayment(payment, payment.status === "pending" ? "Waiting for approval on the phone." : undefined),
      providers: providerCapabilities,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
