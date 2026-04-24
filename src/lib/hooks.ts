'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'
import { getDemoStudents, getDemoClasses, getDemoFeeStructure, getDemoPayments } from './demo-data'
import type {
  School,
  User,
  Student,
  CreateStudentInput,
  Class,
  Subject,
  Attendance,
  Grade,
  FeeStructure,
  FeePayment,
  CreatePaymentInput,
  Message,
  CalendarEvent,
  DashboardStats,
  TimetableEntry
} from '@/types'

// Generic hook for fetching data
export function useSupabaseQuery<T>(
  table: string,
  options?: {
    select?: string
    filters?: Record<string, string | number | boolean | null>
    orderBy?: { column: string; ascending?: boolean }
    limit?: number
  }
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase!.from(table).select(options?.select || '*')

      if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            query = query.eq(key, value)
          }
        })
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? false,
        })
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data: result, error: fetchError } = await query

      if (fetchError) throw fetchError
      setData((result as T[]) || [])
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [table, JSON.stringify(options)])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// Hook for mutations (insert, update, delete)
export function useSupabaseMutation<T>(table: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insert = async (data: Partial<T>) => {
    try {
      setLoading(true)
      setError(null)
      const { data: result, error: insertError } = await supabase!
        .from(table)
        .insert(data)
        .select()
        .single()

      if (insertError) throw insertError
      return result as T
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const update = async (id: string, data: Partial<T>) => {
    try {
      setLoading(true)
      setError(null)
      const { data: result, error: updateError } = await supabase!
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      return result as T
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  return { insert, update, remove, loading, error }
}

// Announcements/Notifications hook
export function useAnnouncements(schoolId?: string, limit = 5) {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      if (!schoolId) return
      try {
        setLoading(true)
        // We'll use the 'messages' table or a dedicated announcements if it exists
        // Given the schema, we might check 'messages' if available or fallback
        const { data, error } = await supabase
          .from('messages') // Assuming common table name if not in schema yet
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (!error) setAnnouncements(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [schoolId, limit])

  return { announcements, loading }
}

// Academic Events hook
export function useAcademicEvents(schoolId?: string, limit = 5) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      if (!schoolId) return
      try {
        setLoading(true)
        // Check for 'academic_calendar' or similar
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: true })
          .limit(limit)

        if (!error) setEvents(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [schoolId])

  return { events, loading }
}

// Students hook
export function useStudents(schoolId?: string) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isDemo } = useAuth()

  const fetchStudents = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
      return
    }

    // Demo mode: only for demo-school (check localStorage directly for reliability)
    const isDemoMode = isDemo || localStorage.getItem('demo_user') !== null
    if (isDemoMode && schoolId === 'demo-school') {
      setLoading(false)
      setStudents(getDemoStudents() as unknown as Student[])
      return
    }

    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('students')
        .select(`
          *,
          classes (
            id,
            name,
            level
          )
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setStudents((data as Student[]) || [])
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [schoolId, isDemo])

  const createStudent = async (student: CreateStudentInput) => {
    try {
      const { data, error: insertError } = await supabase
        .from('students')
        .insert({ ...student, school_id: schoolId })
        .select(`
          *,
          classes (
            id,
            name,
            level
          )
        `)
        .single()

      if (insertError) throw insertError
      setStudents((prev) => [data as Student, ...prev])
      return data as Student
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      throw new Error(errorMessage)
    }
  }

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('students')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          classes (
            id,
            name,
            level
          )
        `)
        .single()

      if (updateError) throw updateError
      setStudents((prev) => prev.map((s) => (s.id === id ? (data as Student) : s)))
      return data as Student
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      throw new Error(errorMessage)
    }
  }

  const deleteStudent = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setStudents((prev) => prev.filter((s) => s.id !== id))
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      throw new Error(errorMessage)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  return { students, loading, error, createStudent, updateStudent, deleteStudent, refetch: fetchStudents }
}

// Single student hook
export function useStudent(id: string) {
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStudent() {
      if (!id) return
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('students')
          .select('*, classes(*)')
          .eq('id', id)
          .single()

        if (error) throw error
        setStudent(data as Student)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }
    fetchStudent()
  }, [id])

  return { student, loading, error }
}

// Classes hook
export function useClasses(schoolId?: string) {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchClasses() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      // Demo mode check
      const isDemoMode = isDemo || localStorage.getItem('demo_user') !== null
      if (isDemoMode && schoolId === 'demo-school') {
        setLoading(false)
        setClasses(getDemoClasses() as unknown as Class[])
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .eq('school_id', schoolId)
          .order('name')

        if (error) throw error
        setClasses((data as Class[]) || [])
      } catch (err) {
        console.error('Error fetching classes:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchClasses()
  }, [schoolId, isDemo])

  return { classes, loading }
}

// Fee payments hook
export function useFeePayments(schoolId?: string) {
  const [payments, setPayments] = useState<FeePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isDemo } = useAuth()

  const fetchPayments = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
      return
    }

    // Demo mode check
    const isDemoMode = isDemo || localStorage.getItem('demo_user') !== null
    if (isDemoMode && schoolId === 'demo-school') {
      setLoading(false)
      setPayments(getDemoPayments() as unknown as FeePayment[])
      return
    }

    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('fee_payments')
        .select(`
          *,
          students!inner (
            id,
            first_name,
            last_name,
            school_id,
            classes (
              name
            )
          )
        `)
        .eq('students.school_id', schoolId)
        .order('payment_date', { ascending: false })

      if (fetchError) throw fetchError
      setPayments((data as FeePayment[]) || [])
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [schoolId, isDemo])

  const createPayment = async (payment: CreatePaymentInput) => {
    // Demo mode - add to local state
    if (isDemo) {
      const { getDemoStudents } = await import('@/lib/demo-data')
      const students = getDemoStudents()
      const student = students.find(s => s.id === payment.student_id)
      const newPaymentRecord = {
        ...payment,
        id: `demo-pay-${Date.now()}`,
        payment_date: new Date().toISOString().split('T')[0],
        students: student ? { 
          id: student.id, 
          first_name: student.first_name, 
          last_name: student.last_name,
          classes: student.classes
        } : null
      }
      setPayments((prev) => [newPaymentRecord as FeePayment, ...prev])
      return newPaymentRecord as FeePayment
    }

    try {
      const { data, error: insertError } = await supabase
        .from('fee_payments')
        .insert(payment)
        .select(`
          *,
          students (
            id,
            first_name,
            last_name,
            classes (
              name
            )
          )
        `)
        .single()

      if (insertError) throw insertError
      setPayments((prev) => [data as FeePayment, ...prev])
      return data as FeePayment
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      throw new Error(errorMessage)
    }
  }

  const deletePayment = async (id: string) => {
    // Demo mode
    if (isDemo) {
      setPayments((prev) => prev.filter((p) => p.id !== id))
      return true
    }
    try {
      const { error: deleteError } = await supabase
        .from('fee_payments')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setPayments((prev) => prev.filter((p) => p.id !== id))
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      throw new Error(errorMessage)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  return { payments, loading, error, createPayment, deletePayment, refetch: fetchPayments }
}

// Fee structure hook
export function useFeeStructure(schoolId?: string) {
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const fetchFeeStructure = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
      return
    }

    // Demo mode check
    const isDemoMode = isDemo || localStorage.getItem('demo_user') !== null
    if (isDemoMode && schoolId === 'demo-school') {
      setLoading(false)
      setFeeStructure(getDemoFeeStructure() as unknown as FeeStructure[])
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('fee_structure')
        .select(`
          *,
          classes (
            name
          )
        `)
        .eq('school_id', schoolId)
        .order('name')

      if (error) throw error
      setFeeStructure((data as FeeStructure[]) || [])
    } catch (err) {
      console.error('Error fetching fee structure:', err)
    } finally {
      setLoading(false)
    }
  }, [schoolId, isDemo])

  const deleteFeeStructure = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('fee_structure')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setFeeStructure((prev) => prev.filter((f) => f.id !== id))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    fetchFeeStructure()
  }, [fetchFeeStructure])

  return { feeStructure, loading, deleteFeeStructure, refetch: fetchFeeStructure }
}

// Attendance hook
export function useAttendance(classId?: string, date?: string) {
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const markAttendance = async (studentId: string, status: string, recordedBy?: string) => {
    // Demo mode - just add to local state
    if (isDemo) {
      const newRecord = {
        id: `demo-att-${Date.now()}`,
        student_id: studentId,
        class_id: classId,
        date: date || new Date().toISOString().split('T')[0],
        status,
        recorded_by: recordedBy,
      }
      setAttendance((prev) => {
        const existing = prev.findIndex((a) => a.student_id === studentId)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = newRecord
          return updated
        }
        return [...prev, newRecord]
      })
      return newRecord
    }

    try {
      const { data, error } = await supabase
        .from('attendance')
        .upsert({
          student_id: studentId,
          class_id: classId,
          date: date || new Date().toISOString().split('T')[0],
          status,
          recorded_by: recordedBy,
        }, { onConflict: 'student_id,date' })
        .select()
        .single()

      if (error) throw error
      setAttendance((prev) => {
        const existing = prev.findIndex((a) => a.student_id === studentId)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = data
          return updated
        }
        return [...prev, data]
      })
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchAttendance() {
      if (!classId || !date) {
        setLoading(false)
        return
      }

      // Demo mode - only for demo accounts
      if (isDemo) {
        const { getDemoAttendance } = await import('@/lib/demo-data')
        const demoAtt = getDemoAttendance(classId, date)
        // Map to match expected format
        const mapped = demoAtt.map(a => ({
          ...a,
          students: { id: a.student_id }
        }))
        setAttendance(mapped)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('class_id', classId)
          .eq('date', date)

        if (error) throw error
        setAttendance(data || [])
      } catch (err) {
        console.error('Error fetching attendance:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [classId, date, isDemo])

  return { attendance, loading, markAttendance }
}

// Grades hook
export function useGrades(classId?: string, subjectId?: string, term?: number, academicYear?: string) {
  const [grades, setGrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const saveGrade = async (grade: {
    student_id: string
    subject_id: string
    class_id: string
    assessment_type: string
    score: number
    term: number
    academic_year: string
    recorded_by?: string
  }) => {
    // Demo mode
    if (isDemo) {
      const newGrade = {
        ...grade,
        id: `demo-grade-${Date.now()}`,
        max_score: 100,
      }
      setGrades((prev) => {
        const existing = prev.findIndex(
          (g) =>
            g.student_id === grade.student_id &&
            g.subject_id === grade.subject_id &&
            g.assessment_type === grade.assessment_type
        )
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = newGrade
          return updated
        }
        return [...prev, newGrade]
      })
      return newGrade
    }

    try {
      const { data, error } = await supabase
        .from('grades')
        .upsert(grade, { onConflict: 'student_id,subject_id,assessment_type,term,academic_year' })
        .select()
        .single()

      if (error) throw error
      setGrades((prev) => {
        const existing = prev.findIndex(
          (g) =>
            g.student_id === grade.student_id &&
            g.subject_id === grade.subject_id &&
            g.assessment_type === grade.assessment_type
        )
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = data
          return updated
        }
        return [...prev, data]
      })
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchGrades() {
      if (!classId) {
        setLoading(false)
        return
      }

      // Demo mode - get demo grades
      if (isDemo) {
        const { getDemoGrades, getDemoStudents } = await import('@/lib/demo-data')
        const demoGrades = getDemoGrades(classId, subjectId)
        const students = getDemoStudents()
        const mapped = demoGrades.map(g => ({
          ...g,
          students: students.find(s => s.id === g.student_id),
          subjects: { id: g.subject_id, name: 'Subject' }
        }))
        setGrades(mapped)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        let query = supabase
          .from('grades')
          .select(`
            *,
            students (
              id,
              first_name,
              last_name
            ),
            subjects (
              id,
              name,
              code
            )
          `)
          .eq('class_id', classId)

        if (subjectId) query = query.eq('subject_id', subjectId)
        if (term) query = query.eq('term', term)
        if (academicYear) query = query.eq('academic_year', academicYear)

        const { data, error } = await query

        if (error) throw error
        setGrades(data || [])
      } catch (err) {
        console.error('Error fetching grades:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchGrades()
  }, [classId, subjectId, term, academicYear, isDemo])

  return { grades, loading, saveGrade }
}

// Subjects hook
export function useSubjects(schoolId?: string, autoSeed: boolean = true) {
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchSubjects() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      // Demo mode - return curriculum subjects
      if (isDemo) {
        setLoading(false)
        const { getDefaultSubjects } = await import('@/lib/curriculum')
        const demoSubjects = getDefaultSubjects('primary').map(s => ({
          id: s.id,
          name: s.name,
          code: s.code,
          level: s.level,
          is_compulsory: s.is_compulsory,
        }))
        setSubjects(demoSubjects)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('school_id', schoolId)
          .order('name')

        if (error) throw error

        let currentSubjects = data || []

        // Auto-seed basic subjects if none exist
        if (currentSubjects.length === 0 && autoSeed) {
          const { getDefaultSubjects } = await import('@/lib/curriculum')
          const defaultSubjects = getDefaultSubjects('primary')
          
          const seeds = defaultSubjects.map(s => ({ 
            name: s.name, 
            code: s.code, 
            level: s.level, 
            is_compulsory: s.is_compulsory,
            school_id: schoolId 
          }))
          
          const { data: inserted, error: insertError } = await supabase
            .from('subjects')
            .insert(seeds)
            .select()

          if (!insertError && inserted) {
            currentSubjects = inserted.sort((a, b) => a.name.localeCompare(b.name))
          }
        }

        setSubjects(currentSubjects)
      } catch (err) {
        console.error('Error fetching subjects:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSubjects()
  }, [schoolId, autoSeed, isDemo])

  return { subjects, loading }
}

// Analytics hook
export function useAnalytics(schoolId?: string) {
  const [data, setData] = useState<any>({
    attendanceTrends: [],
    classPerformance: [],
    subjectPerformance: [],
    feeCollection: [],
    genderDistribution: [],
    stats: {
      totalStudents: 0,
      avgAttendance: 0,
      avgGrade: 0,
      feeCollectionRate: 0,
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAnalytics() {
      if (!schoolId) return
      try {
        setLoading(true)

        // 1. Gender Distribution
        const { data: students } = await supabase
          .from('students')
          .select('gender, class_id')
          .eq('school_id', schoolId)
          .eq('status', 'active')

        const genderMap = students?.reduce((acc: any, s: any) => {
          acc[s.gender] = (acc[s.gender] || 0) + 1
          return acc
        }, {})

        const genderDistribution = [
          { name: 'Boys', value: genderMap?.M || 0, color: '#3b82f6' },
          { name: 'Girls', value: genderMap?.F || 0, color: '#ec4899' },
        ]

        // 2. Class Performance & Subject Performance
        const { data: grades } = await supabase
          .from('grades')
          .select('score, subject_id, class_id, students!inner(gender)')
          .eq('students.school_id', schoolId)

        const classMap: any = {}
        const subjectMap: any = {}

        grades?.forEach((g: any) => {
          // Class stats
          if (!classMap[g.class_id]) classMap[g.class_id] = { total: 0, count: 0, boys: 0, bCount: 0, girls: 0, gCount: 0 }
          classMap[g.class_id].total += g.score
          classMap[g.class_id].count++
          if (g.students.gender === 'M') {
            classMap[g.class_id].boys += g.score
            classMap[g.class_id].bCount++
          } else {
            classMap[g.class_id].girls += g.score
            classMap[g.class_id].gCount++
          }

          // Subject stats
          if (!subjectMap[g.subject_id]) subjectMap[g.subject_id] = { total: 0, count: 0 }
          subjectMap[g.subject_id].total += g.score
          subjectMap[g.subject_id].count++
        })

        // Fetch class names for mapping
        const { data: classes } = await supabase!.from('classes').select('id, name').eq('school_id', schoolId)
        const classNameMap = classes?.reduce((acc: any, c: any) => ({ ...acc, [c.id]: c.name }), {})

        const classPerformance = Object.keys(classMap).map(id => ({
          class: classNameMap[id] || 'N/A',
          avg: Math.round(classMap[id].total / classMap[id].count),
          boys: classMap[id].bCount > 0 ? Math.round(classMap[id].boys / classMap[id].bCount) : 0,
          girls: classMap[id].gCount > 0 ? Math.round(classMap[id].girls / classMap[id].gCount) : 0,
        }))

        // Fetch subject names for mapping
        const { data: subjects } = await supabase!.from('subjects').select('id, name').eq('school_id', schoolId)
        const subjectNameMap = subjects?.reduce((acc: any, s: any) => ({ ...acc, [s.id]: s.name }), {})

        const subjectPerformance = Object.keys(subjectMap).map(id => ({
          subject: subjectNameMap[id] || 'N/A',
          avg: Math.round(subjectMap[id].total / subjectMap[id].count),
        }))

        // 3. Attendance Trends (Daily for last 7 days)
        const { data: attendance } = await supabase
          .from('attendance')
          .select('date, status, students!inner(school_id)')
          .eq('students.school_id', schoolId)
          .order('date', { ascending: false })
          .limit(500)

        const dateMap: any = {}
        attendance?.forEach((a: any) => {
          if (!dateMap[a.date]) dateMap[a.date] = { present: 0, absent: 0, late: 0 }
          dateMap[a.date][a.status]++
        })

        const attendanceTrends = Object.keys(dateMap).sort().map(date => ({
          day: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
          date,
          ...dateMap[date]
        })).slice(-7)

        // 4. Fee Collection (Monthly)
        const { data: payments } = await supabase
          .from('fee_payments')
          .select('amount_paid, payment_date, students!inner(school_id)')
          .eq('students.school_id', schoolId)

        const monthMap: any = {}
        payments?.forEach((p: any) => {
          const month = new Date(p.payment_date).toLocaleString('default', { month: 'short' })
          monthMap[month] = (monthMap[month] || 0) + Number(p.amount_paid)
        })

        // Approximate expected fees (sum of all fee structures * students)
        const { data: feeStructure } = await supabase!.from('fee_structure').select('amount').eq('school_id', schoolId)
        const totalExpectedPerStudent = feeStructure?.reduce((sum, f) => sum + Number(f.amount), 0) || 0
        const monthlyExpected = totalExpectedPerStudent * (students?.length || 1) / 3 // Roughly per term month

        const feeCollectionData = Object.keys(monthMap).map(month => ({
          month,
          collected: monthMap[month],
          expected: monthlyExpected,
        }))

        // Summary Stats
        const totalStudents = students?.length || 0
        const totalGrades = grades?.length || 0
        const avgGrade = totalGrades > 0 ? Math.round((grades?.reduce((s, g) => s + g.score, 0) || 0) / totalGrades) : 0
        const totalAttendance = attendance?.length || 0
        const avgAttendance = totalAttendance > 0 ? Math.round(((attendance?.filter(a => a.status === 'present').length || 0) / totalAttendance) * 100) : 0
        const totalCollected = payments?.reduce((s, p) => s + Number(p.amount_paid), 0) || 0
        const feeRate = totalExpectedPerStudent > 0 ? Math.round((totalCollected / (totalExpectedPerStudent * totalStudents)) * 100) : 0

        setData({
          attendanceTrends,
          classPerformance,
          subjectPerformance,
          feeCollection: feeCollectionData,
          genderDistribution,
          stats: {
            totalStudents,
            avgAttendance,
            avgGrade,
            feeCollectionRate: feeRate,
          }
        })
      } catch (err) {
        console.error('Analytics Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [schoolId])

  return { data, loading }
}

// Timetable hook
export function useTimetable(classId?: string) {
  const [timetable, setTimetable] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTimetable() {
      if (!classId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('timetable')
          .select(`
            *,
            subjects (name, code),
            teachers:users!teacher_id (full_name)
          `)
          .eq('class_id', classId)
          .order('day_of_week')
          .order('start_time')

        if (error) {
          // If table doesn't exist, we'll return empty list instead of erroring
          if (error.code === '42P01') {
             console.warn('Timetable table does not exist yet.')
             setTimetable([])
             return
          }
          throw error
        }
        setTimetable(data || [])
      } catch (err) {
        console.error('Error fetching timetable:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTimetable()
  }, [classId])

  const saveEntry = async (entry: any) => {
    try {
      const { data, error } = await supabase
        .from('timetable')
        .upsert(entry)
        .select()
        .single()

      if (error) throw error
      setTimetable(prev => {
        const idx = prev.findIndex(t => t.id === entry.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = data
          return updated
        }
        return [...prev, data]
      })
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase!.from('timetable').delete().eq('id', id)
      if (error) throw error
      setTimetable(prev => prev.filter(t => t.id !== id))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  return { timetable, loading, saveEntry, deleteEntry }
}

// Staff hook - get all staff for a school
export function useStaff(schoolId?: string) {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchStaff() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      // Demo mode
      if (isDemo) {
        setLoading(false)
        const { getDemoStaff } = await import('@/lib/demo-data')
        setStaff(getDemoStaff())
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('full_name')

        if (error) throw error
        setStaff(data || [])
      } catch (err) {
        console.error('Error fetching staff:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStaff()
  }, [schoolId, isDemo])

  return { staff, loading }
}

// Events hook
export function useEvents(schoolId?: string) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchEvents() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      // Demo mode
      if (isDemo) {
        setLoading(false)
        const { getDemoEvents } = await import('@/lib/demo-data')
        setEvents(getDemoEvents())
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: true })

        if (error) throw error
        setEvents(data || [])
      } catch (err) {
        console.error('Error fetching events:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [schoolId, isDemo])

  return { events, loading }
}

// Messages hook
export function useMessages(schoolId?: string) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchMessages() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      // Demo mode
      if (isDemo) {
        setLoading(false)
        const { getDemoMessages } = await import('@/lib/demo-data')
        setMessages(getDemoMessages())
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        setMessages(data || [])
      } catch (err) {
        console.error('Error fetching messages:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [schoolId, isDemo])

  return { messages, loading }
}

// Dashboard Stats - enhanced for demo
export function useDashboardStats(schoolId?: string) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    feesCollected: 0,
    feesBalance: 0,
    totalClasses: 0,
    totalTeachers: 0,
  })
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchStats() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      // Demo mode check
      const isDemoMode = isDemo || localStorage.getItem('demo_user') !== null
      if (isDemoMode && schoolId === 'demo-school') {
        setLoading(false)
        const { getDemoStats, getDemoStudents, getDemoPayments, getDemoFeeStructure, getDemoClasses } = await import('@/lib/demo-data')
        const demoStats = getDemoStats()
        const students = getDemoStudents()
        const payments = getDemoPayments()
        const feeStructure = getDemoFeeStructure()
        const classes = getDemoClasses()
        
        const totalExpected = feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0)
        const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
        
        setStats({
          totalStudents: demoStats.totalStudents,
          presentToday: Math.floor(demoStats.totalStudents * 0.85),
          feesCollected: totalCollected,
          feesBalance: Math.max(0, totalExpected - totalCollected),
          totalClasses: demoStats.totalClasses,
          totalTeachers: demoStats.totalStaff,
        })
        return
      }

      try {
        setLoading(true)

        const { count: studentCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('status', 'active')

        const { count: classCount } = await supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId)

        const { count: teacherCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('role', 'teacher')

        const today = new Date().toISOString().split('T')[0]
        const { count: presentCount } = await supabase
          .from('attendance')
          .select('*, students!inner(school_id)', { count: 'exact', head: true })
          .eq('students.school_id', schoolId)
          .eq('date', today)
          .eq('status', 'present')

        const { data: payments } = await supabase
          .from('fee_payments')
          .select('amount_paid, students!inner(school_id)')
          .eq('students.school_id', schoolId)

        const totalCollected = payments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0

        const { data: feeStructure } = await supabase
          .from('fee_structure')
          .select('amount')
          .eq('school_id', schoolId)

        const totalExpected = feeStructure?.reduce((sum, f) => sum + Number(f.amount), 0) || 0

        setStats({
          totalStudents: studentCount || 0,
          presentToday: presentCount || 0,
          feesCollected: totalCollected,
          feesBalance: Math.max(0, totalExpected - totalCollected),
          totalClasses: classCount || 0,
          totalTeachers: teacherCount || 0,
        })
      } catch (err) {
        console.error('Error fetching stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [schoolId, isDemo])

  return { stats, loading }
}

// Exam scores hook - for secondary school exams (BOT, EOT, Mid Term, Saturday Tests)
export function useExamScores(classId?: string, subjectId?: string, term?: number, academicYear?: string) {
  const [examScores, setExamScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const saveExamScore = async (score: {
    student_id: string
    subject_id: string
    class_id: string
    exam_type: string  // bot, mid_term, saturday, eot, class_test
    score: number
    max_score?: number
    term: number
    academic_year: string
    recorded_by?: string
  }) => {
    if (isDemo) {
      const newScore = { ...score, id: `demo-exam-${Date.now()}`, max_score: score.max_score || 100 }
      setExamScores(prev => {
        const existing = prev.findIndex(s => 
          s.student_id === score.student_id && 
          s.subject_id === score.subject_id && 
          s.exam_type === score.exam_type
        )
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = newScore
          return updated
        }
        return [...prev, newScore]
      })
      return newScore
    }

    try {
      const { data, error } = await supabase
        .from('exam_scores')
        .upsert({
          student_id: score.student_id,
          subject_id: score.subject_id,
          class_id: score.class_id,
          exam_type: score.exam_type,
          score: score.score,
          max_score: score.max_score || 100,
          term: score.term,
          academic_year: score.academic_year,
          recorded_by: score.recorded_by,
        }, { onConflict: 'student_id,subject_id,exam_type,term,academic_year' })
        .select()
        .single()

      if (error) throw error
      setExamScores(prev => {
        const existing = prev.findIndex(s => 
          s.student_id === score.student_id && 
          s.subject_id === score.subject_id && 
          s.exam_type === score.exam_type
        )
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = data
          return updated
        }
        return [...prev, data]
      })
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
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
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchExamScores() {
      if (!classId) {
        setLoading(false)
        return
      }

      if (isDemo) {
        const { getDemoStudents } = await import('@/lib/demo-data')
        const students = getDemoStudents()
        const demoScores = students.slice(0, 10).map(s => ({
          id: `demo-exam-${s.id}`,
          student_id: s.id,
          subject_id: subjectId || 'demo-subject',
          class_id: classId,
          exam_type: 'eot',
          score: Math.floor(Math.random() * 40) + 60,
          max_score: 100,
          term: term || 1,
          academic_year: academicYear || '2026',
        }))
        setExamScores(demoScores)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        let query = supabase
          .from('exam_scores')
          .select(`
            *,
            students (id, first_name, last_name),
            subjects (id, name, code)
          `)
          .eq('class_id', classId)

        if (subjectId) query = query.eq('subject_id', subjectId)
        if (term) query = query.eq('term', term)
        if (academicYear) query = query.eq('academic_year', academicYear)

        const { data, error } = await query

        if (error) {
          if (error.code === '42P01') {
            console.warn('exam_scores table does not exist yet')
            setExamScores([])
            setLoading(false)
            return
          }
          throw error
        }
        setExamScores(data || [])
      } catch (err) {
        console.error('Error fetching exam scores:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchExamScores()
  }, [classId, subjectId, term, academicYear, isDemo])

  return { examScores, loading, saveExamScore, deleteExamScore }
}

// Get all exams for a school
export function useExams(schoolId?: string) {
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createExam = async (exam: {
    name: string
    exam_type: string
    class_id: string
    subject_id: string
    term: number
    academic_year: string
    exam_date: string
    max_score: number
    weight: number
  }) => {
    if (isDemo) {
      const newExam = { ...exam, id: `demo-exam-${Date.now()}`, school_id: 'demo-school' }
      setExams(prev => [newExam, ...prev])
      return newExam
    }

    try {
      const { data, error } = await supabase
        .from('exams')
        .insert({ ...exam, school_id: schoolId })
        .select()
        .single()

      if (error) throw error
      setExams(prev => [data, ...prev])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const deleteExam = async (id: string) => {
    if (isDemo) {
      setExams(prev => prev.filter(e => e.id !== id))
      return
    }

    try {
      const { error } = await supabase.from('exams').delete().eq('id', id)
      if (error) throw error
      setExams(prev => prev.filter(e => e.id !== id))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchExams() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      if (isDemo) {
        setExams([
          { id: '1', name: 'End of Term 1', exam_type: 'eot', term: 1, academic_year: '2026', exam_date: '2026-04-01', max_score: 100, weight: 50 },
          { id: '2', name: 'Mid Term 1', exam_type: 'mid_term', term: 1, academic_year: '2026', exam_date: '2026-02-15', max_score: 100, weight: 20 },
        ])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('exams')
          .select(`
            *,
            classes (name),
            subjects (name)
          `)
          .eq('school_id', schoolId)
          .order('exam_date', { ascending: false })

        if (error) {
          if (error.code === '42P01') {
            console.warn('exams table does not exist yet')
            setExams([])
            setLoading(false)
            return
          }
          throw error
        }
        setExams(data || [])
      } catch (err) {
        console.error('Error fetching exams:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchExams()
  }, [schoolId, isDemo])

  return { exams, loading, createExam, deleteExam }
}

// Staff Attendance Hook
export function useStaffAttendance(schoolId?: string, date?: string) {
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const markAttendance = async (staffId: string, status: string, remarks?: string) => {
    if (isDemo) {
      const newRecord = {
        id: `demo-staff-att-${Date.now()}`,
        staff_id: staffId,
        date: date || new Date().toISOString().split('T')[0],
        status,
        remarks,
      }
      setAttendance(prev => {
        const existing = prev.findIndex(a => a.staff_id === staffId)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = newRecord
          return updated
        }
        return [...prev, newRecord]
      })
      return newRecord
    }

    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .upsert({
          staff_id: staffId,
          date: date || new Date().toISOString().split('T')[0],
          status,
          remarks,
        }, { onConflict: 'staff_id,date' })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchAttendance() {
      if (!schoolId || !date) {
        setLoading(false)
        return
      }

      if (isDemo) {
        setAttendance([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('staff_attendance')
          .select('*, users!staff_id(full_name, phone)')
          .eq('date', date)

        if (error) throw error
        setAttendance(data || [])
      } catch (err) {
        console.error('Error fetching staff attendance:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [schoolId, date, isDemo])

  return { attendance, loading, markAttendance }
}

// Leave Requests Hook
export function useLeaveRequests(schoolId?: string) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createRequest = async (request: {
    staff_id: string
    leave_type: string
    start_date: string
    end_date: string
    days_count: number
    reason: string
  }) => {
    if (isDemo) {
      const newRequest = { ...request, id: `demo-leave-${Date.now()}`, status: 'pending', created_at: new Date().toISOString() }
      setRequests(prev => [newRequest, ...prev])
      return newRequest
    }

    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert(request)
        .select()
        .single()

      if (error) throw error
      setRequests(prev => [data, ...prev])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const updateRequestStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (isDemo) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      return
    }

    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .update({ status, approved_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setRequests(prev => prev.map(r => r.id === id ? data : r))
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchRequests() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      if (isDemo) {
        setRequests([
          { id: '1', staff_id: 'demo', leave_type: 'annual', start_date: '2026-04-01', end_date: '2026-04-05', days_count: 5, reason: 'Family vacation', status: 'pending' },
        ])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('leave_requests')
          .select('*, users!staff_id(full_name, phone)')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setRequests(data || [])
      } catch (err) {
        console.error('Error fetching leave requests:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [schoolId, isDemo])

  return { requests, loading, createRequest, updateRequestStatus }
}

// Subject Allocations Hook
export function useSubjectAllocations(schoolId?: string, academicYear?: string) {
  const [allocations, setAllocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const createAllocation = async (allocation: {
    teacher_id: string
    subject_id: string
    class_id: string
    academic_year: string
    term?: number
    is_class_teacher?: boolean
  }) => {
    try {
      const { data, error } = await supabase
        .from('subject_allocations')
        .insert(allocation)
        .select()
        .single()

      if (error) throw error
      setAllocations(prev => [...prev, data])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const deleteAllocation = async (id: string) => {
    try {
      const { error } = await supabase.from('subject_allocations').delete().eq('id', id)
      if (error) throw error
      setAllocations(prev => prev.filter(a => a.id !== id))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchAllocations() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        let query = supabase
          .from('subject_allocations')
          .select('*, users!teacher_id(full_name), subjects(name), classes(name)')
          .eq('school_id', schoolId)

        if (academicYear) query = query.eq('academic_year', academicYear)

        const { data, error } = await query

        if (error) throw error
        setAllocations(data || [])
      } catch (err) {
        console.error('Error fetching allocations:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAllocations()
  }, [schoolId, academicYear])

  return { allocations, loading, createAllocation, deleteAllocation }
}

// Assets Hook
export function useAssets(schoolId?: string) {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const createAsset = async (asset: any) => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .insert({ ...asset, school_id: schoolId })
        .select()
        .single()

      if (error) throw error
      setAssets(prev => [data, ...prev])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const updateAsset = async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setAssets(prev => prev.map(a => a.id === id ? data : a))
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const deleteAsset = async (id: string) => {
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id)
      if (error) throw error
      setAssets(prev => prev.filter(a => a.id !== id))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchAssets() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('assets')
          .select('*')
          .eq('school_id', schoolId)
          .order('name')

        if (error) throw error
        setAssets(data || [])
      } catch (err) {
        console.error('Error fetching assets:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAssets()
  }, [schoolId])

  return { assets, loading, createAsset, updateAsset, deleteAsset }
}

// Transport Hook
export function useTransport(schoolId?: string) {
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const createRoute = async (route: any) => {
    try {
      const { data, error } = await supabase
        .from('transport_routes')
        .insert({ ...route, school_id: schoolId })
        .select()
        .single()

      if (error) throw error
      setRoutes(prev => [...prev, data])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const deleteRoute = async (id: string) => {
    try {
      const { error } = await supabase.from('transport_routes').delete().eq('id', id)
      if (error) throw error
      setRoutes(prev => prev.filter(r => r.id !== id))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchRoutes() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('transport_routes')
          .select('*')
          .eq('school_id', schoolId)
          .order('route_name')

        if (error) throw error
        setRoutes(data || [])
      } catch (err) {
        console.error('Error fetching routes:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRoutes()
  }, [schoolId])

  return { routes, loading, createRoute, deleteRoute }
}

// Budget & Expenses Hook
export function useBudget(schoolId?: string) {
  const [budgets, setBudgets] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const createBudget = async (budget: any) => {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .insert({ ...budget, school_id: schoolId })
        .select()
        .single()

      if (error) throw error
      setBudgets(prev => [data, ...prev])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const createExpense = async (expense: any) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({ ...expense, school_id: schoolId })
        .select()
        .single()

      if (error) throw error
      setExpenses(prev => [data, ...prev])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const updateExpenseStatus = async (id: string, status: string) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setExpenses(prev => prev.map(e => e.id === id ? data : e))
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const [budgetsRes, expensesRes] = await Promise.all([
          supabase.from('budgets').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
          supabase.from('expenses').select('*').eq('school_id', schoolId).order('expense_date', { ascending: false })
        ])

        setBudgets(budgetsRes.data || [])
        setExpenses(expensesRes.data || [])
      } catch (err) {
        console.error('Error fetching budget data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [schoolId])

  return { budgets, expenses, loading, createBudget, createExpense, updateExpenseStatus }
}

// Behavior Log Hook
export function useBehaviorLogs(studentId?: string, schoolId?: string) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const addLog = async (log: {
    student_id: string
    date: string
    incident_type: string
    category: string
    description: string
    action_taken?: string
    points?: number
  }) => {
    try {
      const { data, error } = await supabase
        .from('behavior_logs')
        .insert(log)
        .select()
        .single()

      if (error) throw error
      setLogs(prev => [data, ...prev])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchLogs() {
      if (!schoolId && !studentId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        let query = supabase
          .from('behavior_logs')
          .select('*, users!recorded_by(full_name)')
          .order('date', { ascending: false })

        if (studentId) query = query.eq('student_id', studentId)
        if (schoolId) query = query.eq('school_id', schoolId)

        const { data, error } = await query

        if (error) throw error
        setLogs(data || [])
      } catch (err) {
        console.error('Error fetching behavior logs:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [studentId, schoolId])

  return { logs, loading, addLog }
}

// Lesson Plans Hook
export function useLessonPlans(schoolId?: string, teacherId?: string) {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const createPlan = async (plan: any) => {
    try {
      const { data, error } = await supabase
        .from('lesson_plans')
        .insert({ ...plan, school_id: schoolId })
        .select()
        .single()

      if (error) throw error
      setPlans(prev => [data, ...prev])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const updatePlan = async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('lesson_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setPlans(prev => prev.map(p => p.id === id ? data : p))
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const deletePlan = async (id: string) => {
    try {
      const { error } = await supabase.from('lesson_plans').delete().eq('id', id)
      if (error) throw error
      setPlans(prev => prev.filter(p => p.id !== id))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchPlans() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        let query = supabase
          .from('lesson_plans')
          .select('*, subjects(name), classes(name), users!teacher_id(full_name)')
          .eq('school_id', schoolId)
          .order('lesson_date', { ascending: false })

        if (teacherId) query = query.eq('teacher_id', teacherId)

        const { data, error } = await query

        if (error) throw error
        setPlans(data || [])
      } catch (err) {
        console.error('Error fetching lesson plans:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPlans()
  }, [schoolId, teacherId])

  return { plans, loading, createPlan, updatePlan, deletePlan }
}

// Scheme of Work Hook
export function useSchemeOfWork(schoolId?: string) {
  const [schemes, setSchemes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const createScheme = async (scheme: any) => {
    try {
      const { data, error } = await supabase
        .from('scheme_of_work')
        .insert({ ...scheme, school_id: schoolId })
        .select()
        .single()

      if (error) throw error
      setSchemes(prev => [...prev, data])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const updateSchemeStatus = async (id: string, status: string) => {
    try {
      const { data, error } = await supabase
        .from('scheme_of_work')
        .update({ status, completed_date: status === 'completed' ? new Date().toISOString().split('T')[0] : null })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setSchemes(prev => prev.map(s => s.id === id ? data : s))
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchSchemes() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('scheme_of_work')
          .select('*, subjects(name), classes(name)')
          .eq('school_id', schoolId)
          .order('week_number', { ascending: true })

        if (error) throw error
        setSchemes(data || [])
      } catch (err) {
        console.error('Error fetching scheme of work:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSchemes()
  }, [schoolId])

  return { schemes, loading, createScheme, updateSchemeStatus }
}

// Health Records Hook
export function useHealthRecords(schoolId?: string) {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const createRecord = async (record: any) => {
    try {
      const { data, error } = await supabase
        .from('health_records')
        .insert(record)
        .select()
        .single()

      if (error) throw error
      setRecords(prev => [...prev, data])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const updateRecord = async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('health_records')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setRecords(prev => prev.map(r => r.id === id ? data : r))
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    async function fetchRecords() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('health_records')
          .select('*, students(first_name, last_name, classes(name))')
          .order('created_at', { ascending: false })

        if (error) throw error
        setRecords(data || [])
      } catch (err) {
        console.error('Error fetching health records:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRecords()
  }, [schoolId])

  return { records, loading, createRecord, updateRecord }
}
