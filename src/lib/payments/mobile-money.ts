import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";
import { APP_NAME } from "@/lib/app-name";

// ─── MoneyUnify API ───────────────────────────────────────────────────────────
// Docs: https://owk7kqf8sn.apidog.io/
// Supports MTN, Airtel, and Zamtel (auto-detected from phone number).
const MONEY_UNIFY_BASE_URL = "https://api.moneyunify.one";

export class MoneyUnifyClient {
  private authId: string;

  constructor() {
    this.authId = process.env.MONEY_UNIFY_AUTH_ID || "";
  }

  private assertConfigured(): void {
    if (!this.authId) {
      throw new Error("MoneyUnify is not configured. Set MONEY_UNIFY_AUTH_ID in your environment variables.");
    }
  }

  /**
   * Request a payment from a mobile money number.
   * MoneyUnify auto-detects the network (MTN/Airtel/Zamtel) from the phone.
   * @returns transaction_id to use for status checks
   */
  async requestPayment(params: {
    phone: string; // e.g. "256701234567"
    amount: number;
  }): Promise<string> {
    this.assertConfigured();

    const body = new URLSearchParams({
      from_payer: params.phone,
      amount: String(params.amount),
      auth_id: this.authId,
    });

    const response = await fetch(`${MONEY_UNIFY_BASE_URL}/payments/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const data = (await response.json()) as {
      message: string;
      isError: boolean;
      data?: { transaction_id: string; status: string; amount: number };
    };

    if (data.isError || !data.data?.transaction_id) {
      logger.error("MoneyUnify request error:", data);
      throw new Error(data.message || "MoneyUnify payment request failed");
    }

    return data.data.transaction_id;
  }

  async verifyPayment(transactionId: string): Promise<{
    status: "pending" | "completed" | "failed";
    amount?: number;
    message?: string;
  }> {
    this.assertConfigured();

    const body = new URLSearchParams({
      transaction_id: transactionId,
      auth_id: this.authId,
    });

    const response = await fetch(`${MONEY_UNIFY_BASE_URL}/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const data = (await response.json()) as {
      message: string;
      isError: boolean;
      data?: { transaction_id: string; status: string; amount: string };
    };

    if (data.isError) {
      logger.error("MoneyUnify verify error:", data);
      return { status: "failed", message: data.message };
    }

    const status = data.data?.status?.toLowerCase() || "";

    if (status === "successful" || status === "success") {
      return {
        status: "completed",
        amount: parseFloat(data.data?.amount || "0"),
        message: "Payment successful",
      };
    } else if (status === "initiated" || status === "pending") {
      return { status: "pending", message: "Awaiting payment confirmation" };
    } else {
      return { status: "failed", message: data.message || "Payment failed" };
    }
  }
}

// ─── MTN MoMo REST API ────────────────────────────────────────────────────────
// Docs: https://momodeveloper.mtn.com/api-documentation
const MOMO_SANDBOX_BASE_URL = "https://sandbox.momodeveloper.mtn.com";
const MOMO_PROD_BASE_URL = "https://proxy.momoapi.mtn.com";

function getBaseUrl(): string {
  const env = (process.env.MTN_MOMO_ENVIRONMENT || "sandbox").toLowerCase();
  return env === "sandbox" ? MOMO_SANDBOX_BASE_URL : MOMO_PROD_BASE_URL;
}

function getTargetEnvironment(): string {
  return process.env.MTN_MOMO_ENVIRONMENT || "sandbox";
}

interface MomoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MomoPaymentStatusResponse {
  financialTransactionId?: string;
  externalId: string;
  amount: string;
  currency: string;
  payer: { partyIdType: string; partyId: string };
  payerMessage?: string;
  payeeNote?: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED";
  reason?: { code?: string; message?: string };
}

export class MtnMomoClient {
  private subscriptionKey: string;
  private apiUser: string;
  private apiKey: string;

  constructor() {
    this.subscriptionKey = process.env.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY || "";
    this.apiUser = process.env.MTN_MOMO_API_USER || "";
    this.apiKey = process.env.MTN_MOMO_API_KEY || "";
  }

  private assertConfigured(): void {
    if (!this.subscriptionKey || !this.apiUser || !this.apiKey) {
      throw new Error(
        "MTN MoMo payments are not configured. Set MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY, MTN_MOMO_API_USER, and MTN_MOMO_API_KEY in your environment variables.",
      );
    }
  }

  async getAccessToken(): Promise<string> {
    this.assertConfigured();

    const credentials = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString("base64");
    const url = `${getBaseUrl()}/collection/token/`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Ocp-Apim-Subscription-Key": this.subscriptionKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("MTN MoMo token error:", text);
      throw new Error(`MTN MoMo auth failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as MomoTokenResponse;
    return data.access_token;
  }

  /**
   * Initiate a Request-to-Pay (USSD push to customer phone).
   * Returns the referenceId (UUID) used to track the payment.
   */
  async requestToPay(params: {
    amount: number;
    phone: string; // MSISDN format, e.g. "256701234567"
    externalId: string;
    payerMessage?: string;
    payeeNote?: string;
    callbackUrl?: string;
  }): Promise<string> {
    this.assertConfigured();

    const referenceId = randomUUID();
    const token = await this.getAccessToken();
    const url = `${getBaseUrl()}/collection/v1_0/requesttopay`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": getTargetEnvironment(),
      "Ocp-Apim-Subscription-Key": this.subscriptionKey,
      "Content-Type": "application/json",
    };

    const callbackUrl = params.callbackUrl || process.env.MTN_MOMO_CALLBACK_URL;
    if (callbackUrl) {
      headers["X-Callback-Url"] = callbackUrl;
    }

    const body = {
      amount: String(params.amount),
      currency: "UGX",
      externalId: params.externalId,
      payer: {
        partyIdType: "MSISDN",
        partyId: params.phone,
      },
      payerMessage: params.payerMessage || `${APP_NAME} Subscription`,
      payeeNote: params.payeeNote || `${APP_NAME} Subscription Payment`,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.status !== 202) {
      const text = await response.text();
      logger.error("MTN MoMo requesttopay error:", text);
      throw new Error(`MTN MoMo request-to-pay failed (${response.status}): ${text}`);
    }

    return referenceId;
  }

  async getPaymentStatus(referenceId: string): Promise<MomoPaymentStatusResponse> {
    this.assertConfigured();

    const token = await this.getAccessToken();
    const url = `${getBaseUrl()}/collection/v1_0/requesttopay/${referenceId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": getTargetEnvironment(),
        "Ocp-Apim-Subscription-Key": this.subscriptionKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("MTN MoMo status check error:", text);
      throw new Error(`MTN MoMo status check failed (${response.status}): ${text}`);
    }

    return (await response.json()) as MomoPaymentStatusResponse;
  }
}

/**
 * Initiate a mobile money payment.
 * - Uses MoneyUnify if configured (handles MTN/Airtel/Zamtel auto-detected by phone)
 * - Falls back to direct MTN MoMo API for MTN when MoneyUnify is not configured
 * Returns `link` — a status-page URL to direct the user to while waiting.
 */
export async function createMobileMoneyPaymentLink(request: {
  provider: "mtn" | "airtel";
  amount: number;
  phone: string;
  email: string;
  name: string;
  schoolId: string;
  plan: string;
  returnUrl: string;
}): Promise<{ link: string; txRef: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://omuto.org";
  const hasMoneyUnify = !!process.env.MONEY_UNIFY_AUTH_ID;

  const buildStatusUrl = (txRef: string) => {
    if (request.returnUrl.includes("{reference}")) {
      return request.returnUrl.replace(/\{reference\}/g, txRef);
    }
    if (request.returnUrl) {
      return `${request.returnUrl}${request.returnUrl.includes("?") ? "&" : "?"}reference=${txRef}`;
    }
    return `${baseUrl}/dashboard/settings?tab=subscription&pending=true&provider=${request.provider}&plan=${encodeURIComponent(request.plan)}&reference=${txRef}`;
  };

  if (hasMoneyUnify) {
    // MoneyUnify handles both MTN and Airtel (auto-detects from phone number)
    const client = new MoneyUnifyClient();
    const txRef = await client.requestPayment({
      phone: request.phone,
      amount: request.amount,
    });
    return { link: buildStatusUrl(txRef), txRef };
  }

  // Fallback: direct MTN MoMo API (only for MTN, requires separate MoMo keys)
  if (request.provider === "mtn") {
    const client = new MtnMomoClient();
    const txRef = await client.requestToPay({
      amount: request.amount,
      phone: request.phone,
      externalId: `${request.schoolId}_${request.plan}_${Date.now()}`,
      payerMessage: `SkoolMate ${request.plan} plan`,
      payeeNote: `School: ${request.name} — Plan: ${request.plan}`,
    });
    return { link: buildStatusUrl(txRef), txRef };
  }

  throw new Error("No mobile money provider configured. Set MONEY_UNIFY_AUTH_ID or MTN MoMo environment variables.");
}

export async function verifyMobileMoneyPayment(
  txRef: string,
  provider?: "mtn" | "airtel",
): Promise<{
  status: "pending" | "completed" | "failed";
  amount?: number;
  message?: string;
}> {
  // Use provider hint if available; fall back to MTN MoMo for backward compat
  const resolvedProvider = provider ?? "mtn";

  try {
    if (resolvedProvider === "airtel") {
      const client = new MoneyUnifyClient();
      return await client.verifyPayment(txRef);
    }

    // MTN MoMo direct
    const client = new MtnMomoClient();
    const result = await client.getPaymentStatus(txRef);

    if (result.status === "SUCCESSFUL") {
      return { status: "completed", amount: parseFloat(result.amount), message: "Payment successful" };
    } else if (result.status === "PENDING") {
      return { status: "pending", message: "Awaiting payment confirmation on your phone" };
    } else {
      return { status: "failed", message: result.reason?.message || "Payment failed or was declined" };
    }
  } catch (error) {
    logger.error("Error checking mobile money payment status:", error);
    return { status: "pending", message: "Unable to verify payment at this time" };
  }
}

const mobileMoneyApi = {
  MtnMomoClient,
  MoneyUnifyClient,
  createMobileMoneyPaymentLink,
  verifyMobileMoneyPayment,
};

export default mobileMoneyApi;
