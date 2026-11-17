/**
 * SMS template variable rendering.
 *
 * Template bodies ship in two flavours across the app — the SMS Centre and
 * automation use single braces (`{student_name}`) while the Messages templates
 * use double braces (`{{student_name}}`). Nothing substituted either one, so a
 * secretary who picked "Fee Reminder" sent parents the literal text
 * "{{student_name}}" and was billed for it. Both shapes are accepted here and
 * every send path renders through this module.
 */

export type SmsTemplateVars = Record<string, string | number | null | undefined>;

/** Matches `{{key}}` first so the double-brace form is not partially consumed. */
const TOKEN_RE = /\{\{(\w+)\}\}|\{(\w+)\}/g;

function lookup(vars: SmsTemplateVars, key: string): string | undefined {
  const value = vars[key];
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

/**
 * Fill in the tokens the caller has values for. Tokens with no value are left
 * exactly as written rather than being blanked — an empty slot reads as a
 * broken message, a visible token reads as a bug the sender can still catch.
 * `unresolvedSmsTokens()` is what surfaces them before the send.
 */
export function renderSmsTemplate(body: string, vars: SmsTemplateVars): string {
  if (!body) return body;
  return body.replace(TOKEN_RE, (match, doubleKey?: string, singleKey?: string) => {
    const filled = lookup(vars, doubleKey || singleKey || "");
    return filled === undefined ? match : filled;
  });
}

/** Unique token names still present after rendering, in order of appearance. */
export function unresolvedSmsTokens(body: string, vars: SmsTemplateVars): string[] {
  const found: string[] = [];
  const rendered = renderSmsTemplate(body, vars);
  for (const match of rendered.matchAll(TOKEN_RE)) {
    const key = match[1] || match[2];
    if (key && !found.includes(key)) found.push(key);
  }
  return found;
}

/** True when the body carries at least one recognisable token. */
export function hasSmsTokens(body: string): boolean {
  return new RegExp(TOKEN_RE.source).test(body);
}

/** Variables every send path can fill without extra lookups. */
export function baseSmsVars(schoolName?: string | null, now: Date = new Date()): SmsTemplateVars {
  const date = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return {
    school_name: schoolName || "the school",
    date,
    today: date,
  };
}

/** Plain-language list for the composer hint. */
export const SMS_VARIABLE_HINTS: Array<{ token: string; label: string }> = [
  { token: "{student_name}", label: "pupil's name" },
  { token: "{parent_name}", label: "parent's name" },
  { token: "{class_name}", label: "class or stream" },
  { token: "{school_name}", label: "your school" },
  { token: "{date}", label: "today's date" },
];
