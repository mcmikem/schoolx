import { resolveActiveStep } from '@/components/dashboard/WorkflowGuide'

describe('WorkflowGuide step resolution', () => {
  it('defaults to first step for dashboard root', () => {
    expect(resolveActiveStep('/dashboard')).toBe(0)
  })

  it('maps attendance pages to step 2', () => {
    expect(resolveActiveStep('/dashboard/attendance')).toBe(1)
    expect(resolveActiveStep('/dashboard/attendance/today')).toBe(1)
  })

  it('maps fees pages to step 3', () => {
    expect(resolveActiveStep('/dashboard/fees')).toBe(2)
    expect(resolveActiveStep('/dashboard/fees/lookup')).toBe(2)
  })

  it('maps reports pages to final step', () => {
    expect(resolveActiveStep('/dashboard/reports')).toBe(3)
  })

  it('handles null pathname safely', () => {
    expect(resolveActiveStep(null)).toBe(0)
  })
})
