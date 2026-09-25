// ============================================================================
// Messaging channel layer — WhatsApp-first, SMS fallback
// ============================================================================
// Every outbound parent/staff message goes through here so the channel is a
// per-school setting rather than a hard-coded provider.
//
// Why WhatsApp-first: Meta charges per conversation (~$0.03–$0.08) which is
// far cheaper than Ugandan SMS pricing, and parents already read WhatsApp.
// SMS is retained as an explicit fallback for schools whose parents don't
// have WhatsApp, and is MANDATORY for login OTP — Meta prohibits
// authentication over WhatsApp, so OTP must never be routed through here.
//
// Business-initiated messages (anything a parent didn't reply to inside the
// 24h service window) require a Meta-approved template. Free text only works
// inside that window. sendSchoolMessage handles both: if the school has a
// template configured for the message type it is used, otherwise we fall back
// to free text and surface any rejection honestly instead of silently
// reporting success.
// ============================================================================
import { logger } from "@/lib/logger";
import {
  isWhatsAppConfigured,
  sendWhatsAppTextMessage,
  sendWhatsAppTemplateMessage,
  formatWhatsAppPhone,
} from "@/lib/whatsapp";
import { sendAfricasTalkingSMSWithRetry, checkSmsDailyLimit } from "@/lib/africas-talking";

export type MessagingChannel = "whatsapp" | "sms";

/** Message kinds that can map to a Meta-approved WhatsApp template. */
export type ParentMessageKind =
  | "fee_reminder"
  | "absentee_alert"
  | "payment_confirmation"
  | "report_card_ready"
  | "parent_portal_credentials";

export interface SchoolMessageResult {
  success: boolean;
  channel: MessagingChannel;
  messageId?: string;
  error?: string;
  /** Set when the provider rejected a free-text send and a template is needed. */
  needsTemplate?: boolean;
  demo?: boolean;
}

export const CHANNEL_SETTING_KEY = "messaging_channel";
export const TEMPLATE_SETTING_PREFIX = "whatsapp_template_";

/** Default when a school has expressed no preference: WhatsApp, SMS as backup. */
export const DEFAULT_CHANNEL: MessagingChannel = "whatsapp";

/** Is this channel actually able to deliver right now? */
export function isChannelAvailable(channel: MessagingChannel): boolean {
  if (channel === "whatsapp") return isWhatsAppConfigured();
  // SMS needs either a real gateway key, or dev mode (where it self-mocks).
  return !!(process.env.AFRICAS_TALKING_API_KEY || process.env.SMS_API_KEY || process.env.NODE_ENV === "development");
}

/**
 * Pick the channel to actually use.
 * Preference order: the school's explicit choice (if available) → the
 * preferred default → the other channel. Falls back to "sms" only when
 * neither is configured, so the caller gets a truthful "not configured"
 * error rather than a false success.
 */
export function resolveChannel(preferred?: MessagingChannel | null): MessagingChannel {
  if (preferred && isChannelAvailable(preferred)) return preferred;
  if (isChannelAvailable(DEFAULT_CHANNEL)) return DEFAULT_CHANNEL;
  if (isChannelAvailable("sms")) return "sms";
  return preferred ?? DEFAULT_CHANNEL;
}

type SettingsReader = (key: string) => Promise<string | null>;

/**
 * Send one message on the school's channel.
 *
 * @param to        destination phone in any accepted format
 * @param message   rendered message body
 * @param opts.preferredChannel school preference, if already known
 * @param opts.templateName Meta-approved template for business-initiated sends
 * @param opts.readSetting  reader for school_settings (server routes pass a
 *                          service-role reader; client code can pass one too)
 * @param opts.schoolId     used for SMS daily-limit enforcement
 */
export async function sendSchoolMessage(
  to: string,
  message: string,
  opts: {
    preferredChannel?: MessagingChannel | null;
    templateName?: string | null;
    /** Used to look up `whatsapp_template_<kind>` when no explicit name is given. */
    kind?: ParentMessageKind;
    readSetting?: SettingsReader;
    schoolId?: string;
  } = {},
): Promise<SchoolMessageResult> {
  if (!to || !message) {
    return { success: false, channel: "sms", error: "Recipient phone and message are required" };
  }

  let channel = opts.preferredChannel ?? null;
  let templateName = opts.templateName ?? null;

  if (opts.readSetting) {
    try {
      if (!channel) {
        const stored = await opts.readSetting(CHANNEL_SETTING_KEY);
        if (stored === "whatsapp" || stored === "sms") channel = stored;
      }
      if (!templateName && opts.kind) {
        templateName = await opts.readSetting(`${TEMPLATE_SETTING_PREFIX}${opts.kind}`);
      }
    } catch (err) {
      logger.warn("[messaging] Could not read school messaging settings:", err);
    }
  }

  const resolved = resolveChannel(channel);

  if (resolved === "whatsapp") {
    if (!isWhatsAppConfigured()) {
      return {
        success: false,
        channel: "whatsapp",
        error:
          "WhatsApp is not configured. Set WHATSAPP_BUSINESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID, or switch this school to SMS.",
        needsTemplate: false,
      };
    }

    if (templateName) {
      // Business-initiated: MUST use an approved template or Meta rejects it.
      const result = await sendWhatsAppTemplateMessage(to, {
        templateName,
        templateLanguage: "en",
        components: [
          {
            type: "body",
            // Meta substitutes {{1}}..{{n}} positionally. A single text
            // parameter covers the common single-placeholder templates.
            parameters: [{ type: "text", text: message.slice(0, 1024) }],
          },
        ],
      });
      if (result.success) return { success: true, channel: "whatsapp", messageId: result.messageId, demo: result.demo };
      return {
        success: false,
        channel: "whatsapp",
        error: result.error,
        needsTemplate: /template|parameter|not.*approved/i.test(result.error || ""),
      };
    }

    // No template configured. Free text only lands inside the 24h window —
    // outside it Meta returns an error, which we surface rather than hide.
    const result = await sendWhatsAppTextMessage(to, message);
    if (result.success) return { success: true, channel: "whatsapp", messageId: result.messageId, demo: result.demo };
    return {
      success: false,
      channel: "whatsapp",
      error: result.error,
      needsTemplate: true,
    };
  }

  // SMS channel
  if (!isChannelAvailable("sms")) {
    return {
      success: false,
      channel: "sms",
      error: "SMS is not configured. Set AFRICAS_TALKING_API_KEY, or enable WhatsApp for this school.",
    };
  }

  if (opts.schoolId) {
    const withinLimit = await checkSmsDailyLimit(opts.schoolId, 1);
    if (!withinLimit) {
      return { success: false, channel: "sms", error: "Daily SMS limit reached for this school" };
    }
  }

  const result = await sendAfricasTalkingSMSWithRetry(to, message, {
    formatUgandaNumber: true,
    schoolId: opts.schoolId,
  });
  if (result.success) return { success: true, channel: "sms", messageId: result.messageId, demo: result.demo };
  return { success: false, channel: "sms", error: result.error };
}

/**
 * Human-readable status for settings UI: which channels this deployment can
 * actually use right now.
 */
export function getMessagingCapability() {
  const whatsapp = isWhatsAppConfigured();
  const sms = isChannelAvailable("sms");
  return {
    whatsapp,
    sms,
    defaultChannel: resolveChannel(null),
    /** True when business-initiated WhatsApp will actually deliver. */
    whatsappCanSendProactively: whatsapp,
  };
}

export { formatWhatsAppPhone };
