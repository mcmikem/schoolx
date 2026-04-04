import {
  buildRolloverPreview,
  recommendBulkPromotion,
  calculateStudentFeePosition,
  suggestAvailableSubstitutes,
  detectConsecutiveAbsenceAlerts,
  buildAuditDiff,
  deriveGradeWorkflowStatus,
  filterAbsenceAlertsForCooldown,
} from '../lib/operations'

describe('Academic rollover logic', () => {
  test('builds a year-end rollover preview with promotions, graduations, and entry classes', () => {
    const result = buildRolloverPreview({
      academicYear: '2026',
      currentTerm: 3,
      schoolType: 'primary',
      students: [
        { id: '1', status: 'active', class_id: 'c1', classes: { name: 'P.6' } },
        { id: '2', status: 'active', class_id: 'c2', classes: { name: 'P.7' } },
      ],
      classes: [
        { id: 'c1', name: 'P.6', academic_year: '2026' },
        { id: 'c2', name: 'P.7', academic_year: '2026' },
      ],
    })

    expect(result.nextAcademicYear).toBe('2027')
    expect(result.nextTerm).toBe(1)
    expect(result.promotableStudentIds).toEqual(['1'])
    expect(result.graduatingStudentIds).toEqual(['2'])
    expect(result.clonedClasses).toEqual([{ from: 'P.6', to: 'P.7' }])
    expect(result.entryClassNames).toEqual(['P.1'])
  })

  test('warns when a year rollover is attempted before term three closes', () => {
    const result = buildRolloverPreview({
      academicYear: '2026',
      currentTerm: 2,
      schoolType: 'secondary',
      students: [],
      classes: [],
    })

    expect(result.warnings).toContain('Year rollover should normally happen after Term 3 closeout.')
  })
})

describe('Bulk promotion recommendations', () => {
  test('recommends promotion only for students above the passing threshold', () => {
    const result = recommendBulkPromotion([
      { studentId: 'a', averageScore: 67, passingThreshold: 50, currentClassName: 'P.6' },
      { studentId: 'b', averageScore: 42, passingThreshold: 50, currentClassName: 'P.6' },
    ])

    expect(result).toEqual([
      expect.objectContaining({ studentId: 'a', recommendedAction: 'promote', targetClassName: 'P.7' }),
      expect.objectContaining({ studentId: 'b', recommendedAction: 'repeat', targetClassName: 'P.6' }),
    ])
  })
})

describe('Financial integrity and write-offs', () => {
  test('reduces balance with bursaries and write-offs without counting fake cash income', () => {
    const result = calculateStudentFeePosition({
      feeTotal: 300000,
      openingBalance: 50000,
      payments: [{ amount_paid: 150000 }],
      adjustments: [
        { adjustment_type: 'bursary', amount: 50000 },
        { adjustment_type: 'write_off', amount: 150000 },
      ],
    })

    expect(result.totalPaid).toBe(150000)
    expect(result.totalCredits).toBe(200000)
    expect(result.balance).toBe(0)
    expect(result.status).toBe('written_off')
  })

  test('adds penalties into expected balances', () => {
    const result = calculateStudentFeePosition({
      feeTotal: 100000,
      payments: [],
      adjustments: [{ adjustment_type: 'penalty', amount: 15000 }],
    })

    expect(result.totalExpected).toBe(115000)
    expect(result.totalPenalties).toBe(15000)
  })
})

describe('Teacher substitution suggestions', () => {
  test('recommends only teachers free in the requested slot', () => {
    const result = suggestAvailableSubstitutes({
      teachers: [
        { id: 't1', full_name: 'Ms. A' },
        { id: 't2', full_name: 'Mr. B' },
        { id: 't3', full_name: 'Ms. C' },
      ],
      absentTeacherId: 't1',
      date: '2026-04-06',
      period: 2,
      timetable: [
        { teacher_id: 't2', day_of_week: 1, period_number: 2, subject_name: 'Math', class_name: 'P.4' },
      ],
      substitutions: [],
    })

    expect(result[0]).toEqual(
      expect.objectContaining({
        teacherId: 't3',
        status: 'recommended',
      })
    )
    expect(result[1]).toEqual(
      expect.objectContaining({
        teacherId: 't2',
        status: 'busy',
      })
    )
  })
})

describe('Attendance SMS escalation', () => {
  test('flags students absent for three consecutive days for SMS alerts', () => {
    const result = detectConsecutiveAbsenceAlerts({
      students: [{ id: 's1', first_name: 'Amina', last_name: 'Kato', parent_phone: '0770000000' }],
      attendance: [
        { student_id: 's1', date: '2026-04-04', status: 'absent' },
        { student_id: 's1', date: '2026-04-03', status: 'absent' },
        { student_id: 's1', date: '2026-04-02', status: 'absent' },
        { student_id: 's1', date: '2026-04-01', status: 'present' },
      ],
      trigger: { threshold_days: 3, is_active: true },
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(
      expect.objectContaining({
        studentId: 's1',
        consecutiveAbsentDays: 3,
        shouldSendSms: true,
      })
    )
    expect(result[0].smsMessage).toContain('3 consecutive day(s)')
  })

  test('suppresses repeated absence alerts within the cooldown window', () => {
    const alerts = detectConsecutiveAbsenceAlerts({
      students: [{ id: 's1', first_name: 'Amina', last_name: 'Kato', parent_phone: '0770000000' }],
      attendance: [
        { student_id: 's1', date: '2026-04-04', status: 'absent' },
        { student_id: 's1', date: '2026-04-03', status: 'absent' },
        { student_id: 's1', date: '2026-04-02', status: 'absent' },
      ],
      trigger: { threshold_days: 3, is_active: true },
    })

    const filtered = filterAbsenceAlertsForCooldown({
      alerts,
      triggerId: 'trigger-1',
      recentLogs: [
        {
          trigger_id: 'trigger-1',
          record_id: 's1',
          status: 'sent',
          sent_at: new Date().toISOString(),
        },
      ],
      cooldownHours: 24,
    })

    expect(filtered).toHaveLength(0)
  })
})

describe('Grade workflow status', () => {
  test('derives the highest workflow status across grade records', () => {
    expect(
      deriveGradeWorkflowStatus([
        { status: 'draft' },
        { status: 'approved' },
        { status: 'submitted' },
      ])
    ).toBe('approved')
  })
})

describe('Audit diffs', () => {
  test('captures changed fields for sensitive edits such as grade changes', () => {
    const result = buildAuditDiff(
      { score: 45, updated_by: 'teacher-a' },
      { score: 90, updated_by: 'teacher-b' }
    )

    expect(result).toEqual([
      { field: 'score', before: 45, after: 90 },
      { field: 'updated_by', before: 'teacher-a', after: 'teacher-b' },
    ])
  })
})
