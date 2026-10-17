import { normalizeAuthPhone } from "@/lib/validation";
import { normalizeAmount } from "./students";
import { normalizeFeeDate } from "./fees";

/**
 * One line of an MTN MoMo or Airtel Money statement, as read from a file.
 * Every value is a string because it comes straight from a spreadsheet cell.
 */
export interface ParsedMobileTransaction {
  reference: string;
  amount: string;
  phone: string;
  payer: string;
  date: string;
  purpose: string;
  status: string;
}

export interface ValidatedMobileTransaction {
  isValid: boolean;
  data: ParsedMobileTransaction;
  errors: string[];
}

type TxField = keyof ParsedMobileTransaction;

/**
 * MTN MoMo and Airtel Money export different headings for the same thing, and
 * schools save the exports under their own names. Every spelling is indexed.
 */
const HEADER_ALIASES: Record<TxField, string[]> = {
  reference: [
    "financial transaction id",
    "transaction id",
    "transaction id.",
    "txn id",
    "transaction no",
    "transaction number",
    "receipt",
    "receipt no",
    "reference",
    "external id",
    "ref",
    "transaction ref",
  ],
  amount: ["amount", "amount (ugx)", "amount ugx", "value", "paid amount", "credit", "money received"],
  phone: [
    "payer msisdn",
    "msisdn",
    "payer number",
    "sender",
    "sender number",
    "payer",
    "phone",
    "phone number",
    "customer number",
    "subscriber",
    "mobile number",
    "from",
  ],
  payer: ["payer name", "sender name", "customer name", "payer names", "names", "name"],
  date: ["date and time", "transaction date", "date", "time", "created", "completed time", "when"],
  purpose: ["payer message", "payee note", "narration", "description", "message", "purpose", "reason", "details"],
  status: ["transaction status", "status", "state"],
};

function normalizeHeaderKey(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const FIELD_BY_HEADER = (() => {
  const map = new Map<string, TxField>();
  (Object.keys(HEADER_ALIASES) as TxField[]).forEach((field) => {
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

function readField(raw: Record<string, unknown>, field: TxField): string {
  for (const [header, value] of Object.entries(raw)) {
    if (FIELD_BY_HEADER.get(normalizeHeaderKey(header)) === field) return cleanValue(value);
  }
  return "";
}

const SUCCESS_STATUSES = new Set([
  "",
  "1",
  "true",
  "success",
  "successful",
  "successfull",
  "completed",
  "complete",
  "done",
  "paid",
  "approved",
  "processed",
]);

export function isSuccessfulStatus(status: string): boolean {
  return SUCCESS_STATUSES.has(
    String(status || "")
      .trim()
      .toLowerCase(),
  );
}

export function validateMobileTransaction(raw: Record<string, unknown>): ValidatedMobileTransaction {
  const errors: string[] = [];
  const data: ParsedMobileTransaction = {
    reference: readField(raw, "reference"),
    amount: "",
    phone: readField(raw, "phone"),
    payer: readField(raw, "payer"),
    date: readField(raw, "date"),
    purpose: readField(raw, "purpose"),
    status: readField(raw, "status"),
  };

  const amount = normalizeAmount(readField(raw, "amount"));
  if (amount.error) errors.push(`Amount: ${amount.error}`);
  else if (!amount.value) errors.push("Amount is required");
  else if (Number(amount.value) <= 0) errors.push("Amount must be greater than 0");
  data.amount = amount.value;

  const phoneDigits = data.phone.replace(/\D/g, "");
  if (!phoneDigits) errors.push("Payer phone is required");
  else if (phoneDigits.length < 9) errors.push(`phone "${data.phone}" is too short`);

  if (!isSuccessfulStatus(data.status)) errors.push(`status "${data.status}" is not a successful payment`);

  const date = normalizeFeeDate(data.date);
  if (date.error) errors.push(`Date: ${date.error}`);
  data.date = date.value;

  return { data, isValid: errors.length === 0, errors };
}

export function parseMobileTransactions(rows: Array<Record<string, unknown>>): ValidatedMobileTransaction[] {
  return rows.map((row) => validateMobileTransaction(row));
}

export interface StudentPhoneSource {
  id: string;
  first_name: string;
  last_name: string;
  parent_phone?: string | null;
  parent_phone2?: string | null;
  classes?: { name?: string } | null;
}

export interface PhoneIndex {
  exact: Map<string, string>;
  tail: Map<string, string>;
}

/**
 * Index every student by their parent numbers, in both the canonical
 * 256XXXXXXXXX form and by the last nine digits, because a statement prints the
 * number slightly differently from the way it was entered at registration.
 */
export function buildPhoneIndex(students: StudentPhoneSource[]): PhoneIndex {
  const exact = new Map<string, string>();
  const tail = new Map<string, string>();
  const add = (raw: string | null | undefined, id: string) => {
    const normalized = normalizeAuthPhone(String(raw || ""));
    const digits = normalized.replace(/\D/g, "");
    if (!digits) return;
    if (!exact.has(digits)) exact.set(digits, id);
    const last9 = digits.slice(-9);
    if (last9.length === 9 && !tail.has(last9)) tail.set(last9, id);
  };
  for (const student of students) {
    add(student.parent_phone, student.id);
    add(student.parent_phone2, student.id);
  }
  return { exact, tail };
}

export function matchStudentByPhone(index: PhoneIndex, rawPhone: string): string | undefined {
  const digits = normalizeAuthPhone(String(rawPhone || "")).replace(/\D/g, "");
  if (!digits) return undefined;
  const direct = index.exact.get(digits);
  if (direct) return direct;
  const last9 = digits.slice(-9);
  return last9.length === 9 ? index.tail.get(last9) : undefined;
}
