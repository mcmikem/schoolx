// Teacher onboarding step highlights — used by OnboardingFlow.
// Each step targets a data-testid that should exist in the teacher-facing UI.

// The actual highlight logic lives in OnboardingFlow.useHighlight();
// these constants just declare the expected testid strings so they can be
// added to the corresponding JSX elements in the teacher dashboard.

export const TeacherOnboardingStepIDs = {
  schedule: "onboarding-schedule",
  attendanceRow: "onboarding-attendance-row",
  gradePicker: "onboarding-grade-picker",
  recap: "onboarding-recap",
  studentQuick: "onboarding-student-quick",
  finish: "onboarding-finish",
};
