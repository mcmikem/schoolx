export type DataQualitySeverity = "critical" | "warning";

export interface StudentQualityRecord {
  id: string;
  admission_number?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_phone2?: string | null;
}

export interface UserQualityRecord {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
}

export interface DataQualityIssue {
  code: string;
  area: "students" | "staff";
  severity: DataQualitySeverity;
  message: string;
  count: number;
  sampleIds: string[];
}

export interface DataQualityReport {
  issues: DataQualityIssue[];
  checkedStudents: number;
  checkedUsers: number;
  criticalCount: number;
  warningCount: number;
}

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function hasValue(value?: string | null) {
  return normalize(value).length > 0;
}

function duplicateIdsByKey<T extends { id: string }>(
  rows: T[],
  getKey: (row: T) => string,
): string[] {
  const ids: string[] = [];
  const seen = new Map<string, string>();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    const firstId = seen.get(key);
    if (!firstId) {
      seen.set(key, row.id);
      continue;
    }
    if (!ids.includes(firstId)) ids.push(firstId);
    ids.push(row.id);
  }

  return ids;
}

export function evaluateDataQuality(input: {
  students: StudentQualityRecord[];
  users: UserQualityRecord[];
}): DataQualityReport {
  const students = input.students || [];
  const users = input.users || [];
  const issues: DataQualityIssue[] = [];

  const missingAdmission = students.filter(
    (row) => !hasValue(row.admission_number),
  );
  if (missingAdmission.length > 0) {
    issues.push({
      code: "students_missing_admission_number",
      area: "students",
      severity: "critical",
      message: "Students missing admission number",
      count: missingAdmission.length,
      sampleIds: missingAdmission.slice(0, 10).map((row) => row.id),
    });
  }

  const duplicateAdmissions = duplicateIdsByKey(students, (row) =>
    normalize(row.admission_number),
  );
  if (duplicateAdmissions.length > 0) {
    issues.push({
      code: "students_duplicate_admission_number",
      area: "students",
      severity: "critical",
      message: "Duplicate admission numbers found",
      count: duplicateAdmissions.length,
      sampleIds: duplicateAdmissions.slice(0, 10),
    });
  }

  const missingGuardianContact = students.filter(
    (row) => !hasValue(row.parent_phone) && !hasValue(row.parent_phone2),
  );
  if (missingGuardianContact.length > 0) {
    issues.push({
      code: "students_missing_guardian_contact",
      area: "students",
      severity: "warning",
      message: "Students missing both guardian phone contacts",
      count: missingGuardianContact.length,
      sampleIds: missingGuardianContact.slice(0, 10).map((row) => row.id),
    });
  }

  const activeUsers = users.filter((row) => normalize(row.status || "active") !== "inactive");

  const missingRole = activeUsers.filter((row) => !hasValue(row.role));
  if (missingRole.length > 0) {
    issues.push({
      code: "users_missing_role",
      area: "staff",
      severity: "critical",
      message: "Active users missing role assignment",
      count: missingRole.length,
      sampleIds: missingRole.slice(0, 10).map((row) => row.id),
    });
  }

  const duplicateEmails = duplicateIdsByKey(activeUsers, (row) => normalize(row.email));
  if (duplicateEmails.length > 0) {
    issues.push({
      code: "users_duplicate_email",
      area: "staff",
      severity: "warning",
      message: "Active users with duplicate email addresses",
      count: duplicateEmails.length,
      sampleIds: duplicateEmails.slice(0, 10),
    });
  }

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    issues,
    checkedStudents: students.length,
    checkedUsers: users.length,
    criticalCount,
    warningCount,
  };
}
