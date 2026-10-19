/** Tailwind text colour for a report-card grade such as D1, C3, P7 or F9. */
export function reportGradeColor(grade: string): string {
  if (grade.startsWith("D")) return "text-green-600";
  if (grade.startsWith("C")) return "text-blue-600";
  if (grade.startsWith("P")) return "text-yellow-600";
  return grade === "F9" ? "text-red-500" : "text-amber-600";
}

export interface CompetencyBadge {
  label: string;
  emoji: string;
  color: string;
}

/** Badge text for the competency-based (lower primary) report layout. */
export function competencyBadge(level: string | undefined): CompetencyBadge {
  switch (level) {
    case "mastered":
      return { label: "Mastered", emoji: "⭐⭐⭐", color: "text-green-600" };
    case "demonstrates":
      return { label: "Demonstrates", emoji: "⭐⭐", color: "text-blue-600" };
    case "developing":
      return { label: "Developing", emoji: "⭐", color: "text-yellow-600" };
    case "extended":
      return { label: "Extended", emoji: "🏆", color: "text-purple-600" };
    default:
      return { label: "Not Started", emoji: "—", color: "text-gray-400" };
  }
}
