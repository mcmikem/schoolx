/**
 * Which fee lines are owed for joining the school, rather than for staying.
 *
 * Registration and uniform are both entry charges. They are owed once, when a
 * pupil arrives, and not again for as long as that pupil is on the roll. A
 * school whose current pupils already own their uniform is the clearest case:
 * demand a uniform from them and it is money the school will not collect, and
 * because balances derive from what was billed it becomes money owed that then
 * holds up a report card.
 *
 * Both sit behind one flag, `students.is_new_admission`, because they answer
 * the same single question -- is this pupil joining, or already here? Splitting
 * them into two booleans would ask a bursar two questions when the answer to
 * one decides the other.
 *
 * Matching is deliberately loose on the category and on the name, for the same
 * reason meal-fee.ts is: schools record this inconsistently. The live Kikunyu
 * roll files the same kind of charge under "registration"/"Registration" and
 * "uniform"/"Uniform", and an exact category match alone would miss half.
 */

const NEW_ADMISSION_WORDS = /\b(registr\w*|admission|admit|enrol\w*|intake|joining|entry|uniform\w*)\b/i;

/** The fee rows this rule should consider. */
export interface NewAdmissionFeeLike {
  name?: string | null;
  category?: string | null;
}

/**
 * True when this fee line is owed for joining rather than for staying.
 *
 * The category is checked first because it is the field a school sets
 * deliberately, but it is not trusted on its own -- see the note above.
 */
export function isNewAdmissionFee(fee: NewAdmissionFeeLike): boolean {
  const category = String(fee.category ?? "").trim();
  if (category && NEW_ADMISSION_WORDS.test(category)) return true;
  return NEW_ADMISSION_WORDS.test(String(fee.name ?? ""));
}

/**
 * Whether this pupil owes the joining charges.
 *
 * Only an explicit new admission is charged. false (already on roll) and null
 * (nobody has decided yet) are both not charged, so landing the column does not
 * put a registration and a uniform fee on every pupil in the school.
 *
 * Deliberately NOT derived from admission_date. Every pupil on the live roll
 * carries the same admission_date year, so a date rule would mark all of them
 * new and re-charge the whole school. See
 * supabase/migrations/20261127000000_student_new_admission.sql.
 */
export function isChargedNewAdmission(isNewAdmission: boolean | null | undefined): boolean {
  return isNewAdmission === true;
}
