// Centralized support contact configuration
// Platform default: 0727790003 (Uganda). Schools can override via school_settings.
import { NextResponse } from "next/server";

export const PLATFORM_SUPPORT_PHONE = "256727790003";
export const PLATFORM_SUPPORT_PHONE_DISPLAY = "+256 727 790 003";

export const PLATFORM_SUPPORT_WHATSAPP_URL = `https://wa.me/${PLATFORM_SUPPORT_PHONE}`;

export const DEFAULT_WHATSAPP_ENV = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || PLATFORM_SUPPORT_PHONE;

export function getSupportWhatsAppUrl(phone?: string | null): string {
  const formatted = phone ? phone.replace(/[^0-9]/g, "") : DEFAULT_WHATSAPP_ENV.replace(/[^0-9]/g, "");
  const waPhone = formatPhoneRaw(formatted);
  return `https://wa.me/${waPhone}`;
}

function formatPhoneRaw(digits: string): string {
  if (digits.startsWith("256") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `256${digits.slice(1)}`;
  if (digits.length === 9) return `256${digits}`;
  return digits;
}

export function generatePaymentSupportMessage(params: {
  schoolName?: string;
  plan?: string;
  moduleName?: string;
  error?: string;
}): string {
  const lines = ["Hello SkoolMate team!"];
  if (params.schoolName) lines.push(`School: ${params.schoolName}`);
  if (params.plan) lines.push(`Plan: ${params.plan}`);
  if (params.moduleName) lines.push(`Module: ${params.moduleName}`);
  if (params.error) lines.push(`Issue: ${params.error}`);
  lines.push("", "I need help with a payment / activation. Please assist.");
  return lines.join("\n");
}

export function generatePaymentWhatsAppLink(params: {
  phone?: string | null;
  schoolName?: string;
  plan?: string;
  moduleName?: string;
  error?: string;
}): string {
  const phone = params.phone || DEFAULT_WHATSAPP_ENV;
  const message = generatePaymentSupportMessage(params);
  const formatted = phone.replace(/[^0-9]/g, "");
  const waPhone = formatPhoneRaw(formatted);
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
}

// Build a support ticket message. WhatsApp first, SMS as the cheap secondary path.
function buildSupportMessage(params: { schoolName?: string; role?: string; page?: string; topic?: string }): string {
  const lines = ["Hello SkoolMate team, I need help with SkoolMate OS."];
  if (params.schoolName) lines.push(`School: ${params.schoolName}`);
  if (params.role) lines.push(`My role: ${params.role}`);
  if (params.page) lines.push(`Page: ${params.page}`);
  if (params.topic) lines.push(`Question: ${params.topic}`);
  lines.push("", "Please assist. Thank you!");
  return lines.join("\n");
}

export function generateSupportWhatsAppLink(params: {
  phone?: string | null;
  schoolName?: string;
  role?: string;
  page?: string;
  topic?: string;
}): string {
  const phone = (params.phone || DEFAULT_WHATSAPP_ENV).replace(/[^0-9]/g, "");
  return `https://wa.me/${formatPhoneRaw(phone)}?text=${encodeURIComponent(buildSupportMessage(params))}`;
}

// SMS is the secondary channel — used when WhatsApp is unavailable.
export function generateSupportSmsLink(params: {
  phone?: string | null;
  schoolName?: string;
  role?: string;
  page?: string;
  topic?: string;
}): string {
  const phone = (params.phone || DEFAULT_WHATSAPP_ENV).replace(/[^0-9]/g, "");
  return `sms:+${formatPhoneRaw(phone)}?body=${encodeURIComponent(buildSupportMessage(params))}`;
}

// Helper to build a NextResponse JSON with WhatsApp contact info included
export function errorWithWhatsApp(
  message: string,
  status: number,
  context?: {
    schoolName?: string;
    plan?: string;
    moduleName?: string;
    schoolPhone?: string | null;
  },
): NextResponse {
  const whatsappLink = generatePaymentWhatsAppLink({
    phone: context?.schoolPhone,
    schoolName: context?.schoolName,
    plan: context?.plan,
    moduleName: context?.moduleName,
    error: message,
  });
  return NextResponse.json(
    {
      error: message,
      contactWhatsApp: whatsappLink,
      contactPhone: PLATFORM_SUPPORT_PHONE_DISPLAY,
    },
    { status },
  );
}
