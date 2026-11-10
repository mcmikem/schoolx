const STUDENT_SCOPED_TABLES = new Set([
  "attendance",
  "period_attendance",
  "grades",
  "fee_payments",
  "report_cards",
  "behavior_logs",
  "homework_submissions",
  "transport_students",
  "dorm_students",
  "dorm_attendance",
  "student_transfers",
  "student_promotions",
  "promotion_history",
]);

const CLASS_SCOPED_TABLES = new Set(["teacher_timetable", "timetable", "homework", "teacher_substitutions"]);

/** Whether a cached row is outside a successfully downloaded class selection. */
export function isOutsideOfflineClassSelection(
  table: string,
  row: Record<string, unknown>,
  schoolId: string,
  classIds: string[],
  studentIds: string[],
): boolean {
  if (row.school_id !== schoolId) return false;
  if (table === "students") return typeof row.class_id === "string" && !classIds.includes(row.class_id);
  if (table === "classes") return typeof row.id === "string" && !classIds.includes(row.id);
  if (CLASS_SCOPED_TABLES.has(table)) {
    return typeof row.class_id === "string" && !classIds.includes(row.class_id);
  }
  if (STUDENT_SCOPED_TABLES.has(table)) {
    return typeof row.student_id === "string" && !studentIds.includes(row.student_id);
  }
  return false;
}
