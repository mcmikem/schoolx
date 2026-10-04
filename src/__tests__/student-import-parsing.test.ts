import { describe, it, expect } from "@jest/globals";
import { buildClassAliasMap, resolveClassId, validateStudentRow, normalizeGender } from "@/lib/import/students";

/**
 * Regression coverage for the Students page bulk import.
 *
 * The quick import used to normalise rows itself instead of sharing the parser in
 * src/lib/import/students.ts. That local copy had three defects, each of which
 * silently dropped or corrupted real data:
 *
 *   1. gender was coerced with `=== "F" ? "F" : "M"`, so "Female" and "female"
 *      were recorded as male. Nothing reported it.
 *   2. class matching was exact case-insensitive equality against the class
 *      name, so "p5", "P 1" and "Primary 1" all failed. Real spreadsheets are
 *      written by hand and use all of those.
 *   3. date_of_birth was not read at all, so every imported learner lost their
 *      date of birth.
 *
 * These assertions cover the shared parser that the importer now delegates to.
 */

const CLASSES = [
  { id: "c1", name: "P.1" },
  { id: "c2", name: "P.2" },
  { id: "c3", name: "P.3" },
  { id: "c4", name: "P.4" },
  { id: "c5", name: "P.5" },
  { id: "c6", name: "P.6" },
  { id: "c7", name: "P.7" },
];

const map = buildClassAliasMap(CLASSES);

describe("student bulk import – gender", () => {
  it("reads every spelling of male and female", () => {
    for (const raw of ["F", "f", "Female", "female", "FEMALE", " Female "]) {
      expect(normalizeGender(raw)).toBe("F");
    }
    for (const raw of ["M", "m", "Male", "male", "MALE", " Male "]) {
      expect(normalizeGender(raw)).toBe("M");
    }
  });

  it("returns empty for an unrecognised value rather than defaulting to male", () => {
    // The old code collapsed anything that was not exactly "F" to "M", which
    // turned a typo into a wrong gender instead of a reported error.
    for (const raw of ["", "X", "unknown", "1", "girl"]) {
      expect(normalizeGender(raw)).toBe("");
    }
  });

  it("flags a row instead of guessing when gender is not recognised", () => {
    const result = validateStudentRow({
      first_name: "Amina",
      last_name: "Kato",
      gender: "girl",
      class: "P.5",
      parent_name: "Ali Kato",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/gender/i);
  });

  it("keeps a spelled-out Female as female end to end", () => {
    const result = validateStudentRow({
      first_name: "Sarah",
      last_name: "Nakato",
      gender: "Female",
      class: "P.5",
      parent_name: "James Nakato",
    });
    expect(result.errors).toEqual([]);
    expect(result.data.gender).toBe("F");
  });
});

describe("student bulk import – class matching", () => {
  it("accepts the spellings a hand-written roster actually uses", () => {
    const variants = ["P.1", "p.1", "P1", "p1", "P 1", "Primary 1", "primary1", "p. 1", "P-1"];
    const resolved = variants.map((written) => [written, resolveClassId(map, written)]);
    const wrong = resolved.filter(([, id]) => id !== "c1");
    expect(wrong).toEqual([]);
  });

  it("matches across every class, not only the first", () => {
    expect(resolveClassId(map, "P.7")).toBe("c7");
    expect(resolveClassId(map, "p3")).toBe("c3");
  });

  it("does not invent a class that does not exist", () => {
    expect(resolveClassId(map, "P.9")).toBeUndefined();
    expect(resolveClassId(map, "Senior 1")).toBeUndefined();
    expect(resolveClassId(map, "")).toBeUndefined();
  });

  it("does not confuse P.1 with P.10 style prefixes", () => {
    const tenClasses = [
      ...Array.from({ length: 7 }, (_, i) => ({ id: `p${i + 1}`, name: `P.${i + 1}` })),
      { id: "p10", name: "P.10" },
    ];
    const wide = buildClassAliasMap(tenClasses);
    expect(resolveClassId(wide, "P.1")).toBe("p1");
    expect(resolveClassId(wide, "P.10")).toBe("p10");
  });
});

describe("student bulk import – headers", () => {
  it("reads the headers used by the downloadable template", () => {
    const result = validateStudentRow({
      "First Name": "Sarah",
      "Last Name": "Nakato",
      Gender: "F",
      "Date of Birth": "2015-03-15",
      Class: "P.5",
      "Parent Name": "James Nakato",
      "Parent Phone": "0701234567",
      "Student Number": "",
      "PLE Index": "",
    });
    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({
      first_name: "Sarah",
      last_name: "Nakato",
      gender: "F",
      date_of_birth: "2015-03-15",
      class_name: "P.5",
      parent_name: "James Nakato",
      parent_phone: "0701234567",
    });
  });

  it("captures date of birth, which the old importer dropped", () => {
    const result = validateStudentRow({
      first_name: "John",
      last_name: "Mukasa",
      gender: "M",
      date_of_birth: "2014-06-20",
      class: "P.5",
      parent_name: "Betty Mukasa",
    });
    expect(result.data.date_of_birth).toBe("2014-06-20");
  });

  it("accepts a single full name and splits it", () => {
    const result = validateStudentRow({
      full_name: "Sarah Nakato",
      gender: "F",
      class: "P.5",
      parent_name: "James Nakato",
    });
    expect(result.errors).toEqual([]);
    expect(result.data.first_name).toBe("Sarah");
    expect(result.data.last_name).toBe("Nakato");
  });

  it("pairs a second phone column with the alternative number", () => {
    const result = validateStudentRow({
      first_name: "Amina",
      last_name: "Kato",
      gender: "F",
      class: "P.5",
      parent_name: "Ali Kato",
      parent_phone: "0701112222",
      parent_phone2: "0703334444",
    });
    expect(result.data.parent_phone).toBe("0701112222");
    expect(result.data.parent_phone2).toBe("0703334444");
  });

  it("rejects a phone number too short to be dialable", () => {
    const result = validateStudentRow({
      first_name: "Amina",
      last_name: "Kato",
      gender: "F",
      class: "P.5",
      parent_name: "Ali Kato",
      parent_phone: "07",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/phone/i);
  });
});
