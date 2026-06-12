// UNEB Grading System - Official thresholds for Uganda
// Primary (PLE), O-Level (UCE), and A-Level (UACE)
// Supports custom grading schemes via grading_schemes table (with fallback to hardcoded UNEB)

import { logger } from "@/lib/logger";

// ============================================
// WEIGHT CONFIGURATION
// ============================================

export interface WeightConfig {
  ca1: number;
  ca2: number;
  ca3: number;
  ca4: number;
  project: number;
  exam: number;
}

const DEFAULT_WEIGHTS: WeightConfig = {
  ca1: 10,
  ca2: 10,
  ca3: 10,
  ca4: 10,
  project: 10,
  exam: 50,
};

let cachedWeightConfig: WeightConfig | null = null;

export function getWeightConfig(schoolSettings?: Record<string, string>): WeightConfig {
  if (schoolSettings) {
    const weights = schoolSettings["grade_weights"];
    if (weights) {
      try {
        const parsed = JSON.parse(weights);
        return {
          ca1: parsed.ca1 ?? DEFAULT_WEIGHTS.ca1,
          ca2: parsed.ca2 ?? DEFAULT_WEIGHTS.ca2,
          ca3: parsed.ca3 ?? DEFAULT_WEIGHTS.ca3,
          ca4: parsed.ca4 ?? DEFAULT_WEIGHTS.ca4,
          project: parsed.project ?? DEFAULT_WEIGHTS.project,
          exam: parsed.exam ?? DEFAULT_WEIGHTS.exam,
        };
      } catch {
        logger.warn("Failed to parse grade_weights setting, using defaults");
      }
    }
  }
  return cachedWeightConfig || DEFAULT_WEIGHTS;
}

export function setWeightConfig(config: WeightConfig): void {
  cachedWeightConfig = config;
}

// ============================================
// GRADING SCHEME MANAGEMENT
// ============================================

export interface GradingSchemeRecord {
  id: string;
  school_id: string;
  name: string;
  subject_id: string | null;
  min_score: number;
  max_score: number;
  grade: string;
  points: number;
  division: string | null;
  is_default: boolean;
  created_at?: string;
}

let cachedSchemes: GradingSchemeRecord[] | null = null;

export function setGradingSchemes(schemes: GradingSchemeRecord[]): void {
  cachedSchemes = schemes;
}

export function clearGradingCache(): void {
  cachedSchemes = null;
  cachedWeightConfig = null;
}

function findGradeFromSchemes(score: number, schemes?: GradingSchemeRecord[]): string | null {
  const pool = schemes || cachedSchemes;
  if (!pool || pool.length === 0) return null;
  const match = pool.find((s) => score >= s.min_score && score <= s.max_score);
  return match?.grade || null;
}

function findDivisionFromSchemes(score: number, schemes?: GradingSchemeRecord[]): string | null {
  const pool = schemes || cachedSchemes;
  if (!pool || pool.length === 0) return null;
  const match = pool.find((s) => score >= s.min_score && score <= s.max_score);
  return match?.division || null;
}

// ============================================
// PRIMARY LEAVING EXAMINATION (PLE)
// ============================================

export function getPLEGrade(score: number): string {
  if (score >= 80) return 'D1'
  if (score >= 70) return 'D2'
  if (score >= 65) return 'C3'
  if (score >= 60) return 'C4'
  if (score >= 55) return 'C5'
  if (score >= 50) return 'C6'
  if (score >= 45) return 'P7'
  if (score >= 40) return 'P8'
  return 'F9'
}

export function getPLEDivision(aggregate: number): string {
  if (aggregate <= 12) return 'Division I'
  if (aggregate <= 24) return 'Division II'
  if (aggregate <= 28) return 'Division III'
  if (aggregate <= 32) return 'Division IV'
  return 'Ungraded'
}

// ============================================
// O-LEVEL (UCE) - Uganda Certificate of Education
// ============================================

export function getUCEGrade(score: number): string {
  if (score >= 80) return 'D1'
  if (score >= 70) return 'D2'
  if (score >= 65) return 'C3'
  if (score >= 60) return 'C4'
  if (score >= 55) return 'C5'
  if (score >= 50) return 'C6'
  if (score >= 45) return 'P7'
  if (score >= 40) return 'P8'
  return 'F9'
}

export function getUCEDivision(subjectGrades: string[]): string {
  const gradeValues: Record<string, number> = {
    'D1': 1, 'D2': 2, 'C3': 3, 'C4': 4, 'C5': 5, 'C6': 6, 'P7': 7, 'P8': 8, 'F9': 9
  }

  const values = subjectGrades
    .map(g => gradeValues[g] || 9)
    .sort((a, b) => a - b)
    .slice(0, 8)

  const aggregate = values.reduce((sum, v) => sum + v, 0)

  if (aggregate <= 36) return 'Division I'
  if (aggregate <= 44) return 'Division II'
  if (aggregate <= 52) return 'Division III'
  if (aggregate <= 58) return 'Division IV'
  return 'Ungraded'
}

// ============================================
// A-LEVEL (UACE) - Uganda Advanced Certificate of Education
// ============================================

export function getUACEGrade(score: number): string {
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  if (score >= 40) return 'E'
  if (score >= 35) return 'O'
  return 'F'
}

export function getUACEPoints(principalGrades: string[], subsidiaryGrades: string[]): { points: number; division: string } {
  const gradePoints: Record<string, number> = {
    'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'O': 1, 'F': 0
  }

  const principalPoints = principalGrades
    .map(g => gradePoints[g] || 0)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, p) => sum + p, 0)

  const subsidiaryPoints = subsidiaryGrades
    .map(g => gradePoints[g] || 0)
    .reduce((sum, p) => sum + p, 0)

  const totalPoints = principalPoints + subsidiaryPoints

  let division = 'Ungraded'
  if (totalPoints >= 15) division = 'Division I'
  else if (totalPoints >= 12) division = 'Division II'
  else if (totalPoints >= 9) division = 'Division III'
  else if (totalPoints >= 6) division = 'Division IV'

  return { points: totalPoints, division }
}

// ============================================
// GENERAL UTILITIES
// ============================================

export function calculateSubjectTotal(
  ca1: number,
  ca2: number,
  ca3: number,
  ca4: number,
  project: number,
  exam: number,
): number {
  return ca1 + ca2 + ca3 + ca4 + project + exam;
}

export function getUNEBGrade(score: number, schemes?: GradingSchemeRecord[]): string {
  const fromSchemes = findGradeFromSchemes(score, schemes);
  return fromSchemes || getPLEGrade(score);
}

export function getUNEBDivision(avg: number, schemes?: GradingSchemeRecord[]): string {
  const fromSchemes = findDivisionFromSchemes(avg, schemes);
  return fromSchemes || getPLEDivision(avg);
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'D1': 'text-green-600',
    'D2': 'text-green-500',
    'C3': 'text-blue-600',
    'C4': 'text-blue-500',
    'C5': 'text-yellow-600',
    'C6': 'text-yellow-500',
    'P7': 'text-orange-500',
    'P8': 'text-orange-400',
    'F9': 'text-red-500',
    'A': 'text-green-600',
    'B': 'text-green-500',
    'C': 'text-blue-600',
    'D': 'text-blue-500',
    'E': 'text-yellow-600',
    'O': 'text-orange-500',
    'F': 'text-red-500',
  }
  return colors[grade] || 'text-gray-500'
}

export function getDivisionColor(division: string): string {
  switch (division) {
    case 'Division I': return 'text-green-600'
    case 'Division II': return 'text-blue-600'
    case 'Division III': return 'text-yellow-600'
    case 'Division IV': return 'text-orange-500'
    default: return 'text-red-500'
  }
}

export type SchoolLevel = 'primary' | 'secondary_o' | 'secondary_a'
export type GradingScale = 'percentage' | 'competency'
export type CompetencyValue = 1 | 2 | 3

export interface GradingScheme {
  scale: GradingScale
  label: string
  values?: Array<{ value: CompetencyValue; label: string; description: string }>
}

export const COMPETENCY_SCHEME: GradingScheme = {
  scale: 'competency',
  label: 'Competency 3-Point',
  values: [
    { value: 1, label: 'Emerging', description: 'Learner needs substantial support.' },
    { value: 2, label: 'Developing', description: 'Learner shows progress but is not yet secure.' },
    { value: 3, label: 'Secure', description: 'Learner demonstrates expected competency.' },
  ],
}

export const PERCENTAGE_SCHEME: GradingScheme = {
  scale: 'percentage',
  label: 'Percentage 0-100',
}

export function getGradeForLevel(score: number, level: SchoolLevel, customScales?: Array<{ label: string; min: number; max: number }>): string {
  if (customScales && customScales.length > 0) {
    const match = customScales.find(s => score >= s.min && score <= s.max)
    if (match) return match.label
  }
  const fromSchemes = findGradeFromSchemes(score);
  if (fromSchemes) return fromSchemes;

  switch (level) {
    case 'primary': return getPLEGrade(score)
    case 'secondary_o': return getUCEGrade(score)
    case 'secondary_a': return getUACEGrade(score)
    default: return getPLEGrade(score)
  }
}

export function isCompetencyScale(level: string): boolean {
  return ['secondary_competency', 'competency', 'lsc'].includes(level)
}

export function getCompetencyLabel(value: CompetencyValue): string {
  const found = COMPETENCY_SCHEME.values?.find((item) => item.value === value)
  return found?.label || 'Unknown'
}

export function validateCompetencyScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 3
}

export function getGradeOutcome(
  value: number,
  options?: { level?: SchoolLevel | string; scale?: GradingScale; customScales?: Array<{ label: string; min: number; max: number }> }
): { grade: string; scheme: GradingScale } {
  if (options?.scale === 'competency' || isCompetencyScale(options?.level || '')) {
    return {
      grade: validateCompetencyScore(value) ? getCompetencyLabel(value as CompetencyValue) : 'Invalid competency score',
      scheme: 'competency',
    }
  }

  return {
    grade: getGradeForLevel(value, (options?.level as SchoolLevel) || 'primary', options?.customScales),
    scheme: 'percentage',
  }
}

// ============================================
// EXAM SCORE → GRADES SYNC HELPER
// ============================================

export interface ExamScoreMapping {
  student_id: string;
  subject_id: string;
  class_id: string;
  score: number;
  term: number;
  academic_year: string;
  recorded_by?: string;
}

export function mapExamScoreToGrade(
  examScore: ExamScoreMapping,
): {
  student_id: string;
  subject_id: string;
  class_id: string;
  assessment_type: string;
  score: number;
  max_score: number;
  term: number;
  academic_year: string;
  recorded_by?: string;
} {
  return {
    student_id: examScore.student_id,
    subject_id: examScore.subject_id,
    class_id: examScore.class_id,
    assessment_type: 'exam',
    score: examScore.score,
    max_score: 100,
    term: examScore.term,
    academic_year: examScore.academic_year,
    recorded_by: examScore.recorded_by,
  };
}
