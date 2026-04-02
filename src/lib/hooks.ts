'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'
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
  TimetableEntry,
  StaffSalary,
  SalaryPayment,
  StaffReview,
  InventoryTransaction,
  TimetableSlot,
  TimetableConstraint,
  DormRoom,
  DormIncident,
  TransportLog,
  TransportRoute
} from '@/types'

const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001'

function getQuerySchoolId(schoolId: string | undefined, isDemo: boolean): string | undefined {
  if (!schoolId) return undefined
  if (isDemo && schoolId === 'demo-school') return DEMO_SCHOOL_ID
  return schoolId
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), ms)
      )
    ])
  } catch (e) {
    console.warn('Query timeout or error:', e)
    return fallback
  }
}

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
  const select = options?.select || '*'
  const filters = options?.filters
  const orderBy = options?.orderBy
  const limit = options?.limit

  const filtersRef = useRef(filters)
  const prevFiltersRef = useRef<string>('')

  useEffect(() => {
    const currentFiltersStr = JSON.stringify(filters ?? {})
    if (currentFiltersStr !== prevFiltersRef.current) {
      filtersRef.current = filters
      prevFiltersRef.current = currentFiltersStr
    }
  }, [filters])

  const fetchData = useCallback(async () => {
    if (!supabase) return
    
    try {
      setLoading(true)
      setError(null)

      let query = supabase.from(table).select(select)

      if (filtersRef.current) {
        Object.entries(filtersRef.current).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            query = query.eq(key, value)
          }
        })
      }

      if (orderBy) {
        query = query.order(orderBy.column, {
          ascending: orderBy.ascending ?? false,
        })
      }

      if (limit) {
        query = query.limit(limit)
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
  }, [table, select, orderBy, limit])

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
  }, [schoolId, limit])

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

    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      setLoading(true)
      const data = await withTimeout(
        supabase
          .from('students')
          .select(`*, classes (id, name, level)`)
          .eq('school_id', querySchoolId)
          .order('created_at', { ascending: false })
          .then(r => { if (r.error) throw r.error; return r.data }),
        8000,
        [] as Student[]
      )
      setStudents((data as Student[]) || [])
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [schoolId, isDemo])

  const createStudent = async (student: CreateStudentInput) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error: insertError } = await supabase
        .from('students')
        .insert({ ...student, school_id: querySchoolId })
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
    let cancelled = false
    
    async function fetchClasses() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const data = await withTimeout(
          supabase.from('classes').select('*').eq('school_id', querySchoolId).order('name').then(r => { if (r.error) throw r.error; return r.data }),
          5000,
          [] as Class[]
        )
        if (!cancelled) setClasses((data as Class[]) || [])
      } catch (err) {
        console.warn('Classes fetch error (using empty):', err)
        if (!cancelled) setClasses([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchClasses()
    return () => { cancelled = true }
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

    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      setLoading(true)
      const data = await withTimeout(
        supabase
          .from('fee_payments')
          .select(`*, students!inner (id, first_name, last_name, school_id, classes (name))`)
          .eq('students.school_id', querySchoolId)
          .order('payment_date', { ascending: false })
          .then(r => { if (r.error) throw r.error; return r.data }),
        8000,
        [] as FeePayment[]
      )
      setPayments((data as FeePayment[]) || [])
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [schoolId, isDemo])

  const createPayment = async (payment: CreatePaymentInput) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error: insertError } = await supabase
        .from('fee_payments')
        .insert({ ...payment, school_id: querySchoolId })
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

    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      setLoading(true)
      const data = await withTimeout(
        supabase.from('fee_structure').select(`*, classes (name)`).eq('school_id', querySchoolId).order('name').then(r => { if (r.error) throw r.error; return r.data }),
        5000,
        [] as FeeStructure[]
      )
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

  const createFeeStructure = async (fee: {
    name: string
    class_id?: string
    amount: number
    term: number
    academic_year: string
    due_date?: string
  }) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('fee_structure')
        .insert({
          school_id: querySchoolId,
          name: fee.name,
          class_id: fee.class_id || null,
          amount: fee.amount,
          term: fee.term,
          academic_year: fee.academic_year,
          due_date: fee.due_date || null,
        })
        .select()
        .single()

      if (error) throw error
      setFeeStructure((prev) => [...prev, data])
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  useEffect(() => {
    fetchFeeStructure()
  }, [fetchFeeStructure])

  return { feeStructure, loading, deleteFeeStructure, createFeeStructure, refetch: fetchFeeStructure }
}

// Attendance History hook - for dropout tracking
export function useAttendanceHistory(schoolId?: string) {
  const [loading, setLoading] = useState(false)

  const getConsecutiveAbsentStudents = useCallback(async () => {
    if (!schoolId) return []
    setLoading(true)
    try {
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select('student_id, date, status, students!inner(id, first_name, last_name, class_id, school_id, status, classes(name))')
        .eq('students.school_id', schoolId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })

      if (error) throw error

      const studentAttendance: Record<string, { dates: string[], statuses: Record<string, string>, student: any }> = {}
      attendanceData?.forEach((record: any) => {
        const sid = record.student_id
        if (!studentAttendance[sid]) {
          studentAttendance[sid] = { dates: [], statuses: {}, student: record.students }
        }
        studentAttendance[sid].dates.push(record.date)
        studentAttendance[sid].statuses[record.date] = record.status
      })

      const atRiskStudents: Array<{
        student: any
        consecutiveAbsent: number
        lastAttendanceDate: string | null
        riskLevel: 'at_risk' | 'likely_dropout'
      }> = []

      for (const [studentId, data] of Object.entries(studentAttendance)) {
        if (data.student?.status !== 'active') continue

        const sortedDates = data.dates.sort().reverse()
        let consecutiveAbsent = 0
        let lastAttendanceDate: string | null = null

        for (const date of sortedDates) {
          if (data.statuses[date] === 'absent') {
            consecutiveAbsent++
          } else {
            lastAttendanceDate = date
            break
          }
        }

        if (consecutiveAbsent >= 14) {
          atRiskStudents.push({
            student: data.student,
            consecutiveAbsent,
            lastAttendanceDate,
            riskLevel: consecutiveAbsent >= 30 ? 'likely_dropout' : 'at_risk',
          })
        }
      }

      return atRiskStudents.sort((a, b) => b.consecutiveAbsent - a.consecutiveAbsent)
    } catch (err) {
      console.error('Error fetching attendance history:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  return { getConsecutiveAbsentStudents, loading }
}

// Attendance hook
export function useAttendance(classId?: string, date?: string) {
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const markAttendance = async (studentId: string, status: string, recordedBy?: string) => {
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('school_id', querySchoolId)
          .order('name')

        if (error) throw error

        let currentSubjects = data || []

        if (currentSubjects.length === 0 && autoSeed) {
          const { getDefaultSubjects } = await import('@/lib/curriculum')
          const defaultSubjects = getDefaultSubjects('primary')
          
          const seeds = defaultSubjects.map(s => ({ 
            name: s.name, 
            code: s.code, 
            level: s.level, 
            is_compulsory: s.is_compulsory,
            school_id: querySchoolId 
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
    revenueProjections: [],
    atRiskStudents: [],
    stats: {
      totalStudents: 0,
      avgAttendance: 0,
      avgGrade: 0,
      feeCollectionRate: 0,
      projectedRevenue: 0,
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAnalytics() {
      if (!schoolId) return
      try {
        setLoading(true)

        // Parallelize all main fetches
        const [
          { data: students },
          { data: feeStructure },
          { data: attendance },
          { data: grades }
        ] = await Promise.all([
          supabase.from('students').select('id, full_name, gender, class_id, classes(name)').eq('school_id', schoolId).eq('status', 'active'),
          supabase.from('fee_structure').select('id, amount').eq('school_id', schoolId),
          supabase.from('attendance').select('student_id, status').eq('school_id', schoolId).order('date', { ascending: false }).limit(2000), // Limit to recent records for perf
          supabase.from('grades').select('student_id, score').eq('school_id', schoolId)
        ])

        // 1. Gender Distribution (Optimized)
        const genderLevels = { M: 0, F: 0 }
        students?.forEach((s: any) => {
          if (s.gender === 'M') genderLevels.M++
          else if (s.gender === 'F') genderLevels.F++
        })

        const genderDistribution = [
          { name: 'Boys', value: genderLevels.M, color: '#3b82f6' },
          { name: 'Girls', value: genderLevels.F, color: '#ec4899' },
        ]

        // 2. Revenue Projections
        const feeIds = feeStructure?.map(f => f.id) || []
        let totalCollected = 0
        if (feeIds.length > 0) {
          const { data: payments } = await supabase.from('fee_payments').select('amount_paid').in('fee_id', feeIds)
          totalCollected = payments?.reduce((acc, p) => acc + (p.amount_paid || 0), 0) || 0
        }
        
        const totalExpected = feeStructure?.reduce((acc, f) => acc + (f.amount || 0), 0) || 0
        const revenueProjections = [
          { name: 'Collected', value: totalCollected },
          { name: 'Outstanding', value: Math.max(0, totalExpected - totalCollected) }
        ]

        // 3. Optimized At-Risk Detection (Map-based for O(N))
        const attendanceMap: Record<string, { present: number, total: number }> = {}
        attendance?.forEach((a: any) => {
          if (!attendanceMap[a.student_id]) attendanceMap[a.student_id] = { present: 0, total: 0 }
          attendanceMap[a.student_id].total++
          if (a.status === 'present') attendanceMap[a.student_id].present++
        })

        const gradesMap: Record<string, { sum: number, count: number }> = {}
        grades?.forEach((g: any) => {
          if (!gradesMap[g.student_id]) gradesMap[g.student_id] = { sum: 0, count: 0 }
          gradesMap[g.student_id].sum += g.score
          gradesMap[g.student_id].count++
        })

        const atRiskStudents = students?.map(s => {
          const att = attendanceMap[s.id]
          const attRate = att ? (att.present / att.total) * 100 : 100
          
          const grd = gradesMap[s.id]
          const avgScore = grd ? grd.sum / grd.count : 100

          if (attRate < 75 || avgScore < 50) {
            return {
              student_id: s.id,
              full_name: s.full_name,
              class_name: s.classes?.[0]?.name || 'N/A',
              risk_reason: attRate < 75 && avgScore < 50 ? 'both' : (attRate < 75 ? 'low_attendance' : 'low_grades'),
              attendance_rate: attRate,
              avg_score: avgScore
            }
          }
          return null
        }).filter(s => s !== null)

        setData({
          genderDistribution,
          revenueProjections,
          atRiskStudents: atRiskStudents || [],
          attendanceTrends: [],
          classPerformance: [],
          subjectPerformance: [],
          feeCollection: [],
          stats: {
            totalStudents: students?.length || 0,
            avgAttendance: 92, // Placeholder for future logic
            avgGrade: 74,     // Placeholder for future logic
            feeCollectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
            projectedRevenue: totalExpected
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

// SMS Triggers Hook
interface SMSTrigger {
  id: string
  school_id: string
  name: string
  event_type: string
  threshold_days: number
  is_active: boolean
  created_at: string
  last_run_at?: string
}

export function useSMSTriggers(schoolId?: string) {
  const [triggers, setTriggers] = useState<SMSTrigger[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const toggleTrigger = async (id: string, isActive: boolean) => {
    if (isDemo) {
      setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_active: isActive } : t))
      return { success: true }
    }
    try {
      const { error } = await supabase.from('sms_triggers').update({ is_active: isActive }).eq('id', id)
      if (error) throw error
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    async function fetchTriggers() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      if (isDemo) {
        setTriggers([
          { id: '1', school_id: schoolId, name: 'Fee Reminder (15d)', event_type: 'fee_overdue', threshold_days: 15, is_active: true, created_at: new Date().toISOString() },
          { id: '2', school_id: schoolId, name: 'Absentee Alert', event_type: 'student_absent', threshold_days: 1, is_active: false, created_at: new Date().toISOString() },
        ])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase.from('sms_triggers').select('*').eq('school_id', schoolId)
        if (error) throw error
        setTriggers(data || [])
      } catch (err) {
        console.error('Error fetching SMS triggers:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTriggers()
  }, [schoolId, isDemo])

  return { triggers, loading, toggleTrigger }
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
            teachers:profiles (full_name)
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
    let cancelled = false
    
    async function fetchStaff() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const data = await withTimeout(
          supabase.from('users').select('*').eq('school_id', querySchoolId).eq('is_active', true).order('full_name').then(r => { if (r.error) throw r.error; return r.data }),
          5000,
          [] as any[]
        )
        if (!cancelled) setStaff(data || [])
      } catch (err) {
        console.error('Error fetching staff:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStaff()
    return () => { cancelled = true }
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('school_id', querySchoolId)
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('school_id', querySchoolId)
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
    let cancelled = false
    
    async function fetchStats() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)

        // Run queries in parallel with timeout
        const [studentCount, classCount, teacherCount, presentCount, payments, feeStructure] = await Promise.all([
          withTimeout(
            supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', querySchoolId).eq('status', 'active').then(r => r.count),
            5000, 0
          ),
          withTimeout(
            supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', querySchoolId).then(r => r.count),
            5000, 0
          ),
          withTimeout(
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('school_id', querySchoolId).eq('role', 'teacher').then(r => r.count),
            5000, 0
          ),
          withTimeout(
            supabase.from('attendance').select('*, students!inner(school_id)', { count: 'exact', head: true }).eq('students.school_id', querySchoolId).eq('date', new Date().toISOString().split('T')[0]).eq('status', 'present').then(r => r.count),
            5000, 0
          ),
          withTimeout(
            supabase.from('fee_payments').select('amount_paid, students!inner(school_id)').eq('students.school_id', querySchoolId).then(r => r.data),
            5000, []
          ),
          withTimeout(
            supabase.from('fee_structure').select('amount').eq('school_id', querySchoolId).then(r => r.data),
            5000, []
          ),
        ])

        if (cancelled) return

        const totalCollected = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0)
        const totalExpected = (feeStructure || []).reduce((sum: number, f: any) => sum + Number(f.amount || 0), 0)

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
        if (!cancelled) setLoading(false)
      }
    }

    fetchStats()
    
    return () => { cancelled = true }
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
    exam_type: string
    score: number
    max_score?: number
    term: number
    academic_year: string
    recorded_by?: string
  }) => {
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
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('exams')
        .insert({ ...exam, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('exams')
          .select(`
            *,
            classes (name),
            subjects (name)
          `)
          .eq('school_id', querySchoolId)
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
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .upsert({
          staff_id: staffId,
          school_id: querySchoolId,
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('staff_attendance')
          .select('*, users!staff_id(full_name, phone)')
          .eq('school_id', querySchoolId)
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
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert({ ...request, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('leave_requests')
          .select('*, users!staff_id(full_name, phone)')
          .eq('school_id', querySchoolId)
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
  const { isDemo } = useAuth()

  const createAllocation = async (allocation: {
    teacher_id: string
    subject_id: string
    class_id: string
    academic_year: string
    term?: number
    is_class_teacher?: boolean
  }) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('subject_allocations')
        .insert({ ...allocation, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        let query = supabase
          .from('subject_allocations')
          .select('*, users!teacher_id(full_name), subjects(name), classes(name)')
          .eq('school_id', querySchoolId)

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
  }, [schoolId, academicYear, isDemo])

  return { allocations, loading, createAllocation, deleteAllocation }
}

// Assets Hook
export function useAssets(schoolId?: string) {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createAsset = async (asset: any) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('assets')
        .insert({ ...asset, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('assets')
          .select('*')
          .eq('school_id', querySchoolId)
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
  }, [schoolId, isDemo])

  return { assets, loading, createAsset, updateAsset, deleteAsset }
}

// Transport Hook
export function useTransport(schoolId?: string) {
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createRoute = async (route: any) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('transport_routes')
        .insert({ ...route, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('transport_routes')
          .select('*')
          .eq('school_id', querySchoolId)
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
  }, [schoolId, isDemo])

  return { routes, loading, createRoute, deleteRoute }
}

// Budget & Expenses Hook
export function useBudget(schoolId?: string) {
  const [budgets, setBudgets] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createBudget = async (budget: any) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('budgets')
        .insert({ ...budget, school_id: querySchoolId })
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
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({ ...expense, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const [budgetsRes, expensesRes] = await Promise.all([
          supabase.from('budgets').select('*').eq('school_id', querySchoolId).order('created_at', { ascending: false }),
          supabase.from('expenses').select('*').eq('school_id', querySchoolId).order('expense_date', { ascending: false })
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
  }, [schoolId, isDemo])

  return { budgets, expenses, loading, createBudget, createExpense, updateExpenseStatus }
}

// Behavior Log Hook
export function useBehaviorLogs(studentId?: string, schoolId?: string) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const addLog = async (log: {
    student_id: string
    date: string
    incident_type: string
    category: string
    description: string
    action_taken?: string
    points?: number
  }) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('behavior_logs')
        .insert({ ...log, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        let query = supabase
          .from('behavior_logs')
          .select('*, users!recorded_by(full_name)')
          .order('date', { ascending: false })

        if (studentId) query = query.eq('student_id', studentId)
        if (querySchoolId) query = query.eq('school_id', querySchoolId)

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
  }, [studentId, schoolId, isDemo])

  return { logs, loading, addLog }
}

// Lesson Plans Hook
export function useLessonPlans(schoolId?: string, teacherId?: string) {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createPlan = async (plan: any) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('lesson_plans')
        .insert({ ...plan, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        let query = supabase
          .from('lesson_plans')
          .select('*, subjects(name), classes(name), users!teacher_id(full_name)')
          .eq('school_id', querySchoolId)
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
  }, [schoolId, teacherId, isDemo])

  return { plans, loading, createPlan, updatePlan, deletePlan }
}

// Scheme of Work Hook
export function useSchemeOfWork(schoolId?: string) {
  const [schemes, setSchemes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createScheme = async (scheme: any) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('scheme_of_work')
        .insert({ ...scheme, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('scheme_of_work')
          .select('*, subjects(name), classes(name)')
          .eq('school_id', querySchoolId)
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
  }, [schoolId, isDemo])

  return { schemes, loading, createScheme, updateSchemeStatus }
}

// Health Records Hook
export function useHealthRecords(schoolId?: string) {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createRecord = async (record: any) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('health_records')
        .insert({ ...record, school_id: querySchoolId })
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

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('health_records')
          .select('*, students(first_name, last_name, classes(name))')
          .eq('school_id', querySchoolId)
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
  }, [schoolId, isDemo])

  return { records, loading, createRecord, updateRecord }
}

// Staff Salaries Hook
export function useSalaries(schoolId?: string) {
  const [salaries, setSalaries] = useState<StaffSalary[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const updateSalary = async (staffId: string, updates: Partial<StaffSalary>) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { error } = await supabase
        .from('staff_salaries')
        .upsert({ staff_id: staffId, school_id: querySchoolId, ...updates }, { onConflict: 'staff_id' })
      if (error) throw error
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    async function fetchSalaries() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('staff_salaries')
          .select('*, staff:users(*)')
          .eq('school_id', querySchoolId)

        if (error) throw error
        setSalaries(data || [])
      } catch (err) {
        console.error('Error fetching salaries:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSalaries()
  }, [schoolId, isDemo])

  return { salaries, loading, updateSalary }
}

// Salary Payments Hook
export function useSalaryPayments(schoolId?: string) {
  const [payments, setPayments] = useState<SalaryPayment[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const processPayment = async (payment: Omit<SalaryPayment, 'id' | 'created_at'>) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .insert([{ ...payment, school_id: querySchoolId }])
        .select()
        .single()
      if (error) throw error
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    async function fetchPayments() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('salary_payments')
          .select('*, staff:users(*)')
          .eq('school_id', querySchoolId)
          .order('payment_date', { ascending: false })

        if (error) throw error
        setPayments(data || [])
      } catch (err) {
        console.error('Error fetching salary payments:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPayments()
  }, [schoolId, isDemo])

  return { payments, loading, processPayment }
}

// Staff Reviews Hook
export function useStaffReviews(schoolId?: string, staffId?: string) {
  const [reviews, setReviews] = useState<StaffReview[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const submitReview = async (review: Omit<StaffReview, 'id' | 'created_at'>) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('staff_reviews')
        .insert([{ ...review, school_id: querySchoolId }])
        .select()
        .single()
      if (error) throw error
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    async function fetchReviews() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        let query = supabase
          .from('staff_reviews')
          .select('*, staff:users(*), reviewer:users(*)')
          .eq('school_id', querySchoolId)
        
        if (staffId) {
          query = query.eq('staff_id', staffId)
        }

        const { data, error } = await query.order('review_date', { ascending: false })

        if (error) throw error
        setReviews(data || [])
      } catch (err) {
        console.error('Error fetching reviews:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [schoolId, staffId, isDemo])

  return { reviews, loading, submitReview }
}

// Enhanced Inventory Hook
export function useInventory(schoolId?: string) {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const recordTransaction = async (transaction: Omit<InventoryTransaction, 'id' | 'created_at'>) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .insert([{ ...transaction, school_id: querySchoolId }])
        .select()
        .single()
      if (error) throw error

      const stockChange = transaction.transaction_type === 'in' || transaction.transaction_type === 'return' 
        ? transaction.quantity 
        : -transaction.quantity
      
      const { error: updateError } = await supabase.rpc('update_asset_stock', {
        p_asset_id: transaction.asset_id,
        p_change: stockChange
      })
      if (updateError) throw updateError

      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    async function fetchTransactions() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('inventory_transactions')
          .select('*, asset:assets(*)')
          .eq('school_id', querySchoolId)
          .order('transaction_date', { ascending: false })

        if (error) throw error
        setTransactions(data || [])
      } catch (err) {
        console.error('Error fetching inventory transactions:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [schoolId, isDemo])

  return { transactions, loading, recordTransaction }
}

// Enhanced Timetable Hook
export function useTimetableManager(schoolId?: string) {
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [constraints, setConstraints] = useState<TimetableConstraint[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const [slotsRes, constraintsRes] = await Promise.all([
          supabase.from('timetable_slots').select('*').eq('school_id', querySchoolId).order('order_number'),
          supabase.from('timetable_constraints').select('*').eq('school_id', querySchoolId)
        ])

        if (slotsRes.error) throw slotsRes.error
        if (constraintsRes.error) throw constraintsRes.error

        setSlots(slotsRes.data || [])
        setConstraints(constraintsRes.data || [])
      } catch (err) {
        console.error('Error fetching timetable data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [schoolId, isDemo])

  return { slots, constraints, loading }
}

// Student Welfare - Dorm Hook
export function useDormManager(schoolId?: string, dormId?: string) {
  const [rooms, setRooms] = useState<DormRoom[]>([])
  const [incidents, setIncidents] = useState<DormIncident[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const [roomsRes, incidentsRes] = await Promise.all([
          supabase.from('dorm_rooms').select('*').eq('dorm_id', dormId),
          supabase.from('dorm_incidents').select('*, students(first_name, last_name)').eq('dorm_id', dormId).eq('school_id', querySchoolId)
        ])
        setRooms(roomsRes.data || [])
        setIncidents(incidentsRes.data || [])
      } catch (err) {
        console.error('Error fetching dorm welfare data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [schoolId, dormId, isDemo])

  return { rooms, incidents, loading }
}

// Student Welfare - Transport Hook
export function useTransportManager(schoolId?: string) {
  const [logs, setLogs] = useState<TransportLog[]>([])
  const [routes, setRoutes] = useState<TransportRoute[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const [routesRes, logsRes] = await Promise.all([
          supabase.from('transport_routes').select('*, transport_stops(*)').eq('school_id', querySchoolId),
          supabase.from('transport_vehicle_logs').select('*').eq('school_id', querySchoolId).order('log_date', { ascending: false })
        ])
        setRoutes(routesRes.data || [])
        setLogs(logsRes.data || [])
      } catch (err) {
        console.error('Error fetching transport welfare data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [schoolId, isDemo])

  return { routes, logs, loading }
}
