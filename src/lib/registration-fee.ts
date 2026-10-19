/**
 * Which fee lines are registration.
 *
 * A registration fee is owed once, when a pupil joins the school. A pupil who
 * was already on roll has not joined again, so charging them is money the school
 * will not collect -- and because balances are derived from what was billed, it
 * becomes money the school shows as owed and cannot get in.
 *
 * Matching is deliberately loose on the category and on the name, for the same
 * reason meal-fee.ts is: schools record this inconsistently. The live roll files
 * the same kind of fee under "registration", "Registration" and "Admission",
 * and an exact category match alone would miss most of them.
 */

const REGISTRATION_WORDS = /\b(registr\w*|admission|admit|enrol\w*|intake|joining|entry)\b/i;

/** The fee rows this rule should consider. */
export interface RegistrationFeeLike {
  name?: string | null;
  category?: string | null;
}

/**
 * True when this fee line is for registration.
 *
 * The category is checked first because it is the field a school sets
 * deliberately, but it is not trusted on its own -- see the note above.
 */
export function isRegistrationFee(fee: RegistrationFeeLike): boolean {
  const category = String(fee.category ?? "").trim();
  if (category && REGISTRATION_WORDS.test(category)) return true;
  return REGISTRATION_WORDS.test(String(fee.name ?? ""));
}

/**
 * Whether this pupil owes a registration fee.
 *
 * Only an explicit new admission charges. false (already on roll) and null
 * (nobody has decided yet) are both not charged, so landing the column does not
 * put a registration fee on every pupil in the school.
 *
 * Deliberately NOT derived from admission_date. Every pupil on the live roll
 * carries the same admission_date year, so a date rule would mark all of them
 * new and re-charge the whole school. See
 * supabase/migrations/20261127000000_student_new_admission.sql.
 */
export function isChargedRegistration(isNewAdmission: boolean | null | undefined): boolean {
  return isNewAdmission === true;
}