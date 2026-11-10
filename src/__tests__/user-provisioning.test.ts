import {
  buildProvisioningEmail,
  createManagedUserAccount,
  normalizeProvisioningPhone,
  sanitizeProvisioningName,
} from "@/lib/server/user-provisioning";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

describe("user provisioning helpers", () => {
  test("builds auth alias email from normalized phone", () => {
    expect(buildProvisioningEmail("256700000000")).toBe("256700000000@omuto.org");
  });

  test("normalizes Uganda phone numbers consistently", () => {
    expect(normalizeProvisioningPhone("0700 000 000")).toBe("256700000000");
    expect(normalizeProvisioningPhone("+256700000000")).toBe("256700000000");
  });

  test("rejects invalid provisioning values", () => {
    expect(() => sanitizeProvisioningName(" ")).toThrow("Name must be at least 2 characters");
    expect(() => normalizeProvisioningPhone("123")).toThrow("Invalid phone number");
  });

  test.each([
    "short1A",
    "longenough1",
    "Longenough",
    `A1${"x".repeat(127)}`,
  ])("rejects passwords outside the shared account policy before database access", async (password) => {
    const from = jest.fn();
    await expect(
      createManagedUserAccount({
        supabaseAdmin: { from } as never,
        fullName: "Test User",
        phone: "0700000000",
        password,
        role: "teacher",
      }),
    ).rejects.toThrow(PASSWORD_POLICY_MESSAGE);
    expect(from).not.toHaveBeenCalled();
  });
});
