import {
  getPLEGrade,
  getPLEDivision,
  getUCEGrade,
  getUCEDivision,
  getUACEGrade,
  getUACEPoints,
  getUNEBGrade,
  getUNEBDivision,
  getGradeColor,
  getDivisionColor,
  getGradeForLevel,
  getCompetencyLabel,
  validateCompetencyScore,
  getGradeOutcome,
  calculateSubjectTotal,
  getWeightConfig,
  setWeightConfig,
  setGradingSchemes,
  clearGradingCache,
  mapExamScoreToGrade,
  GradingSchemeRecord,
  WeightConfig,
} from '../lib/grading'

describe('Grading - PLE (Primary Leaving Examination)', () => {
  describe('getPLEGrade', () => {
    test('returns D1 for 80+', () => {
      expect(getPLEGrade(80)).toBe('D1')
      expect(getPLEGrade(95)).toBe('D1')
    })

    test('returns D2 for 70-79', () => {
      expect(getPLEGrade(70)).toBe('D2')
      expect(getPLEGrade(79)).toBe('D2')
    })

    test('returns C3-C6 for 50-69', () => {
      expect(getPLEGrade(65)).toBe('C3')
      expect(getPLEGrade(60)).toBe('C4')
      expect(getPLEGrade(55)).toBe('C5')
      expect(getPLEGrade(50)).toBe('C6')
    })

    test('returns P7-P8 for 40-49', () => {
      expect(getPLEGrade(45)).toBe('P7')
      expect(getPLEGrade(40)).toBe('P8')
    })

    test('returns F9 for below 40', () => {
      expect(getPLEGrade(39)).toBe('F9')
      expect(getPLEGrade(0)).toBe('F9')
    })

    test('handles all grade boundaries', () => {
      expect(getPLEGrade(100)).toBe('D1')
      expect(getPLEGrade(80)).toBe('D1')
      expect(getPLEGrade(79)).toBe('D2')
      expect(getPLEGrade(70)).toBe('D2')
      expect(getPLEGrade(69)).toBe('C3')
      expect(getPLEGrade(65)).toBe('C3')
      expect(getPLEGrade(64)).toBe('C4')
      expect(getPLEGrade(60)).toBe('C4')
      expect(getPLEGrade(59)).toBe('C5')
      expect(getPLEGrade(55)).toBe('C5')
      expect(getPLEGrade(54)).toBe('C6')
      expect(getPLEGrade(50)).toBe('C6')
      expect(getPLEGrade(49)).toBe('P7')
      expect(getPLEGrade(45)).toBe('P7')
      expect(getPLEGrade(44)).toBe('P8')
      expect(getPLEGrade(40)).toBe('P8')
      expect(getPLEGrade(39)).toBe('F9')
      expect(getPLEGrade(0)).toBe('F9')
    })
  })

  describe('getPLEDivision', () => {
    test('returns Division I for aggregate <= 12', () => {
      expect(getPLEDivision(4)).toBe('Division I')
      expect(getPLEDivision(12)).toBe('Division I')
    })

    test('returns Division II for aggregate 13-24', () => {
      expect(getPLEDivision(13)).toBe('Division II')
      expect(getPLEDivision(24)).toBe('Division II')
    })

    test('returns Division III for aggregate 25-28', () => {
      expect(getPLEDivision(25)).toBe('Division III')
      expect(getPLEDivision(28)).toBe('Division III')
    })

    test('returns Division IV for aggregate 29-32', () => {
      expect(getPLEDivision(29)).toBe('Division IV')
      expect(getPLEDivision(32)).toBe('Division IV')
    })

    test('returns Ungraded for aggregate > 32', () => {
      expect(getPLEDivision(33)).toBe('Ungraded')
      expect(getPLEDivision(36)).toBe('Ungraded')
    })
  })
})

describe('Grading - UCE (O-Level)', () => {
  describe('getUCEGrade', () => {
    test('returns correct grades', () => {
      expect(getUCEGrade(85)).toBe('D1')
      expect(getUCEGrade(75)).toBe('D2')
      expect(getUCEGrade(65)).toBe('C3')
      expect(getUCEGrade(55)).toBe('C5')
      expect(getUCEGrade(35)).toBe('F9')
    })

    test('handles all grade boundaries', () => {
      expect(getUCEGrade(80)).toBe('D1')
      expect(getUCEGrade(70)).toBe('D2')
      expect(getUCEGrade(65)).toBe('C3')
      expect(getUCEGrade(60)).toBe('C4')
      expect(getUCEGrade(55)).toBe('C5')
      expect(getUCEGrade(50)).toBe('C6')
      expect(getUCEGrade(45)).toBe('P7')
      expect(getUCEGrade(40)).toBe('P8')
      expect(getUCEGrade(39)).toBe('F9')
    })
  })

  describe('getUCEDivision', () => {
    test('calculates division from subject grades', () => {
      const grades = ['C4', 'C3', 'C3', 'D2', 'D2', 'D1', 'D1', 'C4']
      expect(getUCEDivision(grades)).toBe('Division I')
    })

    test('returns Division II for good grades', () => {
      const grades = ['C4', 'C4', 'C4', 'C4', 'C5', 'C5', 'C5', 'C6']
      expect(getUCEDivision(grades)).toBe('Division II')
    })

    test('returns Division III for mixed grades', () => {
      const grades = ['C5', 'C5', 'C5', 'C6', 'C6', 'C6', 'P7', 'P7']
      expect(getUCEDivision(grades)).toBe('Division III')
    })
  })
})

describe('Grading - UACE (A-Level)', () => {
  describe('getUACEGrade', () => {
    test('returns correct grades', () => {
      expect(getUACEGrade(80)).toBe('A')
      expect(getUACEGrade(70)).toBe('B')
      expect(getUACEGrade(60)).toBe('C')
      expect(getUACEGrade(50)).toBe('D')
      expect(getUACEGrade(40)).toBe('E')
      expect(getUACEGrade(35)).toBe('O')
      expect(getUACEGrade(30)).toBe('F')
    })
  })

  describe('getUACEPoints', () => {
    test('calculates points correctly', () => {
      const principal = ['A', 'B', 'C']
      const subsidiary = ['B']
      const result = getUACEPoints(principal, subsidiary)

      expect(result.points).toBe(20)
      expect(result.division).toBe('Division I')
    })

    test('handles failing grades', () => {
      const principal = ['F', 'F', 'F']
      const subsidiary = ['O']
      const result = getUACEPoints(principal, subsidiary)

      expect(result.points).toBe(1)
      expect(result.division).toBe('Ungraded')
    })

    test('returns Ungraded for zero points', () => {
      const principal = ['F', 'F', 'F']
      const subsidiary = ['F']
      const result = getUACEPoints(principal, subsidiary)

      expect(result.points).toBe(0)
      expect(result.division).toBe('Ungraded')
    })
  })
})

describe('Grading Utilities', () => {
  describe('getUNEBGrade', () => {
    test('defaults to PLE grading', () => {
      expect(getUNEBGrade(85)).toBe('D1')
      expect(getUNEBGrade(35)).toBe('F9')
    })

    test('uses grading_schemes when provided', () => {
      const schemes: GradingSchemeRecord[] = [
        { id: '1', school_id: 's1', name: 'Custom', subject_id: null, min_score: 90, max_score: 100, grade: 'A', points: 1, division: 'Distinction', is_default: true, created_at: '' },
        { id: '2', school_id: 's1', name: 'Custom', subject_id: null, min_score: 75, max_score: 89, grade: 'B', points: 2, division: 'Merit', is_default: false, created_at: '' },
      ]
      expect(getUNEBGrade(95, schemes)).toBe('A')
      expect(getUNEBGrade(80, schemes)).toBe('B')
    })

    test('falls back to hardcoded when no scheme matches', () => {
      const schemes: GradingSchemeRecord[] = [
        { id: '1', school_id: 's1', name: 'Custom', subject_id: null, min_score: 90, max_score: 100, grade: 'A', points: 1, division: 'Distinction', is_default: true, created_at: '' },
      ]
      expect(getUNEBGrade(50, schemes)).toBe('C6') // Fallback to PLE
    })
  })

  describe('getUNEBDivision', () => {
    test('defaults to PLE division', () => {
      expect(getUNEBDivision(8)).toBe('Division I')
    })

    test('uses grading_schemes when provided', () => {
      const schemes: GradingSchemeRecord[] = [
        { id: '1', school_id: 's1', name: 'Custom', subject_id: null, min_score: 80, max_score: 100, grade: 'A', points: 1, division: 'Distinction', is_default: true, created_at: '' },
      ]
      expect(getUNEBDivision(90, schemes)).toBe('Distinction')
    })
  })

  describe('getGradeColor', () => {
    test('returns correct colors for grades', () => {
      expect(getGradeColor('D1')).toBe('text-green-600')
      expect(getGradeColor('F9')).toBe('text-red-500')
      expect(getGradeColor('A')).toBe('text-green-600')
      expect(getGradeColor('F')).toBe('text-red-500')
      expect(getGradeColor('unknown')).toBe('text-gray-500')
    })
  })

  describe('getDivisionColor', () => {
    test('returns correct colors for divisions', () => {
      expect(getDivisionColor('Division I')).toBe('text-green-600')
      expect(getDivisionColor('Division II')).toBe('text-blue-600')
      expect(getDivisionColor('Division III')).toBe('text-yellow-600')
      expect(getDivisionColor('Division IV')).toBe('text-orange-500')
      expect(getDivisionColor('Ungraded')).toBe('text-red-500')
    })
  })

  describe('getGradeForLevel', () => {
    test('returns PLE grades for primary', () => {
      expect(getGradeForLevel(85, 'primary')).toBe('D1')
    })

    test('returns UCE grades for secondary_o', () => {
      expect(getGradeForLevel(85, 'secondary_o')).toBe('D1')
    })

    test('returns UACE grades for secondary_a', () => {
      expect(getGradeForLevel(85, 'secondary_a')).toBe('A')
    })

    test('defaults to PLE for unknown level', () => {
      expect(getGradeForLevel(85, 'unknown' as any)).toBe('D1')
    })
  })

  describe('competency grading support', () => {
    test('returns competency labels for 1-3 scores', () => {
      expect(getCompetencyLabel(1)).toBe('Emerging')
      expect(getCompetencyLabel(2)).toBe('Developing')
      expect(getCompetencyLabel(3)).toBe('Secure')
    })

    test('validates competency score range', () => {
      expect(validateCompetencyScore(1)).toBe(true)
      expect(validateCompetencyScore(3)).toBe(true)
      expect(validateCompetencyScore(0)).toBe(false)
      expect(validateCompetencyScore(4)).toBe(false)
    })

    test('switches grade outcome to competency mode when configured', () => {
      expect(getGradeOutcome(3, { scale: 'competency' })).toEqual({
        grade: 'Secure',
        scheme: 'competency',
      })
      expect(getGradeOutcome(85, { level: 'primary' })).toEqual({
        grade: 'D1',
        scheme: 'percentage',
      })
    })
  })

  describe('calculateSubjectTotal', () => {
    test('sums all CA and exam scores', () => {
      expect(calculateSubjectTotal(8, 7, 9, 6, 5, 60)).toBe(95)
    })

    test('handles zeros', () => {
      expect(calculateSubjectTotal(0, 0, 0, 0, 0, 0)).toBe(0)
    })

    test('handles max values', () => {
      expect(calculateSubjectTotal(10, 10, 10, 10, 10, 70)).toBe(120)
    })
  })

  describe('getWeightConfig', () => {
    beforeEach(() => {
      clearGradingCache()
    })

    test('returns default weights when no settings', () => {
      const config = getWeightConfig()
      expect(config.ca1).toBe(10)
      expect(config.ca2).toBe(10)
      expect(config.ca3).toBe(10)
      expect(config.ca4).toBe(10)
      expect(config.project).toBe(10)
      expect(config.exam).toBe(50)
    })

    test('parses weights from school settings', () => {
      const settings = {
        grade_weights: JSON.stringify({ ca1: 5, ca2: 5, ca3: 10, ca4: 5, project: 5, exam: 70 }),
      }
      const config = getWeightConfig(settings)
      expect(config.ca1).toBe(5)
      expect(config.ca2).toBe(5)
      expect(config.ca3).toBe(10)
      expect(config.exam).toBe(70)
    })

    test('falls back to default for missing weights in settings', () => {
      const settings = {
        grade_weights: JSON.stringify({ exam: 70 }),
      }
      const config = getWeightConfig(settings)
      expect(config.exam).toBe(70)
      expect(config.ca1).toBe(10) // default
      expect(config.ca2).toBe(10) // default
    })

    test('uses cached weight config when set', () => {
      const custom: WeightConfig = { ca1: 20, ca2: 20, ca3: 20, ca4: 0, project: 0, exam: 40 }
      setWeightConfig(custom)
      const config = getWeightConfig()
      expect(config.ca1).toBe(20)
      expect(config.exam).toBe(40)
    })

    test('returns defaults on invalid JSON', () => {
      const settings = { grade_weights: 'not-json' }
      const config = getWeightConfig(settings)
      expect(config.ca1).toBe(10)
      expect(config.exam).toBe(50)
    })
  })

  describe('setGradingSchemes / clearGradingCache', () => {
    beforeEach(() => {
      clearGradingCache()
    })

    test('setGradingSchemes and getUNEBGrade use cached schemes', () => {
      const schemes: GradingSchemeRecord[] = [
        { id: '1', school_id: 's1', name: 'Custom', subject_id: null, min_score: 80, max_score: 100, grade: 'A+', points: 1, division: 'Excellent', is_default: true, created_at: '' },
      ]
      setGradingSchemes(schemes)
      expect(getUNEBGrade(95)).toBe('A+')
    })

    test('clearGradingCache resets to hardcoded', () => {
      const schemes: GradingSchemeRecord[] = [
        { id: '1', school_id: 's1', name: 'Custom', subject_id: null, min_score: 80, max_score: 100, grade: 'A+', points: 1, division: 'Excellent', is_default: true, created_at: '' },
      ]
      setGradingSchemes(schemes)
      clearGradingCache()
      expect(getUNEBGrade(95)).toBe('D1')
    })
  })

  describe('mapExamScoreToGrade', () => {
    test('maps exam score to grade record', () => {
      const result = mapExamScoreToGrade({
        student_id: 's1',
        subject_id: 'sub1',
        class_id: 'c1',
        score: 85,
        term: 1,
        academic_year: '2026',
        recorded_by: 'teacher1',
      })
      expect(result).toEqual({
        student_id: 's1',
        subject_id: 'sub1',
        class_id: 'c1',
        assessment_type: 'exam',
        score: 85,
        max_score: 100,
        term: 1,
        academic_year: '2026',
        recorded_by: 'teacher1',
      })
    })

    test('handles missing recorded_by', () => {
      const result = mapExamScoreToGrade({
        student_id: 's1',
        subject_id: 'sub1',
        class_id: 'c1',
        score: 75,
        term: 2,
        academic_year: '2026',
      })
      expect(result.assessment_type).toBe('exam')
      expect(result.recorded_by).toBeUndefined()
    })
  })
})
