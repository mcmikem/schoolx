"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { telHref, whatsappHref } from "@/lib/phone-links";

interface ContactActionsProps {
  phone?: string | null;
  name?: string;
}

/** Tap-to-call / WhatsApp shortcuts for a parent or guardian's phone. */
export default function ContactActions({ phone, name }: ContactActionsProps) {
  const call = telHref(phone);
  const whatsapp = whatsappHref(phone, name ? `Hello ${name}, ` : undefined);
  if (!call && !whatsapp) return null;

  return (
    <div className="flex items-center gap-1">
      {call && (
        <a
          href={call}
          aria-label={name ? `Call ${name}` : "Call this contact"}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--t2)] hover:bg-[var(--surface-container-low)]"
        >
          <MaterialIcon icon="call" size={14} />
          Call
        </a>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={name ? `WhatsApp ${name}` : "WhatsApp this contact"}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--green-ink)] hover:bg-[var(--green-soft)]"
        >
          <MaterialIcon icon="chat" size={14} />
          WhatsApp
        </a>
      )}
    </div>
  );
}
