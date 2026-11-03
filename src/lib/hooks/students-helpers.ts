// Pure helpers extracted from students.ts to keep the hook module focused.
// These are stateless and have no React dependencies.

import type { Class, Student } from "@/types";

export type StudentWithClass = Student & {
  classes?: { id: string; name: string; level: string } | Class;
  houses?: { id: string; name: string; color: string } | null;
  prefect_role?: string;
  student_council_role?: string;
  parent_phone2?: string;
  parent_email?: string;
  blood_type?: string;
  house_id?: string;
  previous_school?: string;
  district_origin?: string;
  sub_county?: string;
  parish?: string;
  village?: string;
  boarding_status?: string;
  games_house?: string;
  is_class_monitor?: boolean;
};

export function buildCoreStudentPayload(student: Record<string, unknown>) {
  return {
    school_id: student.school_id,
    student_number: student.student_number,
    first_name: student.first_name,
    last_name: student.last_name,
    gender: student.gender,
    date_of_birth: student.date_of_birth,
    parent_name: student.parent_name,
    parent_phone: student.parent_phone,
    parent_phone2: student.parent_phone2,
    parent_email: student.parent_email,
    address: student.address,
    class_id: student.class_id,
    ple_index_number: student.ple_index_number,
    photo_url: student.photo_url,
    blood_type: student.blood_type,
    boarding_status: student.boarding_status,
    ...(student.takes_meals === undefined ? {} : { takes_meals: student.takes_meals }),
    house_id: student.house_id,
    previous_school: student.previous_school,
    district_origin: student.district_origin,
    sub_county: student.sub_county,
    parish: student.parish,
    village: student.village,
    games_house: student.games_house,
    is_class_monitor: student.is_class_monitor,
    prefect_role: student.prefect_role,
    student_council_role: student.student_council_role,
    status: student.status,
  };
}

export function isMissingStudentColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";

  return (
    (code === "42703" && message.includes(`students.${columnName}`)) ||
    ((code === "PGRST204" || code === "PGRST301") &&
      message.includes(`'${columnName}'`) &&
      message.toLowerCase().includes("students") &&
      message.toLowerCase().includes("schema cache"))
  );
}

export function isStudentNumberConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";

  return code === "23505" && message.includes("students_school_id_student_number");
}

export function isAnyMissingStudentsColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";

  return (
    (code === "42703" && /column students\."?[a-zA-Z0-9_]+"? does not exist/.test(message)) ||
    ((code === "PGRST204" || code === "PGRST301") &&
      /could not find the '.+' column of 'students' in the schema cache/i.test(message))
  );
}

export function getStudentSelectTimeoutFallback<T extends { id: string }>(cachedData: T[] | null, previousData: T[]) {
  if (cachedData && cachedData.length > 0) {
    return cachedData;
  }

  if (previousData.length > 0) {
    return previousData;
  }

  return null;
}
