// Shared UI types for the student registry.
//
// Centralised here so the page container (students/page.tsx) and the
// registry panel (StudentRegistryPanel.tsx) never drift apart. Previously
// HouseMeta / AttendanceStatusMeta / StudentRow were redeclared in both
// files, which meant a field added in one place silently failed to compile
// in the other (or, worse, compiled with a looser shape).

export interface HouseMeta {
  id: string;
  name: string;
  color?: string | null;
}

export interface AttendanceStatusMeta {
  status: "present" | "absent" | "sick" | "late" | "excused";
  label: string;
}

export interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  gender: "M" | "F" | string;
  class_id: string;
  student_number?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  opening_balance?: string | number | null;
  photo_url?: string | null;
  classes?: {
    name?: string | null;
    stream?: string | null;
  } | null;
  boarding_status?: string | null;
  house_id?: string | null;
  is_class_monitor?: boolean | null;
  prefect_role?: string | null;
  student_council_role?: string | null;
}
