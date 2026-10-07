// ============================================================================
// Why a sign-in failed — and what to say about it.
//
// The login page used to collapse every failure into one production string:
// "Invalid login details". A gateway timeout from Supabase, an exhausted rate
// limit and a genuinely wrong password were indistinguishable to the person at
// the keyboard, so an outage read as "your password is wrong" — and the local
// lockout counted those failures too, locking people out of their own school
// while the sign-in service was unreachable.
//
// Supabase only accuses the password when it actually checked one, so the rule
// here is deliberately one-sided: we only claim the credentials are bad when
// the message says so in the words GoTrue uses. Everything else gets an
// honest answer.
// ============================================================================

export type AuthFailureKind =
  /** The server checked and rejected the email/password pair. */
  | "credentials"
  /** Unreachable, timed out, or a 5xx. Nothing was checked. */
  | "transient"
  /** Supabase is rate limiting. Clears on its own. */
  | "rate_limited"
  /** The account exists but cannot sign in yet (unconfirmed, disabled). */
  | "account"
  /** A failure we cannot attribute. Treated as a real attempt. */
  | "unknown";

const CREDENTIAL_PATTERNS: RegExp[] = [
  /invalid login credentials/i,
  /invalid login/i,
  /wrong password/i,
  /incorrect password/i,
  /invalid password/i,
  /user not found/i,
  /no user/i,
  /email not found/i,
  /invalid phone number or password/i,
  /invalid email or password/i,
];

const TRANSIENT_PATTERNS: RegExp[] = [
  /gateway timeout/i,
  /\b50[234]\b/,
  /\b500\b/,
  /timed? ?out/i,
  /timeout/i,
  /failed to fetch/i,
  /fetch failed/i,
  /load failed/i,
  /networkerror/i,
  /network error/i,
  /network request failed/i,
  /connection (?:is )?(?:closed|reset|refused)/i,
  /unable to connect/i,
  /econnrefused|etimedout|enotfound|epipe/i,
];

const RATE_LIMIT_PATTERNS: RegExp[] = [/rate.?limit/i, /too many requests/i, /over_request_rate_limit/i, /\b429\b/];

const ACCOUNT_PATTERNS: RegExp[] = [
  /email not confirmed/i,
  /phone not confirmed/i,
  /user banned/i,
  /user is banned/i,
  /account disabled/i,
  /user disabled/i,
  /signups not allowed/i,
];

/**
 * Classify a sign-in failure from the message GoTrue (or the network in front
 * of it) produced. Order matters: rate limiting and outages are checked before
 * credentials, because an outage page can echo words we would otherwise read as
 * a password rejection.
 */
export function classifyAuthFailure(message: string | null | undefined): AuthFailureKind {
  const text = (message || "").trim();
  if (!text) return "unknown";

  if (RATE_LIMIT_PATTERNS.some((re) => re.test(text))) return "rate_limited";
  if (ACCOUNT_PATTERNS.some((re) => re.test(text))) return "account";
  if (TRANSIENT_PATTERNS.some((re) => re.test(text))) return "transient";
  if (CREDENTIAL_PATTERNS.some((re) => re.test(text))) return "credentials";

  return "unknown";
}

/**
 * True when this failure says something about the password itself.
 *
 * Only these count toward the local lockout. A gateway timeout is not a guess
 * at anyone's password, and treating it as one locked users out of their own
 * school for five minutes whenever Supabase had a bad minute.
 */
export function countsAsCredentialGuess(kind: AuthFailureKind): boolean {
  return kind === "credentials" || kind === "unknown";
}

/**
 * The message to show.
 *
 * In development the raw message is kept so the cause is visible while
 * working locally; in production credentials keep the generic wording (never
 * tell an attacker which half was wrong) and everything else tells the truth.
 */
export function loginFailureMessage(kind: AuthFailureKind, options: { dev?: boolean; detail?: string } = {}): string {
  const detail = (options.detail || "").trim();

  if (options.dev && detail) {
    const label =
      kind === "credentials"
        ? "rejected"
        : kind === "transient"
          ? "unreachable"
          : kind === "rate_limited"
            ? "rate limited"
            : kind === "account"
              ? "blocked"
              : "unknown";
    return `Login failed (${label}): ${detail}`;
  }

  switch (kind) {
    case "transient":
      return "Couldn't reach the sign-in service. Check your connection and try again.";
    case "rate_limited":
      return "Too many sign-in requests. Wait a minute, then try again.";
    case "account":
      return "This account can't sign in yet. Confirm your email, or ask an administrator to activate it.";
    case "credentials":
    case "unknown":
    default:
      return "Invalid login details";
  }
}
