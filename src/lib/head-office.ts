/**
 * Actions that belong to the head office rather than to a teacher.
 *
 * These are school-wide objects: an exam paper that every class sits, a
 * substitution that pairs two members of staff, an event on the school
 * calendar. A teacher can use the results of all of them, but should not be
 * able to rewrite them -- and today the buttons were simply open to whoever
 * navigated to the page.
 *
 * Deliberately a list of roles rather than a permission flag: these actions
 * do not map onto the existing permission grid, and inventing a flag for
 * "settings"-like powers would blur the line the roles already draw.
 */
export const HEAD_OFFICE_ROLES: string[] = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "secretary",
];

export function isHeadOffice(role: string | undefined | null): boolean {
  if (!role) return false;
  return HEAD_OFFICE_ROLES.includes(role);
}
