'use client'
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useAuth } from './auth-context'
import { supabase } from './supabase'

interface AcademicContextType {
  academicYear: string
  currentTerm: 1 | 2 | 3
  setAcademicYear: (year: string) => void
  setCurrentTerm: (term: 1 | 2 | 3) => void
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined)

export function AcademicProvider({ children }: { children: ReactNode }) {
  const { school } = useAuth()
  const [academicYear, setAcademicYearState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('academic_year')
      if (saved) return saved
    }
    return new Date().getFullYear().toString()
  })

  const [currentTerm, setCurrentTermState] = useState<1 | 2 | 3>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('current_term')
      if (saved) return Number(saved) as 1 | 2 | 3
    }
    return 1
  })

  // Load from school settings on mount or when school changes
  const loadAcademicSettings = useCallback(async () => {
    if (!school?.id) return

    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('key, value')
        .eq('school_id', school.id)
        .in('key', ['current_term', 'academic_year'])
      
      if (error) {
        console.log('school_settings table not available, using defaults')
        return
      }
      
      if (data && data.length > 0) {
        const settings = Object.fromEntries(data.map(s => [s.key, s.value]))
        
        // Use functional updates to avoid dependency on state variables
        if (settings.academic_year) {
          setAcademicYearState(prev => {
            if (prev !== settings.academic_year) {
              localStorage.setItem('academic_year', settings.academic_year)
              return settings.academic_year
            }
            return prev
          })
        }
        
        if (settings.current_term) {
          const newTerm = Number(settings.current_term) as 1 | 2 | 3
          setCurrentTermState(prev => {
            if (prev !== newTerm) {
              localStorage.setItem('current_term', settings.current_term.toString())
              return newTerm
            }
            return prev
          })
        }
      }
    } catch (err) {
      console.error('Failed to load academic settings', err)
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
      await supabase.from('school_settings').upsert({ school_id: school.id, key: 'academic_year', value: year }, { onConflict: 'school_id,key' })
    }
  }

  const setCurrentTerm = async (term: 1 | 2 | 3) => {
    setCurrentTermState(term)
    localStorage.setItem('current_term', term.toString())
    if (school?.id) {
      await supabase.from('school_settings').upsert({ school_id: school.id, key: 'current_term', value: term.toString() }, { onConflict: 'school_id,key' })
    }
  }

  return (
    <AcademicContext.Provider value={{ academicYear, currentTerm, setAcademicYear, setCurrentTerm }}>
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
