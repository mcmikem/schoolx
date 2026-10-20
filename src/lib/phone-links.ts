/**
 * Normalise a Ugandan phone number for click-to-call and WhatsApp.
 *
 * Parents' numbers are typed in whatever form fits: "0772 123 456",
 * "+256772123456", "256-772-123456" or "772123456". `wa.me` only accepts the
 * international digits, so a raw local number silently opens an empty chat.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("0") && digits.length === 10) return `256${digits.slice(1)}`;
  if (digits.length === 9) return `256${digits}`;
  if (digits.startsWith("256") && digits.length >= 12) return digits;
  return digits.length >= 9 ? digits : null;
}

export function telHref(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  return normalized ? `tel:+${normalized}` : null;
}

export function whatsappHref(phone: string | null | undefined, message?: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${normalized}${query}`;
}
