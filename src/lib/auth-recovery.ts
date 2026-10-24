// Password-recovery link handling.
//
// Supabase can land the recovery redirect in three different shapes:
//   - `#access_token=…&refresh_token=…&type=recovery` (implicit flow, the
//     default for a plain supabase-js server client)
//   - `?code=…` (PKCE: every @supabase/ssr browser client forces PKCE)
//   - `?token_hash=…&type=recovery` (custom email templates)
//
// The reset page only understood the first, so a link in either of the other
// two shapes left no session behind and `updateUser()` answered
// "Auth session missing!". Parse all three, and fail with a message a teacher
// can act on instead of the SDK's internal wording.

export type RecoveryParams =
  | { kind: "code"; code: string }
  | { kind: "token_hash"; tokenHash: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "none" };

export interface RecoveryAuth {
  exchangeCodeForSession(code: string): Promise<{ error: { message?: string } | null }>;
  verifyOtp(params: { type: "recovery"; token_hash: string }): Promise<{ error: { message?: string } | null }>;
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<{ error: { message?: string } | null }>;
}

export const RECOVERY_EXPIRED_MESSAGE = "This reset link has expired or was already used. Request a new one.";
export const RECOVERY_WRONG_BROWSER_MESSAGE =
  "Open the reset link in the same browser you requested it from, or request a new link.";

function paramsFrom(value: string): URLSearchParams {
  return new URLSearchParams(value.replace(/^[?#]/, ""));
}

export function parseRecoveryParams(search: string, hash: string): RecoveryParams {
  const query = paramsFrom(search);
  const fragment = paramsFrom(hash);

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken };
  }

  const tokenHash = query.get("token_hash") ?? fragment.get("token_hash");
  if (tokenHash) {
    return { kind: "token_hash", tokenHash };
  }

  const code = query.get("code") ?? fragment.get("code");
  if (code) {
    return { kind: "code", code };
  }

  return { kind: "none" };
}

/** Supabase appends `error`/`error_code` when the link was already used or expired. */
export function recoveryLinkError(search: string, hash: string): string | null {
  for (const source of [paramsFrom(search), paramsFrom(hash)]) {
    const code = source.get("error_code");
    const error = source.get("error");
    if (!code && !error) continue;
    if (code === "otp_expired" || error === "access_denied") return RECOVERY_EXPIRED_MESSAGE;
    const description = source.get("error_description");
    return description ? description.replace(/\+/g, " ") : RECOVERY_EXPIRED_MESSAGE;
  }
  return null;
}

export async function completeRecovery(
  auth: RecoveryAuth,
  params: RecoveryParams,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (params.kind === "none") return { ok: false, message: RECOVERY_EXPIRED_MESSAGE };

  if (params.kind === "tokens") {
    const { error } = await auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    return error ? { ok: false, message: error.message || RECOVERY_EXPIRED_MESSAGE } : { ok: true };
  }

  if (params.kind === "token_hash") {
    const { error } = await auth.verifyOtp({ type: "recovery", token_hash: params.tokenHash });
    return error ? { ok: false, message: error.message || RECOVERY_EXPIRED_MESSAGE } : { ok: true };
  }

  const { error } = await auth.exchangeCodeForSession(params.code);
  if (!error) return { ok: true };
  // A missing/used verifier is the normal failure when the link was opened in
  // a different browser (WhatsApp/Gmail in-app browsers have their own
  // storage). Say that instead of surfacing "PKCE code verifier not found".
  if (/verifier|code challenge|invalid request/i.test(error.message || "")) {
    return { ok: false, message: RECOVERY_WRONG_BROWSER_MESSAGE };
  }
  return { ok: false, message: error.message || RECOVERY_EXPIRED_MESSAGE };
}
