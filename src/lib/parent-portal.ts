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

function isAttendanceStatus(status: string): status is ParentAttendanceStatus {
  return ["present", "absent", "late", "excused"].includes(status);
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
