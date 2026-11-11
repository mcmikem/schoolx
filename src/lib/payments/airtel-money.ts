import { MobileMoneyProviderError } from "@/lib/payments/mobile-money";
import {
  cacheProviderToken,
  providerTokenCacheKey,
  readCachedProviderToken,
} from "@/lib/payments/provider-token-cache";

export interface AirtelMoneyCredentials {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
}

export interface VerifiedMobileMoneyStatus {
  status: "pending" | "completed" | "failed";
  amount?: number;
  currency?: string;
  providerTransactionId?: string;
  externalReference?: string;
  failureCode?: string;
}

function baseUrl(environment: AirtelMoneyCredentials["environment"]): string {
  return environment === "sandbox" ? "https://openapiuat.airtel.africa" : "https://openapi.airtel.africa";
}

function normalizeStatus(value: unknown): VerifiedMobileMoneyStatus["status"] {
  const status = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "TS"].includes(status)) return "completed";
  if (["FAIL", "FAILED", "FAILURE", "TF", "EXPIRED", "REJECTED"].includes(status)) return "failed";
  return "pending";
}

type AirtelApiResponse = {
  access_token?: string;
  expires_in?: number;
  data?: {
    transaction?: {
      id?: string;
      status?: string;
      amount?: number | string;
      currency?: string;
      reference?: string;
      message?: string;
    };
  };
  status?: {
    code?: string;
    message?: string;
    result_code?: string;
    response_code?: string;
  };
};

/** Server-only Airtel Africa collection client. It never receives a PIN. */
export class AirtelMoneyClient {
  private readonly credentials: AirtelMoneyCredentials;

  constructor(credentials: AirtelMoneyCredentials) {
    this.credentials = credentials;
  }

  async getAccessToken(): Promise<string> {
    if (!this.credentials.clientId || !this.credentials.clientSecret) {
      throw new Error("Airtel Money collection credentials are missing.");
    }

    const cacheKey = providerTokenCacheKey("airtel-money", [
      this.credentials.environment,
      this.credentials.clientId,
      this.credentials.clientSecret,
    ]);
    const cached = readCachedProviderToken(cacheKey);
    if (cached) return cached;

    let response: Response;
    try {
      response = await fetch(`${baseUrl(this.credentials.environment)}/auth/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          grant_type: "client_credentials",
        }),
      });
    } catch {
      throw new Error("Could not reach Airtel Money. Check the provider connection and try again.");
    }

    if (!response.ok) {
      throw new Error(
        `Airtel Money connection failed (${response.status}). Check the merchant credentials and environment.`,
      );
    }
    const result = (await response.json()) as AirtelApiResponse;
    if (!result.access_token) throw new Error("Airtel Money did not return an access token.");
    cacheProviderToken(cacheKey, result.access_token, result.expires_in);
    return result.access_token;
  }

  async requestPayment(params: {
    amount: number;
    phone: string;
    reference: string;
    description: string;
  }): Promise<{ providerTransactionId: string }> {
    const token = await this.getAccessToken();
    let response: Response;
    try {
      response = await fetch(`${baseUrl(this.credentials.environment)}/merchant/v1/payments/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Country": "UG",
          "X-Currency": "UGX",
        },
        body: JSON.stringify({
          reference: params.reference,
          subscriber: { country: "UG", currency: "UGX", msisdn: params.phone.slice(-9) },
          transaction: {
            amount: String(params.amount),
            country: "UG",
            currency: "UGX",
            id: params.reference,
          },
          transactionDesc: params.description,
        }),
      });
    } catch {
      throw new MobileMoneyProviderError(
        "Airtel did not return a response. The payment status is being checked.",
        "unknown",
      );
    }

    const payload = (await response.json().catch(() => ({}))) as AirtelApiResponse;
    if (!response.ok) {
      throw new MobileMoneyProviderError(
        `Airtel Money did not accept the payment request (${response.status}).`,
        "rejected",
      );
    }

    const providerTransactionId = payload.data?.transaction?.id || params.reference;
    return { providerTransactionId };
  }

  async getPaymentStatus(providerTransactionId: string): Promise<VerifiedMobileMoneyStatus> {
    const token = await this.getAccessToken();
    let response: Response;
    try {
      response = await fetch(
        `${baseUrl(this.credentials.environment)}/standard/v1/payments/${encodeURIComponent(providerTransactionId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "X-Country": "UG",
            "X-Currency": "UGX",
          },
        },
      );
    } catch {
      return { status: "pending" };
    }
    if (!response.ok) return { status: "pending" };

    const payload = (await response.json().catch(() => ({}))) as AirtelApiResponse;
    const transaction = payload.data?.transaction;
    return {
      status: normalizeStatus(transaction?.status),
      amount: transaction?.amount === undefined ? undefined : Number(transaction.amount),
      currency: transaction?.currency,
      providerTransactionId: transaction?.id || providerTransactionId,
      externalReference: transaction?.reference,
      failureCode: transaction?.message || payload.status?.result_code,
    };
  }
}
