export type ModuleKey =
  | 'dashboard'
  | 'attendance'
  | 'marks'
  | 'exam'
  | 'communications'
  | 'finance'
  | 'reports'
  | 'exports'
  | 'staff'
  | 'operations'
  | 'parentPortal'
  | 'dorm'
  | 'health'
  | 'analytics'

export type FeatureStage = 'core' | 'academic' | 'finance' | 'full'

interface FeatureStageDefinition {
  label: string
  description: string
  modules: ModuleKey[]
}

export const FEATURE_STAGES: Record<FeatureStage, FeatureStageDefinition> = {
  core: {
    label: 'Core controls',
    description: 'Attendance, student records, basic communication and the dashboards you first need.',
    modules: ['dashboard', 'attendance', 'communications', 'staff'],
  },
  academic: {
    label: 'Academic focus',
    description: 'Everything in Core plus marks, exams, reports, and UNEB support when available.',
    modules: ['dashboard', 'attendance', 'communications', 'marks', 'exam', 'reports', 'exports', 'staff'],
  },
  finance: {
    label: 'Finance & operations',
    description: 'Adds invoicing, payments, payroll, budgeting, and health/operations modules.',
    modules: ['dashboard', 'attendance', 'communications', 'finance', 'operations', 'staff', 'exports'],
  },
  full: {
    label: 'Full suite',
    description: 'Unlocks parent portal, dorm, health, analytics, and every module the plan supports.',
    modules: ['dashboard', 'attendance', 'communications', 'marks', 'exam', 'finance', 'reports', 'exports', 'staff', 'operations', 'parentPortal', 'dorm', 'health', 'analytics'],
  },
}

export const DEFAULT_FEATURE_STAGE: FeatureStage = 'core'

export function canUseModule(stage: FeatureStage | undefined, module: ModuleKey): boolean {
  const key = stage || DEFAULT_FEATURE_STAGE
  return FEATURE_STAGES[key].modules.includes(module)
}
