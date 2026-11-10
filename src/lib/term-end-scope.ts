type QueryClient = {
  from: (table: string) => any;
};

/** Return only learner IDs owned by the target school for privileged term jobs. */
export async function loadSchoolStudentIds(client: QueryClient, schoolId: string): Promise<string[]> {
  const { data, error } = await client.from("students").select("id").eq("school_id", schoolId);
  if (error) throw error;
  return (data || []).map((row: { id: string }) => row.id).filter(Boolean);
}

/** Read legacy term-grade rows through learner ownership, never by term alone. */
export async function loadScopedTermStudentGrades(
  client: QueryClient,
  studentIds: string[],
  academicYear: string,
  term: number,
) {
  if (!studentIds.length) return [];
  const { data, error } = await client
    .from("student_grades")
    .select("id, student_id, subject_id, ca1, ca2, ca3, ca4, project, exam_score, final_score")
    .eq("academic_year", academicYear)
    .eq("term", term)
    .in("student_id", studentIds);
  if (error) throw error;
  return data || [];
}

export async function lockScopedTermStudentGrades(
  client: QueryClient,
  studentIds: string[],
  academicYear: string,
  term: number,
) {
  const grades = await loadScopedTermStudentGrades(client, studentIds, academicYear, term);
  if (!grades.length) return 0;
  const { error } = await client
    .from("student_grades")
    .update({ status: "published", locked: true, locked_at: new Date().toISOString() })
    .in(
      "id",
      grades.map((grade: { id: string }) => grade.id),
    )
    .in("student_id", studentIds);
  if (error) throw error;
  return grades.length;
}
