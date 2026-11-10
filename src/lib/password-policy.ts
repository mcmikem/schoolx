export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_MESSAGE = "Use at least 8 characters, with one uppercase letter and one number.";

export function passwordMeetsPolicy(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );
}
