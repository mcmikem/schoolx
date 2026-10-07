/**
 * One place for UGX formatting.
 *
 * There used to be 17 private copies of this spread across the dashboard,
 * the fees screens and the reports, in three different styles. Two of them
 * had bugs the others did not: the compact form rounded 999,999 up to
 * "1000K" instead of crossing into millions, and it returned the bare
 * unsigned number for negatives — an overpaid balance rendered as a positive.
 *
 * Locale is pinned rather than left to the browser so a school that opens
 * the app on a de-DE machine and an en-US machine sees the same digits.
 */

const UGX = "en-UG";

/** `UGX 1,234,567` — tables, invoices, receipts, anything with room. */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "UGX 0";
  return `UGX ${Math.round(amount).toLocaleString(UGX)}`;
}

/** Magnitudes below a trillion shillings, rounded the way they always were:
 *  zero decimals on thousands (12K), one on millions and billions (1.5M). */
function compactMagnitude(abs: number): string {
  if (abs >= 1_000_000_000) {
    const text = (abs / 1_000_000_000).toFixed(1);
    if (Number(text) < 1_000) return `${text}B`;
    return `${(abs / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (abs >= 1_000_000) {
    const text = (abs / 1_000_000).toFixed(1);
    // 999,950,000 prints as "1000.0M" — it is really one billion.
    if (Number(text) < 1_000) return `${text}M`;
    return `${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000) {
    const text = (abs / 1_000).toFixed(0);
    // 999,999 prints as "1000K" — it is really one million.
    if (Number(text) < 1_000) return `${text}K`;
    return `${(abs / 1_000_000).toFixed(1)}M`;
  }
  return abs.toLocaleString(UGX);
}

/**
 * `1.5M` / `12K` / `450` — dashboard tiles where the label already says
 * what the number is, so the currency code would just eat the space.
 *
 * Pass `withUgx` on the wider super-admin screens that used to spell it out.
 */
export function formatCompactCurrency(amount: number, withUgx = false): string {
  if (!Number.isFinite(amount)) return withUgx ? "UGX 0" : "0";
  const sign = amount < 0 ? "-" : "";
  const prefix = withUgx ? "UGX " : "";
  // The sign belongs to the amount, so it goes after the currency code.
  return `${prefix}${sign}${compactMagnitude(Math.abs(Math.round(amount)))}`;
}
