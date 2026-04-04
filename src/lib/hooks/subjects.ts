'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { Subject } from '@/types'
import { getQuerySchoolId } from './utils'
import { isDemoSchool } from '@/lib/demo-utils'

export function useSubjects(schoolId?: string, autoSeed: boolean = true) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const fetchSubjects = useCallback(async () => {
    if (!schoolId) { setLoading(false); return }
    if (isDemo || isDemoSchool(schoolId)) {
      const { getDefaultSubjects } = await import('@/lib/curriculum')
      const defaultSubjects = getDefaultSubjects('primary')
      setSubjects(defaultSubjects.map(s => ({ ...s, id: `demo-sub-${s.code}`, school_id: schoolId, created_at: new Date().toISOString() })) as unknown as Subject[])
      setLoading(false)
      return
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      const { data, error } = await supabase.from('subjects').select('id, name, code, level, is_compulsory, school_id, created_at').eq('school_id', querySchoolId).order('name')
      if (error) throw error
      let currentSubjects = data || []
      if (currentSubjects.length === 0 && autoSeed) {
        const { getDefaultSubjects } = await import('@/lib/curriculum')
        const defaultSubjects = getDefaultSubjects('primary')
        const seeds = defaultSubjects.map(s => ({ name: s.name, code: s.code, level: s.level, is_compulsory: s.is_compulsory, school_id: querySchoolId }))
        const { data: inserted, error: insertError } = await supabase.from('subjects').insert(seeds).select('id, name, code, level, is_compulsory, school_id, created_at')
        if (!insertError && inserted) currentSubjects = inserted.sort((a: any, b: any) => a.name.localeCompare(b.name))
      }
      setSubjects(currentSubjects as Subject[])
    } catch (err) { console.error('Error fetching subjects:', err) }
    finally { setLoading(false) }
  }, [schoolId, autoSeed, isDemo])

  useEffect(() => { fetchSubjects() }, [fetchSubjects])
  return { subjects, loading }
}

export function useSubjectAllocations(schoolId?: string, academicYear?: string) {
  const [allocations, setAllocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createAllocation = async (allocation: { teacher_id: string; subject_id: string; class_id: string; academic_year: string; term?: number; is_class_teacher?: boolean }) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newAlloc = { ...allocation, id: `demo-alloc-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001', created_at: new Date().toISOString() }
      setAllocations(prev => [...prev, newAlloc])
      return newAlloc
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('subject_allocations')
        .insert({ ...allocation, school_id: querySchoolId })
        .select('id, school_id, teacher_id, subject_id, class_id, academic_year, term, is_class_teacher, created_at')
        .single()
      if (error) throw error
      setAllocations(prev => [...prev, data])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const deleteAllocation = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setAllocations(prev => prev.filter(a => a.id !== id))
      return
    }
    try {
      const { error } = await supabase.from('subject_allocations').delete().eq('id', id)
      if (error) throw error
      setAllocations(prev => prev.filter(a => a.id !== id))
    } catch (err: any) { throw new Error(err.message) }
  }

  useEffect(() => {
    async function fetchAllocations() {
      if (!schoolId) { setLoading(false); return }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo)
      try {
        setLoading(true)
        let query = supabase.from('subject_allocations')
          .select('id, school_id, teacher_id, subject_id, class_id, academic_year, term, is_class_teacher, created_at, users!teacher_id(id, full_name), subjects(id, name), classes(id, name)')
          .eq('school_id', querySchoolId)
        if (academicYear) query = query.eq('academic_year', academicYear)
        const { data, error } = await query
        if (error) throw error
        setAllocations(data || [])
      } catch (err) { console.error('Error fetching allocations:', err) }
      finally { setLoading(false) }
    }
    fetchAllocations()
  }, [schoolId, academicYear, isDemo])

  return { allocations, loading, createAllocation, deleteAllocation }
}
