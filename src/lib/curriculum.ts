// Uganda Curriculum Subjects
// Based on NCDC 2024/2025 curriculum

export interface CurriculumSubject {
  id: string
  name: string
  code: string
  level: 'primary' | 'secondary' | 'both'
  category: string
  is_compulsory: boolean
  streams?: string[] // For secondary (Science, Arts, Commercial)
}

// Primary School Subjects (P1-P7)
export const primarySubjects: CurriculumSubject[] = [
  // P1-P3
  { id: 'p-001', name: 'English', code: 'ENG', level: 'primary', category: 'Language', is_compulsory: true },
  { id: 'p-002', name: 'Mathematics', code: 'MTC', level: 'primary', category: 'Numeracy', is_compulsory: true },
  { id: 'p-003', name: 'Integrated Science', code: 'SCI', level: 'primary', category: 'Science', is_compulsory: true },
  { id: 'p-004', name: 'Social Studies', code: 'SST', level: 'primary', category: 'Social', is_compulsory: true },
  { id: 'p-005', name: 'Religious Education', code: 'CRE', level: 'primary', category: 'Religious', is_compulsory: true },
  { id: 'p-006', name: 'Physical Education', code: 'PE', level: 'primary', category: 'Physical', is_compulsory: true },
  // P4-P7 (additional)
  { id: 'p-007', name: 'Local Language', code: 'LNG', level: 'primary', category: 'Language', is_compulsory: false },
  { id: 'p-008', name: 'Art & Craft', code: 'ACD', level: 'primary', category: 'Creative', is_compulsory: false },
  { id: 'p-009', name: 'Music', code: 'MUS', level: 'primary', category: 'Creative', is_compulsory: false },
  { id: 'p-010', name: 'Agriculture', code: 'AGR', level: 'primary', category: 'Practical', is_compulsory: false },
]

// Lower Secondary Subjects (S1-S4) - New Competency-Based Curriculum
export const lowerSecondarySubjects: CurriculumSubject[] = [
  // Compulsory (Core)
  { id: 's-001', name: 'English', code: 'ENG', level: 'secondary', category: 'Language', is_compulsory: true },
  { id: 's-002', name: 'Mathematics', code: 'MTC', level: 'secondary', category: 'Science', is_compulsory: true },
  { id: 's-003', name: 'Biology', code: 'BIO', level: 'secondary', category: 'Science', is_compulsory: false, streams: ['Science'] },
  { id: 's-004', name: 'Chemistry', code: 'CHEM', level: 'secondary', category: 'Science', is_compulsory: false, streams: ['Science'] },
  { id: 's-005', name: 'Physics', code: 'PHY', level: 'secondary', category: 'Science', is_compulsory: false, streams: ['Science'] },
  { id: 's-006', name: 'Geography', code: 'GEO', level: 'secondary', category: 'Social', is_compulsory: false },
  { id: 's-007', name: 'History', code: 'HIS', level: 'secondary', category: 'Social', is_compulsory: false },
  { id: 's-008', name: 'Christian Religious Education', code: 'CRE', level: 'secondary', category: 'Religious', is_compulsory: false },
  { id: 's-009', name: 'Islamic Religious Education', code: 'IRE', level: 'secondary', category: 'Religious', is_compulsory: false },
  { id: 's-010', name: 'Computer Studies', code: 'CST', level: 'secondary', category: 'Technical', is_compulsory: true },
  { id: 's-011', name: 'Entrepreneurship Education', code: 'ENT', level: 'secondary', category: 'Business', is_compulsory: true },
  { id: 's-012', name: 'Literature in English', code: 'LIT', level: 'secondary', category: 'Language', is_compulsory: false },
  { id: 's-013', name: 'French', code: 'FRE', level: 'secondary', category: 'Language', is_compulsory: false },
  { id: 's-014', name: 'Kiswahili', code: 'KIS', level: 'secondary', category: 'Language', is_compulsory: false },
  { id: 's-015', name: 'Fine Art', code: 'ART', level: 'secondary', category: 'Creative', is_compulsory: false },
  { id: 's-016', name: 'Music', code: 'MUS', level: 'secondary', category: 'Creative', is_compulsory: false },
  { id: 's-017', name: 'Physical Education', code: 'PE', level: 'secondary', category: 'Physical', is_compulsory: true },
  { id: 's-018', name: 'Agriculture', code: 'AGR', level: 'secondary', category: 'Practical', is_compulsory: false },
  { id: 's-019', name: 'Food & Nutrition', code: 'FNT', level: 'secondary', category: 'Practical', is_compulsory: false },
  { id: 's-020', name: 'Metal Work', code: 'MTW', level: 'secondary', category: 'Technical', is_compulsory: false },
  { id: 's-021', name: 'Wood Work', code: 'WDK', level: 'secondary', category: 'Technical', is_compulsory: false },
  { id: 's-022', name: 'Technical Drawing', code: 'TDG', level: 'secondary', category: 'Technical', is_compulsory: false },
]

// Combined list
export const allSubjects = [...primarySubjects, ...lowerSecondarySubjects]

// Helper functions
export function getSubjectsByLevel(level: 'primary' | 'secondary'): CurriculumSubject[] {
  return allSubjects.filter(s => s.level === level || s.level === 'both')
}

export function getPrimarySubjects(): CurriculumSubject[] {
  return primarySubjects
}

export function getSecondarySubjects(): CurriculumSubject[] {
  return lowerSecondarySubjects
}

export function getSubjectsByCategory(category: string): CurriculumSubject[] {
  return allSubjects.filter(s => s.category === category)
}

export function getCompulsorySubjects(level: 'primary' | 'secondary'): CurriculumSubject[] {
  return allSubjects.filter(s => (s.level === level || s.level === 'both') && s.is_compulsory)
}

// Get subjects for auto-seed (default set for new schools)
export function getDefaultSubjects(schoolType: 'primary' | 'secondary' | 'combined' = 'primary'): CurriculumSubject[] {
  if (schoolType === 'primary') {
    return primarySubjects.filter(s => s.is_compulsory || ['ENG', 'MTC', 'SCI', 'SST', 'CRE'].includes(s.code))
  } else if (schoolType === 'secondary') {
    return lowerSecondarySubjects.filter(s => s.is_compulsory || ['ENG', 'MTC', 'BIO', 'CHEM', 'PHY', 'CST', 'ENT'].includes(s.code))
  } else {
    return allSubjects.filter(s => s.is_compulsory)
  }
}
