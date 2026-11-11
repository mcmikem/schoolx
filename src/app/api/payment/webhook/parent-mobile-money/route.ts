import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClientOrThrow, rateLimit } from "@/lib/api-utils";
import { decryptProviderCredentials, paymentCredentialsEncryptionReady } from "@/lib/payments/credential-vault";
import {
  createParentMobileMoneyProviderClient,
  type ParentMobileMoneyProvider,
  type ProviderEnvironment,
  type ProviderSecrets,
} from "@/lib/payments/provider-client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type CallbackPayload = {
  referenceId?: string;
  externalId?: string;
  financialTransactionId?: string;
  transaction_id?: string;
  data?: {
    transaction?: {
      id?: string;
      reference?: string;
    };
  };
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
};

async function processCallback(request: NextRequest) {
  const allowed = rateLimit(request, 120, 60_000);
  if (!allowed.success) return NextResponse.json({ received: false }, { status: 429 });
  if (!paymentCredentialsEncryptionReady()) return NextResponse.json({ received: false }, { status: 503 });

  let payload: CallbackPayload = {};
  try {
    payload = (await request.json()) as CallbackPayload;
  } catch {
    // The authenticated status lookup below is authoritative; some providers
    // send an empty callback body and identify the request in a header.
  }

  const candidateReferences = [
    request.headers.get("x-reference-id"),
    request.headers.get("x-transaction-id"),
    payload.referenceId,
    payload.externalId,
    payload.transaction_id,
    payload.data?.transaction?.reference,
    payload.data?.transaction?.id,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const reference = candidateReferences[0];
  if (!reference) return NextResponse.json({ received: false, error: "Missing payment reference" }, { status: 400 });

  const supabase = createServiceRoleClientOrThrow();
  let payment: PaymentRow | null = null;
  try {
    for (const candidate of candidateReferences) {
      const { data: byInternalReference, error: referenceError } = await supabase
        .from("parent_mobile_money_payments")
        .select(
          "id, school_id, student_id, parent_id, purpose, provider, amount, currency, phone_last4, status, provider_reference, provider_transaction_id",
        )
        .eq("provider_reference", candidate)
        .maybeSingle();
      if (referenceError) throw referenceError;
      if (byInternalReference) {
        payment = byInternalReference as PaymentRow;
        break;
      }

      const { data: byProviderId, error: providerIdError } = await supabase
        .from("parent_mobile_money_payments")
        .select(
          "id, school_id, student_id, parent_id, purpose, provider, amount, currency, phone_last4, status, provider_reference, provider_transaction_id",
        )
        .eq("provider_transaction_id", candidate)
        .maybeSingle();
      if (providerIdError) throw providerIdError;
      if (byProviderId) {
        payment = byProviderId as PaymentRow;
        break;
      }

      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)) {
        const { data: byId, error: idError } = await supabase
          .from("parent_mobile_money_payments")
          .select(
            "id, school_id, student_id, parent_id, purpose, provider, amount, currency, phone_last4, status, provider_reference, provider_transaction_id",
          )
          .eq("id", candidate)
          .maybeSingle();
        if (idError) throw idError;
        if (byId) {
          payment = byId as PaymentRow;
          break;
        }
      }
    }
  } catch {
    logger.error("Parent payment callback could not find intent", { reference });
    return NextResponse.json({ received: false }, { status: 503 });
  }

  if (!payment || payment.status === "completed" || payment.status === "failed") {
    return NextResponse.json({ received: true });
  }

  const { data: config, error: configError } = await supabase
    .from("school_payment_provider_configs")
    .select("provider, environment, credentials_ciphertext")
    .eq("school_id", payment.school_id)
    .eq("provider", payment.provider)
    .maybeSingle();
  if (configError || !config) {
    logger.error("Parent payment callback could not load provider config", { paymentId: payment.id });
    return NextResponse.json({ received: false }, { status: 503 });
  }

  let verified;
  try {
    const secrets = decryptProviderCredentials<ProviderSecrets & Record<string, string>>(config.credentials_ciphertext);
    const client = createParentMobileMoneyProviderClient(
      payment.provider,
      config.environment as ProviderEnvironment,
      secrets,
    );
    verified = await client.getPaymentStatus(payment.provider_transaction_id || payment.provider_reference);
  } catch (error) {
    logger.warn("Parent payment callback re-verification failed", {
      paymentId: payment.id,
      provider: payment.provider,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ received: false }, { status: 503 });
  }

  if (verified.status === "completed") {
    const exactAmount = Number(verified.amount) === Number(payment.amount);
    const correctCurrency = verified.currency?.toUpperCase() === "UGX";
    const correctReference =
      !verified.externalReference ||
      verified.externalReference === payment.id ||
      verified.externalReference === payment.provider_reference;
    if (!exactAmount || !correctCurrency || !correctReference) {
      logger.error("Parent payment callback verification mismatch", {
        paymentId: payment.id,
        exactAmount,
        correctCurrency,
        correctReference,
      });
      return NextResponse.json({ received: true, pending: true });
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
      logger.error("Parent payment callback settlement failed", { paymentId: payment.id });
      return NextResponse.json({ received: false }, { status: 503 });
    }
  } else if (verified.status === "failed") {
    const { error } = await supabase.rpc("fail_parent_mobile_money_payment", {
      p_payment_id: payment.id,
      p_provider_status: "FAILED",
      p_failure_code: verified.failureCode || "provider_failed",
    });
    if (error) {
      logger.error("Parent payment callback failure update failed", { paymentId: payment.id });
      return NextResponse.json({ received: false }, { status: 503 });
    }
  }

  return NextResponse.json({ received: true });
}

export async function POST(request: NextRequest) {
  return processCallback(request);
}

export async function PUT(request: NextRequest) {
  return processCallback(request);
}
