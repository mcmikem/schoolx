"use client";

import { useState, useEffect } from "react";
import MaterialIcon from "./MaterialIcon";
import { PLATFORM_SUPPORT_PHONE_DISPLAY } from "@/lib/support-contact";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface ContactSupportProps {
  message?: string;
  prefillMessage?: string;
  variant?: "button" | "inline" | "banner";
  label?: string;
  context?: {
    schoolName?: string;
    plan?: string;
    moduleName?: string;
  };
}

export async function getSchoolSupportPhone(schoolId?: string): Promise<string | null> {
  if (!schoolId) return null;
  try {
    const res = await supabase
      .from("school_settings")
      .select("value")
      .eq("school_id", schoolId)
      .eq("key", "support_phone")
      .maybeSingle();
    return res.data?.value || null;
  } catch {
    return null;
  }
}

export function useSchoolSupportPhone(): string | null {
  const { school } = useAuth();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!school?.id) return;
    // Prefer direct school.support_phone column, fall back to school_settings lookup
    const schoolAny = school as unknown as Record<string, unknown>;
    if (schoolAny.support_phone) {
      setPhone(schoolAny.support_phone as string);
    } else {
      getSchoolSupportPhone(school.id).then(setPhone);
    }
  }, [school?.id, school]);

  return phone;
}

export function generateWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  let waPhone: string;
  if (digits.startsWith("256") && digits.length === 12) waPhone = digits;
  else if (digits.startsWith("0") && digits.length === 10) waPhone = `256${digits.slice(1)}`;
  else waPhone = `256${digits}`;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
}

export default function ContactSupport({
  message,
  prefillMessage,
  variant = "inline",
  label,
  context,
}: ContactSupportProps) {
  const schoolPhone = useSchoolSupportPhone();
  const phone = schoolPhone || PLATFORM_SUPPORT_PHONE_DISPLAY;
  const waPhone = schoolPhone || "256727790003";

  const defaultMessage =
    prefillMessage ||
    (context
      ? [
          "Hello SkoolMate team!",
          context.schoolName ? `School: ${context.schoolName}` : "",
          context.plan ? `Plan: ${context.plan}` : "",
          context.moduleName ? `Module: ${context.moduleName}` : "",
          "",
          message || "I need help.",
        ]
          .filter(Boolean)
          .join("\n")
      : "Hello SkoolMate team! I need help.");

  const waUrl = generateWhatsAppUrl(waPhone, defaultMessage);

  if (variant === "button") {
    return (
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:bg-[#20BD5A] transition-colors"
      >
        <MaterialIcon icon="chat" />
        {label || "Chat on WhatsApp"}
      </a>
    );
  }

  if (variant === "banner") {
    return (
      <div className="rounded-xl bg-[#F0FFF4] border border-[#25D366]/30 p-4 flex items-start gap-3">
        <div className="text-[#25D366] mt-0.5">
          <MaterialIcon icon="support_agent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--t1)]">
            {message || "Need help?"}
          </p>
          <p className="text-xs text-[var(--t3)] mt-1">
            Contact us on{" "}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#25D366] font-medium hover:underline"
            >
              WhatsApp ({phone})
            </a>
          </p>
        </div>
      </div>
    );
  }

  // inline variant
  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-[#25D366] hover:underline font-medium"
    >
      <MaterialIcon icon="chat" className="text-base" />
      {label || `Contact support on WhatsApp (${phone})`}
    </a>
  );
}
