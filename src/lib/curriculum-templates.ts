export interface TemplateClass {
  name: string;
  level: string;
}

export interface TemplateSubject {
  name: string;
  code: string;
  level: "primary" | "secondary" | "both";
  is_compulsory: boolean;
}

export const PRIMARY_TEMPLATE: { classes: TemplateClass[]; subjects: TemplateSubject[] } = {
  classes: [
    { name: "P.1", level: "P.1" },
    { name: "P.2", level: "P.2" },
    { name: "P.3", level: "P.3" },
    { name: "P.4", level: "P.4" },
    { name: "P.5", level: "P.5" },
    { name: "P.6", level: "P.6" },
    { name: "P.7", level: "P.7" },
  ],
  subjects: [
    { name: "English", code: "ENG", level: "primary", is_compulsory: true },
    { name: "Mathematics", code: "MTC", level: "primary", is_compulsory: true },
    { name: "Science", code: "SCI", level: "primary", is_compulsory: true },
    { name: "Social Studies", code: "SST", level: "primary", is_compulsory: true },
    { name: "R.E (Religious Education)", code: "RE", level: "primary", is_compulsory: false },
    { name: "CAP (Creative Arts & Physical Ed)", code: "CAP", level: "primary", is_compulsory: false },
  ],
};

/**
 * Ugandan pre-primary section (Baby / Middle / Top Class).
 *
 * Opt-in: only seeded when a school declares it runs a nursery section, so
 * schools without one are never left holding three empty classes.
 *
 * All three classes share `level: "nursery"` — the section is the level, so
 * report-card automation can recognise them as a group and skip PLE/UCE
 * aggregates (pre-primary results are grades only).
 *
 * Subjects deliberately carry `level: "primary"`: the `subjects.level` column
 * has a DB CHECK constraint of (primary|secondary|both), and a nursery section
 * belongs to the primary school anyway. Nursery "Mathematics" and primary
 * "Mathematics" share a name, so onboarding's name-keyed dedupe collapses them
 * into one subject rather than creating a duplicate.
 */
export const NURSERY_TEMPLATE: { classes: TemplateClass[]; subjects: TemplateSubject[] } = {
  classes: [
    { name: "Baby Class", level: "nursery" },
    { name: "Middle Class", level: "nursery" },
    { name: "Top Class", level: "nursery" },
  ],
  subjects: [
    { name: "Language", code: "LNG", level: "primary", is_compulsory: true },
    { name: "Mathematics", code: "MTC", level: "primary", is_compulsory: true },
    { name: "Environmental Activities", code: "ENV", level: "primary", is_compulsory: true },
    { name: "Creative Activities", code: "CRE", level: "primary", is_compulsory: true },
    { name: "Physical Activities", code: "PA", level: "primary", is_compulsory: true },
    { name: "Social Studies", code: "SST", level: "primary", is_compulsory: false },
    { name: "Religious Education", code: "RE", level: "primary", is_compulsory: false },
  ],
};

export const SECONDARY_TEMPLATE: { classes: TemplateClass[]; subjects: TemplateSubject[] } = {
  classes: [
    { name: "S.1", level: "S.1" },
    { name: "S.2", level: "S.2" },
    { name: "S.3", level: "S.3" },
    { name: "S.4", level: "S.4" },
    { name: "S.5", level: "S.5" },
    { name: "S.6", level: "S.6" },
  ],
  subjects: [
    { name: "Mathematics", code: "MTC", level: "secondary", is_compulsory: true },
    { name: "English Language", code: "ENG", level: "secondary", is_compulsory: true },
    { name: "Biology", code: "BIO", level: "secondary", is_compulsory: true },
    { name: "Chemistry", code: "CHE", level: "secondary", is_compulsory: true },
    { name: "Physics", code: "PHY", level: "secondary", is_compulsory: true },
    { name: "Geography", code: "GEO", level: "secondary", is_compulsory: true },
    { name: "History", code: "HIS", level: "secondary", is_compulsory: true },
    { name: "Commerce", code: "COM", level: "secondary", is_compulsory: false },
    { name: "Entrepreneurship", code: "ENT", level: "secondary", is_compulsory: false },
    { name: "Literature in English", code: "LIT", level: "secondary", is_compulsory: false },
    { name: "Fine Art", code: "ART", level: "secondary", is_compulsory: false },
    { name: "Computer Studies", code: "ICT", level: "secondary", is_compulsory: false },
    { name: "Agric. Principles", code: "AGR", level: "secondary", is_compulsory: false },
  ],
};

/**
 * The default subject list a school is seeded with.
 *
 * Kept here rather than re-implemented per route so the pre-primary section
 * cannot be wired up in one registration path and forgotten in another.
 * Subjects are de-duplicated by code+level, so a school with a nursery section
 * does not end up with Mathematics twice.
 */
export function getTemplateSubjects(
  schoolType: "primary" | "secondary" | "combined",
  options?: { nursery?: boolean },
): TemplateSubject[] {
  const nursery = options?.nursery && schoolType !== "secondary" ? NURSERY_TEMPLATE.subjects : [];
  const base =
    schoolType === "primary"
      ? PRIMARY_TEMPLATE.subjects
      : schoolType === "secondary"
        ? SECONDARY_TEMPLATE.subjects
        : [...PRIMARY_TEMPLATE.subjects, ...SECONDARY_TEMPLATE.subjects];

  const merged: TemplateSubject[] = [];
  const seen = new Set<string>();
  // Base subjects come first so they win a code+level collision: nursery's
  // "Social Studies" is optional while primary's is compulsory, and the school
  // should keep the compulsory one. Nursery then only contributes subjects the
  // school does not already teach (Language, Environmental Activities, ...).
  for (const subject of [...base, ...nursery]) {
    const key = `${subject.code}:${subject.level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(subject);
  }
  return merged;
}
