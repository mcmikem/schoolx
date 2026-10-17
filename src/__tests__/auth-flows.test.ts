import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Auth-flow regression tests — sign-in, register, sign-out, onboarding guard.
 *
 * Scope: pure-logic and unit tests — no network calls, no rendering.
 * Purpose: catch regressions in phone normalisation, login-attempt building,
 *          demo-role sanitisation, password rules, and the auth-context
 *          loading-state invariants that prevent the DashboardRouter race.
 */

import { buildAuthEmailFromPhone, buildAuthLoginAttempts } from "@/lib/auth-login";
import { normalizeAuthPhone } from "@/lib/validation";

// ---------------------------------------------------------------------------
// normalizeAuthPhone — phone normalisation must be stable
// ---------------------------------------------------------------------------

describe("normalizeAuthPhone", () => {
  it("converts 9-digit local format to 256 prefix", () => {
    expect(normalizeAuthPhone("700000000")).toBe("256700000000");
  });

  it("converts 0xxx (10 digits) to 256 prefix", () => {
    expect(normalizeAuthPhone("0700000000")).toBe("256700000000");
  });

  it("strips spaces before normalising", () => {
    expect(normalizeAuthPhone("0700 000 000")).toBe("256700000000");
  });

  it("strips dashes before normalising", () => {
    expect(normalizeAuthPhone("0700-000-000")).toBe("256700000000");
  });

  it("strips leading + from +256 numbers and returns digits", () => {
    // +256700000000 → digits → 256700000000 (already 12 digits, returned as-is)
    expect(normalizeAuthPhone("+256700000000")).toBe("256700000000");
  });

  it("does not double-prefix numbers already starting with 256", () => {
    const result = normalizeAuthPhone("256700000000");
    expect(result).toBe("256700000000");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeAuthPhone("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// buildAuthEmailFromPhone — email used to store accounts in Supabase Auth
// ---------------------------------------------------------------------------

describe("buildAuthEmailFromPhone", () => {
  it("builds @omuto.org email from normalised phone", () => {
    expect(buildAuthEmailFromPhone("0700000000")).toBe("256700000000@omuto.org");
  });

  it("produces the same email regardless of input format", () => {
    const formats = ["0700000000", "0700 000 000", "700000000", "+256700000000"];
    const emails = formats.map(buildAuthEmailFromPhone);
    expect(new Set(emails).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildAuthLoginAttempts — login attempt list completeness
// ---------------------------------------------------------------------------

describe("buildAuthLoginAttempts", () => {
  it("returns empty array for empty input", () => {
    expect(buildAuthLoginAttempts("")).toHaveLength(0);
  });

  it("returns direct email attempt first when input looks like an email", () => {
    const attempts = buildAuthLoginAttempts("admin@school.com");
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toEqual({ type: "email", value: "admin@school.com" });
  });

  it("email input is lowercased", () => {
    const attempts = buildAuthLoginAttempts("Admin@School.COM");
    expect(attempts[0].value).toBe("admin@school.com");
  });

  it("includes normalized omuto.org email for phone input", () => {
    const attempts = buildAuthLoginAttempts("0700000000");
    const emailValues = attempts.filter((a) => a.type === "email").map((a) => a.value);
    // Primary format: normalized@omuto.org
    expect(emailValues).toContain("256700000000@omuto.org");
  });

  it("includes phone fallback attempts for phone input", () => {
    const attempts = buildAuthLoginAttempts("0700000000");
    const types = attempts.map((a) => a.type);
    expect(types).toContain("phone");
  });

  it("does not produce duplicate attempts", () => {
    const attempts = buildAuthLoginAttempts("256700000000");
    const keys = attempts.map((a) => `${a.type}:${a.value}`);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it("handles phone with country code prefix without duplicates", () => {
    const a1 = buildAuthLoginAttempts("256700000000");
    const a2 = buildAuthLoginAttempts("0700000000");
    // Both must include the primary email attempt
    const emailsA1 = a1.filter((a) => a.type === "email").map((a) => a.value);
    const emailsA2 = a2.filter((a) => a.type === "email").map((a) => a.value);
    // They must resolve to the same @omuto.org address
    expect(emailsA1).toContain("256700000000@omuto.org");
    expect(emailsA2).toContain("256700000000@omuto.org");
  });
});

// ---------------------------------------------------------------------------
// Demo-role sanitisation — privilege escalation must be blocked
// ---------------------------------------------------------------------------
// Tests the REAL exported functions from auth-context-types (not a local copy),
// so they can never drift from production the way a re-implementation can.

import { DEMO_ALLOWED_ROLES, sanitizeDemoRole } from "@/lib/auth-context-types";

describe("sanitizeDemoRole", () => {
  it("returns the role unchanged for allowed roles", () => {
    for (const role of DEMO_ALLOWED_ROLES) {
      expect(sanitizeDemoRole(role)).toBe(role);
    }
  });

  it("blocks super_admin elevation", () => {
    expect(sanitizeDemoRole("super_admin")).toBe("teacher");
  });

  it("blocks school_admin elevation", () => {
    expect(sanitizeDemoRole("school_admin")).toBe("teacher");
  });

  it("allows parent role (in real allowed list)", () => {
    expect(sanitizeDemoRole("parent")).toBe("parent");
  });

  it("defaults to teacher for null input", () => {
    expect(sanitizeDemoRole(null)).toBe("teacher");
  });

  it("defaults to teacher for undefined input", () => {
    expect(sanitizeDemoRole(undefined)).toBe("teacher");
  });

  it("defaults to teacher for empty string", () => {
    expect(sanitizeDemoRole("")).toBe("teacher");
  });

  it("defaults to teacher for numeric input", () => {
    expect(sanitizeDemoRole(42)).toBe("teacher");
  });
});

// ---------------------------------------------------------------------------
// Register form password rules — must match API validation (8+ chars, 1 upper, 1 digit)
// ---------------------------------------------------------------------------

import { validatePassword as validateRegisterPasswordRules } from "@/lib/server/marketer-logic";

function validateRegisterPassword(password: string, confirmPassword: string): string | null {
  const ruleError = validateRegisterPasswordRules(password);
  if (ruleError) return ruleError;
  if (password !== confirmPassword) return "Passwords do not match";
  return null;
}

describe("register password validation", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(validateRegisterPassword("Abc1234", "Abc1234")).toMatch(/at least 8/i);
  });

  it("rejects passwords without an uppercase letter", () => {
    expect(validateRegisterPassword("abc12345", "abc12345")).toMatch(/uppercase/i);
  });

  it("rejects passwords without a number", () => {
    expect(validateRegisterPassword("AbcDefGH", "AbcDefGH")).toMatch(/number/i);
  });

  it("rejects mismatched confirmation", () => {
    expect(validateRegisterPassword("SecurePass1", "DifferentPass1")).toMatch(/do not match/i);
  });

  it("accepts a valid password", () => {
    expect(validateRegisterPassword("SecurePass1", "SecurePass1")).toBeNull();
  });

  it("accepts a password that is exactly 8 characters", () => {
    expect(validateRegisterPassword("Secure1!", "Secure1!")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Auth-context loading-state invariant (regression guard for the race condition)
//
// Requirement: whenever onAuthStateChange fires SIGNED_IN with a live session,
// loading must be set to true BEFORE any async getUser()/fetchUserData() call.
// This prevents DashboardRouter from seeing loading=false + user=null and
// redirecting to /login while the session is being fetched.
//
// We verify the invariant by inspecting the source code token — not ideal, but
// guarantees the guard never silently disappears.
// ---------------------------------------------------------------------------

describe("auth-context: onAuthStateChange SIGNED_IN loading guard", () => {
  it("source sets loading only on SIGNED_IN event (not INITIAL_SESSION or TOKEN_REFRESHED)", async () => {
    // Read the compiled source to assert the invariant exists.
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.default.resolve(__dirname, "../lib/auth-context.tsx");
    const source = fs.default.readFileSync(filePath, "utf-8");

    // The guard should only set loading=true on explicit SIGNED_IN events.
    // INITIAL_SESSION and TOKEN_REFRESHED must NOT toggle loading to prevent
    // loading flickers / infinite loading loops during normal navigation.
    expect(source).toMatch(/if\s*\(\s*event\s*===\s*"SIGNED_IN"\s*\)\s*setLoading\s*\(\s*true\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// First-paint hydration — the loading-time critical path
// ---------------------------------------------------------------------------

describe("dashboard paints without waiting on the network", () => {
  const src = readFileSync(join(__dirname, "..", "lib", "auth-context.tsx"), "utf8");

  /**
   * Auth used to gate the entire dashboard on getUser() and then
   * /api/auth/me/ — two sequential round trips behind a blank loading screen,
   * with a 2s safety timer as the thing that usually rescued it. On rural 2G
   * that is the three seconds the app appeared to take to load.
   *
   * The cached profile removes both hops from the critical path. Pinned as
   * source because the value is the ordering of effects inside a large
   * provider, which no unit test can meaningfully observe without standing up
   * the whole auth stack.
   */
  it("hydrates the cached profile as soon as a session exists", () => {
    expect(src).toContain("const cachedUser = localStorage.getItem(OFFLINE_USER_KEY);");
    expect(src).toMatch(/setUser\(JSON\.parse\(cachedUser\) as User\)/);
  });

  it("unblocks a returning session after a matching cached profile is painted", () => {
    const initialSession = src.indexOf('if (event === "INITIAL_SESSION" && session)');
    const getUser = src.indexOf("withSupabaseLockRetry(async () => await supabase!.auth.getUser())", initialSession);
    const hydrate = src.indexOf("setUser(parsedUser)", initialSession);
    const ready = src.indexOf("setAuthInitialized(true)", hydrate);

    expect(initialSession).toBeGreaterThan(-1);
    expect(hydrate).toBeGreaterThan(initialSession);
    expect(ready).toBeGreaterThan(hydrate);
    expect(ready).toBeLessThan(getUser);
    expect(src).toContain("parsedUser.auth_id === session.user.id || parsedUser.id === session.user.id");
  });

  it("does not compete with first paint by downloading whole school tables at sign-in", () => {
    expect(src).not.toContain("offlineDB.refreshAll([");
  });

  it("does not wait for getUser() or /api/auth/me/ before showing it", () => {
    // The hydration block must appear before the getUser() call that follows it.
    const hydrate = src.indexOf("Optimistic profile hydration failed");
    const getUser = src.indexOf("withSupabaseLockRetry(async () => await supabase!.auth.getUser())");
    expect(hydrate).toBeGreaterThan(-1);
    expect(getUser).toBeGreaterThan(-1);
    expect(hydrate).toBeLessThan(getUser);
  });

  it("keeps reconciling afterwards, so a stale cache self-corrects", () => {
    // Optimistic must not mean "trust the cache forever": the fresh profile
    // fetch still has to run and overwrite it.
    // Anchor on the *call site* in checkUser, not the fetch itself, which lives
    // inside fetchUserData and is defined earlier in the file.
    const hydrate = src.indexOf("Optimistic profile hydration failed");
    const reconcile = src.indexOf("await fetchUserData(authUser.id)");
    expect(reconcile).toBeGreaterThan(-1);
    expect(reconcile).toBeGreaterThan(hydrate);
  });

  it("survives a corrupt cache instead of blocking on it", () => {
    expect(src).toContain("Optimistic profile hydration failed");
  });

  it("still clears the cache on sign-out, so it cannot outlive a session", () => {
    expect(src).toMatch(/signOut[\s\S]{0,2000}localStorage\.removeItem\(OFFLINE_USER_KEY\)/);
  });
});

describe("navigation deadline leaves room for the page to load", () => {
  const sw = readFileSync(join(__dirname, "..", "..", "public", "sw.js"), "utf8");

  it("serves a cached navigation well inside the budget", () => {
    // The deadline is pure waiting: the copy is already in hand and the network
    // keeps running afterwards to refresh the cache. At 3000ms it consumed the
    // entire budget before a single byte of JS was requested.
    const cached = Number(sw.match(/NAVIGATION_TIMEOUT_CACHED_MS\s*=\s*(\d+)/)?.[1]);
    expect(cached).toBeGreaterThan(0);
    expect(cached).toBeLessThanOrEqual(1500);
  });

  it("still gives an uncached route a chance to arrive", () => {
    const uncached = Number(sw.match(/NAVIGATION_TIMEOUT_MS\s*=\s*(\d+)/)?.[1]);
    const cached = Number(sw.match(/NAVIGATION_TIMEOUT_CACHED_MS\s*=\s*(\d+)/)?.[1]);
    expect(uncached).toBeGreaterThan(cached);
  });
});
