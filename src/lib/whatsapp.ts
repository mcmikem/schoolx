import { logger } from "@/lib/logger";

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  demo?: boolean;
}

export interface WhatsAppTemplateMessage {
  templateName: string;
  templateLanguage: string;
  components: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: "header" | "body" | "button";
  parameters: { type: string; text?: string }[];
}

export function getWhatsAppConfig() {
  return {
    accessToken: process.env.WHATSAPP_BUSINESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  };
}

export function isWhatsAppConfigured(): boolean {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();
  return !!(accessToken && phoneNumberId);
}

function stripPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export function formatWhatsAppPhone(phone: string): string {
  const digits = stripPhone(phone);
  if (digits.startsWith("256") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `256${digits.slice(1)}`;
  if (digits.length === 9) return `256${digits}`;
  return digits;
}

export function generateWhatsAppShareLink(phone: string, message: string): string {
  const formatted = formatWhatsAppPhone(phone);
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

export async function sendWhatsAppTextMessage(to: string, message: string): Promise<WhatsAppResult> {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();

  if (!accessToken || !phoneNumberId) {
    if (process.env.NODE_ENV === "development") {
      logger.debug(`[WhatsApp Demo] To: ${to}, Message: ${message}`);
      return { success: true, demo: true, messageId: `demo-wa-${Date.now()}` };
    }
    const error = "WhatsApp not configured: WHATSAPP_BUSINESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing";
    logger.error(`[WhatsApp] ${error}`);
    return { success: false, error };
  }

  const formattedPhone = formatWhatsAppPhone(to);

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { body: message },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || `WhatsApp API error ${response.status}`;
      logger.error("[WhatsApp] Send failed:", errorMsg);
      return { success: false, error: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown WhatsApp error";
    logger.error("[WhatsApp] Send error:", msg);
    return { success: false, error: msg };
  }
}

export async function sendWhatsAppTemplateMessage(
  to: string,
  template: WhatsAppTemplateMessage,
): Promise<WhatsAppResult> {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();

  if (!accessToken || !phoneNumberId) {
    if (process.env.NODE_ENV === "development") {
      logger.debug(`[WhatsApp Demo] Template to: ${to}, Template: ${template.templateName}`);
      return { success: true, demo: true, messageId: `demo-wa-tpl-${Date.now()}` };
    }
    const error = "WhatsApp not configured: WHATSAPP_BUSINESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing";
    logger.error(`[WhatsApp] ${error}`);
    return { success: false, error };
  }

  const formattedPhone = formatWhatsAppPhone(to);

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: template.templateName,
          language: { code: template.templateLanguage },
          components: template.components,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || `WhatsApp template error ${response.status}`;
      logger.error("[WhatsApp] Template send failed:", errorMsg);
      return { success: false, error: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown WhatsApp error";
    logger.error("[WhatsApp] Template send error:", msg);
    return { success: false, error: msg };
  }
}

export interface ParentPortalMessageOptions {
  parentName: string;
  parentPhone: string;
  studentName: string;
  password: string;
  portalUrl: string;
  schoolName: string;
}

export function buildParentPortalMessage(opts: ParentPortalMessageOptions): string {
  return (
    `Hello ${opts.parentName}! Your SkoolMate parent portal is ready.\n\n` +
    `Login: ${opts.parentPhone}\n` +
    `Password: ${opts.password}\n` +
    `Link: ${opts.portalUrl}\n\n` +
    `- ${opts.schoolName}`
  );
}

export async function sendWhatsApp(to: string, message: string): Promise<WhatsAppResult> {
  return sendWhatsAppTextMessage(to, message);
}

export async function sendParentPortalCredentials(
  opts: ParentPortalMessageOptions,
): Promise<WhatsAppResult & { shareLink: string }> {
  const message = buildParentPortalMessage(opts);
  const shareLink = generateWhatsAppShareLink(opts.parentPhone, message);

  if (isWhatsAppConfigured()) {
    const result = await sendWhatsAppTextMessage(opts.parentPhone, message);
    return { ...result, shareLink };
  }

  logger.info("[WhatsApp] Not configured — returning share link for manual send");
  if (process.env.NODE_ENV === "development") {
    return { success: true, demo: true, shareLink };
  }
  return { success: false, error: "WhatsApp not configured: credentials were not delivered", shareLink };
}
