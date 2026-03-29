'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useDashboardStats, useStudents, useFeePayments, useFeeStructure, useClasses, useStaff } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

function ProgressRing({ progress, color = '#2E9448' }: { progress: number; color?: string }) {
  const radius = 22
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg className="ring-svg" viewBox="0 0 52 52" style={{ width: '56px', height: '56px' }}>
      <circle className="ring-track" cx="26" cy="26" r={radius} />
      <circle className="ring-fill" cx="26" cy="26" r={radius}
        strokeDasharray={circumference} strokeDashoffset={offset} style={{ stroke: color }} />
    </svg>
  )
}

export default function HeadmasterDashboard() {
  const { school, user, isDemo } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { stats, loading: statsLoading } = useDashboardStats(school?.id)
  const { students = [] } = useStudents(school?.id)
  const { payments = [] } = useFeePayments(school?.id)
  const { feeStructure = [] } = useFeeStructure(school?.id)
  const { classes = [] } = useClasses(school?.id)
  const { staff = [] } = useStaff(school?.id)

  const [classAttendance, setClassAttendance] = useState<Record<string, { present: number; total: number }>>({})
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([])
  const [smsStats, setSmsStats] = useState({ sentToday: 0, deliveryRate: 0 })
  const [loadingExtra, setLoadingExtra] = useState(true)

  // New: pending approvals, fees by period, staff on duty, overdue fees
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
    async function fetchExtraData() {
      if (!school?.id) return
      setLoadingExtra(true)
      try {
        const today = new Date().toISOString().split('T')[0]

        // Week start
        const now = new Date()
        const dayOfWeek = now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        const weekStart = monday.toISOString().split('T')[0]

        // Term start approximation (3 months ago)
        const termStart = new Date(now)
        termStart.setMonth(termStart.getMonth() - 3)
        const termStartStr = termStart.toISOString().split('T')[0]

        // Fetch attendance by class for today
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('student_id, class_id, status')
          .eq('date', today)

        const attendanceByClass: Record<string, { present: number; total: number }> = {}
        const studentClassMap: Record<string, string> = {}

        students.forEach(s => { studentClassMap[s.id] = s.class_id })

        attendanceData?.forEach(a => {
          const classId = studentClassMap[a.student_id]
          if (!classId) return
          if (!attendanceByClass[classId]) attendanceByClass[classId] = { present: 0, total: 0 }
          attendanceByClass[classId].total++
          if (a.status === 'present') attendanceByClass[classId].present++
        })

        setClassAttendance(attendanceByClass)

        // Count classes with low attendance (< 70%)
        let lowAtt = 0
        Object.values(attendanceByClass).forEach(c => {
          if (c.total > 0 && (c.present / c.total) < 0.7) lowAtt++
        })
        setLowAttendanceClasses(lowAtt)

        // Fetch at-risk students (below 50% in 2+ subjects this term)
        const { data: gradesData } = await supabase
          .from('grades')
          .select('student_id, score, term, academic_year')
          .eq('term', currentTerm || 1)
          .eq('academic_year', academicYear || '2026')

        const studentScores: Record<string, number[]> = {}
        gradesData?.forEach(g => {
          if (!studentScores[g.student_id]) studentScores[g.student_id] = []
          studentScores[g.student_id].push(Number(g.score))
        })

        const atRisk = Object.entries(studentScores)
          .filter(([_, scores]) => scores.filter(s => s < 50).length >= 2)
          .map(([studentId]) => students.find(s => s.id === studentId))
          .filter(Boolean)
          .slice(0, 5)

        setAtRiskStudents(atRisk)

        // Dropout risk: students absent 14+ consecutive days
        try {
          const fourteenDaysAgo = new Date(now)
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
          const { data: dropoutAttData } = await supabase
            .from('attendance')
            .select('student_id, status, date')
            .gte('date', fourteenDaysAgo.toISOString().split('T')[0])
            .lte('date', today)
            .order('date', { ascending: false })

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

          // Students with attendance records but all absent for 14+ days
          let dropoutCount = Object.values(studentAbsenceMap).filter(v => v.allAbsent && v.count >= 14).length
          // Also count active students with NO attendance records at all in the period
          activeStudentIds.forEach(id => {
            if (!studentAbsenceMap[id]) dropoutCount++
          })
          setDropoutRiskCount(dropoutCount)
        } catch {
          setDropoutRiskCount(0)
        }

        // Fetch SMS stats
        const { data: messagesData } = await supabase
          .from('messages')
          .select('status, created_at')
          .eq('school_id', school.id)
          .gte('created_at', today)

        const sentToday = messagesData?.length || 0
        const delivered = messagesData?.filter((m: any) => m.status === 'delivered').length || 0
        const rate = sentToday > 0 ? Math.round((delivered / sentToday) * 100) : 0

        setSmsStats({ sentToday, deliveryRate: rate })

        // Fetch pending approvals
        const { count: expCount } = await supabase
          .from('expenses')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('status', 'pending')
        setPendingExpenses(expCount || 0)

        const { count: leaveCount } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('status', 'pending')
        setPendingLeave(leaveCount || 0)

        // Fees collected by period
        const { data: allPayments } = await supabase
          .from('fee_payments')
          .select('amount_paid, payment_date, students!inner(school_id)')
          .eq('students.school_id', school.id)

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

        // Staff on duty today
        const { data: staffAttData } = await supabase
          .from('staff_attendance')
          .select('status')
          .eq('school_id', school.id)
          .eq('date', today)
          .in('status', ['present', 'late'])

        setStaffOnDuty(staffAttData?.length || 0)

        // Overdue fees count (students with balance > 0)
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
        console.error('Error fetching extra data:', err)
      } finally {
        setLoadingExtra(false)
      }
    }

    if (school?.id) {
      fetchExtraData()
    }
  }, [school?.id, currentTerm, academicYear, students.length])

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`
    return `${amount}`
  }

  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  const boysCount = students.filter(s => s.gender === 'M').length
  const girlsCount = students.filter(s => s.gender === 'F').length

  const totalFeesExpected = students.reduce((total, student) => {
    const classFees = feeStructure.filter(f => !f.class_id || f.class_id === student.class_id)
    const studentExpected = classFees.reduce((sum, f) => sum + Number(f.amount || 0), 0)
    return total + studentExpected
  }, 0)

  const totalFeesCollected = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  const collectionRate = totalFeesExpected > 0 ? Math.round((totalFeesCollected / totalFeesExpected) * 100) : 0

  // Calculate real attendance from classAttendance
  const totalPresent = Object.values(classAttendance).reduce((sum, c) => sum + c.present, 0)
  const totalInClass = Object.values(classAttendance).reduce((sum, c) => sum + c.total, 0)
  const attendanceRate = totalInClass > 0 ? Math.round((totalPresent / totalInClass) * 100) : 0
  const absentCount = students.length - stats.presentToday

  const classesNotMarked = classes.filter((c: any) => !classAttendance[c.id] || classAttendance[c.id].total === 0).length

  const totalPendingApprovals = pendingExpenses + pendingLeave

  // Alert count
  const alertCount = (loadingExtra ? 0 : classesNotMarked + atRiskStudents.length + dropoutRiskCount + lowAttendanceClasses + (overdueFeeCount > 0 ? 1 : 0) + (totalPendingApprovals > 0 ? 1 : 0))

  return (
    <div className="content">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <div className="ph-title">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub">{school?.name} • {academicYear} Term {currentTerm}</div>
        </div>
        <div className="ph-actions">
          <Link href="/dashboard/reports" className="btn btn-ghost">
            <MaterialIcon icon="download" style={{ fontSize: '16px' }} />
            Generate Report
          </Link>
          <Link href="/dashboard/students?action=add" className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: '16px' }} />
            Add Student
          </Link>
        </div>
      </div>

      {/* STAT CARDS - Row 1: Core Metrics */}
      <div className="stat-grid">
        {/* Attendance */}
        <Link href="/dashboard/attendance" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--green)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Present Today</div>
              <div className="stat-icon-box" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                <MaterialIcon icon="check_circle" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--green)' }}>
              {loadingExtra ? '...' : `${stats.presentToday || 0} / ${stats.totalStudents}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
              <ProgressRing progress={attendanceRate} color="var(--green)" />
              <div>
                <div style={{ fontFamily: 'Sora', fontSize: '20px', fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>{attendanceRate}%</div>
                <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '3px' }}>Attendance rate</div>
                <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '4px' }}>{absentCount} absent</div>
              </div>
            </div>
          </div>
          <div className="stat-footer">
            <span className="stat-foot-label">{classesNotMarked} classes not marked</span>
            <span className="stat-foot-val" style={{ color: classesNotMarked > 0 ? 'var(--amber)' : 'var(--green)' }}>{classesNotMarked > 0 ? 'Action needed' : 'All marked'}</span>
          </div>
        </Link>

        {/* Fees Collected Today/Week/Term */}
        <Link href="/dashboard/fees" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--amber)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Fees Collected</div>
              <div className="stat-icon-box" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                <MaterialIcon icon="payments" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--amber)' }}>UGX <span>{formatCurrency(totalFeesCollected)}</span></div>
            <div style={{ marginTop: '10px' }}>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(collectionRate, 100)}%`, height: '100%', background: 'var(--green)', borderRadius: '99px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--t3)' }}>
                <span>Target: UGX {formatCurrency(totalFeesExpected)}</span>
                <span><b style={{ color: 'var(--green)' }}>{collectionRate}%</b></span>
              </div>
            </div>
            {/* Fees breakdown */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '11px' }}>
              <div style={{ flex: 1, background: 'var(--bg)', borderRadius: '6px', padding: '6px 8px' }}>
                <div style={{ color: 'var(--t3)' }}>Today</div>
                <div style={{ fontWeight: 700, color: 'var(--t1)' }}>{formatCurrency(feesToday)}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg)', borderRadius: '6px', padding: '6px 8px' }}>
                <div style={{ color: 'var(--t3)' }}>This Week</div>
                <div style={{ fontWeight: 700, color: 'var(--t1)' }}>{formatCurrency(feesThisWeek)}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg)', borderRadius: '6px', padding: '6px 8px' }}>
                <div style={{ color: 'var(--t3)' }}>This Term</div>
                <div style={{ fontWeight: 700, color: 'var(--t1)' }}>{formatCurrency(feesThisTerm)}</div>
              </div>
            </div>
          </div>
          <div className="stat-footer">
            <span className="stat-foot-label">Cash + MTN MoMo + Airtel</span>
            <span className="stat-foot-val" style={{ color: collectionRate >= 80 ? 'var(--green)' : 'var(--amber)' }}>{collectionRate >= 80 ? 'On target' : 'Below target'}</span>
          </div>
        </Link>

        {/* Pending Approvals */}
        <Link href="/dashboard/expense-approvals" className="stat-card">
          <div className="stat-accent" style={{ background: totalPendingApprovals > 0 ? 'var(--red)' : 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Pending Approvals</div>
              <div className="stat-icon-box" style={{ background: totalPendingApprovals > 0 ? 'rgba(192,57,43,.1)' : 'var(--navy-soft)', color: totalPendingApprovals > 0 ? 'var(--red)' : 'var(--navy)' }}>
                <MaterialIcon icon="approval" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: totalPendingApprovals > 0 ? 'var(--red)' : 'var(--green)' }}>{loadingExtra ? '...' : totalPendingApprovals}</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--t3)' }}>Expenses</div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: pendingExpenses > 0 ? 'var(--amber)' : 'var(--t3)' }}>{loadingExtra ? '...' : pendingExpenses}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--t3)' }}>Leave</div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: pendingLeave > 0 ? 'var(--amber)' : 'var(--t3)' }}>{loadingExtra ? '...' : pendingLeave}</div>
              </div>
            </div>
          </div>
          <div className="stat-footer">
            <span className="stat-foot-label">Expenses + Leave requests</span>
            <span className="stat-foot-val" style={{ color: totalPendingApprovals > 0 ? 'var(--red)' : 'var(--green)' }}>{totalPendingApprovals > 0 ? 'Review now' : 'All clear'}</span>
          </div>
        </Link>

        {/* Staff on Duty */}
        <Link href="/dashboard/staff-attendance" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Staff on Duty</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <MaterialIcon icon="badge" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>{loadingExtra ? '...' : `${staffOnDuty} / ${staff?.length || 0}`}</div>
            <div style={{ marginTop: '10px' }}>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ width: `${staff?.length ? Math.min((staffOnDuty / staff.length) * 100, 100) : 0}%`, height: '100%', background: 'var(--navy)', borderRadius: '99px' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>
                {staff?.length ? Math.round((staffOnDuty / staff.length) * 100) : 0}% attendance
              </div>
            </div>
          </div>
          <div className="stat-footer">
            <span className="stat-foot-label">Teachers + Admin</span>
            <span className="stat-foot-val" style={{ color: 'var(--navy)' }}>Today</span>
          </div>
        </Link>
      </div>

      {/* MAIN GRID */}
      <div className="main-grid">
        <div className="main-col">
          {/* QUICK ACTIONS */}
          <div className="card" style={{ padding: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Quick Actions</div>
                <div className="card-sub">Common tasks for today</div>
              </div>
            </div>
            <div className="card-body" style={{ padding: '16px 16px' }}>
              <div className="qa-grid">
                <Link href="/dashboard/attendance" className="qa-item">
                  <div className="qa-icon" style={{ background: 'var(--navy-soft)', borderColor: 'rgba(23,50,95,.12)', color: 'var(--navy)' }}>
                    <MaterialIcon icon="how_to_reg" style={{ fontSize: '20px' }} />
                  </div>
                  <div className="qa-label">Mark Attendance</div>
                </Link>
                <Link href="/dashboard/grades" className="qa-item">
                  <div className="qa-icon" style={{ background: 'var(--green-soft)', borderColor: 'rgba(46,148,72,.12)', color: 'var(--green)' }}>
                    <MaterialIcon icon="grade" style={{ fontSize: '20px' }} />
                  </div>
                  <div className="qa-label">Enter Grades</div>
                </Link>
                <Link href="/dashboard/fees" className="qa-item">
                  <div className="qa-icon" style={{ background: 'var(--amber-soft)', borderColor: 'rgba(184,107,12,.12)', color: 'var(--amber)' }}>
                    <MaterialIcon icon="payments" style={{ fontSize: '20px' }} />
                  </div>
                  <div className="qa-label">Record Payment</div>
                </Link>
                <Link href="/dashboard/messages" className="qa-item">
                  <div className="qa-icon" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--t2)' }}>
                    <MaterialIcon icon="chat" style={{ fontSize: '20px' }} />
                  </div>
                  <div className="qa-label">Send Message</div>
                </Link>
              </div>
            </div>
          </div>

          {/* CLASS ATTENDANCE */}
          <div className="card" style={{ padding: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Class Attendance · Today</div>
                <div className="card-sub">{currentDate.toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })} · {classes.length} classes</div>
              </div>
              <Link href="/dashboard/attendance" className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 10px' }}>View All</Link>
            </div>
            <div>
              {classes.slice(0, 5).map((cls: any, idx: number) => {
                const classStudents = students.filter(s => s.class_id === cls.id).length
                const classAtt = classAttendance[cls.id] || { present: 0, total: classStudents }
                const classRate = classAtt.total > 0 ? Math.round((classAtt.present / classAtt.total) * 100) : 0
                const color = classRate >= 80 ? 'var(--green)' : classRate >= 60 ? 'var(--amber)' : 'var(--red)'

                return (
                  <div key={cls.id} className="att-row">
                    <div className="att-pill" style={{ background: `${color.replace('var(', 'rgba(').replace(')', ',.15)')}`, color }}>
                      {cls.name.substring(0, 3).toUpperCase()}
                    </div>
                    <div className="att-info">
                      <div className="att-name">{cls.name}</div>
                      <div className="att-meta">{classStudents} students · Class Teacher</div>
                    </div>
                    <div className="att-bar-col">
                      <div className="att-bar-bg"><div className="att-bar-fill" style={{ width: `${classRate}%`, background: color }} /></div>
                    </div>
                    <div className="att-pct" style={{ color, fontFamily: 'DM Mono', fontSize: '12px', fontWeight: 500, width: '36px', textAlign: 'right' }}>{classRate}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RECENT ACTIVITY */}
          <div className="card" style={{ padding: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Recent Activity</div>
                <div className="card-sub">Last 24 hours</div>
              </div>
              <Link href="/dashboard/fees" className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 10px' }}>View All</Link>
            </div>
            <div>
              {payments.slice(0, 4).map((payment: any, idx: number) => (
                <div key={payment.id} className="activity-row">
                  <div className="act-dot-col">
                    <div className="act-dot" style={{ background: idx === 0 ? 'var(--green)' : idx === 1 ? 'var(--amber)' : 'var(--navy)' }} />
                  </div>
                  <div className="act-body">
                    <div className="act-title">Payment received from {payment.students?.first_name} {payment.students?.last_name}</div>
                    <div className="act-sub">UGX {formatCurrency(payment.amount_paid)} · MTN MoMo</div>
                  </div>
                  <div className="act-time">{payment.payment_date || 'Today'}</div>
                </div>
              ))}
              <div className="activity-row" style={{ borderBottom: 'none' }}>
                <div className="act-dot-col">
                  <div className="act-dot" style={{ background: 'var(--green)' }} />
                </div>
                <div className="act-body">
                  <div className="act-title">System synced successfully</div>
                  <div className="act-sub">All data up to date</div>
                </div>
                <div className="act-time">Just now</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="main-col">
          {/* ALERTS */}
          <div className="card" style={{ padding: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Alerts</div>
                <div className="card-sub">Needs attention</div>
              </div>
              <span className="badge badge-red">{loadingExtra ? '...' : alertCount} active</span>
            </div>
            <div className="card-body" style={{ padding: '14px 16px' }}>
              {atRiskStudents.length > 0 && (
                <Link href="/dashboard/warnings" className="alert-box red">
                  <div className="ab-icon" style={{ background: 'rgba(192,57,43,.12)', color: 'var(--red)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MaterialIcon icon="warning" style={{ fontSize: '15px' }} />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">{atRiskStudents.length} students at risk</div>
                    <div className="ab-sub">Below 50% in 2+ subjects</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
                </Link>
              )}
              {dropoutRiskCount > 0 && (
                <Link href="/dashboard/dropout-tracking" className="alert-box red">
                  <div className="ab-icon" style={{ background: 'rgba(231,76,60,.12)', color: '#e74c3c', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MaterialIcon icon="person_off" style={{ fontSize: '15px' }} />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">{dropoutRiskCount} students at risk of dropout</div>
                    <div className="ab-sub">Absent 14+ consecutive days</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
                </Link>
              )}
              {classesNotMarked > 0 && (
                <Link href="/dashboard/attendance" className="alert-box amb">
                  <div className="ab-icon" style={{ background: 'rgba(184,107,12,.12)', color: 'var(--amber)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MaterialIcon icon="schedule" style={{ fontSize: '15px' }} />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">{classesNotMarked} classes not marked</div>
                    <div className="ab-sub">Attendance pending today</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
                </Link>
              )}
              {lowAttendanceClasses > 0 && (
                <Link href="/dashboard/attendance" className="alert-box red">
                  <div className="ab-icon" style={{ background: 'rgba(192,57,43,.12)', color: 'var(--red)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MaterialIcon icon="trending_down" style={{ fontSize: '15px' }} />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">{lowAttendanceClasses} classes below 70%</div>
                    <div className="ab-sub">Low attendance today</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
                </Link>
              )}
              {overdueFeeCount > 0 && (
                <Link href="/dashboard/fees" className="alert-box amb">
                  <div className="ab-icon" style={{ background: 'rgba(184,107,12,.12)', color: 'var(--amber)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MaterialIcon icon="money_off" style={{ fontSize: '15px' }} />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">{overdueFeeCount} students with overdue fees</div>
                    <div className="ab-sub">Less than 50% paid</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
                </Link>
              )}
              {totalPendingApprovals > 0 && (
                <Link href="/dashboard/expense-approvals" className="alert-box navy">
                  <div className="ab-icon" style={{ background: 'rgba(23,50,95,.10)', color: 'var(--navy)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MaterialIcon icon="approval" style={{ fontSize: '15px' }} />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">{totalPendingApprovals} pending approvals</div>
                    <div className="ab-sub">{pendingExpenses} expenses · {pendingLeave} leave</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
                </Link>
              )}
              {smsStats.sentToday > 0 && (
                <Link href="/dashboard/messages" className="alert-box green">
                  <div className="ab-icon" style={{ background: 'rgba(46,148,72,.12)', color: 'var(--green)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MaterialIcon icon="chat" style={{ fontSize: '15px' }} />
                  </div>
                  <div className="ab-body">
                    <div className="ab-title">{smsStats.sentToday} SMS sent today</div>
                    <div className="ab-sub">{smsStats.deliveryRate}% delivery rate</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
                </Link>
              )}
              {!loadingExtra && alertCount === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)' }}>
                  <MaterialIcon icon="check_circle" style={{ fontSize: 24, color: 'var(--green)', marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>No alerts — everything looks good!</div>
                </div>
              )}
            </div>
          </div>

          {/* ACADEMIC TERM */}
          <div className="card" style={{ padding: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Academic Term</div>
              </div>
            </div>
            <div className="card-body" style={{ padding: '4px 4px 4px' }}>
              <div className="term-row">
                <div className="term-row-label">
                  <MaterialIcon icon="calendar_today" style={{ fontSize: '14px', color: 'var(--t3)' }} />
                  Academic Year
                </div>
                <div className="term-row-val">{academicYear || '2025'}</div>
              </div>
              <div className="term-row">
                <div className="term-row-label">
                  <MaterialIcon icon="schedule" style={{ fontSize: '14px', color: 'var(--t3)' }} />
                  Current Term
                </div>
                <div className="term-row-val">Term {currentTerm || '1'}</div>
              </div>
              <div className="term-row">
                <div className="term-row-label">
                  <MaterialIcon icon="location_on" style={{ fontSize: '14px', color: 'var(--t3)' }} />
                  District
                </div>
                <div className="term-row-val" style={{ color: 'var(--t3)' }}>{school?.district || 'N/A'}</div>
              </div>
              <div className="term-row">
                <div className="term-row-label">
                  <MaterialIcon icon="sms" style={{ fontSize: '14px', color: 'var(--t3)' }} />
                  SMS Balance
                </div>
                <div className="term-row-val" style={{ color: 'var(--green)' }}>Active</div>
              </div>
              <div className="term-row" style={{ borderBottom: 'none' }}>
                <div className="term-row-label">
                  <MaterialIcon icon="badge" style={{ fontSize: '14px', color: 'var(--t3)' }} />
                  Staff Count
                </div>
                <div className="term-row-val">{staff?.length || 0}</div>
              </div>
            </div>
          </div>

          {/* AT RISK STUDENTS */}
          <div className="card" style={{ padding: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">At-Risk Students</div>
                <div className="card-sub">Below 50% in 2+ subjects</div>
              </div>
              <span className="badge badge-red">{loadingExtra ? '...' : atRiskStudents.length} flagged</span>
            </div>
            <div>
              {loadingExtra ? (
                <div style={{ padding: 20 }}>
                  <div className="skeleton" style={{ height: 60 }}></div>
                </div>
              ) : atRiskStudents.length > 0 ? (
                atRiskStudents.map((student: any, idx: number) => (
                  <Link key={student?.id || idx} href={`/dashboard/students/${student?.id}`} className="warn-row">
                    <div className="warn-av" style={{ background: 'var(--navy)' }}>
                      {student?.first_name?.charAt(0) || '?'}{student?.last_name?.charAt(0) || ''}
                    </div>
                    <div className="warn-info">
                      <div className="warn-name">{student?.first_name} {student?.last_name} · {student?.classes?.name}</div>
                      <div className="warn-detail">Multiple subjects below 50%</div>
                    </div>
                    <span className="badge badge-red">Critical</span>
                  </Link>
                ))
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)' }}>
                  <MaterialIcon icon="check_circle" style={{ fontSize: 24, color: 'var(--green)', marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>No at-risk students</div>
                </div>
              )}
            </div>
            {atRiskStudents.length > 0 && (
              <div style={{ padding: '10px 0 0', borderTop: '1px solid var(--border)' }}>
                <Link href="/dashboard/warnings" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}>
                  <MaterialIcon icon="chat" style={{ fontSize: '14px' }} />
                  SMS All Guardians
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
