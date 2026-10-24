import { describe, expect, it, jest } from "@jest/globals";
import {
  completeRecovery,
  parseRecoveryParams,
  RECOVERY_EXPIRED_MESSAGE,
  RECOVERY_WRONG_BROWSER_MESSAGE,
  type RecoveryAuth,
  recoveryLinkError,
} from "@/lib/auth-recovery";

function fakeAuth(overrides: Partial<RecoveryAuth> = {}): RecoveryAuth {
  return {
    exchangeCodeForSession: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(async () => ({ error: null })),
    setSession: jest.fn(async () => ({ error: null })),
    ...overrides,
  };
}

describe("recovery link parsing", () => {
  it("reads implicit-flow tokens from the hash", () => {
    expect(parseRecoveryParams("", "#access_token=at&refresh_token=rt&type=recovery")).toEqual({
      kind: "tokens",
      accessToken: "at",
      refreshToken: "rt",
    });
  });

  it("reads PKCE codes and token hashes from the query string", () => {
    expect(parseRecoveryParams("?code=abc123", "")).toEqual({ kind: "code", code: "abc123" });
    expect(parseRecoveryParams("?token_hash=hash1&type=recovery", "")).toEqual({
      kind: "token_hash",
      tokenHash: "hash1",
    });
  });

  it("reports nothing to recover from on a direct visit", () => {
    expect(parseRecoveryParams("", "")).toEqual({ kind: "none" });
  });

  it("turns Supabase's otp_expired redirect into a human message", () => {
    expect(recoveryLinkError("?error=access_denied&error_code=otp_expired", "")).toBe(RECOVERY_EXPIRED_MESSAGE);
    expect(recoveryLinkError("", "#error=access_denied&error_code=otp_expired")).toBe(RECOVERY_EXPIRED_MESSAGE);
    expect(recoveryLinkError("?foo=bar", "")).toBeNull();
  });
});

describe("completing recovery", () => {
  it("exchanges a PKCE code for a session", async () => {
    const auth = fakeAuth();
    await expect(completeRecovery(auth, { kind: "code", code: "abc" })).resolves.toEqual({ ok: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("verifies a token_hash from a custom email template", async () => {
    const auth = fakeAuth();
    await expect(completeRecovery(auth, { kind: "token_hash", tokenHash: "h1" })).resolves.toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "h1" });
  });

  it("restores implicit-flow tokens", async () => {
    const auth = fakeAuth();
    await expect(completeRecovery(auth, { kind: "tokens", accessToken: "at", refreshToken: "rt" })).resolves.toEqual({
      ok: true,
    });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
  });

  it("explains that a PKCE link must be opened in the requesting browser", async () => {
    const auth = fakeAuth({
      exchangeCodeForSession: jest.fn(async () => ({
        error: { message: "PKCE code verifier not found in storage" },
      })),
    });
    await expect(completeRecovery(auth, { kind: "code", code: "abc" })).resolves.toEqual({
      ok: false,
      message: RECOVERY_WRONG_BROWSER_MESSAGE,
    });
  });

  it("falls back to the expired message for other failures", async () => {
    const auth = fakeAuth({
      verifyOtp: jest.fn(async () => ({ error: { message: "" } })),
    });
    await expect(completeRecovery(auth, { kind: "token_hash", tokenHash: "h1" })).resolves.toEqual({
      ok: false,
      message: RECOVERY_EXPIRED_MESSAGE,
    });
  });
});
