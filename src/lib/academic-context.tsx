'use client'
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useAuth } from './auth-context'
import { supabase } from './supabase'
import { loadSchoolSettings, saveSchoolSetting } from './school-settings'
import { getErrorMessage } from './validation'
import { logger } from './logger'

const getDefaultAcademicYear = () => new Date().getFullYear().toString()
const getStoredAcademicYear = () => {
  if (typeof window === 'undefined') return getDefaultAcademicYear()
  return localStorage.getItem('academic_year') || getDefaultAcademicYear()
}
const getStoredCurrentTerm = (): 1 | 2 | 3 => {
  if (typeof window === 'undefined') return 1
  const raw = localStorage.getItem('current_term')
  return raw === '2' || raw === '3' ? (Number(raw) as 1 | 2 | 3) : 1
}

// Uganda academic calendar: determine term from current date
function resolveTermByDate(now: Date = new Date()): 1 | 2 | 3 {
  const month = now.getMonth() + 1
  const day = now.getDate()
  const isTerm1 = month === 2 || month === 3 || month === 4 || (month === 5 && day <= 3)
  const isTerm2 = (month === 5 && day >= 27) || month === 6 || month === 7 || (month === 8 && day <= 23)
  const isTerm3 = (month === 9 && day >= 16) || month === 10 || month === 11 || (month === 12 && day <= 6)
  if (isTerm2) return 2
  if (isTerm3) return 3
  return 1
}

interface AcademicContextType {
  academicYear: string
  currentTerm: 1 | 2 | 3
  currentTermStartDate?: string
  currentTermEndDate?: string
  passingMark?: number
  gradeLabels?: Array<{ label: string; min: number; max: number }>
  lockedTerms: string[]
  setAcademicYear: (year: string) => void
  setCurrentTerm: (term: 1 | 2 | 3) => void
  isTermLocked: (year: string, term: 1 | 2 | 3) => boolean
  lockTerm: (year: string, term: 1 | 2 | 3, locked: boolean) => Promise<void>
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined)

export function AcademicProvider({ children }: { children: ReactNode }) {
  const { school, isDemo } = useAuth()
  const [academicYear, setAcademicYearState] = useState<string>(getStoredAcademicYear)
  const [currentTerm, setCurrentTermState] = useState<1 | 2 | 3>(getStoredCurrentTerm)
  const [currentTermStartDate, setCurrentTermStartDate] = useState<string | undefined>()
  const [currentTermEndDate, setCurrentTermEndDate] = useState<string | undefined>()
  const [passingMark, setPassingMark] = useState<number | undefined>()
  const [gradeLabels, setGradeLabels] = useState<Array<{ label: string; min: number; max: number }> | undefined>()
  const [lockedTerms, setLockedTerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Load from school settings on mount or when school changes
  const loadAcademicSettings = useCallback(async () => {
    if (!school?.id) {
      setLoading(false)
      return
    }

    if (isDemo) {
      // Still resolve term by date — just skip DB sync
      const demoTerm = resolveTermByDate()
      setCurrentTermState(demoTerm)
      localStorage.setItem('current_term', demoTerm.toString())
      setAcademicYearState(getStoredAcademicYear())
      setLockedTerms([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const settings = await loadSchoolSettings(school.id)

      let activeYear = getStoredAcademicYear()
      let activeTerm = getStoredCurrentTerm()

      // Try to determine term from academic_terms date ranges
      const { data: allTerms } = await supabase
        .from('academic_terms')
        .select('term_number, start_date, end_date, academic_year')
        .eq('school_id', school.id)

      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      type TermRow = NonNullable<typeof allTerms>[number]
      let matchedTerm: TermRow | undefined
      // Exact date range match
      if (allTerms?.length) {
        matchedTerm = allTerms.find(
          (t) => t.start_date <= todayStr && t.end_date >= todayStr,
        )
      }

      // Fallback: Uganda calendar date ranges
      if (!matchedTerm) {
        activeTerm = resolveTermByDate(today)
      } else {
        activeTerm = matchedTerm.term_number as 1 | 2 | 3
        if (matchedTerm.academic_year) activeYear = matchedTerm.academic_year
        if (matchedTerm.start_date) setCurrentTermStartDate(matchedTerm.start_date)
        if (matchedTerm.end_date) setCurrentTermEndDate(matchedTerm.end_date)
      }

      // Always persist the resolved term
      setCurrentTermState(activeTerm)
      localStorage.setItem('current_term', activeTerm.toString())
      setAcademicYearState(activeYear)
      localStorage.setItem('academic_year', activeYear)

      // Sync to DB (best-effort)
      try {
        await Promise.all([
          saveSchoolSetting(school.id, 'current_term', activeTerm.toString()),
          saveSchoolSetting(school.id, 'academic_year', activeYear),
        ])
      } catch {
        // Non-critical — term is already set in state + localStorage
      }

      // Load remaining settings
      const locked = Object.keys(settings)
        .filter(k => k.startsWith('term_locked_') && settings[k] === 'true')
        .map(k => k.replace('term_locked_', ''))
      setLockedTerms(locked)

      if (settings.passing_mark) {
        setPassingMark(Number(settings.passing_mark))
      }

      if (settings.grade_labels) {
        try {
          setGradeLabels(JSON.parse(settings.grade_labels))
        } catch (e) {
          logger.warn('Failed to parse grade_labels:', e)
        }
      }
    } catch (err) {
      logger.warn('Academic settings fallback in use:', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [school?.id, isDemo])

  useEffect(() => {
    loadAcademicSettings()
  }, [loadAcademicSettings])

  // Save to DB when changed locally
  const setAcademicYear = async (year: string) => {
    setAcademicYearState(year)
    localStorage.setItem('academic_year', year)
    if (school?.id && !isDemo) {
      try {
        await saveSchoolSetting(school.id, 'academic_year', year)
      } catch (error) {
        logger.warn('Error saving academic year:', getErrorMessage(error))
      }
    }
  }

  const setCurrentTerm = async (term: 1 | 2 | 3) => {
    setCurrentTermState(term)
    localStorage.setItem('current_term', term.toString())
    if (school?.id && !isDemo) {
      try {
        await saveSchoolSetting(school.id, 'current_term', term.toString())
      } catch (error) {
        logger.warn('Error saving current term:', getErrorMessage(error))
      }
    }
  }

  const isTermLocked = (year: string, term: 1 | 2 | 3) => {
    return lockedTerms.includes(`${year}_${term}`)
  }

  const lockTerm = async (year: string, term: 1 | 2 | 3, locked: boolean) => {
    if (!school?.id || isDemo) return
    const key = `term_locked_${year}_${term}`
    const val = locked ? 'true' : 'false'
    
    if (locked) {
      if (!lockedTerms.includes(`${year}_${term}`)) setLockedTerms([...lockedTerms, `${year}_${term}`])
    } else {
      setLockedTerms(lockedTerms.filter(t => t !== `${year}_${term}`))
    }

    try {
      await saveSchoolSetting(school.id, key, val)
    } catch (error) {
      logger.warn('Error locking term:', getErrorMessage(error))
    }
  }

  return (
    <AcademicContext.Provider value={{ academicYear, currentTerm, currentTermStartDate, currentTermEndDate, passingMark, gradeLabels, lockedTerms, setAcademicYear, setCurrentTerm, isTermLocked, lockTerm }}>
      {children}
    </AcademicContext.Provider>
  )
}

export function useAcademic() {
  const context = useContext(AcademicContext)
  if (context === undefined) {
    throw new Error('useAcademic must be used within an AcademicProvider')
  }
  return context
}
