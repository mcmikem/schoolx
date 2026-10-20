/**
 * Every pupil field the app offers must survive being saved.
 *
 * normalizeStudentInput and normalizeStudentUpdateInput are allowlists: a field
 * they do not name is silently dropped, and the caller is told the save
 * succeeded. Four columns have been lost exactly this way -- nin, uneab_number,
 * takes_meals and is_new_admission -- and in each case the form accepted the
 * answer, validated it, and then threw it away an instant before the insert.
 * Nothing reported it. A bursar recorded a pupil as not eating at school and
 * the pupil was billed meals anyway.
 *
 * The check is behavioural rather than a source scan: it asks the two functions
 * what they will accept. That way it cannot be fooled by a field being present
 * in the file but unreachable, which is the whole failure mode.
 *
 * It runs offline, against supabase/schema.sql, so it belongs in CI.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { normalizeStudentInput, normalizeStudentUpdateInput } from "@/lib/validation";

/** Columns the app must never write from a form. */
const READ_ONLY = new Set(["id", "school_id", "created_at", "updated_at", "deleted_at", "deleted_by", "status"]);

/**
 * Columns the app deliberately does not offer.
 *
 * Listing them is the point. A column that appears in schema.sql and is in
 * neither list means it exists, no screen can set it, and nothing says so --
 * which is how a field ends up accepted by a form and then dropped on the way
 * to the database. Adding a column without wiring it up now fails here.
 */
const NOT_OFFERED = new Set([
  // Links the pupil to a login. Owned by the auth flows, never by a form: a
  // bursar must not be able to re-point a pupil at somebody else's account.
  "user_id",
  // In the database, referenced nowhere in the app. Listed rather than ignored
  // so that wiring it up later is a deliberate act.
  "passport_photo_url",
]);

/** Every column the students table is documented to have. */
function studentColumns(): string[] {
  const schema = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8");
  const columns = new Set<string>();

  const table = schema.match(/CREATE TABLE IF NOT EXISTS students \(([\s\S]*?)\n\);/);
  if (table) {
    for (const line of table[1].split("\n")) {
      const m = line.trim().match(/^(\w+)\s+\w/);
      if (m && m[1] !== "CONSTRAINT" && m[1] !== "PRIMARY" && m[1] !== "UNIQUE" && m[1] !== "FOREIGN") {
        columns.add(m[1]);
      }
    }
  }

  // Later migrations add columns by ALTER, which is where the drift lives.
  for (const m of schema.matchAll(/ALTER TABLE students ADD COLUMN IF NOT EXISTS (\w+)/g)) {
    columns.add(m[1]);
  }

  return [...columns].sort();
}

/**
 * Which fields each normaliser will carry through.
 *
 * A sentinel value is used rather than a truthy one: `false` and `""` are
 * legitimate answers for the tri-state opt-ins, and a probe using a truthy
 * value would pass even for a function that coerces them away.
 */
function acceptedFields(normalise: (input: Record<string, unknown>) => Record<string, unknown>): Set<string> {
  // Valid values, not a blanket sentinel: these normalisers validate, and a
  // probe of "M" where a "M/F" is expected throws before it gets far enough to
  // tell us anything. The point is which keys come back, not what they hold.
  const valid: Record<string, unknown> = {
    gender: "M",
    opening_balance: 1,
    consecutive_absent_days: 1,
    takes_meals: true,
    is_new_admission: true,
    is_class_monitor: true,
    repeating: true,
  };

  const probe: Record<string, unknown> = {};
  for (const column of studentColumns()) {
    probe[column] = column in valid ? valid[column] : "__probe__";
  }
  return new Set(Object.keys(normalise(probe)));
}

describe("student field contract", () => {
  const columns = studentColumns();
  const createAccepted = acceptedFields(normalizeStudentInput);
  const updateAccepted = acceptedFields(normalizeStudentUpdateInput);
  const writable = columns.filter((c) => !READ_ONLY.has(c) && !NOT_OFFERED.has(c));

  it("finds the students table in schema.sql", () => {
    // If the parse silently stops matching, every other test here would pass
    // by checking nothing at all.
    expect(columns.length).toBeGreaterThan(30);
    expect(columns).toContain("first_name");
    expect(columns).toContain("student_number");
  });

  it("lets every writable column be saved by at least one path", () => {
    // Workflow columns -- dropout_reason, transfer_to, repeating and the rest --
    // are absent from the create path on purpose: nobody is a dropout when they
    // are admitted. They are set later through the update path, and that is
    // where they must be allowed through.
    const lostEverywhere = writable.filter((c) => !createAccepted.has(c) && !updateAccepted.has(c));

    expect(lostEverywhere).toEqual([]);
  });

  it("keeps every workflow column writable through the update path", () => {
    // These are written by the transfers, dropouts and promotion flows. If one
    // drops out of the update allowlist, that flow reports success and changes
    // nothing -- the same failure as the meal opt-in, on a heavier column.
    const workflowColumns = [
      "admission_date",
      "consecutive_absent_days",
      "dropout_date",
      "dropout_reason",
      "last_attendance_date",
      "repeating",
      "transfer_from",
      "transfer_reason",
      "transfer_to",
    ];
    const lost = workflowColumns.filter((c) => !updateAccepted.has(c));
    expect(lost).toEqual([]);
  });

  it("keeps a false answer as false rather than folding it into null", () => {
    // The tri-state columns mean "goes home" and "not yet decided" are
    // different facts. A normaliser using `|| null` would merge them and the
    // bursar could never count who is still undecided.
    // The create path demands its mandatory fields, so they are supplied here;
    // the point of the assertion is what comes back for the tri-state column.
    const minimalCreate = {
      first_name: "Test",
      last_name: "Pupil",
      gender: "M",
      parent_name: "Parent",
      parent_phone: "0772000000",
      class_id: "class-1",
    };

    for (const field of ["takes_meals", "is_new_admission"]) {
      expect(normalizeStudentInput({ ...minimalCreate, [field]: false })[field]).toBe(false);
      expect(normalizeStudentUpdateInput({ [field]: false })[field]).toBe(false);
      expect(normalizeStudentInput({ ...minimalCreate, [field]: "" })[field]).toBeNull();
      expect(normalizeStudentUpdateInput({ [field]: "" })[field]).toBeNull();
    }
  });

  it("leaves a field absent when it was never supplied", () => {
    // Otherwise a partial edit would blank every column it did not mention.
    const out = normalizeStudentUpdateInput({ last_name: "Okello" });
    expect(out).toEqual({ last_name: "Okello" });
    expect("first_name" in out).toBe(false);
    expect("takes_meals" in out).toBe(false);
  });
});
