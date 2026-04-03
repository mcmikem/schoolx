import { 
  SECONDARY_EXAM_TYPES, 
  PRIMARY_EXAM_TYPES,
  calculateWeightedGrade,
  DEFAULT_SECONDARY_WEIGHTS,
  CANDIDATE_EXAM_WEIGHTS,
  getExamTypeLabel,
  getExamColor,
  ExamConfig
} from '../lib/exams'

describe('Exams Module', () => {
  describe('SECONDARY_EXAM_TYPES', () => {
    test('has required exam types', () => {
      const types = SECONDARY_EXAM_TYPES.map(e => e.type)
      expect(types).toContain('class_test')
      expect(types).toContain('bot')
      expect(types).toContain('mid_term')
      expect(types).toContain('eot')
    })

    test('all exams have valid weights', () => {
      SECONDARY_EXAM_TYPES.forEach(exam => {
        expect(exam.weight).toBeGreaterThan(0)
        expect(exam.weight).toBeLessThanOrEqual(100)
      })
    })

    test('all exams are active by default', () => {
      SECONDARY_EXAM_TYPES.forEach(exam => {
        expect(exam.isActive).toBe(true)
      })
    })

    test('has short names', () => {
      SECONDARY_EXAM_TYPES.forEach(exam => {
        expect(exam.shortName).toBeDefined()
        expect(exam.shortName.length).toBeLessThanOrEqual(5)
      })
    })
  })

  describe('PRIMARY_EXAM_TYPES', () => {
    test('has CA exams for continuous assessment', () => {
      const caExams = PRIMARY_EXAM_TYPES.filter(e => e.id.startsWith('ca'))
      expect(caExams.length).toBe(4)
    })

    test('has end of term exam', () => {
      const eot = PRIMARY_EXAM_TYPES.find(e => e.id === 'eot')
      expect(eot).toBeDefined()
      expect(eot?.weight).toBe(30)
    })
  })

  describe('calculateWeightedGrade', () => {
    test('calculates correct weighted grade', () => {
      const scores = {
        class_test: 80,
        bot: 75,
        mid_term: 85,
        eot: 90
      }
      
      const result = calculateWeightedGrade(scores, SECONDARY_EXAM_TYPES)
      
      expect(result.total).toBeGreaterThan(0)
      expect(result.breakdown).toBeDefined()
      expect(result.breakdown.length).toBe(SECONDARY_EXAM_TYPES.length)
    })

    test('handles missing scores', () => {
      const scores = { class_test: 80 }
      const result = calculateWeightedGrade(scores, SECONDARY_EXAM_TYPES)
      
      expect(result.total).toBeGreaterThanOrEqual(0)
    })

    test('returns zero for empty scores', () => {
      const result = calculateWeightedGrade({}, SECONDARY_EXAM_TYPES)
      expect(result.total).toBe(0)
    })

    test('calculates contributions correctly', () => {
      const configs: ExamConfig[] = [
        { id: 'test1', name: 'Test 1', shortName: 'T1', type: 'class_test', weight: 50, maxScore: 100, isActive: true },
        { id: 'test2', name: 'Test 2', shortName: 'T2', type: 'class_test', weight: 50, maxScore: 100, isActive: true },
      ]
      
      const scores = { test1: 100, test2: 100 }
      const result = calculateWeightedGrade(scores, configs)
      
      expect(result.total).toBe(100)
      expect(result.breakdown[0].contribution).toBe(50)
      expect(result.breakdown[1].contribution).toBe(50)
    })
  })

  describe('DEFAULT_SECONDARY_WEIGHTS', () => {
    test('weights add up to 100', () => {
      const total = DEFAULT_SECONDARY_WEIGHTS.ca + DEFAULT_SECONDARY_WEIGHTS.bot + 
                   DEFAULT_SECONDARY_WEIGHTS.mid_term + DEFAULT_SECONDARY_WEIGHTS.eot
      expect(total).toBe(100)
    })

    test('eot has highest weight', () => {
      expect(DEFAULT_SECONDARY_WEIGHTS.eot).toBe(50)
    })
  })

  describe('CANDIDATE_EXAM_WEIGHTS', () => {
    test('includes mock exams for candidates', () => {
      expect(CANDIDATE_EXAM_WEIGHTS.mock).toBeDefined()
    })

    test('weights add up to 100', () => {
      const total = CANDIDATE_EXAM_WEIGHTS.class_test + CANDIDATE_EXAM_WEIGHTS.bot + 
                   CANDIDATE_EXAM_WEIGHTS.saturday + CANDIDATE_EXAM_WEIGHTS.mid_term + 
                   CANDIDATE_EXAM_WEIGHTS.mock + CANDIDATE_EXAM_WEIGHTS.eot
      expect(total).toBe(100)
    })
  })

  describe('getExamTypeLabel', () => {
    test('returns correct labels', () => {
      expect(getExamTypeLabel('class_test')).toBe('Class Test')
      expect(getExamTypeLabel('bot')).toBe('Beginning of Term')
      expect(getExamTypeLabel('mid_term')).toBe('Mid Term')
      expect(getExamTypeLabel('eot')).toBe('End of Term')
      expect(getExamTypeLabel('mock')).toBe('Mock Exam')
    })
  })

  describe('getExamColor', () => {
    test('returns color for each type', () => {
      const types = ['class_test', 'bot', 'mid_term', 'saturday', 'eot', 'mock'] as const
      types.forEach(type => {
        expect(getExamColor(type)).toMatch(/^#/)
      })
    })
  })
})
