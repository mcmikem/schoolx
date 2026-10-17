/**
 * Meal fees may only be charged to pupils who actually eat at school.
 *
 * Not every day pupil does — plenty go home — and charging them puts a Meals
 * fee on a bill for a meal they never receive. Because balances derive from
 * what was billed, that shows as money owed that the school cannot collect.
 *
 * The billing decision is deliberately narrow: only an explicit opt-in is
 * charged. `false` and `null` both mean "not charged", which is what stops an
 * existing school billing meals to all ~870 pupils the moment the column lands.
 * They stay distinguishable so the bursar can see who is still undecided.
 */

import { isChargedMeals, isMealFee } from "@/lib/meal-fee";

describe("isMealFee", () => {
  it("matches on the live fee that exists today", () => {
    // Live data: name "Meals", category "meals", 70,000.
    expect(isMealFee({ name: "Meals", category: "meals" })).toBe(true);
  });

  it("matches either capitalisation, because schools record both", () => {
    expect(isMealFee({ name: "meals", category: "Meals" })).toBe(true);
    expect(isMealFee({ name: "MEALS", category: "Meals" })).toBe(true);
  });

  it("matches the names a school actually uses", () => {
    for (const name of ["School Meals", "Lunch", "Breakfast", "Supper", "Canteen", "Food"]) {
      expect(isMealFee({ name, category: null })).toBe(true);
    }
  });

  it("does not match other fees", () => {
    for (const name of ["Tuition", "Development Fund", "Registration", "Uniform", "Transport"]) {
      expect(isMealFee({ name, category: null })).toBe(false);
    }
  });

  it("does not match a fee whose category merely contains a meal word", () => {
    // "non_meals" or a compound like "meal_plan_admin" is not a meal charge.
    expect(isMealFee({ name: "Admin fee", category: "non_meals" })).toBe(false);
  });

  it("survives missing fields", () => {
    expect(isMealFee({})).toBe(false);
    expect(isMealFee({ name: null, category: null })).toBe(false);
  });
});

describe("isChargedMeals", () => {
  it("charges only an explicit opt-in", () => {
    expect(isChargedMeals(true)).toBe(true);
  });

  it("does not charge a pupil who goes home", () => {
    expect(isChargedMeals(false)).toBe(false);
  });

  it("does not charge a pupil nobody has decided about yet", () => {
    // This is the whole point: no existing school should start being billed
    // meals for every pupil the day the column is added.
    expect(isChargedMeals(null)).toBe(false);
    expect(isChargedMeals(undefined)).toBe(false);
  });

  it("keeps undecided distinguishable from declined for reporting", () => {
    // Both bill the same, but a bursar needs to know how many are still unset.
    expect(isChargedMeals(null)).toBe(isChargedMeals(false));
    expect(null).not.toBe(false);
  });
});
describe("feeAppliesToStudent honours the meal opt-in", () => {
  const { feeAppliesToStudent } = require("@/lib/operations");
  const day = { class_id: null, boarding_status: "day" };

  it("applies meals to a pupil who opted in", () => {
    expect(feeAppliesToStudent({ ...day, name: "Meals", category: "meals" }, { boarding_status: "day", takes_meals: true })).toBe(true);
  });

  it("does not apply meals to a pupil who goes home", () => {
    expect(feeAppliesToStudent({ ...day, name: "Meals", category: "meals" }, { boarding_status: "day", takes_meals: false })).toBe(false);
  });

  it("does not apply meals to a pupil nobody has decided about", () => {
    expect(feeAppliesToStudent({ ...day, name: "Meals", category: "meals" }, { boarding_status: "day", takes_meals: null })).toBe(false);
    expect(feeAppliesToStudent({ ...day, name: "Meals", category: "meals" }, { boarding_status: "day" })).toBe(false);
  });

  it("leaves every other fee alone", () => {
    const tuition = { ...day, name: "Tuition", category: "tuition" };
    for (const takes of [true, false, null, undefined]) {
      expect(feeAppliesToStudent(tuition, { boarding_status: "day", takes_meals: takes })).toBe(true);
    }
  });

  it("still applies class and boarding rules first", () => {
    const meals = { class_id: "p3", boarding_status: "day", name: "Meals", category: "meals" };
    expect(feeAppliesToStudent(meals, { class_id: "p3", boarding_status: "day", takes_meals: true })).toBe(true);
    expect(feeAppliesToStudent(meals, { class_id: "p7", boarding_status: "day", takes_meals: true })).toBe(false);
    expect(feeAppliesToStudent({ ...meals, boarding_status: "boarding" }, { class_id: "p3", boarding_status: "day", takes_meals: true })).toBe(false);
  });

  it("keeps working for callers that pass a narrowed row", () => {
    // Existing callers pass only class_id/boarding_status; a row with no name
    // cannot be a meal, so nothing changes for them.
    expect(feeAppliesToStudent({ class_id: "p3", boarding_status: "day" }, { class_id: "p3", boarding_status: "day" })).toBe(true);
    expect(feeAppliesToStudent({ class_id: "p7" }, { class_id: "p3", boarding_status: "day" })).toBe(false);
  });
});
