/**
 * Choosing the fee a payment or discount defaults to.
 *
 * A school charges named fees and most payments are tuition, so the sensible
 * default is the tuition line for the pupil's own class. Two rules decide it:
 *
 *  - a fee written for this pupil's kind of student (boarding vs day) wins,
 *    because a boarding pupil owes the boarding rate, not the day rate;
 *  - otherwise tuition, always, because that is what nearly every payment is.
 *
 * "Always" is the point. Leaving the field blank when two tuition lines exist
 * just moves the work back to the bursar for the common case, and the fee is
 * one tap away either way. The tie-break below is deterministic so the same
 * class always yields the same answer.
 */

export interface FeeChoice {
  id: string;
  name: string;
  amount?: number | string | null;
  retired?: boolean;
}

/**
 * @param fees     Fee lines already narrowed to the pupil's class and category.
 * @param boardingStatus "day" or "boarding", when known.
 * @returns the fee id to preselect, or "" when nothing sensible is on offer.
 */
export function pickDefaultFee(
  fees: FeeChoice[],
  boardingStatus?: string | null,
): string {
  const live = fees.filter((f) => !f.retired);

  // A fee written for this pupil's kind of student wins outright. Matched by
  // name: fee_structure.category cannot be trusted for this (see below) and in
  // practice holds "tuition"/"meals"/"Development" rather than a pupil type.
  if (boardingStatus) {
    const re = new RegExp(`\\b${boardingStatus}\\b`, "i");
    const forCategory = live.filter((f) => re.test(f.name));
    if (forCategory.length === 1) return forCategory[0].id;
  }

  // Tuition is identified by NAME, never by category.
  //
  // On live data "Development Fund" and "app fees" are both filed under a
  // tuition category. Trusting the column made a development-fund payment the
  // default for an ordinary tuition payment -- silently filing a parent's money
  // under a charge they never agreed to, which is the exact failure this field
  // exists to prevent.
  const tuition = live.filter((f) => /tuition/i.test(f.name));
  if (tuition.length === 0) return "";
  if (tuition.length === 1) return tuition[0].id;

  // Duplicated rows naming the same fee at the same price are the same fee to
  // the person paying -- one school holds 18 identical Tuition rows -- so any
  // of them is a correct answer.
  const distinct = new Set(tuition.map((f) => `${f.name}|${f.amount}`));
  if (distinct.size === 1) return tuition[0].id;

  // Several DIFFERENT tuition prices, and the user still wants tuition. Pick
  // deterministically: the plain "Tuition" line before any renamed one, then the
  // highest amount, since a reduced or concessionary line is normally set below
  // the school's standard fee. Guessing wrong is one tap to fix, whereas leaving
  // it blank is a tap every single time.
  const plain = tuition.filter((f) => /^tuition$/i.test(f.name.trim()));
  if (plain.length > 0) {
    return highest(plain);
  }
  return highest(tuition);
}

function highest(fees: FeeChoice[]): string {
  const top = Math.max(...fees.map((f) => Number(f.amount) || 0));
  return fees.filter((f) => (Number(f.amount) || 0) === top)[0].id;
}