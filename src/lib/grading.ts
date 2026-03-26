// UNEB Grading System - Official thresholds for Uganda
// Primary (PLE), O-Level (UCE), and A-Level (UACE)

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
  // PLE uses aggregate of best 4 subjects (4-36)
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
  // UCE: Best 8 subjects determine division
  // Grade values: D1=1, D2=2, C3=3, C4=4, C5=5, C6=6, P7=7, P8=8, F9=9
  const gradeValues: Record<string, number> = {
    'D1': 1, 'D2': 2, 'C3': 3, 'C4': 4, 'C5': 5, 'C6': 6, 'P7': 7, 'P8': 8, 'F9': 9
  }
  
  const values = subjectGrades
    .map(g => gradeValues[g] || 9)
    .sort((a, b) => a - b)
    .slice(0, 8) // Best 8 subjects
  
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
  // A-Level: 3 principal subjects + 1 subsidiary (General Paper)
  // Points: A=6, B=5, C=4, D=3, E=2, O=1, F=0
  const gradePoints: Record<string, number> = {
    'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'O': 1, 'F': 0
  }
  
  const principalPoints = principalGrades
    .map(g => gradePoints[g] || 0)
    .sort((a, b) => b - a)
    .slice(0, 3) // Best 3 principal subjects
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

// Backward compatibility - defaults to PLE grading
export function getUNEBGrade(score: number): string {
  return getPLEGrade(score)
}

export function getUNEBDivision(avg: number): string {
  return getPLEDivision(avg)
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    // PLE/O-Level grades
    'D1': 'text-green-600',
    'D2': 'text-green-500',
    'C3': 'text-blue-600',
    'C4': 'text-blue-500',
    'C5': 'text-yellow-600',
    'C6': 'text-yellow-500',
    'P7': 'text-orange-500',
    'P8': 'text-orange-400',
    'F9': 'text-red-500',
    // A-Level grades
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

export function getGradeForLevel(score: number, level: SchoolLevel): string {
  switch (level) {
    case 'primary': return getPLEGrade(score)
    case 'secondary_o': return getUCEGrade(score)
    case 'secondary_a': return getUACEGrade(score)
    default: return getPLEGrade(score)
  }
}
