export interface ParentPortalChild {
  id: string;
  first_name: string;
  last_name: string;
  class_name: string;
  school_id?: string;
  class_id?: string;
  attendance?: string;
  fees_balance?: string;
  next_exam?: string;
}

export interface ParentPortalNotice {
  title: string;
  content: string;
  created_at: string;
  icon?: string;
  color?: string;
  desc?: string;
}

export interface ParentPortalFeeStructureItem {
  id: string;
  name: string;
  amount: number;
  term?: string | null;
}

export interface ParentPortalPayment {
  id: string;
  amount_paid: number;
  payment_date: string;
  payment_method?: string | null;
  payment_reference?: string | null;
  fee_structure?: { name?: string | null } | null;
}

export type ParentPortalWalletTransactionType =
  | "topup"
  | "spend"
  | "refund"
  | "adjustment";

export interface ParentPortalWalletTransaction {
  id: string;
  amount: number;
  type: ParentPortalWalletTransactionType;
  reference?: string | null;
  description?: string | null;
  created_at: string;
}

export interface ParentPortalFeeStats {
  totalFee: number;
  totalPaid: number;
  balance: number;
  status: "unknown" | "pending" | "paid";
}

export type ParentAttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused";

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
        fee_terms?:
          | { name?: string | null }
          | Array<{ name?: string | null }>
          | null;
      }
    | Array<{
        fee_terms?:
          | { name?: string | null }
          | Array<{ name?: string | null }>
          | null;
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
  fee_terms?:
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null;
};

interface ParentStudentLinkRecord {
  student?:
    | {
        id: string;
        first_name: string;
        last_name: string;
        school_id?: string;
        class_id?: string;
        class?:
          | { name?: string | null }
          | Array<{ name?: string | null }>
          | null;
      }
    | Array<{
        id: string;
        first_name: string;
        last_name: string;
        school_id?: string;
        class_id?: string;
        class?:
          | { name?: string | null }
          | Array<{ name?: string | null }>
          | null;
      }>
    | null;
}

function resolveLinkedStudent(link: ParentStudentLinkRecord["student"]) {
  if (Array.isArray(link)) {
    return link[0] || null;
  }
  return link || null;
}

export function mapParentStudentLinks(
  links: ParentStudentLinkRecord[],
): ParentPortalChild[] {
  return links.flatMap((link) => {
    const student = resolveLinkedStudent(link.student);
    if (!student) return [];
    return [
      {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        school_id: student.school_id,
        class_id: student.class_id,
        class_name: resolveRelationName(student.class),
      },
    ];
  });
}

export function resolveSelectedChild(
  children: ParentPortalChild[],
  childId?: string | null,
): ParentPortalChild | null {
  if (children.length === 0) return null;
  if (!childId) return children[0];
  return children.find((child) => child.id === childId) || children[0];
}

export function calculateFeeStats(
  feeStructure: ParentPortalFeeStructureItem[],
  payments: ParentPortalPayment[],
): ParentPortalFeeStats {
  const totalFee = feeStructure.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount_paid || 0),
    0,
  );
  const balance = Math.max(0, totalFee - totalPaid);

  return {
    totalFee,
    totalPaid,
    balance,
    status:
      totalFee === 0 ? "unknown" : balance === 0 ? "paid" : "pending",
  };
}

export function normalizePayments(
  payments: Array<
    ParentPortalLegacyPaymentRecord | ParentPortalModernPaymentRecord
  >,
): ParentPortalPayment[] {
  return payments.map((payment) => {
    const modernPayment = payment as ParentPortalModernPaymentRecord;
    const legacyPayment = payment as ParentPortalLegacyPaymentRecord;
    const feeTermLink = resolveSingleRelation(modernPayment.student_fee_terms);

    return {
      id: payment.id,
      amount_paid: Number(
        modernPayment.amount ?? legacyPayment.amount_paid ?? 0,
      ),
      payment_date:
        modernPayment.payment_date ||
        legacyPayment.payment_date ||
        new Date().toISOString(),
      payment_method:
        modernPayment.payment_method || legacyPayment.payment_method || null,
      payment_reference:
        modernPayment.transaction_reference ||
        legacyPayment.payment_reference ||
        null,
      fee_structure:
        legacyPayment.fee_structure ||
        (feeTermLink
          ? { name: resolveRelationName(feeTermLink.fee_terms) }
          : null),
    };
  });
}

export function normalizeWalletTransactions(
  transactions: Array<
    | ParentPortalLegacyWalletTransactionRecord
    | ParentPortalModernWalletTransactionRecord
  >,
): ParentPortalWalletTransaction[] {
  return transactions.map((transaction) => {
    const modernTransaction =
      transaction as ParentPortalModernWalletTransactionRecord;
    const legacyTransaction =
      transaction as ParentPortalLegacyWalletTransactionRecord;
    const rawType =
      modernTransaction.transaction_type || legacyTransaction.type || "refund";

    return {
      id: transaction.id,
      amount: Number(transaction.amount || 0),
      type: isWalletTransactionType(rawType) ? rawType : "refund",
      reference:
        modernTransaction.reference_id || legacyTransaction.reference || null,
      description: transaction.description || null,
      created_at: transaction.created_at || new Date().toISOString(),
    };
  });
}

export function normalizeFeeTermItems(
  terms: ParentPortalModernFeeTermRecord[],
): ParentPortalFeeStructureItem[] {
  return terms.map((term) => ({
    id: term.id,
    name: resolveRelationName(term.fee_terms) || "Fee Term",
    amount: Number(term.final_amount || 0),
    term: term.academic_year || null,
  }));
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

export function calculateAttendanceStats(
  records: ParentPortalAttendanceRecord[],
): ParentPortalAttendanceStats {
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
    teacher_comment?: string | null;
    subject_name?: string | null;
    subjects?:
      | { name?: string | null }
      | Array<{ name?: string | null }>
      | null;
  }>,
): ParentPortalGradeRecord[] {
  return grades.map((grade) => ({
    id: grade.id,
    subject_name:
      grade.subject_name || resolveRelationName(grade.subjects) || "Unknown",
    score: Number(grade.score || 0),
    max_score: Number(grade.max_score || 100),
    grade: grade.grade || null,
    term: grade.term || null,
    exam_type: grade.exam_type || null,
    teacher_comment: grade.teacher_comment || null,
  }));
}

export function getUniqueTerms(
  grades: ParentPortalGradeRecord[],
): string[] {
  return Array.from(
    new Set(grades.map((grade) => grade.term).filter(Boolean)),
  ) as string[];
}

export function buildReportCardSummaries(
  grades: ParentPortalGradeRecord[],
): ParentPortalReportCardSummary[] {
  return getUniqueTerms(grades).map((term) => {
    const records = grades.filter((grade) => grade.term === term);
    const averagePercent =
      records.length > 0
        ? Math.round(
            records.reduce((total, record) => total + toPercent(record), 0) /
              records.length,
          )
        : 0;
    const strongestRecord = records.reduce<ParentPortalGradeRecord | null>(
      (best, record) => {
        if (!best || toPercent(record) > toPercent(best)) {
          return record;
        }
        return best;
      },
      null,
    );
    const latestComment =
      records.find((record) => record.teacher_comment)?.teacher_comment || null;

    return {
      term,
      averagePercent,
      subjectCount: records.length,
      strongestSubject: strongestRecord?.subject_name || "—",
      latestExamType:
        records.find((record) => record.exam_type)?.exam_type || null,
      teacherComment: latestComment,
      performanceBand: getPerformanceBand(averagePercent),
    };
  });
}

function isAttendanceStatus(status: string): status is ParentAttendanceStatus {
  return ["present", "absent", "late", "excused"].includes(status);
}

function isWalletTransactionType(
  status: string,
): status is ParentPortalWalletTransactionType {
  return ["topup", "spend", "refund", "adjustment"].includes(status);
}

function toPercent(record: ParentPortalGradeRecord) {
  return Math.round((record.score / (record.max_score || 100)) * 100);
}

function getPerformanceBand(
  averagePercent: number,
): ParentPortalReportCardSummary["performanceBand"] {
  if (averagePercent >= 80) return "excellent";
  if (averagePercent >= 65) return "good";
  if (averagePercent >= 50) return "fair";
  return "attention";
}

function resolveRelationName(
  relation:
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null
    | undefined,
) {
  if (Array.isArray(relation)) {
    return relation[0]?.name || "—";
  }
  return relation?.name || "—";
}

function resolveSingleRelation<T>(relation: T | T[] | null | undefined) {
  if (Array.isArray(relation)) {
    return relation[0] || null;
  }
  return relation || null;
}
