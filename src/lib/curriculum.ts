// Uganda Curriculum Subjects
// Based on NCDC 2025 curriculum guidelines
// Updated for Competency-Based Curriculum (CBC)

export interface CurriculumSubject {
  id: string;
  name: string;
  code: string;
  level: "primary" | "secondary" | "both";
  category: string;
  is_compulsory: boolean;
  streams?: string[]; // For secondary (Science, Arts, Commercial)
  is_thematic?: boolean; // For P1-P3 thematic curriculum
  cross_cutting_theme?: string[]; // Climate, Health, ICT, Entrepreneurship, Gender
}

// Cross-cutting themes per NCDC 2025
export const CROSS_CUTTING_THEMES = [
  {
    id: "climate",
    name: "Climate Change & Environment",
    description: "Environmental conservation and climate action",
  },
  {
    id: "ict",
    name: "ICT & Digital Literacy",
    description: "Digital skills and technology",
  },
  {
    id: "entrepreneurship",
    name: "Entrepreneurship",
    description: "Business skills and innovation",
  },
  {
    id: "gender",
    name: "Gender & Equity",
    description: "Gender equality and inclusion",
  },
  {
    id: "health",
    name: "Health & Nutrition",
    description: "Health education and nutrition",
  },
  {
    id: "peace",
    name: "Peace & Values",
    description: "Peace education and moral values",
  },
  {
    id: "community",
    name: "Community Service",
    description: "Civic engagement and service learning",
  },
] as const;

// Primary School Subjects (P1-P3) - Thematic Curriculum
export const primaryThematicSubjects: CurriculumSubject[] = [
  // P1-P3 Learning Areas (Thematic)
  {
    id: "t-001",
    name: "Language Activities",
    code: "LANG",
    level: "primary",
    category: "Language",
    is_compulsory: true,
    is_thematic: true,
  },
  {
    id: "t-002",
    name: "Mathematical Activities",
    code: "MATH",
    level: "primary",
    category: "Numeracy",
    is_compulsory: true,
    is_thematic: true,
  },
  {
    id: "t-003",
    name: "Environmental Activities",
    code: "ENV",
    level: "primary",
    category: "Social",
    is_compulsory: true,
    is_thematic: true,
  },
  {
    id: "t-004",
    name: "Religious Activities",
    code: "REL",
    level: "primary",
    category: "Religious",
    is_compulsory: true,
    is_thematic: true,
  },
  {
    id: "t-005",
    name: "Physical Activities",
    code: "PHY",
    level: "primary",
    category: "Physical",
    is_compulsory: true,
    is_thematic: true,
  },
  {
    id: "t-006",
    name: "Creative Activities",
    code: "ART",
    level: "primary",
    category: "Creative",
    is_compulsory: true,
    is_thematic: true,
  },
];

// Primary School Subjects (P4-P7) - Subject-Based
export const primarySubjects: CurriculumSubject[] = [
  // Core Subjects (P4-P7)
  {
    id: "p-001",
    name: "English",
    code: "ENG",
    level: "primary",
    category: "Language",
    is_compulsory: true,
  },
  {
    id: "p-002",
    name: "Mathematics",
    code: "MTC",
    level: "primary",
    category: "Numeracy",
    is_compulsory: true,
  },
  {
    id: "p-003",
    name: "Integrated Science",
    code: "SCI",
    level: "primary",
    category: "Science",
    is_compulsory: true,
  },
  {
    id: "p-004",
    name: "Social Studies",
    code: "SST",
    level: "primary",
    category: "Social",
    is_compulsory: true,
  },
  {
    id: "p-005",
    name: "Religious Education",
    code: "REL",
    level: "primary",
    category: "Religious",
    is_compulsory: true,
  },
  {
    id: "p-006",
    name: "Physical Education",
    code: "PE",
    level: "primary",
    category: "Physical",
    is_compulsory: true,
  },
  // Elective Subjects
  {
    id: "p-007",
    name: "Local Language",
    code: "LNG",
    level: "primary",
    category: "Language",
    is_compulsory: false,
  },
  {
    id: "p-008",
    name: "Art & Craft",
    code: "ACD",
    level: "primary",
    category: "Creative",
    is_compulsory: false,
  },
  {
    id: "p-009",
    name: "Music",
    code: "MUS",
    level: "primary",
    category: "Creative",
    is_compulsory: false,
  },
  {
    id: "p-010",
    name: "Agriculture",
    code: "AGR",
    level: "primary",
    category: "Practical",
    is_compulsory: false,
  },
];

// Lower Secondary Subjects (S1-S4) - New Competency-Based Curriculum
export const lowerSecondarySubjects: CurriculumSubject[] = [
  // Compulsory (Core) - All streams
  {
    id: "s-001",
    name: "English",
    code: "ENG",
    level: "secondary",
    category: "Language",
    is_compulsory: true,
    streams: ["Science", "Arts", "Commercial"],
  },
  {
    id: "s-002",
    name: "Mathematics",
    code: "MTC",
    level: "secondary",
    category: "Science",
    is_compulsory: true,
    streams: ["Science", "Arts", "Commercial"],
  },
  {
    id: "s-010",
    name: "Computer Studies",
    code: "CST",
    level: "secondary",
    category: "Technical",
    is_compulsory: true,
    streams: ["Science", "Arts", "Commercial"],
    cross_cutting_theme: ["ict"],
  },
  {
    id: "s-011",
    name: "Entrepreneurship Education",
    code: "ENT",
    level: "secondary",
    category: "Business",
    is_compulsory: true,
    streams: ["Science", "Arts", "Commercial"],
    cross_cutting_theme: ["entrepreneurship"],
  },
  {
    id: "s-017",
    name: "Physical Education",
    code: "PE",
    level: "secondary",
    category: "Physical",
    is_compulsory: true,
    streams: ["Science", "Arts", "Commercial"],
    cross_cutting_theme: ["health"],
  },
  // Science Stream
  {
    id: "s-003",
    name: "Biology",
    code: "BIO",
    level: "secondary",
    category: "Science",
    is_compulsory: false,
    streams: ["Science"],
    cross_cutting_theme: ["health"],
  },
  {
    id: "s-004",
    name: "Chemistry",
    code: "CHEM",
    level: "secondary",
    category: "Science",
    is_compulsory: false,
    streams: ["Science"],
  },
  {
    id: "s-005",
    name: "Physics",
    code: "PHY",
    level: "secondary",
    category: "Science",
    is_compulsory: false,
    streams: ["Science"],
  },
  // Arts Stream
  {
    id: "s-012",
    name: "Literature in English",
    code: "LIT",
    level: "secondary",
    category: "Language",
    is_compulsory: false,
    streams: ["Arts"],
  },
  {
    id: "s-006",
    name: "Geography",
    code: "GEO",
    level: "secondary",
    category: "Social",
    is_compulsory: false,
    streams: ["Arts"],
    cross_cutting_theme: ["climate"],
  },
  {
    id: "s-007",
    name: "History",
    code: "HIS",
    level: "secondary",
    category: "Social",
    is_compulsory: false,
    streams: ["Arts"],
  },
  // Commercial Stream
  {
    id: "s-013",
    name: "Commerce",
    code: "COM",
    level: "secondary",
    category: "Business",
    is_compulsory: false,
    streams: ["Commercial"],
    cross_cutting_theme: ["entrepreneurship"],
  },
  {
    id: "s-014",
    name: "Accounting",
    code: "ACC",
    level: "secondary",
    category: "Business",
    is_compulsory: false,
    streams: ["Commercial"],
  },
  // Religious Education
  {
    id: "s-008",
    name: "Christian Religious Education",
    code: "CRE",
    level: "secondary",
    category: "Religious",
    is_compulsory: false,
    streams: ["Science", "Arts", "Commercial"],
  },
  {
    id: "s-009",
    name: "Islamic Religious Education",
    code: "IRE",
    level: "secondary",
    category: "Religious",
    is_compulsory: false,
    streams: ["Science", "Arts", "Commercial"],
  },
  // Languages (NCDC 2025 - Kiswahili now compulsory)
  {
    id: "s-015",
    name: "Kiswahili",
    code: "KIS",
    level: "secondary",
    category: "Language",
    is_compulsory: true,
    streams: ["Science", "Arts", "Commercial"],
  }, // NCDC 2025 priority
  {
    id: "s-016",
    name: "French",
    code: "FRE",
    level: "secondary",
    category: "Language",
    is_compulsory: false,
    streams: ["Science", "Arts", "Commercial"],
  },
  // Creative & Practical
  {
    id: "s-018",
    name: "Fine Art",
    code: "ART",
    level: "secondary",
    category: "Creative",
    is_compulsory: false,
    streams: ["Arts"],
  },
  {
    id: "s-019",
    name: "Music",
    code: "MUS",
    level: "secondary",
    category: "Creative",
    is_compulsory: false,
    streams: ["Arts"],
  },
  {
    id: "s-020",
    name: "Agriculture",
    code: "AGR",
    level: "secondary",
    category: "Practical",
    is_compulsory: false,
    streams: ["Science", "Arts", "Commercial"],
    cross_cutting_theme: ["climate", "entrepreneurship"],
  },
  {
    id: "s-021",
    name: "Food & Nutrition",
    code: "FNT",
    level: "secondary",
    category: "Practical",
    is_compulsory: false,
    streams: ["Arts", "Commercial"],
    cross_cutting_theme: ["health"],
  },
  // Technical
  {
    id: "s-022",
    name: "Metal Work",
    code: "MTW",
    level: "secondary",
    category: "Technical",
    is_compulsory: false,
    streams: ["Science"],
  },
  {
    id: "s-023",
    name: "Wood Work",
    code: "WDK",
    level: "secondary",
    category: "Technical",
    is_compulsory: false,
    streams: ["Science"],
  },
  {
    id: "s-024",
    name: "Technical Drawing",
    code: "TDG",
    level: "secondary",
    category: "Technical",
    is_compulsory: false,
    streams: ["Science"],
  },
];

// Combined lists
export const allSubjects = [
  ...primaryThematicSubjects,
  ...primarySubjects,
  ...lowerSecondarySubjects,
];
export const allPrimary = [...primaryThematicSubjects, ...primarySubjects];

// Helper functions
export function getSubjectsByLevel(
  level: "primary" | "secondary",
): CurriculumSubject[] {
  if (level === "primary") return allPrimary;
  return lowerSecondarySubjects;
}

export function getPrimarySubjects(): CurriculumSubject[] {
  return primarySubjects;
}

export function getThematicSubjects(): CurriculumSubject[] {
  return primaryThematicSubjects;
}

export function getSecondarySubjects(): CurriculumSubject[] {
  return lowerSecondarySubjects;
}

export function getSubjectsByCategory(category: string): CurriculumSubject[] {
  return allSubjects.filter((s) => s.category === category);
}

export function getSubjectsByStream(stream: string): CurriculumSubject[] {
  return lowerSecondarySubjects.filter((s) => s.streams?.includes(stream));
}

export function getCompulsorySubjects(
  level: "primary" | "secondary",
): CurriculumSubject[] {
  if (level === "primary") {
    return [...primaryThematicSubjects, ...primarySubjects].filter(
      (s) => s.is_compulsory,
    );
  }
  return lowerSecondarySubjects.filter((s) => s.is_compulsory);
}

export function getCrossCuttingThemes(subjectId: string): string[] {
  const subject = allSubjects.find((s) => s.id === subjectId);
  return subject?.cross_cutting_theme || [];
}

// Get subjects for auto-seed (default set for new schools)
export function getDefaultSubjects(
  schoolType: "primary" | "secondary" | "combined" = "primary",
  includeThematic = true,
): CurriculumSubject[] {
  if (schoolType === "primary") {
    const thematic = includeThematic ? primaryThematicSubjects : [];
    const core = primarySubjects.filter(
      (s) =>
        s.is_compulsory || ["ENG", "MTC", "SCI", "SST", "REL"].includes(s.code),
    );
    return [...thematic, ...core];
  } else if (schoolType === "secondary") {
    // NCDC 2025: English, Mathematics, CST, Entrepreneurship, PE, Kiswahili are compulsory
    return lowerSecondarySubjects.filter(
      (s) =>
        s.is_compulsory ||
        ["ENG", "MTC", "BIO", "CHEM", "PHY", "CST", "ENT", "KIS"].includes(
          s.code,
        ),
    );
  } else {
    return getCompulsorySubjects("primary").concat(
      getCompulsorySubjects("secondary"),
    );
  }
}

// Get stream subjects for S1-S4
export function getStreamSubjects(
  stream: "Science" | "Arts" | "Commercial",
): CurriculumSubject[] {
  return lowerSecondarySubjects.filter((s) => s.streams?.includes(stream));
}

// Competency assessment levels
export const COMPETENCY_LEVELS = [
  {
    id: "not_started",
    name: "Not Started",
    abbreviation: "NS",
    description: "Learning not yet begun",
  },
  {
    id: "developing",
    name: "Developing",
    abbreviation: "D",
    description: "Learning in progress",
  },
  {
    id: "demonstrates",
    name: "Demonstrates",
    abbreviation: "DEM",
    description: "Can apply with guidance",
  },
  {
    id: "mastered",
    name: "Mastered",
    abbreviation: "M",
    description: "Can apply independently",
  },
  {
    id: "extended",
    name: "Extended",
    abbreviation: "E",
    description: "Can teach others",
  },
] as const;

export type CompetencyLevel = (typeof COMPETENCY_LEVELS)[number]["id"];

// Re-export NCDC syllabus helpers
export {
  ALL_NCDC_TOPICS,
  getTopicsBySubject,
  getTopicsByClass,
  getTopicsByTerm,
} from "./ndc-syllabus";
