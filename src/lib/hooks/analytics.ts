'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { DashboardStats } from '@/types'
import { getQuerySchoolId, withTimeout } from './utils'
import { isDemoSchool } from '@/lib/demo-utils'
import { logger } from "@/lib/logger";

export function useDashboardStats(schoolId?: string) {
  const [stats, setStats] = useState({ totalStudents: 0, maleStudents: 0, femaleStudents: 0, presentToday: 0, feesCollected: 0, feesBalance: 0, totalClasses: 0, totalTeachers: 0 })
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    let cancelled = false
    async function fetchStats() {
      if (!schoolId) { setLoading(false); return }
      
      if (isDemo || isDemoSchool(schoolId)) {
        setStats({ totalStudents: 847, maleStudents: 423, femaleStudents: 424, presentToday: 798, feesCollected: 45000000, feesBalance: 12500000, totalClasses: 12, totalTeachers: 24 })
        setLoading(false)
        return
      }
      
      const querySchoolId = getQuerySchoolId(schoolId, isDemo)
      try {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        const studentIds = await withTimeout(
          supabase
            .from('students')
            .select('id')
            .eq('school_id', querySchoolId)
            .eq('status', 'active')
            .then((r) => r.data?.map((s: { id: string }) => s.id) || []),
          5000,
          [] as string[],
        )

        const presentCountPromise = studentIds.length
          ? withTimeout(
              supabase
                .from('attendance')
                .select('id', { count: 'exact', head: true })
                .in('student_id', studentIds)
                .eq('date', today)
                .eq('status', 'present')
                .then((r) => r.count),
              5000,
              0,
            )
          : Promise.resolve(0)

        const paymentsPromise = studentIds.length
          ? withTimeout(
              supabase
                .from('fee_payments')
                .select('amount_paid')
                .in('student_id', studentIds)
                .then((r) => r.data || []),
              5000,
              [] as Array<{ amount_paid: number | null }>,
            )
          : Promise.resolve([] as Array<{ amount_paid: number | null }>)

        const [studentCount, classCount, teacherCount, presentCount, payments, feeStructure, maleCount, femaleCount, studentClasses] = await Promise.all([
          withTimeout(supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', querySchoolId).eq('status', 'active').then(r => r.count), 5000, 0),
          withTimeout(supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', querySchoolId).then(r => r.count), 5000, 0),
          withTimeout(supabase.from('users').select('id', { count: 'exact', head: true }).eq('school_id', querySchoolId).eq('role', 'teacher').then(r => r.count), 5000, 0),
          presentCountPromise,
          paymentsPromise,
          withTimeout(supabase.from('fee_structure').select('amount, class_id').eq('school_id', querySchoolId).then(r => r.data), 5000, []),
          withTimeout(supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', querySchoolId).eq('status', 'active').eq('gender', 'M').then(r => r.count), 5000, 0),
          withTimeout(supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', querySchoolId).eq('status', 'active').eq('gender', 'F').then(r => r.count), 5000, 0),
          withTimeout(supabase.from('students').select('class_id').eq('school_id', querySchoolId).eq('status', 'active').then(r => r.data || []), 5000, []),
        ])
        if (cancelled) return
        const totalCollected = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0)

        const classCounts: Record<string, number> = {}
        ;(studentClasses as Array<{ class_id: string | null }> || []).forEach((s) => {
          if (s.class_id) classCounts[s.class_id] = (classCounts[s.class_id] || 0) + 1
        })
        const totalExpected = (feeStructure || []).reduce((sum: number, f: any) => {
          const count = f.class_id ? (classCounts[f.class_id] || 0) : (studentCount || 0)
          return sum + (Number(f.amount || 0) * count)
        }, 0)
        setStats({ totalStudents: studentCount || 0, maleStudents: maleCount || 0, femaleStudents: femaleCount || 0, presentToday: presentCount || 0, feesCollected: totalCollected, feesBalance: Math.max(0, totalExpected - totalCollected), totalClasses: classCount || 0, totalTeachers: teacherCount || 0 })
      } catch (err) { logger.error('Error fetching stats:', err) }
      finally { if (!cancelled) setLoading(false) }
    }
    fetchStats()
    return () => { cancelled = true }
  }, [schoolId, isDemo])

  return { stats, loading }
}

export function useAnalytics(schoolId?: string) {
  const [data, setData] = useState<any>({ attendanceTrends: [], classPerformance: [], subjectPerformance: [], feeCollection: [], genderDistribution: [], revenueProjections: [], atRiskStudents: [], stats: { totalStudents: 0, avgAttendance: 0, avgGrade: 0, feeCollectionRate: 0, projectedRevenue: 0 } })
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchAnalytics() {
      if (!schoolId) return

      if (isDemo || isDemoSchool(schoolId)) {
        setData({
          genderDistribution: [
            { name: 'Boys', value: 423, color: '#3b82f6' },
            { name: 'Girls', value: 424, color: '#ec4899' }
          ],
          revenueProjections: [
            { name: 'Collected', value: 45000000 },
            { name: 'Outstanding', value: 12500000 }
          ],
          atRiskStudents: [
            { student_id: 'demo-1', full_name: 'John Okello', class_name: 'Primary 4', risk_reason: 'low_attendance', attendance_rate: 62, avg_score: 78 },
            { student_id: 'demo-2', full_name: 'Sarah Nabukeera', class_name: 'Primary 5', risk_reason: 'low_grades', attendance_rate: 88, avg_score: 42 },
          ],
          attendanceTrends: [
            { name: 'Week 1', value: 94 }, { name: 'Week 2', value: 92 }, { name: 'Week 3', value: 89 }, { name: 'Week 4', value: 91 }
          ],
          classPerformance: [
            { name: 'Primary 1', value: 78 }, { name: 'Primary 2', value: 82 }, { name: 'Primary 3', value: 75 }, { name: 'Primary 4', value: 71 }
          ],
          subjectPerformance: [
            { name: 'Mathematics', value: 74 }, { name: 'English', value: 78 }, { name: 'Science', value: 72 }, { name: 'Social Studies', value: 68 }
          ],
          feeCollection: [
            { name: 'Term 1', value: 45000000 }, { name: 'Term 2', value: 42000000 }, { name: 'Term 3', value: 38000000 }
          ],
          stats: { totalStudents: 847, avgAttendance: 92, avgGrade: 74, feeCollectionRate: 78, projectedRevenue: 57500000 }
        })
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // Use proper joins - attendance and grades don't have school_id directly
        const [{ data: students }, { data: feeStructure }, { data: attendance }, { data: grades }] = await Promise.all([
          supabase.from('students').select('id, first_name, last_name, gender, class_id, classes(name)').eq('school_id', schoolId).eq('status', 'active'),
          supabase.from('fee_structure').select('id, amount').eq('school_id', schoolId),
          supabase.from('attendance').select('student_id, status, date, students!inner(school_id)').eq('students.school_id', schoolId).order('date', { ascending: false }).limit(2000),
          supabase.from('grades').select('student_id, score, class_id, students!inner(school_id), classes(name)').eq('students.school_id', schoolId)
        ])

        const genderLevels = { M: 0, F: 0 }
        students?.forEach((s: any) => { if (s.gender === 'M') genderLevels.M++; else if (s.gender === 'F') genderLevels.F++ })
        const genderDistribution = [{ name: 'Boys', value: genderLevels.M, color: '#3b82f6' }, { name: 'Girls', value: genderLevels.F, color: '#ec4899' }]

        const feeIds = feeStructure?.map((f: any) => f.id) || []
        let totalCollected = 0
        if (feeIds.length > 0) {
          const { data: payments } = await supabase.from('fee_payments').select('amount_paid').in('fee_id', feeIds)
          totalCollected = payments?.reduce((acc, p) => acc + (p.amount_paid || 0), 0) || 0
        }
        const totalExpected = feeStructure?.reduce((acc: number, f: any) => acc + (f.amount || 0), 0) || 0
        const revenueProjections = [{ name: 'Collected', value: totalCollected }, { name: 'Outstanding', value: Math.max(0, totalExpected - totalCollected) }]

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
        const atRiskStudents = students?.map((s: any) => {
          const att = attendanceMap[s.id]
          const attRate = att ? (att.present / att.total) * 100 : 100
          const grd = gradesMap[s.id]
          const avgScore = grd ? grd.sum / grd.count : 100
          if (attRate < 75 || avgScore < 50) return { student_id: s.id, full_name: `${s.first_name} ${s.last_name}`, class_name: s.classes?.[0]?.name || 'N/A', risk_reason: attRate < 75 && avgScore < 50 ? 'both' : (attRate < 75 ? 'low_attendance' : 'low_grades'), attendance_rate: attRate, avg_score: avgScore }
          return null
        }).filter((s: any) => s !== null)

        // Compute real average attendance rate across all students with records
        const allAttRates = Object.values(attendanceMap).map((a) => (a.present / a.total) * 100)
        const realAvgAttendance = allAttRates.length > 0
          ? Math.round(allAttRates.reduce((s, v) => s + v, 0) / allAttRates.length)
          : 0

        // Compute real average grade across all students with grades
        const allGradeAvgs = Object.values(gradesMap).map((g) => g.sum / g.count)
        const realAvgGrade = allGradeAvgs.length > 0
          ? Math.round(allGradeAvgs.reduce((s, v) => s + v, 0) / allGradeAvgs.length)
          : 0

        // Compute health score as weighted average of fee collection rate and attendance rate
        const feeRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0
        const healthScore = Math.round((realAvgAttendance * 0.5) + (feeRate * 0.3) + (realAvgGrade * 0.2))

        // Compute weekly attendance trends from the last 4 weeks
        const weeklyAttendance: Record<string, { present: number; total: number }> = {}
        attendance?.forEach((a: any) => {
          if (!a.date) return
          const d = new Date(a.date)
          // ISO week: number of weeks since a fixed reference Monday
          const startOfYear = new Date(d.getFullYear(), 0, 1)
          const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
          const key = `W${weekNum}`
          if (!weeklyAttendance[key]) weeklyAttendance[key] = { present: 0, total: 0 }
          weeklyAttendance[key].total++
          if (a.status === 'present') weeklyAttendance[key].present++
        })
        const attendanceTrends = Object.entries(weeklyAttendance)
          .slice(-4)
          .map(([name, v]) => ({ name, value: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0 }))

        // Compute class performance from grades grouped by class
        const classGradesMap: Record<string, { name: string; sum: number; count: number }> = {}
        grades?.forEach((g: any) => {
          const className = (g.classes as any)?.name || g.class_id || 'Unknown'
          if (!classGradesMap[className]) classGradesMap[className] = { name: className, sum: 0, count: 0 }
          classGradesMap[className].sum += g.score
          classGradesMap[className].count++
        })
        const classPerformance = Object.values(classGradesMap)
          .map(c => ({ name: c.name, value: c.count > 0 ? Math.round(c.sum / c.count) : 0 }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 8)

        setData({ genderDistribution, revenueProjections, atRiskStudents: atRiskStudents || [], attendanceTrends, classPerformance, subjectPerformance: [], feeCollection: [], stats: { totalStudents: students?.length || 0, avgAttendance: realAvgAttendance, avgGrade: realAvgGrade, feeCollectionRate: feeRate, projectedRevenue: totalExpected, healthScore } })
      } catch (err) { logger.error('Analytics Error:', err) }
      finally { setLoading(false) }
    }
    fetchAnalytics()
  }, [schoolId, isDemo])

  return { data, loading }
}
