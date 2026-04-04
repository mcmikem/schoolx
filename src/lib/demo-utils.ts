export const isDemoSchool = (schoolId?: string | null) => {
  const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001'
  return schoolId === DEMO_SCHOOL_ID
}
