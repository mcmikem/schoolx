'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { Student, CreateStudentInput, Class } from '@/types'
import { getQuerySchoolId, withTimeout } from './utils'

import { DEMO_STUDENTS, DEMO_CLASSES } from '@/lib/demo-data'
import { isDemoSchool } from '@/lib/demo-utils'
import { getFeatureLimit, getPlanUsageWarning } from '@/lib/payments/subscription-client'

export function useStudents(schoolId?: string, options?: { limit?: number; offset?: number }) {
  const limit = options?.limit || 100
  const offset = options?.offset || 0
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const { isDemo, school } = useAuth()

  const fetchStudents = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || isDemoSchool(schoolId)) {
      setStudents(DEMO_STUDENTS as any)
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
    // Check plan limit for non-demo schools
    if (!isDemo && !isDemoSchool(schoolId) && school?.subscription_plan) {
      const maxStudents = getFeatureLimit(school.subscription_plan as any, 'maxStudents')
      if (totalCount >= maxStudents) {
        throw new Error(`Student limit reached. Your plan allows ${maxStudents.toLocaleString()} students. Upgrade to add more.`)
      }
    }

    if (isDemo || isDemoSchool(schoolId)) {
      const newId = `demo-student-${Date.now()}`
      const newStudentData = {
        ...student,
        id: newId,
        school_id: schoolId || '00000000-0000-0000-0000-000000000001',
        status: 'active' as const,
        created_at: new Date().toISOString(),
        classes: DEMO_CLASSES.find(c => c.id === student.class_id) || DEMO_CLASSES[0],
      }
      setStudents(prev => [newStudentData as any, ...prev])
      setTotalCount(prev => prev + 1)
      return newStudentData as any
    }
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
    if (isDemo || isDemoSchool(schoolId)) {
      setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
      return { ...students.find(s => s.id === id), ...updates } as any
    }
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
    if (isDemo || isDemoSchool(schoolId)) {
      setStudents(prev => prev.filter(s => s.id !== id))
      setTotalCount(prev => prev - 1)
      return
    }
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
    if (isDemo || isDemoSchool(schoolId)) {
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
