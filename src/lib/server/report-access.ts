// Reports are available to school operations and academic leadership roles only;
// parent/student-facing roles are intentionally excluded from aggregate report access.
// Bursar is included: ROLE_PERMISSIONS grants bursar `reports`, the bursar nav
// carries /dashboard/reports, and the bursar dashboard links its collections
// report there — denying it at the API only produced a silent empty screen.
export const REPORT_ALLOWED_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "teacher",
  "secretary",
  "bursar",
];
