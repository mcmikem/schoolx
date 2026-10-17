import type { BoardingStatus, FeeCategory, FeeFrequency } from "@/components/fees/FeeFormModal";
import { normalizeAmount } from "./students";

/**
 * Rows of a fee-structure import file.
 *
 * A "fee structure" row is one billable line for a class (or every class): what
 * it is called, how much it costs, which term and year it belongs to. The shape
 * mirrors FeeStructure but every value is a string, because it comes straight
 * from a spreadsheet cell and may be blank, misspelt or formatted as a date.
 */
export interface ParsedFeeRow {
  name: string;
  class_name: string;
  amount: string;
  term: string;
  category: string;
  boarding_status: BoardingStatus;
  frequency: FeeFrequency;
  transport_zone: string;
  due_date: string;
  academic_year: string;
}

export interface ValidatedFeeRow {
  isValid: boolean;
  data: ParsedFeeRow;
  errors: string[];
}

export const FEE_TEMPLATE_HEADERS = [
  "Fee Name",
  "Class",
  "Amount (UGX)",
  "Term",
  "Category",
  "Applies To",
  "Frequency",
  "Transport Zone",
  "Due Date",
  "Academic Year",
];

/**
 * Header row only, same as the student template.
 *
 * A sample fee in the template is a fee the importer will happily create in a
 * school that only ever downloaded the blank form, so the file ships empty.
 */
export function buildFeeTemplateCsv(): string {
  return FEE_TEMPLATE_HEADERS.join(",");
}

type FeeField = keyof ParsedFeeRow;

/**
 * Spreadsheets name the same column many ways: "Fee", "Item", "Particulars".
 * Every spelling is indexed so a school does not have to rename its own sheet.
 */
const HEADER_ALIASES: Record<FeeField, string[]> = {
  name: ["fee name", "fee", "name", "item", "fee item", "particulars", "description", "title"],
  class_name: ["class", "class name", "level", "grade", "form", "class level"],
  amount: ["amount", "amount (ugx)", "amount ugx", "fee amount", "amount payable", "cost", "price"],
  term: ["term", "term number", "term no"],
  category: ["category", "fee category", "fee type", "type", "head"],
  boarding_status: ["applies to", "boarding", "boarding status", "resident", "day/boarding", "student type"],
  frequency: ["frequency", "billing", "recurrence", "per", "payment frequency", "period"],
  transport_zone: ["transport zone", "zone", "route", "transport route"],
  due_date: ["due date", "due", "deadline", "payment due date"],
  academic_year: ["academic year", "year", "session", "academic session"],
};

function normalizeHeaderKey(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const FIELD_BY_HEADER = (() => {
  const map = new Map<string, FeeField>();
  (Object.keys(HEADER_ALIASES) as FeeField[]).forEach((field) => {
    for (const alias of HEADER_ALIASES[field]) {
      const key = normalizeHeaderKey(alias);
      if (key && !map.has(key)) map.set(key, field);
    }
  });
  return map;
})();

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function readField(raw: Record<string, unknown>, field: FeeField): string {
  for (const [header, value] of Object.entries(raw)) {
    if (FIELD_BY_HEADER.get(normalizeHeaderKey(header)) === field) return cleanValue(value);
  }
  return "";
}

function normalizeText(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s._\-/]+/g, " ")
    .trim();
}

/**
 * Categories are matched by keyword, not equality, because a bursar writes
 * "Lunch & Porridge" or "School Fees (Term 1)" rather than the slug. A value
 * that matches nothing is kept as "other" rather than rejected -- the amount
 * and the name are what matter, and a wrong grouping should not block a bill.
 */
const CATEGORY_ALIASES: Array<[FeeCategory, string[]]> = [
  ["uneb", ["uneb", "une b", "uneb registration"]],
  ["bank_charges", ["bank charges", "bank charge", "banking"]],
  ["development", ["development", "development levy", "development fund", "building fund", "building"]],
  ["functional", ["functional", "functional fees", "requirements", "requirement"]],
  ["registration", ["registration", "admission", "enrollment", "enrolment"]],
  ["uniform", ["uniform", "uniforms", "clothing", "attire"]],
  ["library", ["library"]],
  ["sports", ["sports", "games", "co curricular", "co-curricular"]],
  ["ict", ["ict", "computer lab", "computer fee", "computer"]],
  ["medical", ["medical", "health", "sick bay", "clinic"]],
  ["exam", ["exam", "examination", "exam fee", "test fee"]],
  ["transport", ["transport", "transportation", "school bus", "bus", "taxi"]],
  ["boarding", ["boarding", "accommodation", "hostel", "board"]],
  ["meals", ["meals", "meal", "food", "feeding", "lunch", "porridge"]],
  ["pta", ["pta", "parents teacher association", "parent teacher association"]],
  ["tuition", ["tuition", "school fees", "school fee", "tuition fees"]],
];

export function normalizeFeeCategory(raw: string): FeeCategory {
  const text = normalizeText(raw);
  if (!text) return "tuition";
  for (const [category, aliases] of CATEGORY_ALIASES) {
    if (aliases.includes(text)) return category;
  }
  for (const [category, aliases] of CATEGORY_ALIASES) {
    if (aliases.some((alias) => text.includes(alias))) return category;
  }
  return "other";
}

export function normalizeBoardingStatus(raw: string): BoardingStatus {
  const text = normalizeText(raw);
  if (!text) return "both";
  const saysDay = /\bday\b/.test(text);
  const saysBoarding = /\b(board|boarder|boarding|resident|hostel)/.test(text);
  if (/\bboth\b|\ball\b|\bany\b/.test(text) || (saysDay && saysBoarding)) return "both";
  if (saysBoarding) return "boarding";
  if (saysDay) return "day";
  return "both";
}

export function normalizeFeeFrequency(raw: string): FeeFrequency {
  const text = normalizeText(raw);
  if (!text) return "per_term";
  if (/\byear|annual/.test(text)) return "per_year";
  if (/\bone|once|single/.test(text)) return "one_off";
  if (/term/.test(text)) return "per_term";
  return "per_term";
}

/**
 * Term is only meaningful for a per-term fee. Returns "" when the sheet is
 * blank, which the import hook fills with the term being set up rather than
 * refusing the whole file for lacking a column schools commonly omit.
 */
export function normalizeFeeTerm(raw: string): { value: string; error: string | null } {
  const text = normalizeText(raw);
  if (!text) return { value: "", error: null };
  const digit = text.match(/\b([1-3])\b/);
  if (digit) return { value: digit[1], error: null };
  if (/first|\bone\b/.test(text)) return { value: "1", error: null };
  if (/second|\btwo\b/.test(text)) return { value: "2", error: null };
  if (/third|\bthree\b/.test(text)) return { value: "3", error: null };
  return { value: "", error: `unrecognised term "${raw}"` };
}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MIN_PLAUSIBLE_SERIAL = 20000; // 1954-10-03
const MAX_PLAUSIBLE_SERIAL = 80000; // 2119-01-01

/**
 * A due date is normally in the future, so unlike a date of birth it is not
 * rejected for being later than today. Everything else follows the same rules:
 * restate as YYYY-MM-DD, read slash dates day-first, and report anything
 * unrecognised instead of guessing.
 */
export function normalizeFeeDate(raw: string): { value: string; error: string | null } {
  const input = (raw || "").trim();
  if (!input) return { value: "", error: null };

  const fail = (detail: string) => ({
    value: "",
    error: `"${raw}" ${detail}. Use dd/mm/yyyy, for example 15/03/2026.`,
  });

  const finish = (year: number, month: number, day: number) => {
    if (month < 1 || month > 12) return fail("has a month outside 01-12");
    if (day < 1 || day > 31) return fail("has a day outside 01-31");
    const asDate = new Date(Date.UTC(year, month - 1, day));
    if (asDate.getUTCFullYear() !== year || asDate.getUTCMonth() !== month - 1 || asDate.getUTCDate() !== day) {
      return fail("is not a real date");
    }
    return { value: asDate.toISOString().slice(0, 10), error: null };
  };

  if (/^\d{4}$/.test(input)) return fail("is only a year");

  if (/^\d{4,6}$/.test(input)) {
    const serial = Number(input);
    if (serial < MIN_PLAUSIBLE_SERIAL || serial > MAX_PLAUSIBLE_SERIAL) return fail("is not a date");
    const d = new Date(EXCEL_EPOCH_UTC + serial * 86400000);
    if (Number.isNaN(d.getTime())) return fail("is not a date");
    return { value: d.toISOString().slice(0, 10), error: null };
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(input);
  if (iso) return finish(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const sep = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(input);
  if (sep) {
    const first = Number(sep[1]);
    const second = Number(sep[2]);
    let year = Number(sep[3]);
    if (sep[3].length === 2) year = year > 30 ? 1900 + year : 2000 + year;
    if (first > 12) return finish(year, second, first);
    if (second > 12) return finish(year, first, second);
    return finish(year, second, first);
  }

  const named = /^(\d{1,2})?[\s\-/]*([a-z]{3,9})[\s\-/,]*(\d{1,2})?[\s,\-/]*(\d{4})$/i.exec(input);
  if (named) {
    const month = MONTH_NAMES.indexOf(named[2].slice(0, 3).toLowerCase());
    if (month >= 0) {
      const day = named[1] ? Number(named[1]) : named[3] ? Number(named[3]) : 1;
      return finish(Number(named[4]), month + 1, day);
    }
  }

  return fail("is not a date");
}

export function validateFeeRow(raw: Record<string, unknown>): ValidatedFeeRow {
  const errors: string[] = [];

  const frequency = normalizeFeeFrequency(readField(raw, "frequency"));
  const termResult = normalizeFeeTerm(readField(raw, "term"));
  if (frequency === "per_term" && termResult.error) errors.push(`Term: ${termResult.error}`);

  const amount = normalizeAmount(readField(raw, "amount"));
  if (amount.error) errors.push(`Amount: ${amount.error}`);
  else if (!amount.value) errors.push("Amount is required");
  else if (Number(amount.value) <= 0) errors.push("Amount must be greater than 0");

  const due = normalizeFeeDate(readField(raw, "due_date"));
  if (due.error) errors.push(`Due date: ${due.error}`);

  const name = readField(raw, "name");
  if (!name) errors.push("Fee name is required");

  return {
    data: {
      name,
      class_name: readField(raw, "class_name"),
      amount: amount.value,
      term: frequency === "per_term" ? termResult.value : "",
      category: normalizeFeeCategory(readField(raw, "category")),
      boarding_status: normalizeBoardingStatus(readField(raw, "boarding_status")),
      frequency,
      transport_zone: readField(raw, "transport_zone"),
      due_date: due.value,
      academic_year: readField(raw, "academic_year"),
    },
    isValid: errors.length === 0,
    errors,
  };
}

export function parseFeeRows(rows: Array<Record<string, unknown>>): ValidatedFeeRow[] {
  return rows.map((row) => validateFeeRow(row));
}

/** Identity used to decide whether a row is already on the fee list. */
export function feeStructureKey(name: string, classId: string, term: number | null, academicYear: string): string {
  return [
    String(name || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase(),
    classId || "",
    term === null || term === undefined ? "" : String(term),
    String(academicYear || "").trim(),
  ].join("|");
}
