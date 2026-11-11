import {
  AirtelMoneyClient,
  type AirtelMoneyCredentials,
  type VerifiedMobileMoneyStatus,
} from "@/lib/payments/airtel-money";
import { MtnMomoClient, type MtnMomoCredentials } from "@/lib/payments/mobile-money";

export type ParentMobileMoneyProvider = "mtn" | "airtel";
export type ProviderEnvironment = "sandbox" | "production";

export type MtnProviderSecrets = {
  subscriptionKey: string;
  userId: string;
  credentialToken: string;
};

export type AirtelProviderSecrets = {
  clientId: string;
  clientSecret: string;
};

export type ProviderSecrets = MtnProviderSecrets | AirtelProviderSecrets;

export interface ProviderPaymentStatus extends VerifiedMobileMoneyStatus {}

export interface ParentMobileMoneyProviderClient {
  testConnection(): Promise<void>;
  requestPayment(params: {
    amount: number;
    phone: string;
    reference: string;
    description: string;
    callbackUrl?: string;
  }): Promise<string>;
  getPaymentStatus(reference: string): Promise<ProviderPaymentStatus>;
}

export function createParentMobileMoneyProviderClient(
  provider: ParentMobileMoneyProvider,
  environment: ProviderEnvironment,
  secrets: ProviderSecrets,
): ParentMobileMoneyProviderClient {
  if (provider === "mtn") {
    const credentials: MtnMomoCredentials = {
      ...(secrets as MtnProviderSecrets),
      environment,
      targetEnvironment: environment === "sandbox" ? "sandbox" : "mtnuganda",
    };
    const client = new MtnMomoClient(credentials);
    return {
      async testConnection() {
        await client.getAccessToken();
      },
      async requestPayment(params) {
        return client.requestToPay({
          amount: params.amount,
          phone: params.phone,
          externalId: params.reference,
          referenceId: params.reference,
          payerMessage: "SkoolMate school payment",
          payeeNote: params.description,
          callbackUrl: params.callbackUrl,
        });
      },
      async getPaymentStatus(reference) {
        const response = await client.getPaymentStatus(reference);
        return {
          status: response.status === "SUCCESSFUL" ? "completed" : response.status === "FAILED" ? "failed" : "pending",
          amount: Number(response.amount),
          currency: response.currency,
          providerTransactionId: response.financialTransactionId || reference,
          externalReference: response.externalId,
          failureCode: response.reason?.code || response.reason?.message,
        };
      },
    };
  }

  const credentials: AirtelMoneyCredentials = {
    ...(secrets as AirtelProviderSecrets),
    environment,
  };
  const client = new AirtelMoneyClient(credentials);
  return {
    async testConnection() {
      await client.getAccessToken();
    },
    async requestPayment(params) {
      const result = await client.requestPayment(params);
      return result.providerTransactionId;
    },
    getPaymentStatus(reference) {
      return client.getPaymentStatus(reference);
    },
  };
}

export function requiredProviderSecretFields(provider: ParentMobileMoneyProvider): string[] {
  return provider === "mtn" ? ["subscriptionKey", "userId", "credentialToken"] : ["clientId", "clientSecret"];
}
