import crypto from "crypto";

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

interface MobileMoneyConfig {
  publicKey: string;
  secretKey: string;
}

interface MobileMoneyRequest {
  amount: number;
  currency: string;
  tx_ref: string;
  orderRef?: string;
  accountbank?: string;
  accountnumber?: string;
  payment_type?: string;
  redirect_url?: string;
  customer: {
    email: string;
    phonenumber: string;
    name: string;
  };
  customizations?: {
    title: string;
    logo: string;
  };
  meta?: Record<string, string>;
}

interface MobileMoneyStatusResponse {
  status: string;
  message: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: string;
    payment_type: string;
    customer: {
      email: string;
      name: string;
      phone: string;
    };
    meta?: Record<string, string>;
  };
}

export class FlutterwaveMobileMoney {
  private config: MobileMoneyConfig;

  constructor() {
    this.config = {
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY!,
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY!,
    };

    if (!this.config.publicKey || !this.config.secretKey) {
      throw new Error("Flutterwave API keys are not configured");
    }
  }

  private async makeRequest(
    endpoint: string,
    method: "GET" | "POST" = "POST",
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${FLUTTERWAVE_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.secretKey}`,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Flutterwave API error:", data);
        throw new Error(data.message || "Flutterwave API request failed");
      }

      return data;
    } catch (error) {
      console.error("Flutterwave request error:", error);
      throw error;
    }
  }

  async initiateMTNPayment(request: {
    amount: number;
    phone: string;
    email: string;
    name: string;
    schoolId: string;
    plan: string;
    returnUrl: string;
  }): Promise<{ link: string; txRef: string; reference: string }> {
    const txRef = `MM_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const payload: Record<string, unknown> = {
      amount: request.amount,
      currency: "UGX",
      tx_ref: txRef,
      payment_type: "mobilemoneyug",
      accountbank: "MTN",
      accountnumber: request.phone.replace(/^256/, ""),
      redirect_url: request.returnUrl,
      customer: {
        email: request.email,
        phonenumber: request.phone,
        name: request.name,
      },
      customizations: {
        title: "SkoolMate OS",
        logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
      },
      meta: {
        schoolId: request.schoolId,
        plan: request.plan,
      },
    };

    const response = (await this.makeRequest("/payments", "POST", payload)) as {
      status: string;
      data: { link: string; tx_ref: string };
    };

    return {
      link: response.data.link,
      txRef: response.data.tx_ref,
      reference: response.data.tx_ref,
    };
  }

  async initiateAirtelPayment(request: {
    amount: number;
    phone: string;
    email: string;
    name: string;
    schoolId: string;
    plan: string;
    returnUrl: string;
  }): Promise<{ link: string; txRef: string; reference: string }> {
    const txRef = `AM_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const payload: Record<string, unknown> = {
      amount: request.amount,
      currency: "UGX",
      tx_ref: txRef,
      payment_type: "mobilemoneyug",
      accountbank: "AIRTEL",
      accountnumber: request.phone.replace(/^256/, ""),
      redirect_url: request.returnUrl,
      customer: {
        email: request.email,
        phonenumber: request.phone,
        name: request.name,
      },
      customizations: {
        title: "SkoolMate OS",
        logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
      },
      meta: {
        schoolId: request.schoolId,
        plan: request.plan,
      },
    };

    const response = (await this.makeRequest("/payments", "POST", payload)) as {
      status: string;
      data: { link: string; tx_ref: string };
    };

    return {
      link: response.data.link,
      txRef: response.data.tx_ref,
      reference: response.data.tx_ref,
    };
  }

  async verifyTransaction(txRef: string): Promise<MobileMoneyStatusResponse> {
    const response = (await this.makeRequest(
      `/transactions/${txRef}/verify`,
      "GET",
    )) as MobileMoneyStatusResponse;

    return response;
  }

  async getTransactionStatus(txRef: string): Promise<{
    status: "pending" | "completed" | "failed";
    amount?: number;
    message?: string;
  }> {
    try {
      const verification = await this.verifyTransaction(txRef);

      if (verification.data.status === "successful") {
        return {
          status: "completed",
          amount: verification.data.amount,
          message: "Payment successful",
        };
      } else if (verification.data.status === "pending") {
        return {
          status: "pending",
          message: "Payment pending",
        };
      } else {
        return {
          status: "failed",
          message: verification.data.status,
        };
      }
    } catch (error) {
      console.error("Error checking transaction status:", error);
      return {
        status: "pending",
        message: "Unable to verify payment",
      };
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHash("sha256")
      .update(payload + process.env.FLUTTERWAVE_WEBHOOK_SECRET)
      .digest("hex");

    return hash === signature;
  }

  parseWebhookEvent(payload: Record<string, unknown>): {
    event: string;
    data: {
      txRef: string;
      status: string;
      amount: number;
      customer: { email: string; phone: string; name: string };
      meta?: Record<string, string>;
    };
  } | null {
    const event = payload.event as string;
    const data = payload.data as Record<string, unknown>;

    if (!event || !data) {
      return null;
    }

    return {
      event,
      data: {
        txRef: data.tx_ref as string,
        status: data.status as string,
        amount: data.amount as number,
        customer: data.customer as {
          email: string;
          phone: string;
          name: string;
        },
        meta: data.meta as Record<string, string> | undefined,
      },
    };
  }
}

export function createMobileMoneyPaymentLink(request: {
  provider: "mtn" | "airtel";
  amount: number;
  phone: string;
  email: string;
  name: string;
  schoolId: string;
  plan: string;
  returnUrl: string;
}): Promise<{ link: string; txRef: string; reference: string }> {
  const flutterwave = new FlutterwaveMobileMoney();

  if (request.provider === "mtn") {
    return flutterwave.initiateMTNPayment(request);
  } else {
    return flutterwave.initiateAirtelPayment(request);
  }
}

export async function verifyMobileMoneyPayment(
  txRef: string,
): Promise<{
  status: "pending" | "completed" | "failed";
  amount?: number;
  message?: string;
}> {
  const flutterwave = new FlutterwaveMobileMoney();
  const result = await flutterwave.getTransactionStatus(txRef);
  return result;
}

const mobileMoneyApi = {
  FlutterwaveMobileMoney,
  createMobileMoneyPaymentLink,
  verifyMobileMoneyPayment,
};

export default mobileMoneyApi;
