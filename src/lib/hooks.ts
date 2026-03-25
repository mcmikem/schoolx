'use client'
import { useState, useEffect, useCallback } from 'react'
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

      let query = supabase.from(table).select(options?.select || '*')

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
      const { data: result, error: insertError } = await supabase
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
      const { data: result, error: updateError } = await supabase
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

// Dashboard stats hook - Optimized for performance
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

  useEffect(() => {
    async function fetchStats() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // 1. Students count (optimized count only)
        const { count: studentCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('status', 'active')

        // 2. Classes count
        const { count: classCount } = await supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId)

        // 3. Today's attendance - using !inner join to filter by school_id
        const today = new Date().toISOString().split('T')[0]
        const { count: presentCount } = await supabase
          .from('attendance')
          .select('*, students!inner(school_id)', { count: 'exact', head: true })
          .eq('students.school_id', schoolId)
          .eq('date', today)
          .eq('status', 'present')

        // 4. Fees Collected - using !inner join for aggregation
        const { data: payments } = await supabase
          .from('fee_payments')
          .select('amount_paid, students!inner(school_id)')
          .eq('students.school_id', schoolId)

        const totalCollected = payments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0

        // 5. Total Expected Fees (from active students' class fee structures)
        // We'll approximate this by summing fee structures for the school
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
          totalTeachers: 0,
        })
      } catch (err) {
        console.error('Error fetching stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [schoolId])

  return { stats, loading }
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

  const fetchStudents = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
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
  }, [schoolId])

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

  useEffect(() => {
    async function fetchClasses() {
      if (!schoolId) {
        setLoading(false)
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
  }, [schoolId])

  return { classes, loading }
}

// Fee payments hook
export function useFeePayments(schoolId?: string) {
  const [payments, setPayments] = useState<FeePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('fee_payments')
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
        .in('student_id',
          (await supabase.from('students').select('id').eq('school_id', schoolId)).data?.map(s => s.id) || []
        )
        .order('payment_date', { ascending: false })

      if (fetchError) throw fetchError
      setPayments((data as FeePayment[]) || [])
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  const createPayment = async (payment: CreatePaymentInput) => {
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

  const fetchFeeStructure = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
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
  }, [schoolId])

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
  }, [classId, date])

  return { attendance, loading, markAttendance }
}

// Grades hook
export function useGrades(classId?: string, subjectId?: string, term?: number, academicYear?: string) {
  const [grades, setGrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
  }, [classId, subjectId, term, academicYear])

  return { grades, loading, saveGrade }
}

// Subjects hook
export function useSubjects(schoolId?: string) {
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSubjects() {
      if (!schoolId) {
        setLoading(false)
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
        setSubjects(data || [])
      } catch (err) {
        console.error('Error fetching subjects:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSubjects()
  }, [schoolId])

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
        const { data: classes } = await supabase.from('classes').select('id, name').eq('school_id', schoolId)
        const classNameMap = classes?.reduce((acc: any, c: any) => ({ ...acc, [c.id]: c.name }), {})

        const classPerformance = Object.keys(classMap).map(id => ({
          class: classNameMap[id] || 'N/A',
          avg: Math.round(classMap[id].total / classMap[id].count),
          boys: classMap[id].bCount > 0 ? Math.round(classMap[id].boys / classMap[id].bCount) : 0,
          girls: classMap[id].gCount > 0 ? Math.round(classMap[id].girls / classMap[id].gCount) : 0,
        }))

        // Fetch subject names for mapping
        const { data: subjects } = await supabase.from('subjects').select('id, name').eq('school_id', schoolId)
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
        const { data: feeStructure } = await supabase.from('fee_structure').select('amount').eq('school_id', schoolId)
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
      const { error } = await supabase.from('timetable').delete().eq('id', id)
      if (error) throw error
      setTimetable(prev => prev.filter(t => t.id !== id))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  return { timetable, loading, saveEntry, deleteEntry }
}
