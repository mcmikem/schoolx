import fs from "node:fs";
import path from "node:path";
import { classifyAuthFailure, countsAsCredentialGuess, loginFailureMessage } from "@/lib/auth-failure";

// A login that failed because Supabase timed out was reported as a wrong
// password, and the timeout counted toward the local five-minute lockout. The
// account this was reported against (256704641523@omuto.org) has a correct
// password — verified against the stored bcrypt hash — so every one of those
// "invalid credentials" was the gateway answering 504.

describe("classifyAuthFailure", () => {
  it("recognises the words GoTrue uses when it checked the password", () => {
    expect(classifyAuthFailure("Invalid login credentials")).toBe("credentials");
    expect(classifyAuthFailure("invalid login credentials")).toBe("credentials");
    expect(classifyAuthFailure("User not found")).toBe("credentials");
    expect(classifyAuthFailure("No user found")).toBe("credentials");
    expect(classifyAuthFailure("Invalid phone number or password")).toBe("credentials");
  });

  it("never calls a gateway timeout a bad password", () => {
    // The exact body the auth endpoint returned while this was being fixed.
    expect(classifyAuthFailure("Gateway Timeout")).toBe("transient");
    expect(classifyAuthFailure("Login attempt timed out")).toBe("transient");
    expect(classifyAuthFailure("Connection timed out. Please check your internet and try again.")).toBe("transient");
    expect(classifyAuthFailure("Failed to fetch")).toBe("transient");
    expect(classifyAuthFailure("NetworkError when attempting to fetch resource.")).toBe("transient");
    expect(classifyAuthFailure("HTTP 503 Service Unavailable")).toBe("transient");
    expect(classifyAuthFailure("fetch failed")).toBe("transient");
  });

  it("separates rate limiting from both other cases", () => {
    expect(classifyAuthFailure("Too many requests")).toBe("rate_limited");
    expect(classifyAuthFailure("Request rate limit reached")).toBe("rate_limited");
    expect(classifyAuthFailure("over_request_rate_limit")).toBe("rate_limited");
    expect(classifyAuthFailure("HTTP 429")).toBe("rate_limited");
  });

  it("gives an unconfirmed account its own answer", () => {
    expect(classifyAuthFailure("Email not confirmed")).toBe("account");
    expect(classifyAuthFailure("User is banned")).toBe("account");
  });

  it("treats an empty or unrecognised failure as an attempt, not an outage", () => {
    expect(classifyAuthFailure("")).toBe("unknown");
    expect(classifyAuthFailure(null)).toBe("unknown");
    expect(classifyAuthFailure(undefined)).toBe("unknown");
    expect(classifyAuthFailure("something we have never seen")).toBe("unknown");
  });

  it("prefers rate limiting and outages over the password when a message contains both", () => {
    expect(classifyAuthFailure("Invalid login: too many requests")).toBe("rate_limited");
    expect(classifyAuthFailure("504 Gateway Timeout")).toBe("transient");
  });
});

describe("countsAsCredentialGuess", () => {
  it("counts a rejection and an unattributed failure", () => {
    expect(countsAsCredentialGuess("credentials")).toBe(true);
    expect(countsAsCredentialGuess("unknown")).toBe(true);
  });

  it("does not count anything the server never checked", () => {
    expect(countsAsCredentialGuess("transient")).toBe(false);
    expect(countsAsCredentialGuess("rate_limited")).toBe(false);
    expect(countsAsCredentialGuess("account")).toBe(false);
  });

  it("keeps a slow network from locking someone out of their own school", () => {
    // Five consecutive gateway timeouts must not reach MAX_FAILED_ATTEMPTS.
    const kinds = Array.from({ length: 5 }, () => classifyAuthFailure("Gateway Timeout"));
    expect(kinds.filter(countsAsCredentialGuess)).toHaveLength(0);
  });
});

describe("loginFailureMessage", () => {
  it("keeps the generic wording for a real credential rejection in production", () => {
    expect(loginFailureMessage("credentials", { dev: false, detail: "Invalid login credentials" })).toBe(
      "Invalid login details",
    );
  });

  it("stops blaming the password when the service could not be reached", () => {
    const msg = loginFailureMessage("transient", { dev: false, detail: "Gateway Timeout" });
    expect(msg).not.toBe("Invalid login details");
    expect(msg).toMatch(/reach the sign-in service/i);
  });

  it("tells the truth about rate limiting and locked accounts too", () => {
    expect(loginFailureMessage("rate_limited", { dev: false })).toMatch(/wait a minute/i);
    expect(loginFailureMessage("account", { dev: false })).toMatch(/can't sign in yet/i);
  });

  it("shows the raw message in development so the cause is visible", () => {
    const msg = loginFailureMessage("transient", { dev: true, detail: "Gateway Timeout" });
    expect(msg).toContain("Gateway Timeout");
    expect(msg).toContain("unreachable");
  });

  it("falls back to the generic wording when it has no detail to show", () => {
    expect(loginFailureMessage("unknown", { dev: true, detail: "" })).toBe("Invalid login details");
  });
});

describe("login page only counts real credential failures", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/app/login/page.tsx"), "utf8");

  it("routes failures through the classifier", () => {
    expect(src).toContain("classifyAuthFailure(rawMsg)");
    expect(src).toContain("countsAsCredentialGuess(kind)");
    expect(src).toContain("loginFailureMessage(kind");
  });

  it("guards the lockout counter behind the classifier", () => {
    const increments = src.split("attemptsRef.current += 1").length - 1;
    expect(increments).toBe(1);
    // The single increment must sit inside the credential branch, never before it.
    expect(src.indexOf("attemptsRef.current += 1")).toBeGreaterThan(src.indexOf("const isCredentialGuess"));
    expect(src.indexOf("attemptsRef.current += 1")).toBeLessThan(src.indexOf("const newAttempts"));
  });

  it("never hardcodes the old blanket production message", () => {
    // The string may exist in comments, but never as a direct toast argument.
    const toastLines = src
      .split("\n")
      .filter((line) => line.includes("toast.error") || line.includes("toast.warning") || line.includes("toast.info"));
    expect(toastLines.join("\n")).not.toContain("Invalid login details");
  });
});
