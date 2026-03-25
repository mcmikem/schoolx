// UNEB Grading System - Official thresholds
// This ensures consistent grading across all pages

export function getUNEBGrade(score: number): string {
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

export function getUNEBDivision(avg: number): string {
  if (avg >= 80) return 'Division I'
  if (avg >= 60) return 'Division II'
  if (avg >= 40) return 'Division III'
  if (avg >= 20) return 'Division IV'
  return 'Ungraded'
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'D1': return 'text-green-600'
    case 'D2': return 'text-green-500'
    case 'C3': return 'text-blue-600'
    case 'C4': return 'text-blue-500'
    case 'C5': return 'text-yellow-600'
    case 'C6': return 'text-yellow-500'
    case 'P7': return 'text-orange-500'
    case 'P8': return 'text-orange-400'
    case 'F9': return 'text-red-500'
    default: return 'text-gray-500'
  }
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
