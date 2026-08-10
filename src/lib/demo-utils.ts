const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

// Demo-school data fabrication is ONLY valid in a dev/test environment. Outside
// of it a school whose id happens to equal the reserved UUID must be treated as
// a real tenant, otherwise production schools get fabricated dashboards.
const isDemoEnvironment =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

export const isDemoSchool = (schoolId?: string | null) => {
  return isDemoEnvironment && schoolId === DEMO_SCHOOL_ID;
};
