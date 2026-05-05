import { deepFreeze } from "./deep-freeze"

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
  | 'settings'
  | 'parentPortal'
  | 'dorm'
  | 'health'
  | 'analytics'

export type FeatureStage = 'core' | 'academic' | 'finance' | 'full'

interface FeatureStageDefinition {
  label: string
  description: string
  modules: readonly ModuleKey[]
}

export const FEATURE_STAGES: Record<FeatureStage, FeatureStageDefinition> = deepFreeze({
  core: {
    label: 'Core controls',
    description: 'Attendance, student records, staff management and basic communication.',
    modules: ['dashboard', 'attendance', 'communications', 'staff', 'settings'],
  },
  academic: {
    label: 'Academic focus',
    description: 'Everything in Core plus marks entry, exams, reports and academic tools.',
    modules: ['dashboard', 'attendance', 'communications', 'marks', 'exam', 'reports', 'exports', 'staff', 'settings'],
  },
  finance: {
    label: 'Finance & operations',
    description: 'Everything in Academic plus invoicing, payments, payroll, budgeting and operations modules.',
    modules: ['dashboard', 'attendance', 'communications', 'marks', 'exam', 'reports', 'finance', 'operations', 'health', 'staff', 'exports', 'settings'],
  },
  full: {
    label: 'Full suite',
    description: 'Unlocks parent portal, dorm, health, analytics, and every module the plan supports.',
    modules: ['dashboard', 'attendance', 'communications', 'marks', 'exam', 'finance', 'reports', 'exports', 'staff', 'operations', 'settings', 'parentPortal', 'dorm', 'health', 'analytics'],
  },
})

export const DEFAULT_FEATURE_STAGE: FeatureStage = 'core'

export function canUseModule(stage: FeatureStage | undefined, module: ModuleKey): boolean {
  const key = stage || DEFAULT_FEATURE_STAGE
  return FEATURE_STAGES[key].modules.includes(module)
}
