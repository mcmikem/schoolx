const ROLE_TASKS: Record<string, string> = {
  teacher: "For today’s work, open Attendance, choose your class, mark learners, then sync when you are online.",
  bursar: "Open Fees, select the learner, enter the payment reference, and confirm it in the fee ledger.",
  headmaster: "Review today’s dashboard, then open Attendance, Staff, or Reports for the follow-up you need.",
  school_admin: "Review the school dashboard, then use Students, Staff, or Settings to keep school records current.",
  admin: "Review the school dashboard, then use Students, Staff, or Settings to keep school records current.",
  dean_of_studies: "Open Timetable to confirm lessons, then Grades to review mark entry and class progress.",
  secretary: "Open Students to update learner records, then check Messages for school and parent follow-up.",
  parent: "Open Parent Portal to check your selected child’s attendance, latest results, and fee balance.",
};

/** Pick guidance for the user's primary role, falling back to any held role. */
export function getGuidedTourTask(roles: readonly string[]): string {
  for (const role of roles) {
    const task = ROLE_TASKS[role];
    if (task) return task;
  }
  return "Open the dashboard and choose the school tool you need for today’s work.";
}
