export type StudentSortKey = "name" | "number" | "class";
export type StudentSortDir = "asc" | "desc";

/** The subset of a student row the registry filters and sorts on. */
export interface RegistryStudent {
  first_name: string;
  last_name: string;
  student_number?: string | null;
  parent_name?: string | null;
  class_id?: string | null;
  gender?: string | null;
  status?: string | null;
  is_class_monitor?: boolean | null;
  prefect_role?: string | null;
  student_council_role?: string | null;
  opening_balance?: number | string | null;
  classes?: { name?: string | null } | null;
}

export interface RegistryFilters {
  search?: string;
  classId?: string;
  gender?: "all" | "M" | "F";
  status?: string;
  position?: string;
  defaultersOnly?: boolean;
}

/**
 * Every word in the search must appear in the pupil's name, parent name or
 * student number, so "nakato p.3" narrows rather than widens.
 */
export function matchesStudentSearch(student: RegistryStudent, search: string): boolean {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const name = `${student.first_name} ${student.last_name}`.toLowerCase();
  const parent = student.parent_name?.toLowerCase() ?? "";
  const number = student.student_number?.toLowerCase() ?? "";
  return words.every((word) => name.includes(word) || parent.includes(word) || number.includes(word));
}

export function filterStudents<T extends RegistryStudent>(students: T[], filters: RegistryFilters = {}): T[] {
  const {
    search = "",
    classId = "all",
    gender = "all",
    status = "all",
    position = "all",
    defaultersOnly = false,
  } = filters;
  return students.filter((student) => {
    if (!matchesStudentSearch(student, search)) return false;
    if (classId !== "all" && student.class_id !== classId) return false;
    if (gender !== "all" && student.gender !== gender) return false;
    if (status !== "all" && student.status !== status) return false;
    if (position === "monitor" && !student.is_class_monitor) return false;
    if (position === "prefect" && !(student.prefect_role || student.student_council_role)) return false;
    if (defaultersOnly && !(Number(student.opening_balance || 0) > 0)) return false;
    return true;
  });
}

function sortValue(student: RegistryStudent, key: StudentSortKey): string {
  if (key === "number") return student.student_number || "";
  if (key === "class") return student.classes?.name || "";
  return `${student.first_name} ${student.last_name}`;
}

/** Sorting is a copy: the caller's array is never mutated. */
export function sortStudents<T extends RegistryStudent>(
  students: T[],
  key: StudentSortKey,
  dir: StudentSortDir = "asc",
): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...students].sort((a, b) => sortValue(a, key).localeCompare(sortValue(b, key)) * factor);
}
