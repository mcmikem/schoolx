export interface TemplateClass {
  name: string
  level: string
}

export interface TemplateSubject {
  name: string
  code: string
  level: 'primary' | 'secondary' | 'both'
  is_compulsory: boolean
}

export const PRIMARY_TEMPLATE: { classes: TemplateClass[]; subjects: TemplateSubject[] } = {
  classes: [
    { name: 'P.1', level: 'P.1' },
    { name: 'P.2', level: 'P.2' },
    { name: 'P.3', level: 'P.3' },
    { name: 'P.4', level: 'P.4' },
    { name: 'P.5', level: 'P.5' },
    { name: 'P.6', level: 'P.6' },
    { name: 'P.7', level: 'P.7' },
  ],
  subjects: [
    { name: 'English', code: 'ENG', level: 'primary', is_compulsory: true },
    { name: 'Mathematics', code: 'MTC', level: 'primary', is_compulsory: true },
    { name: 'Science', code: 'SCI', level: 'primary', is_compulsory: true },
    { name: 'Social Studies', code: 'SST', level: 'primary', is_compulsory: true },
    { name: 'R.E (Religious Education)', code: 'RE', level: 'primary', is_compulsory: false },
    { name: 'CAP (Creative Arts & Physical Ed)', code: 'CAP', level: 'primary', is_compulsory: false },
  ]
}

export const SECONDARY_TEMPLATE: { classes: TemplateClass[]; subjects: TemplateSubject[] } = {
  classes: [
    { name: 'S.1', level: 'S.1' },
    { name: 'S.2', level: 'S.2' },
    { name: 'S.3', level: 'S.3' },
    { name: 'S.4', level: 'S.4' },
    { name: 'S.5', level: 'S.5' },
    { name: 'S.6', level: 'S.6' },
  ],
  subjects: [
    { name: 'Mathematics', code: 'MTC', level: 'secondary', is_compulsory: true },
    { name: 'English Language', code: 'ENG', level: 'secondary', is_compulsory: true },
    { name: 'Biology', code: 'BIO', level: 'secondary', is_compulsory: true },
    { name: 'Chemistry', code: 'CHE', level: 'secondary', is_compulsory: true },
    { name: 'Physics', code: 'PHY', level: 'secondary', is_compulsory: true },
    { name: 'Geography', code: 'GEO', level: 'secondary', is_compulsory: true },
    { name: 'History', code: 'HIS', level: 'secondary', is_compulsory: true },
    { name: 'Commerce', code: 'COM', level: 'secondary', is_compulsory: false },
    { name: 'Entrepreneurship', code: 'ENT', level: 'secondary', is_compulsory: false },
    { name: 'Literature in English', code: 'LIT', level: 'secondary', is_compulsory: false },
    { name: 'Fine Art', code: 'ART', level: 'secondary', is_compulsory: false },
    { name: 'Computer Studies', code: 'ICT', level: 'secondary', is_compulsory: false },
    { name: 'Agric. Principles', code: 'AGR', level: 'secondary', is_compulsory: false },
  ]
}
