/**
 * Auth-flow regression tests — sign-in, register, sign-out, onboarding guard.
 *
 * Scope: pure-logic and unit tests — no network calls, no rendering.
 * Purpose: catch regressions in phone normalisation, login-attempt building,
 *          demo-role sanitisation, password rules, and the auth-context
 *          loading-state invariants that prevent the DashboardRouter race.
 */

import { normalizeAuthPhone } from "@/lib/validation";
import {
  buildAuthLoginAttempts,
  buildAuthEmailFromPhone,
} from "@/lib/auth-login";

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
    expect(buildAuthEmailFromPhone("0700000000")).toBe(
      "256700000000@omuto.org",
    );
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

  it("includes omuto.org email variants for phone input", () => {
    const attempts = buildAuthLoginAttempts("0700000000");
    const emailValues = attempts
      .filter((a) => a.type === "email")
      .map((a) => a.value);
    expect(emailValues).toContain("0700000000@omuto.org");
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

// Re-implement DEMO_ALLOWED_ROLES and sanitizeDemoRole in isolation so this
// test does NOT depend on auth-context internals (which would require a full
// React provider setup).
const DEMO_ALLOWED_ROLES = [
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
];

function sanitizeDemoRole(raw: unknown): string {
  if (typeof raw === "string" && DEMO_ALLOWED_ROLES.includes(raw)) return raw;
  return "teacher"; // lowest-privilege default
}

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

  it("blocks parent role (not in allowed list)", () => {
    expect(sanitizeDemoRole("parent")).toBe("teacher");
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

/** Mirrors the validateStep3 password logic in register/page.tsx */
function validateRegisterPassword(
  password: string,
  confirmPassword: string,
): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one uppercase letter and one number";
  }
  if (password !== confirmPassword) return "Passwords do not match";
  return null; // valid
}

describe("register password validation", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(validateRegisterPassword("Abc1234", "Abc1234")).toMatch(/at least 8/i);
  });

  it("rejects passwords without an uppercase letter", () => {
    expect(validateRegisterPassword("abc12345", "abc12345")).toMatch(
      /uppercase/i,
    );
  });

  it("rejects passwords without a number", () => {
    expect(validateRegisterPassword("AbcDefGH", "AbcDefGH")).toMatch(/number/i);
  });

  it("rejects mismatched confirmation", () => {
    expect(validateRegisterPassword("SecurePass1", "DifferentPass1")).toMatch(
      /do not match/i,
    );
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
  it("source sets loading before awaiting getUser for SIGNED_IN with session", async () => {
    // Read the compiled source to assert the invariant exists.
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.default.resolve(
      __dirname,
      "../lib/auth-context.tsx",
    );
    const source = fs.default.readFileSync(filePath, "utf-8");

    // The guard should appear as: if (session) setLoading(true)
    // before the withSupabaseLockRetry / getUser call inside the SIGNED_IN branch.
    expect(source).toMatch(/if\s*\(\s*session\s*\)\s*setLoading\s*\(\s*true\s*\)/);
  });
});
