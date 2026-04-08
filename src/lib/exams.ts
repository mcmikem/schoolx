// Exam Types for Secondary Schools Uganda
// BOT = Beginning of Term, EOT = End of Term

export type ExamType =
  | "class_test"
  | "bot" // Beginning of Term
  | "mid_term" // Mid Term
  | "saturday" // Saturday Test
  | "eot" // End of Term
  | "mock"; // Mock Exams (for candidate classes)

export interface ExamConfig {
  id: string;
  name: string;
  shortName: string;
  type: ExamType;
  weight: number; // Weight in final grade (percentage)
  maxScore: number;
  isActive: boolean;
}

export const SECONDARY_EXAM_TYPES: ExamConfig[] = [
  {
    id: "class_test",
    name: "Class Test",
    shortName: "CT",
    type: "class_test",
    weight: 10,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "bot",
    name: "Beginning of Term",
    shortName: "BOT",
    type: "bot",
    weight: 10,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "saturday",
    name: "Saturday Test",
    shortName: "SAT",
    type: "saturday",
    weight: 10,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "mid_term",
    name: "Mid Term",
    shortName: "MT",
    type: "mid_term",
    weight: 20,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "eot",
    name: "End of Term",
    shortName: "EOT",
    type: "eot",
    weight: 50,
    maxScore: 100,
    isActive: true,
  },
];

export const PRIMARY_EXAM_TYPES: ExamConfig[] = [
  {
    id: "ca1",
    name: "Continuous Assessment 1",
    shortName: "CA1",
    type: "class_test",
    weight: 10,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "bot",
    name: "Beginning of Term",
    shortName: "BOT",
    type: "bot",
    weight: 10,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "ca2",
    name: "Continuous Assessment 2",
    shortName: "CA2",
    type: "class_test",
    weight: 10,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "ca3",
    name: "Continuous Assessment 3",
    shortName: "CA3",
    type: "class_test",
    weight: 10,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "ca4",
    name: "Continuous Assessment 4",
    shortName: "CA4",
    type: "class_test",
    weight: 10,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "project",
    name: "Project",
    shortName: "PRJ",
    type: "class_test",
    weight: 10,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "mid_term",
    name: "Mid Term",
    shortName: "MT",
    type: "mid_term",
    weight: 20,
    maxScore: 100,
    isActive: true,
  },
  {
    id: "eot",
    name: "End of Term",
    shortName: "EOT",
    type: "eot",
    weight: 30,
    maxScore: 100,
    isActive: true,
  },
];

export const EXAM_TYPES = SECONDARY_EXAM_TYPES;

// Calculate weighted average for a student in a subject
export function calculateWeightedGrade(
  scores: Record<string, number>,
  examConfigs: ExamConfig[],
): {
  total: number;
  breakdown: {
    name: string;
    score: number;
    weight: number;
    contribution: number;
  }[];
} {
  let totalWeight = 0;
  let weightedSum = 0;

  const breakdown = examConfigs.map((config) => {
    const score = scores[config.id] || 0;
    const contribution = (score * config.weight) / 100;
    weightedSum += contribution;
    totalWeight += config.weight;

    return {
      name: config.name,
      score,
      weight: config.weight,
      contribution,
    };
  });

  // Normalize to 100 if not all exams are taken
  const total = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

  return { total, breakdown };
}

// Default exam weights for Uganda secondary schools
export const DEFAULT_SECONDARY_WEIGHTS = {
  ca: 20, // Class tests + Saturday tests
  bot: 10, // Beginning of Term
  mid_term: 20, // Mid Term
  eot: 50, // End of Term (finals)
};

// For candidate classes (P.7, S.4, S.6)
export const CANDIDATE_EXAM_WEIGHTS = {
  class_test: 5,
  bot: 10,
  saturday: 5,
  mid_term: 20,
  mock: 15,
  eot: 45,
};

export function getExamTypeLabel(type: ExamType): string {
  const labels: Record<ExamType, string> = {
    class_test: "Class Test",
    bot: "Beginning of Term",
    mid_term: "Mid Term",
    saturday: "Saturday Test",
    eot: "End of Term",
    mock: "Mock Exam",
  };
  return labels[type];
}

export function getExamColor(type: ExamType): string {
  const colors: Record<ExamType, string> = {
    class_test: "#7A8CA3",
    bot: "#17325F",
    mid_term: "#B86B0C",
    saturday: "#2E9448",
    eot: "#C0392B",
    mock: "#8B5CF6",
  };
  return colors[type];
}
