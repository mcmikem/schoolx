/**
 * Registration fees may only be charged to pupils who are joining the school.
 *
 * A registration fee is a one-off at the door. A pupil already on roll has not
 * joined again, so billing them one is money the school cannot collect — and
 * because balances derive from what was billed, it sits there as money owed and
 * eventually holds up a report card.
 *
 * The decision is deliberately narrow, exactly as it is for meals: only an
 * explicit new admission is charged, and `false` and `null` both mean "not
 * charged" so the column can land without billing the whole school.
 *
 * The reason it is a flag and not a date is the point of this file. Every pupil
 * on the live roll carries the same admission_date year, so any rule of the form
 * "admitted this year" marks every existing pupil new and re-charges all of
 * them. See supabase/migrations/20261127000000_student_new_admission.sql.
 */

import { isChargedRegistration, isRegistrationFee } from "@/lib/registration-fee";
import { feeAppliesToStudent } from "@/lib/operations";
import { normalizeStudentUpdateInput } from "@/lib/validation";

describe("isRegistrationFee", () => {
  it("matches on the live fee that exists today", () => {
    // Live data: name "Registration", category "registration", 20,000.
    expect(isRegistrationFee({ name: "Registration", category: "registration" })).toBe(true);
  });

  it("matches either capitalisation, because schools record both", () => {
    expect(isRegistrationFee({ name: "registration", category: "Registration" })).toBe(true);
    expect(isRegistrationFee({ name: "REGISTRATION", category: "Registration" })).toBe(true);
  });

  it("matches the words a school actually uses for it", () => {
    for (const name of ["Registration", "Registration Fee", "Admission", "Admission Fee", "Enrolment", "Joining Fee"]) {
      expect(isRegistrationFee({ name, category: null })).toBe(true);
    }
  });

  it("leaves ordinary recurring fees alone", () => {
    // Live data carries these categories; none of them is registration.
    for (const category of ["Tuition", "tuition", "Development", "meals", "uniform", "uneb", "Other"]) {
      expect(isRegistrationFee({ name: category, category })).toBe(false);
    }
  });

  it("does not match a null term fee just because it is one-off", () => {
    // Term is not part of the shape passed here, and "Registration" is matched
    // on name alone -- but a fee with no registration word must not be caught.
    expect(isRegistrationFee({ name: "Term 1 Book", category: null })).toBe(false);
  });
});

describe("isChargedRegistration", () => {
  it("charges only an explicit new admission", () => {
    expect(isChargedRegistration(true)).toBe(true);
  });

  it("treats already-on-roll and undecided the same: not charged", () => {
    expect(isChargedRegistration(false)).toBe(false);
    expect(isChargedRegistration(null)).toBe(false);
    expect(isChargedRegistration(undefined)).toBe(false);
  });
});

describe("feeAppliesToStudent with a registration fee", () => {
  // class_id is optional and not nullable, so these omit it: a school-wide fee
  // has no class on it.
  const registration = { boarding_status: null, name: "Registration", category: "registration" };
  const pupil = { class_id: "class-1", boarding_status: "day", takes_meals: null };

  it("bills a newly admitted pupil", () => {
    expect(feeAppliesToStudent(registration, { ...pupil, is_new_admission: true })).toBe(true);
  });

  it("does not bill a pupil who was already on roll", () => {
    expect(feeAppliesToStudent(registration, { ...pupil, is_new_admission: false })).toBe(false);
  });

  it("does not bill anyone until somebody has decided", () => {
    // This is the case that matters on day one: all 869 live pupils are NULL,
    // and none of them should acquire a registration fee.
    expect(feeAppliesToStudent(registration, { ...pupil, is_new_admission: null })).toBe(false);
    expect(feeAppliesToStudent(registration, pupil)).toBe(false);
  });

  it("leaves tuition alone for every pupil", () => {
    const tuition = { boarding_status: null, name: "Tuition", category: "Tuition" };
    for (const is_new_admission of [true, false, null]) {
      expect(feeAppliesToStudent(tuition, { ...pupil, is_new_admission })).toBe(true);
    }
  });

  it("still keeps the two rules independent", () => {
    const meals = { boarding_status: null, name: "Meals", category: "meals" };
    // New admission does not buy a meal, and eating does not earn registration.
    expect(feeAppliesToStudent(meals, { ...pupil, is_new_admission: true })).toBe(false);
    expect(feeAppliesToStudent(registration, { ...pupil, takes_meals: true })).toBe(false);
    expect(
      feeAppliesToStudent(registration, { ...pupil, takes_meals: true, is_new_admission: true }),
    ).toBe(true);
  });
});

describe("normalizeStudentUpdateInput keeps the opt-ins", () => {
  /**
   * Regression. The normaliser is an allowlist, and both of these fields were
   * missing from it. Saving the "School Meals" answer on a pupil therefore
   * stripped it, reported success, and changed nothing in the database — the
   * whole opt-in looked implemented and did nothing.
   */
  it("does not strip takes_meals", () => {
    expect(normalizeStudentUpdateInput({ takes_meals: true })).toEqual({ takes_meals: true });
    expect(normalizeStudentUpdateInput({ takes_meals: false })).toEqual({ takes_meals: false });
  });

  it("does not strip is_new_admission", () => {
    expect(normalizeStudentUpdateInput({ is_new_admission: true })).toEqual({ is_new_admission: true });
    expect(normalizeStudentUpdateInput({ is_new_admission: false })).toEqual({ is_new_admission: false });
  });

  it("keeps false rather than folding it into null", () => {
    // "false" and "undecided" bill the same, but they are different facts and
    // the bursar needs to see who declined versus who nobody has asked.
    expect(normalizeStudentUpdateInput({ takes_meals: false }).takes_meals).toBe(false);
    expect(normalizeStudentUpdateInput({ is_new_admission: false }).is_new_admission).toBe(false);
  });

  it("treats an empty string as undecided, not as a refusal", () => {
    expect(normalizeStudentUpdateInput({ takes_meals: "" }).takes_meals).toBeNull();
    expect(normalizeStudentUpdateInput({ is_new_admission: "" }).is_new_admission).toBeNull();
  });

  it("leaves both absent when they are not supplied", () => {
    const out = normalizeStudentUpdateInput({ last_name: "Okello" });
    expect("takes_meals" in out).toBe(false);
    expect("is_new_admission" in out).toBe(false);
  });
});