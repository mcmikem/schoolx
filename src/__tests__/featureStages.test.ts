import { FEATURE_STAGES, DEFAULT_FEATURE_STAGE, canUseModule, FeatureStage, ModuleKey } from '../lib/featureStages'

describe('Feature Stages', () => {
  describe('FEATURE_STAGES', () => {
    test('core stage has required modules', () => {
      expect(FEATURE_STAGES.core.modules).toContain('dashboard')
      expect(FEATURE_STAGES.core.modules).toContain('attendance')
      expect(FEATURE_STAGES.core.modules).toContain('communications')
    })

    test('academic stage has marks and exams', () => {
      expect(FEATURE_STAGES.academic.modules).toContain('marks')
      expect(FEATURE_STAGES.academic.modules).toContain('exam')
      expect(FEATURE_STAGES.academic.modules).toContain('reports')
    })

    test('finance stage has finance and operations', () => {
      expect(FEATURE_STAGES.finance.modules).toContain('finance')
      expect(FEATURE_STAGES.finance.modules).toContain('operations')
    })

    test('full stage has all modules', () => {
      const fullModules = FEATURE_STAGES.full.modules
      expect(fullModules).toContain('parentPortal')
      expect(fullModules).toContain('dorm')
      expect(fullModules).toContain('health')
      expect(fullModules).toContain('analytics')
    })

    test('each stage has label and description', () => {
      const stages: FeatureStage[] = ['core', 'academic', 'finance', 'full']
      stages.forEach(stage => {
        expect(FEATURE_STAGES[stage].label).toBeDefined()
        expect(FEATURE_STAGES[stage].description).toBeDefined()
        expect(FEATURE_STAGES[stage].modules).toBeDefined()
      })
    })
  })

  describe('canUseModule', () => {
    test('core stage allows core modules only', () => {
      expect(canUseModule('core', 'dashboard')).toBe(true)
      expect(canUseModule('core', 'attendance')).toBe(true)
      expect(canUseModule('core', 'marks')).toBe(false)
      expect(canUseModule('core', 'finance')).toBe(false)
    })

    test('academic stage allows academic modules', () => {
      expect(canUseModule('academic', 'marks')).toBe(true)
      expect(canUseModule('academic', 'exam')).toBe(true)
      expect(canUseModule('academic', 'reports')).toBe(true)
    })

    test('finance stage allows finance modules', () => {
      expect(canUseModule('finance', 'finance')).toBe(true)
      expect(canUseModule('finance', 'operations')).toBe(true)
    })

    test('full stage allows all modules', () => {
      const allModules: ModuleKey[] = ['dashboard', 'attendance', 'marks', 'exam', 'parentPortal', 'dorm', 'health', 'analytics']
      allModules.forEach(module => {
        expect(canUseModule('full', module)).toBe(true)
      })
    })

    test('defaults to core for undefined stage', () => {
      expect(canUseModule(undefined, 'dashboard')).toBe(true)
      expect(canUseModule(undefined, 'attendance')).toBe(true)
      expect(canUseModule(undefined, 'parentPortal')).toBe(false)
    })

    test('handles null stage same as undefined', () => {
      expect(canUseModule(null as any, 'dashboard')).toBe(true)
    })
  })

  describe('DEFAULT_FEATURE_STAGE', () => {
    test('defaults to core', () => {
      expect(DEFAULT_FEATURE_STAGE).toBe('core')
    })
  })

  describe('Stage Progression', () => {
    test('core is smallest, full is largest', () => {
      expect(FEATURE_STAGES.core.modules.length).toBeLessThan(FEATURE_STAGES.full.modules.length)
      expect(FEATURE_STAGES.academic.modules.length).toBeGreaterThan(FEATURE_STAGES.core.modules.length)
    })

    test('each higher stage includes lower stage modules', () => {
      const coreModules = FEATURE_STAGES.core.modules
      const academicModules = FEATURE_STAGES.academic.modules
      coreModules.forEach(module => {
        expect(academicModules).toContain(module)
      })
    })
  })
})
