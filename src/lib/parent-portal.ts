import { getGradeLabel } from "@/lib/automation";

export interface ParentPortalChild {
  id: string;
  first_name: string;
  last_name: string;
  student_number?: string | null;
  class_name: string;
  school_id?: string;
  class_id?: string;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_phone2?: string | null;
  photo_url?: string | null;
  avatar_url?: string | null;
  district_origin?: string | null;
  village?: string | null;
  attendance?: string;
  fees_balance?: string;
  next_exam?: string;
}

export interface ParentPortalNotice {
  id?: string;
  title: string;
  content: string;
  created_at: string;
  icon?: string;
  color?: string;
  desc?: string;
  type?: string;
  message?: string;
  is_read?: boolean;
}

export interface ParentPortalFeeStructureItem {
  id: string;
  name: string;
  amount: number;
  term?: string | null;
  due_date?: string | null;
}

export interface ParentPortalPayment {
  id: string;
  amount_paid: number;
  payment_date: string;
  payment_method?: string | null;
  payment_reference?: string | null;
  fee_structure?: { name?: string | null } | null;
}

export type ParentPortalWalletTransactionType = "topup" | "spend" | "refund" | "adjustment";

export interface ParentPortalWalletTransaction {
  id: string;
  amount: number;
  type: ParentPortalWalletTransactionType;
  reference?: string | null;
  description?: string | null;
  created_at: string;
}

/**
 * A discount, scholarship, write-off or fine on the pupil's bill.
 *
 * The parent portal used to add up the fee lines and the payments and stop
 * there, so a parent of a discounted pupil was shown the gross bill — a
 * balance HIGHER than the one the bursar's ledger showed, for the same child.
 * Two numbers for one debt is worse than a wrong one: the parent argues with
 * the school over a figure the school never held.
 */
export interface ParentPortalAdjustment {
  id: string;
  adjustment_type: string;
  amount: number;
  notes?: string | null;
  created_at?: string | null;
}

export interface ParentPortalFeeStats {
  /** What the fee lines add up to, before any credit. */
  totalFee: number;
  /** Discounts, scholarships and write-offs. */
  totalCredits: number;
  /** Fines and other charges added on top of the fee lines. */
  totalPenalties: number;
  /** What is actually owed: totalFee + penalties − credits. */
  expected: number;
  totalPaid: number;
  balance: number;
  status: "unknown" | "pending" | "paid";
}

export type ParentAttendanceStatus = "present" | "absent" | "late" | "excused";

export interface ParentPortalAttendanceRecord {
  id: string;
  date: string;
  status: ParentAttendanceStatus;
  notes?: string | null;
}

export interface ParentPortalAttendanceStats {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export interface ParentPortalGradeRecord {
  id: string;
  subject_name: string;
  score: number;
  max_score: number;
  grade?: string | null;
  term?: string | null;
  exam_type?: string | null;
  teacher_comment?: string | null;
}

export interface ParentPortalMessageThreadItem {
  id: string;
  subject?: string | null;
  body: string;
  sender_role: "parent" | "school";
  created_at: string;
  is_read: boolean;
}

export interface ParentPortalReportCardSummary {
  term: string;
  averagePercent: number;
  subjectCount: number;
  strongestSubject: string;
  latestExamType?: string | null;
  teacherComment?: string | null;
  performanceBand: "excellent" | "good" | "fair" | "attention";
}

export interface ParentPortalHomeworkAssignment {
  id: string;
  title: string;
  description?: string | null;
  subject_name: string;
  due_date: string;
  marks: number;
  class_name?: string | null;
  academic_year?: string | null;
  term?: number | null;
  created_at: string;
  submission?: {
    status: "pending" | "submitted" | "graded" | "late";
    submitted_at?: string | null;
    marks?: number | null;
    feedback?: string | null;
  } | null;
}

export function normalizeHomeworkAssignments(
  homework: Array<{
    id: string;
    title: string;
    description?: string | null;
    subject_id: string;
    class_id: string;
    due_date: string;
    marks: number;
    academic_year?: string | null;
    term?: number | null;
    created_at: string;
    subjects?: { name?: string | null } | Array<{ name?: string | null }> | null;
    classes?: { name?: string | null } | Array<{ name?: string | null }> | null;
    homework_submissions?: Array<{
      status: string;
      submitted_at?: string | null;
      /**
       * The column is marks_obtained. The dashboard writes that name, and
       * selecting "marks" made every parent-portal homework query fail with
       * "column homework_submissions.marks does not exist", so a parent saw an
       * empty homework list.
       */
      marks_obtained?: number | null;
      feedback?: string | null;
    }> | null;
  }>,
): ParentPortalHomeworkAssignment[] {
  return homework.map((h) => ({
    id: h.id,
    title: h.title,
    description: h.description,
    subject_name: resolveRelationName(h.subjects, "Unknown"),
    due_date: h.due_date,
    marks: h.marks,
    class_name: resolveRelationName(h.classes),
    academic_year: h.academic_year,
    term: h.term,
    created_at: h.created_at,
    submission: h.homework_submissions?.[0]
      ? {
          status: isHomeworkStatus(h.homework_submissions[0].status) ? h.homework_submissions[0].status : "pending",
          submitted_at: h.homework_submissions[0].submitted_at,
          marks: h.homework_submissions[0].marks_obtained,
          feedback: h.homework_submissions[0].feedback,
        }
      : null,
  }));
}

function isHomeworkStatus(status: string): status is "pending" | "submitted" | "graded" | "late" {
  return ["pending", "submitted", "graded", "late"].includes(status);
}

type ParentPortalLegacyPaymentRecord = {
  id: string;
  amount_paid?: number | null;
  payment_date?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  fee_structure?: { name?: string | null } | null;
};

type ParentPortalModernPaymentRecord = {
  id: string;
  amount?: number | null;
  payment_date?: string | null;
  payment_method?: string | null;
  transaction_reference?: string | null;
  student_fee_terms?:
    | {
        fee_terms?: { name?: string | null } | Array<{ name?: string | null }> | null;
      }
    | Array<{
        fee_terms?: { name?: string | null } | Array<{ name?: string | null }> | null;
      }>
    | null;
};

type ParentPortalLegacyWalletTransactionRecord = {
  id: string;
  amount?: number | null;
  type?: string | null;
  reference?: string | null;
  description?: string | null;
  created_at?: string | null;
};

type ParentPortalModernWalletTransactionRecord = {
  id: string;
  amount?: number | null;
  transaction_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
  created_at?: string | null;
};

type ParentPortalModernFeeTermRecord = {
  id: string;
  final_amount?: number | null;
  academic_year?: string | null;
  fee_terms?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

interface ParentStudentLinkRecord {
  student?:
    | {
        id: string;
        first_name: string;
        last_name: string;
        student_number?: string | null;
        school_id?: string;
        class_id?: string;
        parent_name?: string | null;
        parent_phone?: string | null;
        parent_phone2?: string | null;
        district_origin?: string | null;
        village?: string | null;
        photo_url?: string | null;
        class?: { name?: string | null } | Array<{ name?: string | null }> | null;
      }
    | Array<{
        id: string;
        first_name: string;
        last_name: string;
        student_number?: string | null;
        school_id?: string;
        class_id?: string;
        parent_name?: string | null;
        parent_phone?: string | null;
        parent_phone2?: string | null;
        district_origin?: string | null;
        village?: string | null;
        photo_url?: string | null;
        class?: { name?: string | null } | Array<{ name?: string | null }> | null;
      }>
    | null;
}

function resolveLinkedStudent(link: ParentStudentLinkRecord["student"]) {
  if (Array.isArray(link)) {
    return link[0] || null;
  }
  return link || null;
}

export function mapParentStudentLinks(links: ParentStudentLinkRecord[]): ParentPortalChild[] {
  return links.flatMap((link) => {
    const student = resolveLinkedStudent(link.student);
    if (!student) return [];
    return [
      {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        student_number: student.student_number,
        school_id: student.school_id,
        class_id: student.class_id,
        class_name: resolveRelationName(student.class, "Unassigned"),
        parent_name: student.parent_name,
        parent_phone: student.parent_phone,
        parent_phone2: student.parent_phone2,
        photo_url: student.photo_url,
        district_origin: student.district_origin,
        village: student.village,
      },
    ];
  });
}

export function resolveSelectedChild(children: ParentPortalChild[], childId?: string | null): ParentPortalChild | null {
  if (children.length === 0) return null;
  if (!childId) return children[0];
  return children.find((child) => child.id === childId) || null;
}

const PARENT_CREDIT_ADJUSTMENTS = new Set([
  "discount",
  "scholarship",
  "manual_credit",
  "write_off",
  "bursary",
  "amnesty",
]);

export function calculateFeeStats(
  feeStructure: ParentPortalFeeStructureItem[],
  payments: ParentPortalPayment[],
  adjustments: ParentPortalAdjustment[] = [],
): ParentPortalFeeStats {
  const totalFee = feeStructure.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
  const totalCredits = adjustments
    .filter((a) => PARENT_CREDIT_ADJUSTMENTS.has(a.adjustment_type))
    .reduce((sum, a) => sum + Math.max(0, Number(a.amount || 0)), 0);
  const totalPenalties = adjustments
    .filter((a) => a.adjustment_type === "penalty")
    .reduce((sum, a) => sum + Math.max(0, Number(a.amount || 0)), 0);
  const expected = Math.max(0, totalFee + totalPenalties - totalCredits);
  const balance = Math.max(0, expected - totalPaid);

  return {
    totalFee,
    totalCredits,
    totalPenalties,
    expected,
    totalPaid,
    balance,
    status: totalFee === 0 ? "unknown" : balance === 0 ? "paid" : "pending",
  };
}

export function normalizePayments(
  payments: Array<ParentPortalLegacyPaymentRecord | ParentPortalModernPaymentRecord>,
): ParentPortalPayment[] {
  return payments.map((payment) => {
    const modernPayment = payment as ParentPortalModernPaymentRecord;
    const legacyPayment = payment as ParentPortalLegacyPaymentRecord;
    const feeTermLink = resolveSingleRelation(modernPayment.student_fee_terms);

    return {
      id: payment.id,
      amount_paid: Number(modernPayment.amount ?? legacyPayment.amount_paid ?? 0),
      payment_date: modernPayment.payment_date || legacyPayment.payment_date || new Date().toISOString(),
      payment_method: modernPayment.payment_method || legacyPayment.payment_method || null,
      payment_reference: modernPayment.transaction_reference || legacyPayment.payment_reference || null,
      fee_structure:
        legacyPayment.fee_structure || (feeTermLink ? { name: resolveRelationName(feeTermLink.fee_terms) } : null),
    };
  });
}

export function normalizeWalletTransactions(
  transactions: Array<ParentPortalLegacyWalletTransactionRecord | ParentPortalModernWalletTransactionRecord>,
): ParentPortalWalletTransaction[] {
  return transactions.map((transaction) => {
    const modernTransaction = transaction as ParentPortalModernWalletTransactionRecord;
    const legacyTransaction = transaction as ParentPortalLegacyWalletTransactionRecord;
    const rawType = modernTransaction.transaction_type || legacyTransaction.type || "refund";

    return {
      id: transaction.id,
      amount: Number(transaction.amount || 0),
      type: isWalletTransactionType(rawType) ? rawType : "refund",
      reference: modernTransaction.reference_id || legacyTransaction.reference || null,
      description: transaction.description || null,
      created_at: transaction.created_at || new Date().toISOString(),
    };
  });
}

export function normalizeFeeTermItems(terms: ParentPortalModernFeeTermRecord[]): ParentPortalFeeStructureItem[] {
  return terms.map((term) => ({
    id: term.id,
    name: resolveRelationName(term.fee_terms) || "Fee Term",
    amount: Number(term.final_amount || 0),
    term: term.academic_year || null,
  }));
}

export interface ParentPortalFeeGroup {
  key: string;
  label: string;
  items: ParentPortalFeeStructureItem[];
  total: number;
}

/**
 * Group fee lines by term so a parent can see exactly what each term costs
 * instead of one opaque total. Numeric terms (1/2/3) sort first; an academic
 * year or "All fees" bucket follows.
 */
export function groupFeesByTerm(fees: ParentPortalFeeStructureItem[]): ParentPortalFeeGroup[] {
  const groups = new Map<string, ParentPortalFeeStructureItem[]>();

  for (const fee of fees) {
    const raw = fee.term == null ? "" : String(fee.term).trim();
    const key = raw || "unspecified";
    const list = groups.get(key) ?? [];
    list.push(fee);
    groups.set(key, list);
  }

  const asTermNumber = (key: string): number | null => {
    const value = Number(key);
    return Number.isInteger(value) && value > 0 && value <= 3 ? value : null;
  };

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const na = asTermNumber(a);
      const nb = asTermNumber(b);
      if (na != null && nb != null) return na - nb;
      if (na != null) return -1;
      if (nb != null) return 1;
      if (a === "unspecified") return 1;
      if (b === "unspecified") return -1;
      return a.localeCompare(b);
    })
    .map(([key, items]) => ({
      key,
      label: asTermNumber(key) != null ? `Term ${key}` : key === "unspecified" ? "All fees" : key,
      items,
      total: items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    }));
}

export function pickPreferredSchemaRows<T>({
  modernRows,
  modernError,
  legacyRows,
  legacyError,
}: {
  modernRows?: T[] | null;
  modernError?: unknown;
  legacyRows?: T[] | null;
  legacyError?: unknown;
}): T[] {
  if (!modernError) {
    return modernRows || [];
  }

  if (!legacyError) {
    return legacyRows || [];
  }

  return [];
}

export function normalizeAttendanceRecords(
  records: Array<{
    id: string;
    date: string;
    status: string;
    remarks?: string | null;
    notes?: string | null;
  }>,
): ParentPortalAttendanceRecord[] {
  return records.map((record) => ({
    id: record.id,
    date: record.date,
    status: isAttendanceStatus(record.status) ? record.status : "absent",
    notes: record.notes ?? record.remarks ?? null,
  }));
}

export function calculateAttendanceStats(records: ParentPortalAttendanceRecord[]): ParentPortalAttendanceStats {
  return records.reduce<ParentPortalAttendanceStats>(
    (stats, record) => {
      stats.total += 1;
      stats[record.status] += 1;
      return stats;
    },
    { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
  );
}

export function normalizeGrades(
  grades: Array<{
    id: string;
    score?: number | null;
    max_score?: number | null;
    grade?: string | null;
    term?: string | null;
    exam_type?: string | null;
    assessment_type?: string | null;
    teacher_comment?: string | null;
    subject_name?: string | null;
    subjects?: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>,
): ParentPortalGradeRecord[] {
  return grades.map((grade) => ({
    id: grade.id,
    subject_name: grade.subject_name || resolveRelationName(grade.subjects) || "Unknown",
    score: Number(grade.score || 0),
    max_score: Number(grade.max_score || 100),
    grade: grade.grade || getGradeLabel(Number(grade.score || 0)),
    term: grade.term || null,
    exam_type: grade.exam_type || grade.assessment_type || null,
    teacher_comment: grade.teacher_comment || null,
  }));
}

export function getUniqueTerms(grades: ParentPortalGradeRecord[]): string[] {
  return Array.from(new Set(grades.map((grade) => grade.term).filter(Boolean))) as string[];
}

export function buildReportCardSummaries(grades: ParentPortalGradeRecord[]): ParentPortalReportCardSummary[] {
  return getUniqueTerms(grades).map((term) => {
    const records = grades.filter((grade) => grade.term === term);
    const averagePercent =
      records.length > 0
        ? Math.round(records.reduce((total, record) => total + toPercent(record), 0) / records.length)
        : 0;
    const strongestRecord = records.reduce<ParentPortalGradeRecord | null>((best, record) => {
      if (!best || toPercent(record) > toPercent(best)) {
        return record;
      }
      return best;
    }, null);
    const latestComment = records.find((record) => record.teacher_comment)?.teacher_comment || null;

    return {
      term,
      averagePercent,
      subjectCount: records.length,
      strongestSubject: strongestRecord?.subject_name || "—",
      latestExamType: records.find((record) => record.exam_type)?.exam_type || null,
      teacherComment: latestComment,
      performanceBand: getPerformanceBand(averagePercent),
    };
  });
}

function isAttendanceStatus(status: string): status is ParentAttendanceStatus {
  return ["present", "absent", "late", "excused"].includes(status);
}

function isWalletTransactionType(status: string): status is ParentPortalWalletTransactionType {
  return ["topup", "spend", "refund", "adjustment"].includes(status);
}

function toPercent(record: ParentPortalGradeRecord) {
  return Math.round((record.score / (record.max_score || 100)) * 100);
}

function getPerformanceBand(averagePercent: number): ParentPortalReportCardSummary["performanceBand"] {
  if (averagePercent >= 80) return "excellent";
  if (averagePercent >= 65) return "good";
  if (averagePercent >= 50) return "fair";
  return "attention";
}

function resolveRelationName(
  relation: { name?: string | null } | Array<{ name?: string | null }> | null | undefined,
  fallback = "—",
) {
  if (Array.isArray(relation)) {
    return relation[0]?.name || fallback;
  }
  return relation?.name || fallback;
}

function resolveSingleRelation<T>(relation: T | T[] | null | undefined) {
  if (Array.isArray(relation)) {
    return relation[0] || null;
  }
  return relation || null;
}

/**
 * Which notifications a poll should announce.
 *
 * Polling replaced a realtime subscription, and the difference that matters is
 * that every tick re-reads the same rows. A naive "prepend whatever came back"
 * would re-announce the whole list forever and inflate the unread count without
 * bound, so the caller tracks which ids it has already seen and only speaks up
 * about genuinely new ones.
 *
 * Ids, not rows, are the identity here: rows are re-read with server defaults
 * applied (`is_read`, `read_at`), so comparing content would treat an unchanged
 * notification as new every single tick.
 *
 * Returned rather than mutated so the caller owns the new set — a shared mutable
 * Set threaded through a timer is how "seen" quietly resets itself.
 */
export function findUnseenNotificationIds(
  seen: ReadonlySet<string>,
  rows: ReadonlyArray<{ id?: unknown }>,
): { toAnnounce: Array<{ id: string; title: string }>; seen: Set<string> } {
  const previous = new Set(seen);
  const toAnnounce: Array<{ id: string; title: string }> = [];
  const current = new Set<string>();

  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : row.id == null ? "" : String(row.id);
    // A row with no id cannot be tracked, so it can never be safely announced.
    if (!id) continue;
    current.add(id);
    if (!previous.has(id)) {
      toAnnounce.push({ id, title: String((row as { title?: unknown }).title ?? "New notification") });
    }
  }

  return { toAnnounce, seen: current };
}

/**
 * The soonest fee due date that has not passed. Dates are compared at local
 * midnight so a fee due "today" still counts.
 */
export function nextDueDate(
  feeStructure: Array<Pick<ParentPortalFeeStructureItem, "due_date">>,
  today: Date = new Date(),
): Date | null {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return (
    feeStructure
      .map((fee) => fee.due_date)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()) && date >= start)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null
  );
}
