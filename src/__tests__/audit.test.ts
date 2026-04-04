import { buildAuditDiff } from '../lib/operations'

describe('Audit support', () => {
  test('buildAuditDiff reports no changes for identical records', () => {
    expect(buildAuditDiff({ score: 80 }, { score: 80 })).toEqual([])
  })

  test('buildAuditDiff captures lock-state changes', () => {
    expect(
      buildAuditDiff(
        { ca_locked: false, locked_by: null },
        { ca_locked: true, locked_by: 'teacher-1' }
      )
    ).toEqual([
      { field: 'ca_locked', before: false, after: true },
      { field: 'locked_by', before: null, after: 'teacher-1' },
    ])
  })
})
