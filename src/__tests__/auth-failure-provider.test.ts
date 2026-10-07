import { classifyAuthFailure, countsAsCredentialGuess, loginFailureMessage } from "@/lib/auth-failure";

// Every failed sign-in ends on the phone format once the three email formats
// have been rejected, and GoTrue answers that last one with
// `phone_provider_disabled`, because the project has phone sign-in switched
// off at the provider level. Read as a guess it inflates the local lockout for
// a reply that never looked at the password; read as an unknown it prints
// "Invalid login details" and counts anyway.
describe("phone sign-in switched off at the project", () => {
  it("classifies GoTrue's code and its prose", () => {
    expect(classifyAuthFailure("phone_provider_disabled")).toBe("account");
    expect(classifyAuthFailure("Phone logins are disabled")).toBe("account");
  });

  it("does not count as a password guess", () => {
    expect(countsAsCredentialGuess(classifyAuthFailure("phone_provider_disabled"))).toBe(false);
    expect(countsAsCredentialGuess(classifyAuthFailure("Phone logins are disabled"))).toBe(false);
  });

  it("says something the person at the keyboard can act on", () => {
    const msg = loginFailureMessage("account", { dev: false });
    expect(msg).toMatch(/can't sign in yet/i);
    expect(msg).not.toBe("Invalid login details");
    expect(msg).not.toMatch(/check your connection/i);
  });

  it("keeps the raw reply visible while developing", () => {
    expect(loginFailureMessage("account", { dev: true, detail: "phone_provider_disabled" })).toBe(
      "Login failed (blocked): phone_provider_disabled",
    );
  });
});
