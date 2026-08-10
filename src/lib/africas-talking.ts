import { logger } from "@/lib/logger";

export interface AfricasTalkingSMSResult {
  success: boolean;
  messageId?: string;
  statusCode?: number;
  error?: string;
  demo?: boolean;
}

const SMS_DAILY_LIMIT = parseInt(process.env.SMS_DAILY_LIMIT || "500", 10);

export function formatUgandaPhone(phone: string): string {
  let formatted = phone.replace(/\D/g, "");

  if (formatted.startsWith("256")) {
    if (formatted.length !== 12) {
      throw new Error("Invalid phone number: must be 12 digits with country code");
    }
    return `+${formatted}`;
  }

  if (formatted.startsWith("0")) {
    formatted = formatted.slice(1);
    if (formatted.length !== 9) {
      throw new Error("Invalid phone number: must be 9 digits after leading zero");
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
    apiKey: process.env.AFRICAS_TALKING_API_KEY || process.env.SMS_API_KEY || "",
    username: process.env.AFRICAS_TALKING_USERNAME || process.env.SMS_USERNAME || "sandbox",
  };
}

let smsQuotaSchoolId: string | null = null;

export function setSmsQuotaSchoolId(schoolId: string | null) {
  smsQuotaSchoolId = schoolId;
}

export async function sendAfricasTalkingSMS(
  to: string,
  message: string,
  options?: { from?: string; formatUgandaNumber?: boolean; schoolId?: string },
): Promise<AfricasTalkingSMSResult> {
  const { apiKey, username } = getAfricasTalkingConfig();
  const recipient = options?.formatUgandaNumber ? formatUgandaPhone(to) : to;
  const schoolId = options?.schoolId || smsQuotaSchoolId;

  if (schoolId) {
    const quota = await checkSmsQuota(schoolId, 1);
    if (!quota.allowed) {
      const error = `SMS quota exceeded: ${quota.used}/${quota.limit} used this month`;
      logger.error(`[SMS] ${error}`);
      return { success: false, error };
    }
  }

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      logger.debug(`[SMS Demo] To: ${recipient}, Message: ${message}`);
      if (schoolId) {
        await incrementSmsUsage(schoolId, true);
      }
      return {
        success: true,
        demo: true,
        messageId: `demo-${Date.now()}`,
        statusCode: 101,
      };
    }
    // Production: never claim a message was sent when no gateway is configured.
    const error = "SMS not configured: AFRICAS_TALKING_API_KEY is missing";
    logger.error(`[SMS] ${error}`);
    return { success: false, error };
  }

  try {
    const body = new URLSearchParams({ username, to: recipient, message });
    if (options?.from) {
      body.set("from", options.from);
    }

    const response = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        apiKey,
      },
      body,
    });

    const responseText = await response.text();
    let payload: any = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (err) {
      logger.error("[SMS] Failed to parse API response:", err);
      payload = null;
    }

    const recipientResult = payload?.SMSMessageData?.Recipients?.[0];
    const statusCode = recipientResult?.statusCode;
    const messageId = recipientResult?.messageId;
    const success = response.ok && (statusCode === undefined || statusCode === 101 || statusCode === 102);

    if (schoolId) {
      await incrementSmsUsage(schoolId, success);
    }

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
    if (schoolId) {
      await incrementSmsUsage(schoolId, false);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    };
  }
}

export async function sendAfricasTalkingSMSWithRetry(
  to: string,
  message: string,
  options?: { from?: string; formatUgandaNumber?: boolean; maxRetries?: number; schoolId?: string },
): Promise<AfricasTalkingSMSResult> {
  const maxRetries = options?.maxRetries ?? 2;
  let lastError: AfricasTalkingSMSResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await sendAfricasTalkingSMS(to, message, {
      from: options?.from,
      formatUgandaNumber: options?.formatUgandaNumber,
      schoolId: options?.schoolId,
    });

    if (result.success) return result;

    lastError = result;
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
      logger.warn(`[SMS] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${result.error}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return lastError ?? { success: false, error: "SMS failed after all retries" };
}

export async function checkSmsDailyLimit(schoolId: string, requestedCount: number): Promise<boolean> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return true;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("created_at", today.toISOString());

    if (error) {
      logger.error("[SMS] Failed to check daily limit:", error);
      return true;
    }

    const sentToday = count ?? 0;
    return sentToday + requestedCount <= SMS_DAILY_LIMIT;
  } catch (err) {
    logger.error("[SMS] Error checking daily limit:", err);
    return true;
  }
}

export async function checkSmsQuota(
  schoolId: string,
  requestedCount: number,
): Promise<{ allowed: boolean; remaining: number; limit: number; used: number }> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { allowed: true, remaining: 999999, limit: 999999, used: 0 };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const month = now.toLocaleString("en-US", { month: "short" }).toLowerCase();
    const year = now.getFullYear();

    let { data: quota } = await supabase.from("sms_quota").select("*").eq("school_id", schoolId).maybeSingle();

    if (!quota) {
      const { data: newQuota } = await supabase.from("sms_quota").insert({ school_id: schoolId }).select().single();
      quota = newQuota;
    }

    if (!quota) {
      return { allowed: true, remaining: 999999, limit: 999999, used: 0 };
    }

    const remaining = Math.max(0, quota.monthly_limit - quota.monthly_used);
    const allowed = remaining >= requestedCount;

    return { allowed, remaining, limit: quota.monthly_limit, used: quota.monthly_used };
  } catch (err) {
    logger.error("[SMS] Error checking quota:", err);
    return { allowed: true, remaining: 999999, limit: 999999, used: 0 };
  }
}

export async function incrementSmsUsage(schoolId: string, success: boolean): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) return;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const month = now.toLocaleString("en-US", { month: "short" }).toLowerCase();
    const year = now.getFullYear();

    await supabase.rpc("increment_sms_usage", {
      p_school_id: schoolId,
      p_month: month,
      p_year: year,
      p_success: success,
    });
  } catch (err) {
    logger.error("[SMS] Error incrementing usage:", err);
  }
}
