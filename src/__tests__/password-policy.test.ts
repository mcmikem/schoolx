import { passwordMeetsPolicy } from "@/lib/password-policy";

describe("passwordMeetsPolicy", () => {
  it.each([
    "Short7A",
    "alllowercase7",
    "NoNumberHere",
    "A1234567".repeat(17),
    null,
    12345678,
  ])("rejects a password that does not meet the shared policy", (password) => {
    expect(passwordMeetsPolicy(password)).toBe(false);
  });

  it("accepts a password at the minimum length with uppercase and a number", () => {
    expect(passwordMeetsPolicy("Welcome7")).toBe(true);
  });
});
