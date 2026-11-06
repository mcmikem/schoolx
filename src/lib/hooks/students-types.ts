import type { Student, CreateStudentInput } from "@/types";
import type { StudentWithClass } from "./students-helpers";
import type { RegistryQuery } from "@/lib/students/registry-query";

export type SlimStudent = Pick<
  Student,
  | "id"
  | "school_id"
  | "student_number"
  | "first_name"
  | "last_name"
  | "gender"
  | "date_of_birth"
  | "parent_name"
  | "parent_phone"
  | "class_id"
  | "admission_date"
  | "status"
  | "photo_url"
  | "created_at"
> &
  Pick<StudentWithClass, "classes">;

export interface UseStudentsResult<TStudent> {
  students: TStudent[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  createStudent: (student: CreateStudentInput) => Promise<StudentWithClass>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<StudentWithClass>;
  deleteStudent: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export type StudentQueryOptions = {
  limit?: number;
  offset?: number;
  /** "full" (default) or "slim" — the pick-list row set above. */
  fields?: "full" | "slim";
  /** Hold the first fetch until the caller has resolved device/network settings. */
  enabled?: boolean;
  registry?: RegistryQuery;
};
