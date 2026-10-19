import { competencyBadge, reportGradeColor } from "@/lib/report-card-presentation";

describe("reportGradeColor", () => {
  it("colours divisions, credits and passes", () => {
    expect(reportGradeColor("D1")).toBe("text-green-600");
    expect(reportGradeColor("D2")).toBe("text-green-600");
    expect(reportGradeColor("C3")).toBe("text-blue-600");
    expect(reportGradeColor("P7")).toBe("text-yellow-600");
  });

  it("marks F9 red and other unknowns amber", () => {
    expect(reportGradeColor("F9")).toBe("text-red-500");
    expect(reportGradeColor("F")).toBe("text-amber-600");
    expect(reportGradeColor("")).toBe("text-amber-600");
  });
});

describe("competencyBadge", () => {
  it.each([
    ["mastered", "Mastered", "⭐⭐⭐"],
    ["demonstrates", "Demonstrates", "⭐⭐"],
    ["developing", "Developing", "⭐"],
    ["extended", "Extended", "🏆"],
  ])("maps %s", (level, label, emoji) => {
    const badge = competencyBadge(level);
    expect(badge.label).toBe(label);
    expect(badge.emoji).toBe(emoji);
  });

  it("falls back to Not Started", () => {
    expect(competencyBadge(undefined)).toEqual({
      label: "Not Started",
      emoji: "—",
      color: "text-gray-400",
    });
  });
});
