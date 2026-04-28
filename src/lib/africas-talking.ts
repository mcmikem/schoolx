export interface AfricasTalkingSMSResult {
  success: boolean;
  messageId?: string;
  statusCode?: number;
  error?: string;
  demo?: boolean;
}

export function formatUgandaPhone(phone: string): string {
  let formatted = phone.replace(/\D/g, "");

  if (formatted.startsWith("256")) {
    if (formatted.length !== 12) {
      throw new Error(
        "Invalid phone number: must be 12 digits with country code",
      );
    }
    return `+${formatted}`;
  }

  if (formatted.startsWith("0")) {
    formatted = formatted.slice(1);
    if (formatted.length !== 9) {
      throw new Error(
        "Invalid phone number: must be 9 digits after leading zero",
      );
    }
    return `+256${formatted}`;
  }

  if (formatted.length === 9) {
    return `+256${formatted}`;
  }

  throw new Error("Invalid phone number format");
}

export function getAfricasTalkingConfig() {
  return {
    apiKey:
      process.env.AFRICAS_TALKING_API_KEY || process.env.SMS_API_KEY || "",
    username:
      process.env.AFRICAS_TALKING_USERNAME ||
      process.env.SMS_USERNAME ||
      "sandbox",
  };
}

export async function sendAfricasTalkingSMS(
  to: string,
  message: string,
  options?: { from?: string; formatUgandaNumber?: boolean },
): Promise<AfricasTalkingSMSResult> {
  const { apiKey, username } = getAfricasTalkingConfig();
  const recipient = options?.formatUgandaNumber ? formatUgandaPhone(to) : to;

  if (!apiKey) {
    console.log(`[SMS Demo] To: ${recipient}, Message: ${message}`);
    return {
      success: true,
      demo: true,
      messageId: `demo-${Date.now()}`,
      statusCode: 101,
    };
  }

  try {
    const body = new URLSearchParams({ username, to: recipient, message });
    if (options?.from) {
      body.set("from", options.from);
    }

    const response = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          apiKey,
        },
        body,
      },
    );

    const responseText = await response.text();
    let payload: any = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (err) {
      console.error("[SMS] Failed to parse API response:", err);
      payload = null;
    }

    const recipientResult = payload?.SMSMessageData?.Recipients?.[0];
    const statusCode = recipientResult?.statusCode;
    const messageId = recipientResult?.messageId;
    const success =
      response.ok &&
      (statusCode === undefined || statusCode === 101 || statusCode === 102);

    return {
      success,
      messageId,
      statusCode,
      error: success
        ? undefined
        : recipientResult?.status ||
          payload?.SMSMessageData?.Message ||
          responseText ||
          `SMS request failed with status ${response.status}`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    };
  }
}
