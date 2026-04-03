'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { getQuerySchoolId } from './utils'

export function useAttendance(classId?: string, date?: string) {
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const markAttendance = async (studentId: string, status: string, recordedBy?: string) => {
    try {
      const { data, error } = await supabase.from('attendance').upsert(
        { student_id: studentId, class_id: classId, date: date || new Date().toISOString().split('T')[0], status, recorded_by: recordedBy },
        { onConflict: 'student_id,date' }
      ).select('id, student_id, class_id, date, status, remarks, recorded_by, created_at').single()
      if (error) throw error
      setAttendance(prev => {
        const existing = prev.findIndex(a => a.student_id === studentId)
        if (existing >= 0) { const u = [...prev]; u[existing] = data; return u }
        return [...prev, data]
      })
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  useEffect(() => {
    async function fetchAttendance() {
      if (!classId || !date) { setLoading(false); return }
      try {
        setLoading(true)
        const { data, error } = await supabase.from('attendance')
          .select('id, student_id, class_id, date, status, remarks, recorded_by, created_at')
          .eq('class_id', classId)
          .eq('date', date)
        if (error) throw error
        setAttendance(data || [])
      } catch (err) { console.error('Error fetching attendance:', err) }
      finally { setLoading(false) }
    }
    fetchAttendance()
  }, [classId, date, isDemo])

  return { attendance, loading, markAttendance }
}

export function useAttendanceHistory(schoolId?: string) {
  const [loading, setLoading] = useState(false)

  const getConsecutiveAbsentStudents = useCallback(async () => {
    if (!schoolId) return []
    setLoading(true)
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select(`
          student_id, date, status, 
          students!inner(id, first_name, last_name, class_id, school_id, status, classes(name))
        `)
        .eq('students.school_id', schoolId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })

      if (error) throw error

      const studentAttendance: Record<string, { dates: string[], statuses: Record<string, string>, student: any }> = {}
      attendanceData?.forEach((record: any) => {
        const sid = record.student_id
        if (!studentAttendance[sid]) studentAttendance[sid] = { dates: [], statuses: {}, student: record.students }
        studentAttendance[sid].dates.push(record.date)
        studentAttendance[sid].statuses[record.date] = record.status
      })

      const atRiskStudents: Array<{ student: any; consecutiveAbsent: number; lastAttendanceDate: string | null; riskLevel: 'at_risk' | 'likely_dropout' }> = []

      for (const [, data] of Object.entries(studentAttendance)) {
        if (data.student?.status !== 'active') continue
        const sortedDates = data.dates.sort().reverse()
        let consecutiveAbsent = 0
        let lastAttendanceDate: string | null = null
        for (const date of sortedDates) {
          if (data.statuses[date] === 'absent') { consecutiveAbsent++ }
          else { lastAttendanceDate = date; break }
        }
        if (consecutiveAbsent >= 14) {
          atRiskStudents.push({ student: data.student, consecutiveAbsent, lastAttendanceDate, riskLevel: consecutiveAbsent >= 30 ? 'likely_dropout' : 'at_risk' })
        }
      }
      return atRiskStudents.sort((a, b) => b.consecutiveAbsent - a.consecutiveAbsent)
    } catch (err) { console.error('Error fetching attendance history:', err); return [] }
    finally { setLoading(false) }
  }, [schoolId])

  return { getConsecutiveAbsentStudents, loading }
}

export function useStaffAttendance(schoolId?: string, date?: string) {
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const markAttendance = async (staffId: string, status: string, remarks?: string) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('staff_attendance').upsert(
        { staff_id: staffId, school_id: querySchoolId, date: date || new Date().toISOString().split('T')[0], status, remarks },
        { onConflict: 'staff_id,date' }
      ).select('id, staff_id, school_id, date, status, remarks, created_at').single()
      if (error) throw error
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  useEffect(() => {
    async function fetchAttendance() {
      if (!schoolId || !date) { setLoading(false); return }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo)
      try {
        setLoading(true)
        const { data, error } = await supabase.from('staff_attendance')
          .select('id, staff_id, school_id, date, status, remarks, created_at, users!staff_id(id, full_name, phone)')
          .eq('school_id', querySchoolId)
          .eq('date', date)
        if (error) throw error
        setAttendance(data || [])
      } catch (err) { console.error('Error fetching staff attendance:', err) }
      finally { setLoading(false) }
    }
    fetchAttendance()
  }, [schoolId, date, isDemo])

  return { attendance, loading, markAttendance }
}
