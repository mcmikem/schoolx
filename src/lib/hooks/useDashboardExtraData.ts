'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ClassAttendance {
  present: number
  total: number
}

interface DashboardExtraData {
  classAttendance: Record<string, ClassAttendance>
  atRiskStudents: any[]
  smsStats: { sentToday: number; deliveryRate: number }
  pendingExpenses: number
  pendingLeave: number
  feesToday: number
  feesThisWeek: number
  feesThisTerm: number
  staffOnDuty: number
  overdueFeeCount: number
  lowAttendanceClasses: number
  dropoutRiskCount: number
  loading: boolean
}

export function useDashboardExtraData(
  schoolId: string | undefined,
  students: any[],
  feeStructure: any[],
  currentTerm: string | number | undefined,
  academicYear: string | undefined
): DashboardExtraData {
  const [classAttendance, setClassAttendance] = useState<Record<string, ClassAttendance>>({})
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([])
  const [smsStats, setSmsStats] = useState({ sentToday: 0, deliveryRate: 0 })
  const [loading, setLoading] = useState(true)
  const [pendingExpenses, setPendingExpenses] = useState(0)
  const [pendingLeave, setPendingLeave] = useState(0)
  const [feesToday, setFeesToday] = useState(0)
  const [feesThisWeek, setFeesThisWeek] = useState(0)
  const [feesThisTerm, setFeesThisTerm] = useState(0)
  const [staffOnDuty, setStaffOnDuty] = useState(0)
  const [overdueFeeCount, setOverdueFeeCount] = useState(0)
  const [lowAttendanceClasses, setLowAttendanceClasses] = useState(0)
  const [dropoutRiskCount, setDropoutRiskCount] = useState(0)

  useEffect(() => {
    if (!schoolId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchExtraData() {
      setLoading(true)
      try {
        const today = new Date().toISOString().split('T')[0]
        const now = new Date()
        const dayOfWeek = now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        const weekStart = monday.toISOString().split('T')[0]

        const [
          attendanceRes,
          gradesRes,
          messagesRes,
          expensesRes,
          leaveRes,
          paymentsRes,
          staffAttRes,
        ] = await Promise.all([
          supabase.from('attendance').select('student_id, class_id, status').eq('date', today),
          supabase
            .from('grades')
            .select('student_id, score, term, academic_year')
            .eq('term', currentTerm || 1)
            .eq('academic_year', academicYear || '2026'),
          supabase.from('messages').select('status, created_at').eq('school_id', schoolId).gte('created_at', today),
          supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending'),
          supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending'),
          supabase.from('fee_payments').select('amount_paid, payment_date, students!inner(school_id)').eq('students.school_id', schoolId),
          supabase.from('staff_attendance').select('status').eq('school_id', schoolId).eq('date', today).in('status', ['present', 'late']),
        ])

        if (cancelled) return

        // Attendance by class
        const attendanceByClass: Record<string, ClassAttendance> = {}
        const studentClassMap: Record<string, string> = {}
        students.forEach(s => { studentClassMap[s.id] = s.class_id })

        attendanceRes.data?.forEach(a => {
          const classId = studentClassMap[a.student_id]
          if (!classId) return
          if (!attendanceByClass[classId]) attendanceByClass[classId] = { present: 0, total: 0 }
          attendanceByClass[classId].total++
          if (a.status === 'present') attendanceByClass[classId].present++
        })
        setClassAttendance(attendanceByClass)

        let lowAtt = 0
        Object.values(attendanceByClass).forEach(c => {
          if (c.total > 0 && (c.present / c.total) < 0.7) lowAtt++
        })
        setLowAttendanceClasses(lowAtt)

        // At-risk students
        const studentScores: Record<string, number[]> = {}
        gradesRes.data?.forEach(g => {
          if (!studentScores[g.student_id]) studentScores[g.student_id] = []
          studentScores[g.student_id].push(Number(g.score))
        })

        const atRisk = Object.entries(studentScores)
          .filter(([_, scores]) => scores.filter(s => s < 50).length >= 2)
          .map(([studentId]) => students.find(s => s.id === studentId))
          .filter(Boolean)
          .slice(0, 5)
        setAtRiskStudents(atRisk)

        // Dropout risk
        try {
          const fourteenDaysAgo = new Date(now)
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
          const { data: dropoutAttData } = await supabase
            .from('attendance')
            .select('student_id, status, date')
            .gte('date', fourteenDaysAgo.toISOString().split('T')[0])
            .lte('date', today)
            .order('date', { ascending: false })

          if (!cancelled) {
            const studentAbsenceMap: Record<string, { allAbsent: boolean; count: number }> = {}
            const activeStudentIds = new Set(students.filter(s => s.status === 'active').map(s => s.id))

            dropoutAttData?.forEach((r: any) => {
              if (!activeStudentIds.has(r.student_id)) return
              if (!studentAbsenceMap[r.student_id]) {
                studentAbsenceMap[r.student_id] = { allAbsent: r.status === 'absent', count: r.status === 'absent' ? 1 : 0 }
              } else if (studentAbsenceMap[r.student_id].allAbsent && r.status === 'absent') {
                studentAbsenceMap[r.student_id].count++
              } else {
                studentAbsenceMap[r.student_id].allAbsent = false
              }
            })

            let dropoutCount = Object.values(studentAbsenceMap).filter(v => v.allAbsent && v.count >= 14).length
            activeStudentIds.forEach(id => {
              if (!studentAbsenceMap[id]) dropoutCount++
            })
            setDropoutRiskCount(dropoutCount)
          }
        } catch {
          if (!cancelled) setDropoutRiskCount(0)
        }

        // SMS stats
        const sentToday = messagesRes.data?.length || 0
        const delivered = messagesRes.data?.filter((m: any) => m.status === 'delivered').length || 0
        const rate = sentToday > 0 ? Math.round((delivered / sentToday) * 100) : 0
        setSmsStats({ sentToday, deliveryRate: rate })

        // Pending approvals
        setPendingExpenses(expensesRes.count || 0)
        setPendingLeave(leaveRes.count || 0)

        // Fees by period
        const allPayments = paymentsRes.data
        let todayTotal = 0
        let weekTotal = 0
        let termTotal = 0

        allPayments?.forEach((p: any) => {
          const pDate = p.payment_date || ''
          const amt = Number(p.amount_paid) || 0
          termTotal += amt
          if (pDate >= weekStart) weekTotal += amt
          if (pDate >= today) todayTotal += amt
        })

        setFeesToday(todayTotal)
        setFeesThisWeek(weekTotal)
        setFeesThisTerm(termTotal)

        // Staff on duty
        setStaffOnDuty(staffAttRes.data?.length || 0)

        // Overdue fees
        const totalExpectedPerStudent = feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0)
        if (totalExpectedPerStudent > 0) {
          const paidByStudent: Record<string, number> = {}
          allPayments?.forEach((p: any) => {
            const sid = p.students?.id || ''
            if (sid) paidByStudent[sid] = (paidByStudent[sid] || 0) + Number(p.amount_paid)
          })
          const overdue = students.filter(s => (paidByStudent[s.id] || 0) < totalExpectedPerStudent * 0.5).length
          setOverdueFeeCount(overdue)
        }
      } catch (err) {
        console.error('Error fetching dashboard extra data:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchExtraData()

    return () => { cancelled = true }
  }, [schoolId, currentTerm, academicYear, students, feeStructure])

  return {
    classAttendance,
    atRiskStudents,
    smsStats,
    pendingExpenses,
    pendingLeave,
    feesToday,
    feesThisWeek,
    feesThisTerm,
    staffOnDuty,
    overdueFeeCount,
    lowAttendanceClasses,
    dropoutRiskCount,
    loading,
  }
}
