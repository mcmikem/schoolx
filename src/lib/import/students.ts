/**
 * Every field a roster can carry.
 *
 * This is the single field list shared by both import screens, and it mirrors
 * the registration form so a learner can be enrolled identically whether they
 * are typed in one at a time or uploaded in bulk. `house_name` and `class_name`
 * are the human-written forms; the importer resolves them to the ids the insert
 * actually needs.
 */
export type StudentField =
  | "first_name"
  | "last_name"
  | "full_name"
  | "gender"
  | "date_of_birth"
  | "class_name"
  | "student_number"
  | "ple_index_number"
  | "parent_name"
  | "parent_phone"
  | "parent_phone2"
  | "parent_email"
  | "address"
  | "village"
  | "parish"
  | "sub_county"
  | "district_origin"
  | "boarding_status"
  | "house_name"
  | "previous_school"
  | "blood_type"
  | "religion"
  | "nationality"
  | "nin"
  | "opening_balance"
  | "is_class_monitor"
  | "prefect_role"
  | "student_council_role"
  | "games_house";

export interface ParsedStudentRow {
  first_name: string;
  last_name: string;
  gender: "M" | "F" | "";
  date_of_birth: string;
  parent_name: string;
  parent_phone: string;
  parent_phone2: string;
  parent_email: string;
  address: string;
  village: string;
  parish: string;
  sub_county: string;
  district_origin: string;
  class_name: string;
  student_number: string;
  ple_index_number: string;
  boarding_status: string;
  house_name: string;
  previous_school: string;
  blood_type: string;
  religion: string;
  nationality: string;
  nin: string;
  opening_balance: string;
  is_class_monitor: boolean;
  prefect_role: string;
  student_council_role: string;
  games_house: string;
}

export interface ValidatedStudentRow {
  data: ParsedStudentRow;
  isValid: boolean;
  errors: string[];
}

const FIELD_ALIASES: Record<StudentField, string[]> = {
  first_name: ["firstname", "first", "givenname", "studentfirstname", "pupilfirstname", "forename", "firstnames"],
  last_name: ["lastname", "last", "surname", "familyname", "studentlastname", "pupillastname", "lastnames"],
  full_name: ["name", "fullname", "studentname", "pupilname", "names", "fullnames"],
  gender: ["gender", "sex", "sexofpupil", "genderofpupil", "sexofstudent", "genderofstudent", "sexm/f"],
  date_of_birth: ["dateofbirth", "dob", "birthdate", "birthday", "dateofbirthdob"],
  parent_name: [
    "parentname",
    "parentguardianname",
    "guardianname",
    "parent",
    "guardian",
    "parentorguardian",
    "fathersname",
    "mothersname",
    "fathername",
    "mothername",
    "parentnames",
    "guardiannames",
  ],
  parent_phone: [
    "parentphone",
    "guardianphone",
    "parentcontact",
    "guardiancontact",
    "phone",
    "phonenumber",
    "mobile",
    "mobilenumber",
    "contact",
    "telephone",
    "parentsphone",
    "parentsmobile",
    "fathersphone",
    "mothersphone",
    "parentphonenumber",
    "phone1",
    "parentsmobilenumber",
  ],
  parent_phone2: [
    "parentphone2",
    "phone2",
    "secondphone",
    "alternatephone",
    "otherphone",
    "phonenumber2",
    "guardianphone2",
    "parentphonenumber2",
    "mobile2",
    "mobilenumber2",
  ],
  class_name: [
    "class",
    "grade",
    "stream",
    "classstream",
    "form",
    "level",
    "classname",
    "studentclass",
    "classgrade",
    "section",
    "streamclass",
    "classlevel",
  ],
  student_number: [
    "studentnumber",
    "studentno",
    "admissionnumber",
    "admissionno",
    "admn",
    "admno",
    "id",
    "studentid",
    "regno",
    "registrationnumber",
    "registrationno",
    "studentregistrationnumber",
    "admnumber",
  ],
  ple_index_number: [
    "pleindex",
    "pleindexnumber",
    "ple",
    "unebindex",
    "indexnumber",
    "nationalindex",
    "pleunebindex",
    "unebindexnumber",
  ],
  parent_email: ["parentemail", "email", "guardianemail", "parentmail", "contactemail"],
  address: ["address", "homeaddress", "residentialaddress", "physicaladdress"],
  village: ["village", "villageofresidence", "homevillage"],
  parish: ["parish", "parishofresidence"],
  sub_county: ["subcounty", "subcountyofresidence", "subcountyoforigin", "county"],
  district_origin: ["districtorigin", "origindistrict", "district", "homedistrict", "districtoforigin"],
  boarding_status: ["boardingstatus", "boarding", "residence", "residencetype", "boardingtype"],
  house_name: ["house", "housename", "schoolhouse", "houseofresidence"],
  previous_school: ["previousschool", "formerschool", "lastschool", "prior school", "priorschool", "prevschool"],
  blood_type: ["bloodtype", "bloodgroup", "blood"],
  religion: ["religion", "religiousaffiliation", "faith"],
  nationality: ["nationality", "citizenship", "country"],
  nin: ["nin", "nationalidentificationnumber", "nationalid", "ssn"],
  opening_balance: ["openingbalance", "openingfees", "openingfeebalance", "balance", "opening", "fee balance"],
  // "prefect" alone belongs to prefect_role. normalizeHeader returns the first
  // field that claims a header, and is_class_monitor is declared first, so
  // listing it here made a column headed "Prefect" read as a yes/no flag.
  is_class_monitor: ["isclassmonitor", "classmonitor", "monitor", "classprefect"],
  prefect_role: ["prefectrole", "prefect", "prefecttitle", "leadershiprole", "monitorrole"],
  games_house: ["gameshouse", "games", "sportshouse", "athleticshouse", "footballhouse"],
  student_council_role: ["studentcouncilrole", "studentcouncil", "councilrole", "scc", "council"],
};

export function normalizeHeader(raw: string): StudentField | null {
  const key = (raw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key) return null;
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(key)) return field as StudentField;
  }
  return null;
}

export function mapRowKeys(row: Record<string, unknown>): Partial<Record<StudentField, string>> {
  const assignment: Partial<Record<StudentField, string>> = {};
  let phoneCount = 0;

  for (const rawKey of Object.keys(row)) {
    const field = normalizeHeader(rawKey);
    if (!field) continue;

    if (field === "parent_phone") {
      phoneCount++;
      if (phoneCount === 1) {
        assignment.parent_phone = rawKey;
      } else if (!assignment.parent_phone2) {
        assignment.parent_phone2 = rawKey;
      }
      continue;
    }

    if (!assignment[field]) assignment[field] = rawKey;
  }

  return assignment;
}

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function splitFullName(full: string): { first: string; last: string } {
  const trimmed = full.trim();
  const spaceIndex = trimmed.lastIndexOf(" ");
  if (spaceIndex > 0) {
    return { first: trimmed.slice(0, spaceIndex).trim(), last: trimmed.slice(spaceIndex + 1).trim() };
  }
  return { first: trimmed, last: trimmed };
}

export function normalizeGender(raw: string): "M" | "F" | "" {
  const upper = (raw || "").trim().toUpperCase();
  if (upper === "M" || upper === "MALE") return "M";
  if (upper === "F" || upper === "FEMALE") return "F";
  return "";
}

export const BOARDING_STATUSES = ["day", "boarding", "weekly"] as const;
export type BoardingStatus = (typeof BOARDING_STATUSES)[number];

const TRUTHY = ["y", "yes", "true", "1", "x", "t"];
const FALSY = ["n", "no", "false", "0", "f", ""];

/**
 * The form stores a single leading letter per house, so accept the word forms
 * that appear in a hand-written roster and settle on the letter.
 */
export function normalizeBoardingStatus(raw: string): BoardingStatus | "" {
  const k = (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!k) return "day";
  if (k.startsWith("b")) return "boarding";
  if (k.startsWith("d")) return "day";
  if (k.startsWith("w")) return "weekly";
  return "";
}

/**
 * A blank cell means "not a monitor" rather than an error. An unrecognised value
 * is reported, because guessing here would quietly put the wrong student on the
 * prefects list.
 */
export function normalizeMonitorFlag(raw: string): { value: boolean; error: string | null } {
  const k = (raw || "").trim().toLowerCase();
  if (TRUTHY.includes(k)) return { value: true, error: null };
  if (FALSY.includes(k)) return { value: false, error: null };
  return { value: false, error: `unrecognised value "${raw}"` };
}

/** Returns "" when the cell is blank or not a number, so it can be reported. */
export function normalizeAmount(raw: string): { value: string; error: string | null } {
  const k = (raw || "").trim();
  if (!k) return { value: "", error: null };
  const cleaned = k.replace(/[^\d.\-]/g, "");
  if (!cleaned || cleaned === "-" || isNaN(Number(cleaned))) {
    return { value: "", error: `"${k}" is not a number` };
  }
  return { value: cleaned, error: null };
}

/**
 * Excel's day zero is 1899-12-30. Serials below this are not dates anyone means
 * by a birth date, so they are treated as a mistake rather than a date.
 */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MIN_PLAUSIBLE_SERIAL = 20000; // 1954-10-03
const MAX_PLAUSIBLE_SERIAL = 80000; // 2119-01-01

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Read a date of birth and restate it as YYYY-MM-DD.
 *
 * Dates are the one place where being lenient is unsafe. Postgres only accepts
 * YYYY-MM-DD, so anything else reaches the insert and comes back as
 * `date/time field value out of range` with no hint about the offending row.
 * dd/mm/yyyy is the local convention here, so a slash, dash or dot date is read
 * day-first; a value whose first part cannot be a month, such as 15/03/2015, is
 * read month-first instead rather than being silently read as 3 March.
 *
 * Anything unrecognised is returned as an error instead of being guessed at, so
 * the row is reported before seeding rather than during it.
 */
export function normalizeDateOfBirth(raw: string): { value: string; error: string | null } {
  const input = (raw || "").trim();
  if (!input) return { value: "", error: null };

  const fail = (detail: string) => ({
    value: "",
    error: `"${raw}" ${detail}. Use dd/mm/yyyy, for example 15/03/2015.`,
  });

  // A bare year, or anything that is only digits, is ambiguous or too coarse.
  if (/^\d{4}$/.test(input)) {
    return { value: "", error: `is only a year. Use dd/mm/yyyy, for example 01/01/${input}` };
  }

  // Excel serial, which is what a spreadsheet exports when a date column was
  // ever formatted as a number.
  if (/^\d{4,6}$/.test(input)) {
    const serial = Number(input);
    if (serial < MIN_PLAUSIBLE_SERIAL || serial > MAX_PLAUSIBLE_SERIAL) {
      return fail("is not a date");
    }
    const d = new Date(EXCEL_EPOCH_UTC + serial * 86400000);
    if (Number.isNaN(d.getTime())) return fail("is not a date");
    return { value: d.toISOString().slice(0, 10), error: null };
  }

  // ISO already.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  if (iso) {
    const [, y, m, d] = iso;
    return finishDate(Number(y), Number(m), Number(d), fail);
  }

  const sep = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(input);
  if (sep) {
    const [, a, b, rawYear] = sep;
    const first = Number(a);
    const second = Number(b);
    let year = Number(rawYear);
    if (rawYear.length === 2) year = year > 30 ? 1900 + year : 2000 + year;

    // Read day-first unless the first part cannot be a month.
    if (first > 12) return finishDate(year, second, first, fail);
    if (second > 12) return finishDate(year, first, second, fail);
    return finishDate(year, second, first, fail); // both plausible: dd/mm
  }

  // An exported timestamp, e.g. 2018-02-29T00:00:00Z. The date is taken
  // verbatim from the text rather than handed to `new Date()`.
  const stamped = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]|$)/.exec(input);
  if (stamped) {
    return finishDate(Number(stamped[1]), Number(stamped[2]), Number(stamped[3]), fail);
  }

  // Month names, written out. `new Date("15 March 2015")` reads the text in the
  // machine's own zone, so the same file imported in Kampala and in London could
  // disagree by a day. Every date here is therefore read from the string itself.
  const named = /^(\d{1,2})?[\s\-/]*([a-z]{3,9})[\s\-/,]*(\d{1,2})?[\s,\-/]*(\d{4})$/i.exec(input);
  if (named) {
    const day = named[1] ? Number(named[1]) : null;
    const month = MONTH_NAMES.indexOf(named[2].slice(0, 3).toLowerCase());
    const second = named[3] ? Number(named[3]) : null;
    const year = Number(named[4]);
    if (month >= 0) {
      if (day !== null && second !== null) return fail("is ambiguous");
      return finishDate(year, month + 1, day ?? second ?? 1, fail);
    }
  }

  return fail("is not a date");
}

function finishDate(
  year: number,
  month: number,
  day: number,
  fail: (detail: string) => { value: string; error: string | null },
): { value: string; error: string | null } {
  if (month < 1 || month > 12) return fail("has a month outside 01-12");
  if (day < 1 || day > 31) return fail("has a day outside 01-31");

  const asDate = new Date(Date.UTC(year, month - 1, day));
  if (asDate.getUTCFullYear() !== year || asDate.getUTCMonth() !== month - 1 || asDate.getUTCDate() !== day) {
    return fail("is not a real date");
  }
  if (asDate.getTime() > Date.now()) return fail("is in the future");

  return { value: asDate.toISOString().slice(0, 10), error: null };
}

export function validateStudentRow(raw: Record<string, unknown>): ValidatedStudentRow {
  const keys = mapRowKeys(raw);
  const get = (field: StudentField): string => (keys[field] ? cleanValue(raw[keys[field] as string]) : "");

  const errors: string[] = [];
  let first = get("first_name");
  let last = get("last_name");

  if (!first && !last) {
    const full = get("full_name");
    if (full) {
      const split = splitFullName(full);
      first = split.first;
      last = split.last;
    }
  }

  const genderRaw = get("gender");
  const gender = normalizeGender(genderRaw);

  const parent_phone = get("parent_phone");
  const phoneDigits = parent_phone.replace(/\D/g, "");

  if (!first) errors.push("Missing first name");
  if (!last) errors.push("Missing last name");
  if (!genderRaw) errors.push("Missing gender");
  else if (!gender) errors.push(`Invalid gender "${genderRaw}"`);
  if (parent_phone && phoneDigits.length < 9) errors.push("Phone number looks too short");

  const boarding = normalizeBoardingStatus(get("boarding_status"));
  if (!boarding) errors.push(`Unrecognised boarding status "${get("boarding_status")}"`);
  const boardingStatus = boarding || "";

  const monitorFlag = normalizeMonitorFlag(get("is_class_monitor"));
  if (monitorFlag.error) errors.push(`Class monitor: ${monitorFlag.error}`);
  const monitor = monitorFlag.value;

  const amount = normalizeAmount(get("opening_balance"));
  if (amount.error) errors.push(`Opening balance: ${amount.error}`);
  const amountValue = amount.value;

  const dob = normalizeDateOfBirth(get("date_of_birth"));
  if (dob.error) errors.push(`Date of birth: ${dob.error}`);

  return {
    data: {
      first_name: first,
      last_name: last,
      gender,
      date_of_birth: dob.value,
      parent_name: get("parent_name"),
      parent_phone,
      parent_phone2: get("parent_phone2"),
      class_name: get("class_name"),
      student_number: get("student_number"),
      ple_index_number: get("ple_index_number"),
      parent_email: get("parent_email"),
      address: get("address"),
      village: get("village"),
      parish: get("parish"),
      sub_county: get("sub_county"),
      district_origin: get("district_origin"),
      boarding_status: boardingStatus,
      house_name: get("house_name"),
      previous_school: get("previous_school"),
      blood_type: get("blood_type"),
      religion: get("religion"),
      nationality: get("nationality"),
      nin: get("nin"),
      opening_balance: amountValue,
      is_class_monitor: monitor,
      prefect_role: get("prefect_role"),
      student_council_role: get("student_council_role"),
      games_house: get("games_house"),
    },
    isValid: errors.length === 0,
    errors,
  };
}

export function parseStudentRows(rows: Array<Record<string, unknown>>): ValidatedStudentRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => validateStudentRow(row || {}));
}

export function detectDelimiter(text: string): string {
  const firstLine = (text.split(/\r?\n/, 1)[0] || "") as string;
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  if (firstLine.includes("|")) return "|";
  return ",";
}

export function splitDelimitedLine(line: string, delimiter: string): string[] {
  const value = (line || "").trim();
  if (!value) return [];
  if (delimiter === ",") {
    return value.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.trim().replace(/^["']|["']$/g, ""));
  }
  return value.split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ""));
}

export function parseDelimitedText(text: string): Array<Record<string, unknown>> {
  const delimiter = detectDelimiter(text);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitDelimitedLine(lines[0], delimiter);
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitDelimitedLine(lines[i], delimiter);
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (header) row[header] = values[idx] ?? "";
    });
    if (Object.keys(row).length > 0) rows.push(row);
  }

  return rows;
}

export function buildEmptyStudentRow(): ParsedStudentRow {
  return {
    first_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    parent_name: "",
    parent_phone: "",
    parent_phone2: "",
    parent_email: "",
    address: "",
    village: "",
    parish: "",
    sub_county: "",
    district_origin: "",
    class_name: "",
    student_number: "",
    ple_index_number: "",
    boarding_status: "day",
    house_name: "",
    previous_school: "",
    blood_type: "",
    religion: "",
    nationality: "",
    nin: "",
    opening_balance: "",
    is_class_monitor: false,
    prefect_role: "",
    student_council_role: "",
    games_house: "",
  };
}

// Real CSVs say "P.1", "p1", "Primary 1", "Primary1 " for the same class.
// Index every class under its normalized key plus common aliases so harmless
// spelling variants import instead of failing row by row. First class wins
// on alias collisions.
export function buildClassAliasMap(classes: Array<{ id: string; name: string }>): Map<string, string> {
  const map = new Map<string, string>();
  const addAlias = (key: string, id: string) => {
    const k = key.trim().toLowerCase();
    if (k && !map.has(k)) map.set(k, id);
  };
  for (const { id, name } of classes) {
    const raw = String(name || "");
    const compact = raw
      .trim()
      .toLowerCase()
      .replace(/[\s._-]+/g, "");
    addAlias(raw, id);
    addAlias(compact, id);
    const m = compact.match(/^([a-z]+)(\d+[a-z]?)$/);
    if (m) {
      const [, letters, num] = m;
      if (letters === "p") {
        addAlias(`primary${num}`, id);
      } else if (letters === "s") {
        addAlias(`senior${num}`, id);
        addAlias(`secondary${num}`, id);
      } else if (letters.startsWith("primary")) {
        addAlias(`p${num}`, id);
        addAlias(`p.${num}`, id);
      } else if (letters.startsWith("senior") || letters.startsWith("secondary")) {
        addAlias(`s${num}`, id);
        addAlias(`s.${num}`, id);
      }
    }
  }
  return map;
}

export function resolveClassId(map: Map<string, string>, rawClassName: unknown): string | undefined {
  const raw = String(rawClassName || "")
    .trim()
    .toLowerCase();
  if (!raw) return undefined;
  return map.get(raw) ?? map.get(raw.replace(/[\s._-]+/g, ""));
}

/**
 * Index houses by every spelling that identifies them.
 *
 * Roster sheets write "Red", "red house", "RED"; the stored value is a single
 * letter. Normalising the same way class names are normalised means a house
 * column is as forgiving as a class column.
 */
export function buildHouseAliasMap(houses: Array<{ id: string; name: string }>): Map<string, string> {
  const map = new Map<string, string>();
  const addAlias = (key: string, id: string) => {
    const k = key.trim().toLowerCase();
    if (k && !map.has(k)) map.set(k, id);
  };
  for (const { id, name } of houses) {
    const raw = String(name || "");
    if (!raw.trim()) continue;
    addAlias(raw, id);
    addAlias(raw.replace(/[\s._-]+/g, ""), id);
    const letters = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    if (letters) {
      addAlias(letters, id);
      addAlias(letters.slice(0, 1), id);
      addAlias(`${letters.slice(0, 1)}house`, id);
    }
  }
  return map;
}

export function resolveHouseId(map: Map<string, string>, rawHouseName: unknown): string | undefined {
  if (rawHouseName === null || rawHouseName === undefined) return undefined;
  const k = String(rawHouseName).trim().toLowerCase();
  if (!k) return undefined;
  const direct = map.get(k);
  if (direct) return direct;

  const compact = k.replace(/[\s._-]+/g, "");
  const lettersOnly = compact.replace(/[^a-z]/g, "");
  const withoutNoise = map.get(compact) ?? map.get(lettersOnly);
  if (withoutNoise) return withoutNoise;

  // A roster is as likely to say "Red House" as "Red", so drop the word that
  // only qualifies the colour and try again.
  const stripped = lettersOnly.replace(/houses?$/, "");
  if (stripped && stripped !== lettersOnly) {
    return map.get(stripped) ?? map.get(stripped.slice(0, 1));
  }
  return undefined;
}
