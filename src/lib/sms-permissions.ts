/**
 * Who may send an SMS.
 *
 * The list lives here so the server route and the buttons that offer it agree.
 * A button a role cannot use is worse than no button: the teacher taps it and
 * the API answers 403 with nothing on screen to explain why.
 *
 * Teachers are deliberately not on this list. Sending to a parent is an
 * office job today; a teacher who needs a parent told should raise it through
 * the notices the school sends, not by spending the school's SMS credits.
 */
export const SMS_ALLOWED_ROLES: string[] = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
  "secretary",
];

export function canSendSms(role: string | undefined | null): boolean {
  if (!role) return false;
  return SMS_ALLOWED_ROLES.includes(role);
}
