'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { DEMO_GRADES } from '@/lib/demo-data'
import { isDemoSchool } from '@/lib/demo-utils'

export function useGrades(classId?: string, subjectId?: string, term?: number, academicYear?: string) {
  const [grades, setGrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const saveGrade = async (grade: { student_id: string; subject_id: string; class_id: string; assessment_type: string; score: number; max_score?: number; term: number; academic_year: string; recorded_by?: string }) => {
    const maxScore = grade.max_score || 100
    if (grade.score < 0 || grade.score > maxScore) {
      throw new Error(`Score must be between 0 and ${maxScore}`)
    }
    if (isDemo) {
      const newGrade = { ...grade, max_score: maxScore, id: `demo-grade-${Date.now()}`, created_at: new Date().toISOString() }
      setGrades(prev => {
        const existing = prev.findIndex(g => g.student_id === grade.student_id && g.subject_id === grade.subject_id && g.assessment_type === grade.assessment_type)
        if (existing >= 0) { const u = [...prev]; u[existing] = newGrade; return u }
        return [...prev, newGrade]
      })
      return newGrade
    }
    try {
      const { data, error } = await supabase.from('grades')
        .upsert({ ...grade, max_score: maxScore }, { onConflict: 'student_id,subject_id,assessment_type,term,academic_year' })
        .select('id, student_id, subject_id, class_id, assessment_type, score, max_score, term, academic_year, recorded_by, created_at')
        .single()
      if (error) throw error
      setGrades(prev => {
        const existing = prev.findIndex(g => g.student_id === grade.student_id && g.subject_id === grade.subject_id && g.assessment_type === grade.assessment_type)
        if (existing >= 0) { const u = [...prev]; u[existing] = data; return u }
        return [...prev, data]
      })
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const fetchGrades = useCallback(async () => {
    if (isDemo) {
      setGrades(DEMO_GRADES as any)
      setLoading(false)
      return
    }
    if (!classId) { setLoading(false); return }
    try {
      setLoading(true)
      let query = supabase.from('grades')
        .select(`
          id, student_id, subject_id, class_id, assessment_type, score, max_score, term, academic_year, recorded_by, created_at,
          students (id, first_name, last_name), 
          subjects (id, name, code)
        `)
        .eq('class_id', classId)
      if (subjectId) query = query.eq('subject_id', subjectId)
      if (term) query = query.eq('term', term)
      if (academicYear) query = query.eq('academic_year', academicYear)
      const { data, error } = await query
      if (error) throw error
      setGrades(data || [])
    } catch (err) { console.error('Failed to fetch grades:', err) }
    finally { setLoading(false) }
  }, [classId, subjectId, term, academicYear, isDemo])

  useEffect(() => { fetchGrades() }, [fetchGrades])
  return { grades, loading, saveGrade }
}

export function useExamScores(classId?: string, subjectId?: string, term?: number, academicYear?: string) {
  const [examScores, setExamScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const saveExamScore = async (score: { student_id: string; subject_id: string; class_id: string; exam_type: string; score: number; max_score?: number; term: number; academic_year: string; recorded_by?: string }) => {
    const maxScore = score.max_score || 100
    if (score.score < 0 || score.score > maxScore) {
      throw new Error(`Score must be between 0 and ${maxScore}`)
    }
    if (isDemo) {
      const newScore = { ...score, max_score: maxScore, id: `demo-exam-${Date.now()}`, created_at: new Date().toISOString() }
      setExamScores(prev => {
        const existing = prev.findIndex(s => s.student_id === score.student_id && s.subject_id === score.subject_id && s.exam_type === score.exam_type)
        if (existing >= 0) { const u = [...prev]; u[existing] = newScore; return u }
        return [...prev, newScore]
      })
      return newScore
    }
    try {
      const { data, error } = await supabase.from('exam_scores')
        .upsert({ ...score, max_score: maxScore }, { onConflict: 'student_id,subject_id,exam_type,term,academic_year' })
        .select('id, student_id, subject_id, class_id, exam_type, score, max_score, term, academic_year, recorded_by, created_at')
        .single()
      if (error) throw error
      setExamScores(prev => {
        const existing = prev.findIndex(s => s.student_id === score.student_id && s.subject_id === score.subject_id && s.exam_type === score.exam_type)
        if (existing >= 0) { const u = [...prev]; u[existing] = data; return u }
        return [...prev, data]
      })
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const deleteExamScore = async (id: string) => {
    if (isDemo) {
      setExamScores(prev => prev.filter(s => s.id !== id))
      return
    }
    try {
      const { error } = await supabase.from('exam_scores').delete().eq('id', id)
      if (error) throw error
      setExamScores(prev => prev.filter(s => s.id !== id))
    } catch (err: any) { throw new Error(err.message) }
  }

  useEffect(() => {
    async function fetchExamScores() {
      if (!classId) { setLoading(false); return }
      try {
        setLoading(true)
        let query = supabase.from('exam_scores')
          .select(`
            id, student_id, subject_id, class_id, exam_type, score, max_score, term, academic_year, recorded_by, created_at,
            students (id, first_name, last_name), 
            subjects (id, name, code)
          `)
          .eq('class_id', classId)
        if (subjectId) query = query.eq('subject_id', subjectId)
        if (term) query = query.eq('term', term)
        if (academicYear) query = query.eq('academic_year', academicYear)
        const { data, error } = await query
        if (error) { if (error.code === '42P01') { setExamScores([]); setLoading(false); return; } throw error }
        setExamScores(data || [])
      } catch (err) { console.error('Error fetching exam scores:', err) }
      finally { setLoading(false) }
    }
    fetchExamScores()
  }, [classId, subjectId, term, academicYear, isDemo])

  return { examScores, loading, saveExamScore, deleteExamScore }
}

export function useExams(schoolId?: string) {
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createExam = async (exam: { name: string; exam_type: string; class_id: string; subject_id: string; term: number; academic_year: string; exam_date: string; max_score: number; weight: number }) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newExam = { ...exam, id: `demo-exam-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001', created_at: new Date().toISOString() }
      setExams(prev => [newExam, ...prev])
      return newExam
    }
    try {
      const { data, error } = await supabase.from('exams')
        .insert({ ...exam, school_id: schoolId })
        .select('id, school_id, name, exam_type, class_id, subject_id, term, academic_year, exam_date, max_score, weight, created_at')
        .single()
      if (error) throw error
      setExams(prev => [data, ...prev])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const deleteExam = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setExams(prev => prev.filter(e => e.id !== id))
      return
    }
    try {
      const { error } = await supabase.from('exams').delete().eq('id', id)
      if (error) throw error
      setExams(prev => prev.filter(e => e.id !== id))
    } catch (err: any) { throw new Error(err.message) }
  }

  useEffect(() => {
    async function fetchExams() {
      if (!schoolId) { setLoading(false); return }
      try {
        setLoading(true)
        const { data, error } = await supabase.from('exams')
          .select(`
            id, school_id, name, exam_type, class_id, subject_id, term, academic_year, exam_date, max_score, weight, created_at,
            classes (id, name), 
            subjects (id, name)
          `)
          .eq('school_id', schoolId)
          .order('exam_date', { ascending: false })
        if (error) { if (error.code === '42P01') { setExams([]); setLoading(false); return; } throw error }
        setExams(data || [])
      } catch (err) { console.error('Error fetching exams:', err) }
      finally { setLoading(false) }
    }
    fetchExams()
  }, [schoolId, isDemo])

  return { exams, loading, createExam, deleteExam }
}
