'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AcademicContextType {
  academicYear: string
  currentTerm: 1 | 2 | 3
  setAcademicYear: (year: string) => void
  setCurrentTerm: (term: 1 | 2 | 3) => void
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined)

export function AcademicProvider({ children }: { children: ReactNode }) {
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

  const setAcademicYear = (year: string) => {
    setAcademicYearState(year)
    localStorage.setItem('academic_year', year)
  }

  const setCurrentTerm = (term: 1 | 2 | 3) => {
    setCurrentTermState(term)
    localStorage.setItem('current_term', term.toString())
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
