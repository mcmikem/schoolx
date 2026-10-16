import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The fail-open guard that stops the middleware bouncing a signed-in user back
 * to /login depends entirely on recognising the session cookie.
 *
 * It did not, for the sessions that matter. @supabase/ssr splits a session
 * across numbered cookies once it outgrows a single one, so the browser holds
 *
 *   sb-<project>-auth-token.0
 *   sb-<project>-auth-token.1
 *
 * and a check for a name ending exactly in "-auth-token" rejects both. The
 * result was a correct password producing a redirect back to
 * /login?reason=session_expired, and the tell-tale retries that followed.
 *
 * It never showed up in development because the dev bypass returns before this
 * check runs, so it only ever bit production.
 */

const proxy = readFileSync(join(__dirname, "..", "proxy.ts"), "utf8");

// The predicate, lifted out of the middleware so it can be exercised directly.
function hasAuthSessionCookie(cookieNames: string[]): boolean {
  for (const name of cookieNames) {
    if (!name.startsWith("sb-")) continue;
    if (name.endsWith("-auth-token") || /^sb-[^:]+-auth-token\.\d+$/.test(name)) {
      return true;
    }
  }
  return false;
}

describe("session cookie detection", () => {
  it("matches a plain single-cookie session", () => {
    expect(hasAuthSessionCookie(["sb-gucxpmgwvnbqykevucbi-auth-token"])).toBe(true);
  });

  it("matches a chunked session, which is the case that was broken", () => {
    // Observed from a real sign-in as the super admin.
    expect(hasAuthSessionCookie(["sb-gucxpmgwvnbqykevucbi-auth-token.0"])).toBe(true);
    expect(hasAuthSessionCookie(["sb-gucxpmgwvnbqykevucbi-auth-token.1"])).toBe(true);
    expect(hasAuthSessionCookie(["sb-gucxpmgwvnbqykevucbi-auth-token.0", "sb-gucxpmgwvnbqykevucbi-auth-token.1"])).toBe(
      true,
    );
  });

  it("matches a session chunked far past two parts", () => {
    expect(hasAuthSessionCookie(["sb-abc-auth-token.12"])).toBe(true);
  });

  it("ignores unrelated cookies", () => {
    expect(hasAuthSessionCookie(["csrf-token", "_ga", "next-auth.callback-url"])).toBe(false);
  });

  it("does not match a different supabase cookie family", () => {
    expect(hasAuthSessionCookie(["sb-abc-refresh-token.0"])).toBe(false);
  });

  it("returns false with no cookies at all", () => {
    expect(hasAuthSessionCookie([])).toBe(false);
  });
});

describe("the middleware uses this predicate", () => {
  it("no longer relies on an exact -auth-token suffix", () => {
    expect(proxy).toContain("/^sb-[^:]+-auth-token\\.\\d+$/");
    expect(proxy).toContain("hasAuthSessionCookie");
  });

  it("still fails open for app shells rather than redirecting a valid session", () => {
    // The guard this predicate feeds: without it, a transient token-validation
    // failure signs the user out.
    expect(proxy).toContain("cookie-present-user-unverified");
    expect(proxy).toContain('pathname.startsWith("/super-admin")');
  });

  it("only skips the guard in development", () => {
    // Explains why this was invisible locally and only bit production.
    expect(proxy).toMatch(/NODE_ENV !== "production"[\s\S]{0,400}super-admin/);
  });
});
