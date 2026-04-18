import {
  resolveCurriculumStage,
  parseStoredSubtopics,
  mapSchemeWeekFromRecord,
  buildLessonProcedure,
  splitLessonProcedure,
} from '@/lib/academics-utils'

describe('academics workflow helpers', () => {
  it('distinguishes secondary classes from upper primary', () => {
    expect(resolveCurriculumStage('P4 Blue')).toEqual({ stage: 'primary', level: 4 })
    expect(resolveCurriculumStage('S4 North')).toEqual({ stage: 'secondary', level: 4 })
    expect(resolveCurriculumStage('S6')).toEqual({ stage: 'secondary', level: 6 })
  })

  it('parses stored subtopics safely from json and plain text', () => {
    expect(parseStoredSubtopics('["Fractions","Decimals"]')).toEqual(['Fractions', 'Decimals'])
    expect(parseStoredSubtopics('Fractions\nDecimals')).toEqual(['Fractions', 'Decimals'])
    expect(parseStoredSubtopics(null)).toEqual([])
  })

  it('normalizes scheme rows using week_number from the database', () => {
    expect(
      mapSchemeWeekFromRecord({
        week_number: 3,
        topic: 'Numbers',
        subtopics: 'Whole numbers',
        objectives: 'Count and compare',
        resources: 'Counters',
      }),
    ).toEqual({
      week: 3,
      topic: 'Numbers',
      subtopics: 'Whole numbers',
      objectives: 'Count and compare',
      resources: 'Counters',
    })
  })

  it('round-trips lesson procedure sections for editing', () => {
    const procedure = buildLessonProcedure({
      introduction: 'Warm up',
      presentation: 'Teacher models',
      consolidation: 'Learners practice',
      evaluation: 'Quick quiz',
    })

    expect(splitLessonProcedure(procedure)).toEqual({
      introduction: 'Warm up',
      presentation: 'Teacher models',
      consolidation: 'Learners practice',
      evaluation: 'Quick quiz',
    })
  })
})
