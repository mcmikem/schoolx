import { describe, expect, it } from "@jest/globals";
import {
  BOARDING_STATUSES,
  buildClassAliasMap,
  buildHouseAliasMap,
  buildStudentTemplateCsv,
  formatSpreadsheetCell,
  normalizeAmount,
  normalizeBoardingStatus,
  normalizeDateOfBirth,
  normalizeGender,
  parseDelimitedText,
  resolveClassId,
  resolveHouseId,
  STUDENT_TEMPLATE_HEADERS,
  validateStudentRow,
} from "@/lib/import/students";

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

const TEMPLATE_COLUMNS = [
  "Student Number",
  "First Name",
  "Last Name",
  "Gender",
  "Date of Birth",
  "Class",
  "Boarding Status",
  "House",
  "Parent Name",
  "Parent Phone",
  "Parent Phone 2",
  "Parent Email",
  "PLE Index",
  "NIN",
  "Previous School",
  "District of Origin",
  "Sub-county",
  "Parish",
  "Village",
  "Blood Type",
  "Religion",
  "Nationality",
  "Address",
  "Opening Balance",
  "Class Monitor",
  "Prefect Role",
  "Student Council Role",
  "Games House",
];

const FULL_ROW: Record<string, string> = {
  "Student Number": "STU-001",
  "First Name": "Sarah",
  "Last Name": "Nakato",
  Gender: "F",
  "Date of Birth": "2015-03-15",
  Class: "P.1",
  "Boarding Status": "Boarding",
  House: "Red House",
  "Parent Name": "James Nakato",
  "Parent Phone": "0701234567",
  "Parent Phone 2": "0707654321",
  "Parent Email": "james@example.com",
  "PLE Index": "U0001/2026",
  NIN: "CM123456789X",
  "Previous School": "St Peters PS",
  "District of Origin": "Mityana",
  "Sub-county": "Gomba",
  Parish: "Wakiso",
  Village: "Naluganyi",
  "Blood Type": "O+",
  Religion: "Catholic",
  Nationality: "Ugandan",
  Address: "Plot 14",
  // contains a comma on purpose
  "Opening Balance": "UGX 150,000",
  "Class Monitor": "Yes",
  "Prefect Role": "Head Prefect",
  "Student Council Role": "Secretary",
  "Games House": "Blue",
};

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

/**
 * The roster template is meant to carry every field the registration form takes,
 * so a learner enrolled in bulk ends up with the same record as one typed in by
 * hand. These cover the columns that were added for that parity.
 */
describe("student bulk import – full registration contract", () => {
  const base = {
    first_name: "Sarah",
    last_name: "Nakato",
    gender: "F",
    class: "P.5",
    parent_name: "James Nakato",
  };

  it("captures the address and origin columns", () => {
    const r = validateStudentRow({
      ...base,
      village: "Naluganyi",
      parish: "Wakiso",
      "sub-county": "Gomba",
      "District of Origin": "Mityana",
      address: "Plot 14, Namagave",
    });
    expect(r.errors).toEqual([]);
    expect(r.data).toMatchObject({
      village: "Naluganyi",
      parish: "Wakiso",
      sub_county: "Gomba",
      district_origin: "Mityana",
      address: "Plot 14, Namagave",
    });
  });

  it("captures the personal columns", () => {
    const r = validateStudentRow({
      ...base,
      "Blood Type": "O+",
      Religion: "Catholic",
      Nationality: "Ugandan",
      NIN: "CM123456789X",
      "Previous School": "St Peter's PS",
    });
    expect(r.errors).toEqual([]);
    expect(r.data).toMatchObject({
      blood_type: "O+",
      religion: "Catholic",
      nationality: "Ugandan",
      nin: "CM123456789X",
      previous_school: "St Peter's PS",
    });
  });

  it("captures the roles and the opening balance", () => {
    const r = validateStudentRow({
      ...base,
      "Opening Balance": "UGX 150,000",
      "Prefect Role": "Head Prefect",
      "Student Council Role": "Secretary",
      "Games House": "Red",
    });
    expect(r.errors).toEqual([]);
    expect(r.data.opening_balance).toBe("150000");
    expect(r.data.prefect_role).toBe("Head Prefect");
    expect(r.data.student_council_role).toBe("Secretary");
    expect(r.data.games_house).toBe("Red");
  });

  it("defaults a blank boarding status to day", () => {
    const r = validateStudentRow({ ...base });
    expect(r.errors).toEqual([]);
    expect(r.data.boarding_status).toBe("day");
  });

  it("reads every spelling of boarding status", () => {
    for (const raw of ["boarding", "Boarding", "boarder", "B"]) {
      expect(normalizeBoardingStatus(raw)).toBe("boarding");
    }
    for (const raw of ["day", "Day", "day scholar", "D"]) {
      expect(normalizeBoardingStatus(raw)).toBe("day");
    }
    for (const raw of ["weekly", "Weekly", "W"]) {
      expect(normalizeBoardingStatus(raw)).toBe("weekly");
    }
    expect(BOARDING_STATUSES).toEqual(["day", "boarding", "weekly"]);
  });

  it("rejects an unrecognised boarding status rather than guessing", () => {
    const r = validateStudentRow({ ...base, "Boarding Status": "sometimes" });
    expect(r.isValid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/boarding/i);
  });

  it("treats a blank class monitor as false and flags a bad value", () => {
    expect(validateStudentRow({ ...base }).data.is_class_monitor).toBe(false);
    expect(validateStudentRow({ ...base, "Class Monitor": "yes" }).data.is_class_monitor).toBe(true);
    const bad = validateStudentRow({ ...base, "Class Monitor": "maybe" });
    expect(bad.isValid).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/monitor/i);
  });

  it("strips currency formatting from the opening balance", () => {
    expect(normalizeAmount("UGX 150,000")).toEqual({ value: "150000", error: null });
    expect(normalizeAmount("")).toEqual({ value: "", error: null });
    expect(normalizeAmount("abc").error).toMatch(/not a number/);
  });

  it("rejects a non-numeric opening balance", () => {
    const r = validateStudentRow({ ...base, "Opening Balance": "lots" });
    expect(r.isValid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/balance/i);
  });
});

describe("student bulk import – house matching", () => {
  const houses = [
    { id: "h1", name: "Red" },
    { id: "h2", name: "Blue" },
    { id: "h3", name: "Kasu" },
  ];
  const map = buildHouseAliasMap(houses);

  it("matches the names a roster actually uses", () => {
    for (const written of ["Red", "red", "RED", "Red House", "redhouse", "R"]) {
      const id = resolveHouseId(map, written);
      expect(id).toBe("h1");
    }
    expect(resolveHouseId(map, "Kasu")).toBe("h3");
  });

  it("does not invent a house that does not exist", () => {
    expect(resolveHouseId(map, "Purple")).toBeUndefined();
    expect(resolveHouseId(map, "")).toBeUndefined();
    expect(resolveHouseId(map, undefined)).toBeUndefined();
  });

  it("does not collide on a shared first letter", () => {
    const twoSameLetter = buildHouseAliasMap([
      { id: "x", name: "Red" },
      { id: "y", name: "Ruby" },
    ]);
    expect(resolveHouseId(twoSameLetter, "Red")).toBe("x");
    expect(resolveHouseId(twoSameLetter, "Ruby")).toBe("y");
  });
});

/**
 * Guards the template against the two ways it can break silently: a column that
 * slips out of alignment, and two fields claiming the same header.
 *
 * The alignment failure found during development was real. "UGX 150,000" contains
 * a comma, so an unquoted cell split into two columns and every value after
 * Opening Balance shifted left by one -- a learner's games house silently became
 * their student council role, with nothing reported.
 */
describe("student bulk import – template round trip", () => {
  it("covers every column with a value, so no field shifts", () => {
    const missing = TEMPLATE_COLUMNS.filter((column) => FULL_ROW[column] === undefined);
    expect(missing).toEqual([]);
    expect(TEMPLATE_COLUMNS.length).toBe(Object.keys(FULL_ROW).length);
  });

  it("lands every value on the field it belongs to", () => {
    const result = validateStudentRow(FULL_ROW);
    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({
      student_number: "STU-001",
      first_name: "Sarah",
      last_name: "Nakato",
      gender: "F",
      date_of_birth: "2015-03-15",
      class_name: "P.1",
      boarding_status: "boarding",
      house_name: "Red House",
      parent_name: "James Nakato",
      parent_phone: "0701234567",
      parent_phone2: "0707654321",
      parent_email: "james@example.com",
      ple_index_number: "U0001/2026",
      nin: "CM123456789X",
      previous_school: "St Peters PS",
      district_origin: "Mityana",
      sub_county: "Gomba",
      parish: "Wakiso",
      village: "Naluganyi",
      blood_type: "O+",
      religion: "Catholic",
      nationality: "Ugandan",
      address: "Plot 14",
      opening_balance: "150000",
      is_class_monitor: true,
      prefect_role: "Head Prefect",
      student_council_role: "Secretary",
      games_house: "Blue",
    });
  });

  it("does not let a bare Prefect header be read as the monitor flag", () => {
    // is_class_monitor used to claim "prefect" and was matched first, so a
    // column headed "Prefect" was parsed as a yes/no instead of a role.
    const result = validateStudentRow({
      first_name: "John",
      last_name: "Mukasa",
      gender: "M",
      class: "P.1",
      parent_name: "Betty Mukasa",
      Prefect: "Head Prefect",
    });
    expect(result.data.prefect_role).toBe("Head Prefect");
    expect(result.data.is_class_monitor).toBe(false);
  });
});

/**
 * Dates were the largest silent failure in the roster import and are worth their
 * own coverage.
 *
 * Postgres accepts only YYYY-MM-DD for a date column, and nothing validated the
 * format first, so dd/mm/yyyy -- the local convention -- passed the pre-flight as
 * "ready" and then failed mid-seed with:
 *
 *   date/time field value out of range: "15/03/2015"
 *
 * Worse, 03/15/2015 inserted successfully as 3 March. A learner's date of birth
 * was silently wrong with nothing reported at all.
 */
describe("student bulk import – date of birth", () => {
  const expectDate = (raw: string, expected: string) => {
    const result = normalizeDateOfBirth(raw);
    expect(result.error).toBeNull();
    expect(result.value).toBe(expected);
  };

  it("accepts ISO dates unchanged", () => {
    expectDate("2015-03-15", "2015-03-15");
    expectDate("2015-3-5", "2015-03-05");
  });

  it("accepts the local dd/mm/yyyy convention", () => {
    expectDate("15/03/2015", "2015-03-15");
    expectDate("15-03-2015", "2015-03-15");
    expectDate("15.03.2015", "2015-03-15");
    expectDate("1/3/2015", "2015-03-01");
    expectDate("05/06/2016", "2016-06-05");
  });

  it("reads month-first only when the day cannot be a month", () => {
    expectDate("03/15/2015", "2015-03-15");
    expectDate("12/25/2014", "2014-12-25");
  });

  it("handles two-digit years", () => {
    expectDate("5/6/15", "2015-06-05");
    expectDate("5/6/99", "1999-06-05");
  });

  it("recovers a date exported from a spreadsheet as a serial number", () => {
    const result = normalizeDateOfBirth("42095");
    expect(result.error).toBeNull();
    expect(result.value).toMatch(/^2015-0\d-\d{2}$/);
  });

  it("understands month names", () => {
    expectDate("15 March 2015", "2015-03-15");
    expectDate("March 2015", "2015-03-01");
    // an exported timestamp must not shift by a day depending on the reader's zone
    expectDate("2016-02-29T00:00:00Z", "2016-02-29");
    expectDate("2016-02-29 00:00:00", "2016-02-29");
    expectDate("29/02/2016", "2016-02-29");
  });

  it("rejects a leap day in a year that is not a leap year", () => {
    // 2018 is not divisible by 4, so 29 February never existed
    const result = normalizeDateOfBirth("2018-02-29");
    expect(result.error).toMatch(/not a real date/);
  });

  it("treats blank as not supplied", () => {
    expect(normalizeDateOfBirth("")).toEqual({ value: "", error: null });
    expect(normalizeDateOfBirth("   ")).toEqual({ value: "", error: null });
  });

  const expectRejected = (raw: string) => {
    const result = normalizeDateOfBirth(raw);
    expect(result.error).toBeTruthy();
    expect(result.value).toBe("");
    // the message has to tell the user what to type instead
    expect(result.error).toMatch(/dd\/mm\/yyyy/);
  };

  it("rejects values that cannot be a birth date", () => {
    for (const raw of ["2015", "42095" + "0", "abc", "32/01/2015", "15/13/2015", "15/02/2016x"]) {
      expectRejected(raw);
    }
  });

  it("rejects a date in the future", () => {
    expectRejected("01/01/2099");
  });

  it("reports a bad date on the row instead of failing the import later", () => {
    const result = validateStudentRow({
      first_name: "Sarah",
      last_name: "Nakato",
      gender: "F",
      class: "P.1",
      parent_name: "James Nakato",
      "Date of Birth": "15/03/2015",
    });
    expect(result.errors).toEqual([]);
    expect(result.data.date_of_birth).toBe("2015-03-15");

    const bad = validateStudentRow({
      first_name: "John",
      last_name: "Mukasa",
      gender: "M",
      class: "P.1",
      parent_name: "Betty Mukasa",
      "Date of Birth": "2015",
    });
    expect(bad.isValid).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/date of birth/i);
  });
});

/**
 * The template is header-only on purpose.
 *
 * It previously carried two filled-in example learners, which a headmaster would
 * fill around and upload, inventing two children in the register.
 */
describe("student bulk import – template shape", () => {
  it("emits a single header row and nothing else", () => {
    const headerOnly = TEMPLATE_COLUMNS.join(",");
    const lines = headerOnly.split("\n");
    expect(lines.length).toBe(1);
    expect(lines[0].split(",")).toEqual(TEMPLATE_COLUMNS);
  });

  it("survives a BOM and a Windows line ending, as downloaded", () => {
    const file = `\uFEFF${TEMPLATE_COLUMNS.join(",")}\r\n`;
    const rows = parseDelimitedText(file);
    expect(rows.length).toBe(0);
  });

  it("parses a filled copy of that template", () => {
    const file =
      `\uFEFF${TEMPLATE_COLUMNS.join(",")}\r\n` +
      `${TEMPLATE_COLUMNS.map((c) => (FULL_ROW[c] ?? "").replace(/[",]/g, (m) => `"${m}"`)).join(",")}\r\n`;
    const rows = parseDelimitedText(file);
    expect(rows.length).toBe(1);
    const result = validateStudentRow(rows[0]);
    expect(result.errors).toEqual([]);
    expect(result.data.date_of_birth).toBe("2015-03-15");
    expect(result.data.opening_balance).toBe("150000");
    expect(result.data.games_house).toBe("Blue");
  });
});

/**
 * This is why the import looked intermittent: the same roster imported cleanly
 * as .csv and failed every date as .xlsx.
 *
 * ExcelJS returns a JavaScript Date for a cell Excel has formatted as a date.
 * Stringifying it produced
 *   "Sun Mar 15 2015 03:00:00 GMT+0300 (East Africa Time)"
 * which no date parser accepts, so every date in a spreadsheet upload was
 * rejected while the CSV route worked.
 */
describe("student bulk import – spreadsheet cells", () => {
  it("renders a date cell as YYYY-MM-DD", () => {
    expect(formatSpreadsheetCell(new Date(Date.UTC(2015, 2, 15)))).toBe("2015-03-15");
    expect(formatSpreadsheetCell(new Date(Date.UTC(2014, 5, 20)))).toBe("2014-06-20");
  });

  it("accepts a leap day, which Excel can store", () => {
    expect(formatSpreadsheetCell(new Date(Date.UTC(2016, 1, 29)))).toBe("2016-02-29");
  });

  it("turns an invalid Date into blank rather than the word Invalid", () => {
    expect(formatSpreadsheetCell(new Date("nonsense"))).toBe("");
  });

  it("renders plain and numeric cells unchanged", () => {
    expect(formatSpreadsheetCell("Sarah")).toBe("Sarah");
    expect(formatSpreadsheetCell("  P.1  ")).toBe("P.1");
    expect(formatSpreadsheetCell(150000)).toBe("150000");
    expect(formatSpreadsheetCell(null)).toBe("");
    expect(formatSpreadsheetCell(undefined)).toBe("");
  });

  it("reads a cell holding styled text", () => {
    expect(formatSpreadsheetCell({ richText: [{ text: "Sara" }, { text: "h" }] })).toBe("Sarah");
    expect(formatSpreadsheetCell({ text: "Mukasa" })).toBe("Mukasa");
  });

  it("does not surface an Excel error value as text", () => {
    expect(formatSpreadsheetCell({ error: "#N/A" })).toBe("");
  });

  it("produces a date the row validator then accepts", () => {
    const cell = formatSpreadsheetCell(new Date(Date.UTC(2015, 2, 15)));
    const result = validateStudentRow({
      "First Name": "Sarah",
      "Last Name": "Nakato",
      Gender: "F",
      "Date of Birth": cell,
      Class: "P.1",
      "Parent Name": "James Nakato",
    });
    expect(result.errors).toEqual([]);
    expect(result.data.date_of_birth).toBe("2015-03-15");
  });
});

describe("student bulk import – uneab number", () => {
  it("is captured from the roster", () => {
    const result = validateStudentRow({
      first_name: "Sarah",
      last_name: "Nakato",
      gender: "F",
      class: "P.1",
      parent_name: "James Nakato",
      "UNEAB Number": "U8483920",
    });
    expect(result.errors).toEqual([]);
    expect(result.data.uneab_number).toBe("U8483920");
  });

  it("is left blank when the column is absent", () => {
    const result = validateStudentRow({
      first_name: "John",
      last_name: "Mukasa",
      gender: "M",
      class: "P.1",
      parent_name: "Betty Mukasa",
    });
    expect(result.data.uneab_number).toBe("");
  });
});

/**
 * Three screens hand out a student template: the registry's CSV, the import
 * page's Excel file, and the API route's Word document. Each used to keep its
 * own column list, so two of them went on shipping an 8-column file after the
 * third had grown to 29 -- the same file, downloaded from a different page,
 * looked unchanged.
 */
describe("student bulk import – template columns", () => {
  it("ships one list", () => {
    expect(buildStudentTemplateCsv()).toBe(STUDENT_TEMPLATE_HEADERS.join(","));
  });

  it("carries every field a person can supply", () => {
    // 47 columns on the students table, of which 15 are system-managed and 3
    // are unused by any code, leaving 29 that a school could want on a roster.
    expect(STUDENT_TEMPLATE_HEADERS).toHaveLength(29);
  });

  it("is a header row only, so downloading it cannot create a learner", () => {
    const rows = buildStudentTemplateCsv().split(/\r?\n/);
    expect(rows).toHaveLength(1);
  });

  it("starts with the fields needed to identify a child", () => {
    expect(STUDENT_TEMPLATE_HEADERS.slice(0, 6)).toEqual([
      "Student Number",
      "First Name",
      "Last Name",
      "Gender",
      "Date of Birth",
      "Class",
    ]);
  });

  /**
   * One filled-in value per heading. Every template column must appear here:
   * adding a heading without adding a sample is how a column ends up shipped
   * but never parsed, which is the failure this suite exists to catch.
   */
  const SAMPLE_BY_HEADER: Record<string, string> = {
    "Student Number": "",
    "First Name": "Sarah",
    "Last Name": "Nakato",
    Gender: "F",
    "Date of Birth": "2015-03-15",
    Class: "P.1",
    "Boarding Status": "day",
    House: "Red",
    "Parent Name": "James Nakato",
    "Parent Phone": "0701234567",
    "Parent Phone 2": "",
    "Parent Email": "james@example.com",
    "PLE Index": "PLE/2026/001",
    NIN: "CM123456789012",
    "Previous School": "Kikunyu Primary",
    "District of Origin": "Kabarole",
    "Sub-county": "Kicucu",
    Parish: "Kicucu",
    Village: "Kicucu East",
    "Blood Type": "O+",
    Religion: "Christian",
    Nationality: "Ugandan",
    Address: "Plot 1 Kabarole",
    "Opening Balance": "150000",
    "Class Monitor": "yes",
    "Prefect Role": "Head Boy",
    "Student Council Role": "Treasurer",
    "Games House": "Red",
    "UNEAB Number": "U8483920",
  };

  it("covers every heading with a sample, so none can be shipped unread", () => {
    for (const header of STUDENT_TEMPLATE_HEADERS) {
      expect(SAMPLE_BY_HEADER).toHaveProperty(header);
    }
    expect(Object.keys(SAMPLE_BY_HEADER)).toHaveLength(STUDENT_TEMPLATE_HEADERS.length);
  });

  it("round-trips: a row built from the template parses back intact", () => {
    const csv = [
      STUDENT_TEMPLATE_HEADERS.join(","),
      STUDENT_TEMPLATE_HEADERS.map((header) => SAMPLE_BY_HEADER[header]).join(","),
    ].join("\n");

    const rows = parseDelimitedText(csv);
    expect(rows).toHaveLength(1);

    const result = validateStudentRow(rows[0]);
    expect(result.errors).toEqual([]);

    expect(result.data.first_name).toBe("Sarah");
    expect(result.data.last_name).toBe("Nakato");
    expect(result.data.date_of_birth).toBe("2015-03-15");
    expect(result.data.uneab_number).toBe("U8483920");
    expect(result.data.village).toBe("Kicucu East");
    expect(result.data.previous_school).toBe("Kikunyu Primary");
    expect(result.data.prefect_role).toBe("Head Boy");
    // The parser keeps the raw text; the seeding hook converts it with Number().
    expect(result.data.opening_balance).toBe("150000");
    expect(result.data.is_class_monitor).toBe(true);
  });

  it("covers the fields the registration form itself collects", () => {
    const wanted = [
      "Boarding Status",
      "House",
      "NIN",
      "PLE Index",
      "Opening Balance",
      "Class Monitor",
      "Prefect Role",
      "UNEAB Number",
    ];
    for (const header of wanted) expect(STUDENT_TEMPLATE_HEADERS).toContain(header);
  });
});
