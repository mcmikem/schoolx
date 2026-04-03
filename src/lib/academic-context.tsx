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
  const [academicYear, setAcademicYearState] = useState<string>(new Date().getFullYear().toString())
  const [currentTerm, setCurrentTermState] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(true)

  // Load from school settings on mount or when school changes
  const loadAcademicSettings = useCallback(async () => {
    if (!school?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('school_settings')
        .select('key, value')
        .eq('school_id', school.id)
        .in('key', ['current_term', 'academic_year'])
      
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
      } else {
        // Initialize if empty
        const initialYear = new Date().getFullYear().toString()
        const initialTerm = '1'
        await supabase.from('school_settings').insert([
          { school_id: school.id, key: 'academic_year', value: initialYear },
          { school_id: school.id, key: 'current_term', value: initialTerm }
        ])
      }
    } catch (err) {
      console.error('Failed to load academic settings', err)
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
      if (error) console.error('Error saving academic year:', error)
    }
  }

  const setCurrentTerm = async (term: 1 | 2 | 3) => {
    setCurrentTermState(term)
    localStorage.setItem('current_term', term.toString())
    if (school?.id) {
      const { error } = await supabase
        .from('school_settings')
        .upsert({ school_id: school.id, key: 'current_term', value: term.toString() }, { onConflict: 'school_id,key' })
      if (error) console.error('Error saving current term:', error)
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
