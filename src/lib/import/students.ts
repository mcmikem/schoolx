export type StudentField =
  | "first_name"
  | "last_name"
  | "full_name"
  | "gender"
  | "date_of_birth"
  | "parent_name"
  | "parent_phone"
  | "parent_phone2"
  | "class_name"
  | "student_number"
  | "ple_index_number";

export interface ParsedStudentRow {
  first_name: string;
  last_name: string;
  gender: "M" | "F" | "";
  date_of_birth: string;
  parent_name: string;
  parent_phone: string;
  parent_phone2: string;
  class_name: string;
  student_number: string;
  ple_index_number: string;
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

  return {
    data: {
      first_name: first,
      last_name: last,
      gender,
      date_of_birth: get("date_of_birth"),
      parent_name: get("parent_name"),
      parent_phone,
      parent_phone2: get("parent_phone2"),
      class_name: get("class_name"),
      student_number: get("student_number"),
      ple_index_number: get("ple_index_number"),
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
    class_name: "",
    student_number: "",
    ple_index_number: "",
  };
}
