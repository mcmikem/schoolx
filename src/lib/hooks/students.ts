'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { Student, CreateStudentInput, Class } from '@/types'
import { getQuerySchoolId, withTimeout } from './utils'

// Demo data for offline/demo mode
const DEMO_STUDENTS: any[] = [
  { id: '1', school_id: 'demo-school', student_number: 'P001', first_name: 'John', last_name: 'Akena', gender: 'M', class_id: '1', status: 'active', classes: { id: '1', name: 'P.1', level: 'primary' } },
  { id: '2', school_id: 'demo-school', student_number: 'P002', first_name: 'Mary', last_name: 'Adoch', gender: 'F', class_id: '1', status: 'active', classes: { id: '1', name: 'P.1', level: 'primary' } },
  { id: '3', school_id: 'demo-school', student_number: 'P003', first_name: 'Peter', last_name: 'Okello', gender: 'M', class_id: '2', status: 'active', classes: { id: '2', name: 'P.2', level: 'primary' } },
  { id: '4', school_id: 'demo-school', student_number: 'P004', first_name: 'Sarah', last_name: 'Namatovu', gender: 'F', class_id: '2', status: 'active', classes: { id: '2', name: 'P.2', level: 'primary' } },
  { id: '5', school_id: 'demo-school', student_number: 'P005', first_name: 'James', last_name: 'Ochieng', gender: 'M', class_id: '3', status: 'active', classes: { id: '3', name: 'P.3', level: 'primary' } },
]

const DEMO_CLASSES: any[] = [
  { id: '1', school_id: 'demo-school', name: 'P.1', level: 'primary' },
  { id: '2', school_id: 'demo-school', name: 'P.2', level: 'primary' },
  { id: '3', school_id: 'demo-school', name: 'P.3', level: 'primary' },
]

export function useStudents(schoolId?: string, options?: { limit?: number; offset?: number }) {
  const limit = options?.limit || 100
  const offset = options?.offset || 0
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const { isDemo } = useAuth()

  const fetchStudents = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || schoolId === '00000000-0000-0000-0000-000000000001') {
      setStudents(DEMO_STUDENTS)
      setTotalCount(DEMO_STUDENTS.length)
      setLoading(false)
      return
    }
    
    if (!schoolId) { setLoading(false); return }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', querySchoolId)
      setTotalCount(count || 0)
      const data = await withTimeout(
        supabase.from('students').select(`id, school_id, student_number, first_name, last_name, gender, class_id, status, classes (id, name, level)`).eq('school_id', querySchoolId).order('created_at', { ascending: false }).range(offset, offset + limit - 1).then(r => { if (r.error) throw r.error; return r.data }),
        8000, [] as any[]
      )
      setStudents((data as any[]) || [])
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [schoolId, isDemo, limit, offset])

  const createStudent = async (student: CreateStudentInput) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error: insertError } = await supabase.from('students')
        .insert({ ...student, school_id: querySchoolId })
        .select(`
          id, school_id, student_number, first_name, last_name, gender, 
          date_of_birth, parent_name, parent_phone, class_id, admission_date, status, created_at,
          classes (id, name, level)
        `)
        .single()
      if (insertError) throw insertError
      setStudents(prev => [data as any, ...prev])
      setTotalCount(prev => prev + 1)
      return data as any
    } catch (err: unknown) { throw new Error(err instanceof Error ? err.message : 'Unknown error') }
  }

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    try {
      const { data, error: updateError } = await supabase.from('students')
        .update(updates)
        .eq('id', id)
        .select(`
          id, school_id, student_number, first_name, last_name, gender, 
          date_of_birth, parent_name, parent_phone, class_id, admission_date, status, created_at,
          classes (id, name, level)
        `)
        .single()
      if (updateError) throw updateError
      setStudents(prev => prev.map(s => s.id === id ? (data as any) : s))
      return data as any
    } catch (err: unknown) { throw new Error(err instanceof Error ? err.message : 'Unknown error') }
  }

  const deleteStudent = async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('students').delete().eq('id', id)
      if (deleteError) throw deleteError
      setStudents(prev => prev.filter(s => s.id !== id))
      setTotalCount(prev => prev - 1)
    } catch (err: unknown) { throw new Error(err instanceof Error ? err.message : 'Unknown error') }
  }

  useEffect(() => { fetchStudents() }, [fetchStudents])
  return { students, loading, error, totalCount, createStudent, updateStudent, deleteStudent, refetch: fetchStudents }
}

export function useStudent(id: string) {
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStudent() {
      if (!id) return
      try {
        setLoading(true)
        const { data, error } = await supabase.from('students')
          .select(`
            id, school_id, student_number, first_name, last_name, gender, 
            date_of_birth, parent_name, parent_phone, class_id, admission_date, status, created_at,
            classes(id, name, level)
          `)
          .eq('id', id)
          .single()
        if (error) throw error
        setStudent(data as any)
      } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Unknown error') }
      finally { setLoading(false) }
    }
    fetchStudent()
  }, [id])

  return { student, loading, error }
}

export function useClasses(schoolId?: string) {
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const fetchClasses = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || schoolId === '00000000-0000-0000-0000-000000000001') {
      setClasses(DEMO_CLASSES)
      setLoading(false)
      return
    }
    
    if (!schoolId) { setLoading(false); return }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      const data = await withTimeout(
        supabase.from('classes').select('id, name, level, school_id, created_at').eq('school_id', querySchoolId).order('name').then(r => { if (r.error) throw r.error; return r.data }),
        5000, [] as any[]
      )
      setClasses((data as any[]) || [])
    } catch (err) { console.warn('Classes fetch error:', err); setClasses([]) }
    finally { setLoading(false) }
  }, [schoolId, isDemo])

  useEffect(() => { fetchClasses() }, [fetchClasses])
  return { classes, loading }
}
