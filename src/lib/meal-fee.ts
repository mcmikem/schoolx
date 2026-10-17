/**
 * Which fee lines are meals.
 *
 * A meal is only owed by a pupil who eats at school. Plenty of day pupils do
 * not -- they go home -- and charging them produces a Meals fee the parent
 * will refuse and a balance that never settles. Because balances are derived
 * from what was billed, that becomes money the school shows as owed and cannot
 * collect.
 *
 * Matching is deliberately loose on the category and on the name, because
 * schools record this inconsistently: live data files the same kind of fee as
 * both "meals" and "Meals", and names vary ("Meals", "School Meals", "Lunch").
 * An exact category match alone would miss half of them and silently keep
 * charging pupils who do not eat.
 */

const MEAL_WORDS = /\b(meal|meals|lunch|breakfast|supper|canteen|food)\b/i;

/** The fee rows this rule should consider. */
export interface MealFeeLike {
  name?: string | null;
  category?: string | null;
}

/**
 * True when this fee line is for school meals.
 *
 * The category is checked first because it is the field a school sets
 * deliberately, but it is not trusted on its own -- see the note above.
 */
export function isMealFee(fee: MealFeeLike): boolean {
  const category = String(fee.category ?? "").trim();
  if (category && MEAL_WORDS.test(category)) return true;
  return MEAL_WORDS.test(String(fee.name ?? ""));
}

/**
 * Whether this pupil is charged meals.
 *
 * Only an explicit opt-in charges. `false` (goes home) and `null` (nobody has
 * decided yet) are both not charged, which is what stops an existing school
 * billing meals to every pupil the moment the column lands.
 */
export function isChargedMeals(takesMeals: boolean | null | undefined): boolean {
  return takesMeals === true;
}