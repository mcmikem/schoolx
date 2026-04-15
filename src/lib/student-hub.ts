import type { Student } from "@/types";

export const STUDENT_TEMPLATE_COLUMNS = [
  "student_number",
  "first_name",
  "last_name",
  "gender",
  "class_name",
  "class_id",
  "ple_index_number",
  "parent_name",
  "parent_phone",
  "parent_phone2",
  "opening_balance",
] as const;

export const TRANSFER_REASONS = [
  "Family relocation",
  "School closure",
  "Better opportunity",
  "Fee constraints",
  "Disciplinary",
  "Academic reasons",
  "Other",
] as const;

export type TransferTab = "in" | "out";

export interface TransferOutRecord {
  id: string;
  student_id: string;
  transfer_to: string;
  reason: string;
  transfer_date: string;
  student_name: string;
  class_name: string;
  student_number: string;
  gender: string;
  admission_date: string;
}

export interface AtRiskStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  student_number: string;
  class_id: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  consecutive_absent: number;
  last_attendance_date: string | null;
  risk_level: "at_risk" | "likely_dropout";
}

export interface PromotionStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  status: string;
  class_id: string;
  repeating?: boolean;
  classes?: { id: string; name: string; level: string };
}

export interface ClassData {
  id: string;
  name: string;
  level: string;
}

export type StudentAction = "promote" | "repeat" | "demote" | "skip";

export interface StudentActionMap {
  [studentId: string]: {
    action: StudentAction;
    targetClassId?: string;
    reason?: string;
  };
}

export type StudentHubStudent = Student & {
  classes?: { name?: string | null } | null;
  is_class_monitor?: boolean;
  prefect_role?: string | null;
  student_council_role?: string | null;
};

export function resolveClassIdForImport(
  row: Record<string, string>,
  classes: Array<{ id: string; name: string }>,
) {
  if (row.class_id) return row.class_id;
  if (!row.class_name) return "";

  const match = classes.find(
    (item) => item.name.toLowerCase() === row.class_name.toLowerCase(),
  );
  return match?.id || "";
}

export function createDefaultStudentActions(
  students: PromotionStudent[],
): StudentActionMap {
  const defaultActions: StudentActionMap = {};
  students.forEach((student) => {
    defaultActions[student.id] = { action: "promote" };
  });
  return defaultActions;
}

export function filterAndSortStudents(
  students: StudentHubStudent[],
  options: {
    searchTerm: string;
    selectedClass: string;
    filterGender: "all" | "M" | "F";
    filterPosition: string;
    sortBy: "name" | "number" | "class";
  },
) {
  const { searchTerm, selectedClass, filterGender, filterPosition, sortBy } =
    options;
  const normalizedSearch = searchTerm.toLowerCase();

  const result = students.filter((student) => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    const matchesSearch =
      fullName.includes(normalizedSearch) ||
      student.parent_name.toLowerCase().includes(normalizedSearch) ||
      student.student_number.toLowerCase().includes(normalizedSearch);
    const matchesClass =
      selectedClass === "all" || student.class_id === selectedClass;
    const matchesGender =
      filterGender === "all" || student.gender === filterGender;
    const matchesPosition =
      filterPosition === "all" ||
      (filterPosition === "monitor" && student.is_class_monitor) ||
      (filterPosition === "prefect" &&
        (student.prefect_role || student.student_council_role));

    return matchesSearch && matchesClass && matchesGender && matchesPosition;
  });

  result.sort((left, right) => {
    if (sortBy === "name") {
      return `${left.first_name} ${left.last_name}`.localeCompare(
        `${right.first_name} ${right.last_name}`,
      );
    }

    if (sortBy === "number") {
      return left.student_number.localeCompare(right.student_number);
    }

    return (left.classes?.name || "").localeCompare(right.classes?.name || "");
  });

  return result;
}
