export type CurriculumStage = {
  stage: "primary" | "secondary" | "unknown";
  level: number;
};

export function resolveCurriculumStage(className?: string | null): CurriculumStage {
  const value = (className || "").trim();

  const primaryMatch = value.match(/(?:^|\b)P\.?\s*([1-7])(?:\b|$)/i);
  if (primaryMatch) {
    return { stage: "primary", level: Number(primaryMatch[1]) };
  }

  const secondaryMatch = value.match(/(?:^|\b)S\.?\s*([1-6])(?:\b|$)/i);
  if (secondaryMatch) {
    return { stage: "secondary", level: Number(secondaryMatch[1]) };
  }

  return { stage: "unknown", level: 0 };
}

function normalizeSubjectName(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function subjectNamesMatch(a?: string | null, b?: string | null) {
  const left = normalizeSubjectName(a);
  const right = normalizeSubjectName(b);

  if (!left || !right) return false;
  if (left === right) return true;

  const aliasGroups = [
    ["english", "englishlanguage"],
    ["mathematics", "maths", "math"],
    ["science", "integratedscience"],
    ["socialstudies", "sst"],
    ["religiouseducation", "re", "cre"],
    ["physicaleducation", "pe"],
    ["informationcommunicationtechnology", "ict", "computerstudies"],
    ["creativearts", "art", "arts"],
  ];

  return aliasGroups.some(
    (group) => group.includes(left) && group.includes(right),
  );
}

export function parseStoredSubtopics(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Fallback to plain text parsing
  }

  return trimmed
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildAcademicYear(academicYear?: string | null) {
  return academicYear && academicYear.trim()
    ? academicYear.trim()
    : String(new Date().getFullYear());
}

export function mapSchemeWeekFromRecord(record: any) {
  return {
    week: Number(record?.week_number ?? record?.week ?? 0),
    topic: record?.topic || "",
    subtopics: record?.subtopics || "",
    objectives: record?.objectives || "",
    resources: record?.resources || "",
  };
}

export function buildLessonProcedure(sections: {
  introduction?: string;
  presentation?: string;
  consolidation?: string;
  evaluation?: string;
}) {
  return [
    `Introduction:\n${sections.introduction || ""}`,
    `Presentation:\n${sections.presentation || ""}`,
    `Consolidation:\n${sections.consolidation || ""}`,
    `Evaluation:\n${sections.evaluation || ""}`,
  ].join("\n\n");
}

export function splitLessonProcedure(procedure?: string | null) {
  const text = procedure || "";
  const readSection = (label: string, nextLabel?: string) => {
    const pattern = nextLabel
      ? new RegExp(`${label}:\\n?([\\s\\S]*?)\\n\\n${nextLabel}:`, "i")
      : new RegExp(`${label}:\\n?([\\s\\S]*)$`, "i");
    const match = text.match(pattern);
    return match?.[1]?.trim() || "";
  };

  return {
    introduction: readSection("Introduction", "Presentation"),
    presentation: readSection("Presentation", "Consolidation"),
    consolidation: readSection("Consolidation", "Evaluation"),
    evaluation: readSection("Evaluation"),
  };
}
