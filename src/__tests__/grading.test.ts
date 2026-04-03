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
  })

  describe('getUCEDivision', () => {
    test('calculates division from subject grades', () => {
      // Best 8 subjects: C4(4), C3(3), C3(3), D2(2), D2(2), D1(1), D1(1), C4(4) = 20
      const grades = ['C4', 'C3', 'C3', 'D2', 'D2', 'D1', 'D1', 'C4']
      expect(getUCEDivision(grades)).toBe('Division I')
    })

    test('returns Division II for good grades', () => {
      const grades = ['C4', 'C4', 'C4', 'C4', 'C5', 'C5', 'C5', 'C6']
      // 4+4+4+4+5+5+5+6 = 37 (Division II <= 44)
      expect(getUCEDivision(grades)).toBe('Division II')
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
      const principal = ['A', 'B', 'C'] // 6+5+4 = 15
      const subsidiary = ['B'] // 5
      const result = getUACEPoints(principal, subsidiary)
      
      expect(result.points).toBe(20)
      expect(result.division).toBe('Division I')
    })

    test('handles failing grades', () => {
      const principal = ['F', 'F', 'F'] // 0+0+0 = 0
      const subsidiary = ['O'] // 1
      const result = getUACEPoints(principal, subsidiary)
      
      expect(result.points).toBe(1)
      expect(result.division).toBe('Ungraded') // 1 point is less than 6
    })

    test('returns Ungraded for zero points', () => {
      const principal = ['F', 'F', 'F'] // 0
      const subsidiary = ['F'] // 0
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
    })
  })

  describe('getUNEBDivision', () => {
    test('defaults to PLE division', () => {
      expect(getUNEBDivision(8)).toBe('Division I')
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
})
