import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PRIMARY_TEMPLATE,
  SECONDARY_TEMPLATE,
} from '@/lib/curriculum-templates'
import {
  buildUgandaAcademicTerms,
  buildUgandaCalendarEvents,
} from '@/lib/uganda-school-calendar'
import {
  buildDefaultClasses,
  type SchoolSetupType,
} from '@/lib/school-setup'

export function getDefaultSubjects(schoolType: string) {
  if (schoolType === 'primary') return PRIMARY_TEMPLATE.subjects
  if (schoolType === 'secondary') return SECONDARY_TEMPLATE.subjects

  const combined = [...PRIMARY_TEMPLATE.subjects]
  SECONDARY_TEMPLATE.subjects.forEach((subject) => {
    if (!combined.find((item) => item.code === subject.code && item.level === subject.level)) {
      combined.push(subject)
    }
  })
  return combined
}

export function generateSchoolCode(schoolName: string, district: string): string {
  const nameWords = schoolName
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0)

  let nameCode = ''
  for (const word of nameWords.slice(0, 3)) {
    nameCode += word.substring(0, 2)
    if (nameCode.length >= 4) break
  }
  nameCode = nameCode.substring(0, 4) || 'SCHL'

  const districtCode =
    district
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .substring(0, 2) || 'UG'

  const randomNum = Math.floor(100 + Math.random() * 900)
  return `${nameCode}${districtCode}${randomNum}`
}

export async function reserveUniqueSchoolCode(
  supabaseAdmin: SupabaseClient,
  schoolName: string,
  district: string,
  requestedCode?: string | null,
) {
  const sanitizedRequestedCode = requestedCode?.trim().toUpperCase()

  if (sanitizedRequestedCode) {
    const { data: existingSchool } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq('school_code', sanitizedRequestedCode)
      .maybeSingle()

    if (existingSchool) {
      throw new Error('School code already exists')
    }

    return sanitizedRequestedCode
  }

  let attempts = 0
  let schoolCode = generateSchoolCode(schoolName, district)

  while (attempts < 10) {
    const { data: existingSchool } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq('school_code', schoolCode)
      .maybeSingle()

    if (!existingSchool) return schoolCode

    schoolCode = generateSchoolCode(schoolName, district)
    attempts += 1
  }

  throw new Error('Unable to generate unique school code. Please try again.')
}

export async function seedSchoolDefaults(
  supabaseAdmin: SupabaseClient,
  schoolId: string,
  schoolType: SchoolSetupType,
) {
  const currentYear = new Date().getFullYear().toString()
  const defaultSubjects = getDefaultSubjects(schoolType)

  if (defaultSubjects.length > 0) {
    await supabaseAdmin.from('subjects').insert(
      defaultSubjects.map((subject) => ({
        school_id: schoolId,
        name: subject.name,
        code: subject.code,
        level: subject.level,
        is_compulsory: subject.is_compulsory,
      })),
    )
  }

  const defaultClasses = buildDefaultClasses(schoolId, schoolType, currentYear)
  if (defaultClasses.length > 0) {
    await supabaseAdmin.from('classes').insert(defaultClasses)
  }

  const { data: academicYear } = await supabaseAdmin
    .from('academic_years')
    .insert({
      school_id: schoolId,
      year: currentYear,
      is_current: true,
    })
    .select()
    .single()

  if (academicYear) {
    const defaultAcademicTerms = buildUgandaAcademicTerms(schoolId, currentYear)
    await supabaseAdmin.from('terms').insert(
      defaultAcademicTerms.map((term) => ({
        school_id: schoolId,
        academic_year_id: academicYear.id,
        term_number: term.term_number,
        start_date: term.start_date,
        end_date: term.end_date,
        is_current: term.is_current,
      })),
    )

    await supabaseAdmin.from('academic_terms').upsert(defaultAcademicTerms, {
      onConflict: 'school_id,academic_year,term_number',
    })
  }

  await supabaseAdmin
    .from('events')
    .insert(buildUgandaCalendarEvents(schoolId, currentYear))
}