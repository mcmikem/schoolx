'use client'
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useAuth } from './auth-context'
import { supabase } from './supabase'
import { getErrorMessage } from './validation'

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

interface AcademicContextType {
  academicYear: string
  currentTerm: 1 | 2 | 3
  lockedTerms: string[]
  setAcademicYear: (year: string) => void
  setCurrentTerm: (term: 1 | 2 | 3) => void
  isTermLocked: (year: string, term: 1 | 2 | 3) => boolean
  lockTerm: (year: string, term: 1 | 2 | 3, locked: boolean) => Promise<void>
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined)

export function AcademicProvider({ children }: { children: ReactNode }) {
  const { school } = useAuth()
  const [academicYear, setAcademicYearState] = useState<string>(getStoredAcademicYear)
  const [currentTerm, setCurrentTermState] = useState<1 | 2 | 3>(getStoredCurrentTerm)
  const [lockedTerms, setLockedTerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Load from school settings on mount or when school changes
  const loadAcademicSettings = useCallback(async () => {
    if (!school?.id || !supabase) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('school_settings')
        .select('key, value')
        .eq('school_id', school.id)

      if (error) throw error
      
      if (data && data.length > 0) {
        const settings = Object.fromEntries(data.map(s => [s.key, s.value]))
        
        if (settings.academic_year) {
          setAcademicYearState(settings.academic_year)
          localStorage.setItem('academic_year', settings.academic_year)
        }
        
        if (settings.current_term) {
          const newTerm = Number(settings.current_term) as 1 | 2 | 3
          setCurrentTermState(newTerm)
          localStorage.setItem('current_term', settings.current_term.toString())
        }

        const locked = Object.keys(settings)
          .filter(k => k.startsWith('term_locked_') && settings[k] === 'true')
          .map(k => k.replace('term_locked_', ''))
        setLockedTerms(locked)
      } else {
        // Initialize if empty
        const initialYear = getStoredAcademicYear()
        const initialTerm = String(getStoredCurrentTerm())
        const { error: seedError } = await supabase.from('school_settings').upsert([
          { school_id: school.id, key: 'academic_year', value: initialYear },
          { school_id: school.id, key: 'current_term', value: initialTerm }
        ], { onConflict: 'school_id,key' })

        if (seedError) {
          console.warn('Academic settings fallback in use:', getErrorMessage(seedError))
        }
      }
    } catch (err) {
      console.warn('Academic settings fallback in use:', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  useEffect(() => {
    loadAcademicSettings()
  }, [loadAcademicSettings])

  // Save to DB when changed locally
  const setAcademicYear = async (year: string) => {
    setAcademicYearState(year)
    localStorage.setItem('academic_year', year)
    if (school?.id) {
      const { error } = await supabase
        .from('school_settings')
        .upsert({ school_id: school.id, key: 'academic_year', value: year }, { onConflict: 'school_id,key' })
      if (error) console.warn('Error saving academic year:', getErrorMessage(error))
    }
  }

  const setCurrentTerm = async (term: 1 | 2 | 3) => {
    setCurrentTermState(term)
    localStorage.setItem('current_term', term.toString())
    if (school?.id) {
      const { error } = await supabase
        .from('school_settings')
        .upsert({ school_id: school.id, key: 'current_term', value: term.toString() }, { onConflict: 'school_id,key' })
      if (error) console.warn('Error saving current term:', getErrorMessage(error))
    }
  }

  const isTermLocked = (year: string, term: 1 | 2 | 3) => {
    return lockedTerms.includes(`${year}_${term}`)
  }

  const lockTerm = async (year: string, term: 1 | 2 | 3, locked: boolean) => {
    if (!school?.id) return
    const key = `term_locked_${year}_${term}`
    const val = locked ? 'true' : 'false'
    
    if (locked) {
      if (!lockedTerms.includes(`${year}_${term}`)) setLockedTerms([...lockedTerms, `${year}_${term}`])
    } else {
      setLockedTerms(lockedTerms.filter(t => t !== `${year}_${term}`))
    }

    const { error } = await supabase
      .from('school_settings')
      .upsert({ school_id: school.id, key, value: val }, { onConflict: 'school_id,key' })
    
    if (error) console.warn('Error locking term:', getErrorMessage(error))
  }

  return (
    <AcademicContext.Provider value={{ academicYear, currentTerm, lockedTerms, setAcademicYear, setCurrentTerm, isTermLocked, lockTerm }}>
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
