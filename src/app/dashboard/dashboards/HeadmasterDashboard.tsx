'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useDashboardStats, useStudents, useFeePayments, useFeeStructure, useClasses, useStaff } from '@/lib/hooks'
import { useDashboardExtraData } from '@/lib/hooks/useDashboardExtraData'
import { useMemo } from 'react'
import MaterialIcon from '@/components/MaterialIcon'
import { DashboardSkeleton, StatsGridSkeleton, QuickActionsSkeleton } from '@/components/Skeletons'
import OnboardingTips from '@/components/OnboardingTips'
import { useToast } from '@/components/Toast'
import ErrorBoundary from '@/components/ErrorBoundary'

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

function HeadmasterDashboardContent() {
  const toast = useToast()
  const { school, user, isDemo } = useAuth()
  const { academicYear, currentTerm } = useAcademic()

  const { stats, loading: statsLoading } = useDashboardStats(school?.id)
  const { students = [] } = useStudents(school?.id)
  const { payments = [] } = useFeePayments(school?.id)
  const { feeStructure = [] } = useFeeStructure(school?.id)
  const { classes = [] } = useClasses(school?.id)
  const { staff = [] } = useStaff(school?.id)

  const {
    classAttendance, atRiskStudents, smsStats, pendingExpenses, pendingLeave,
    feesToday, feesThisWeek, feesThisTerm, staffOnDuty, overdueFeeCount,
    lowAttendanceClasses, dropoutRiskCount, loading: loadingExtra
  } = useDashboardExtraData(school?.id, students, feeStructure, currentTerm, academicYear)

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

  const totalPresent = Object.values(classAttendance).reduce((sum, c) => sum + c.present, 0)
  const totalInClass = Object.values(classAttendance).reduce((sum, c) => sum + c.total, 0)
  const attendanceRate = totalInClass > 0 ? Math.round((totalPresent / totalInClass) * 100) : 0
  const absentCount = students.length - stats.presentToday

  const classesNotMarked = classes.filter((c: any) => !classAttendance[c.id] || classAttendance[c.id].total === 0).length

  const totalPendingApprovals = pendingExpenses + pendingLeave

  const alertCount = (loadingExtra ? 0 : classesNotMarked + atRiskStudents.length + dropoutRiskCount + lowAttendanceClasses + (overdueFeeCount > 0 ? 1 : 0) + (totalPendingApprovals > 0 ? 1 : 0))

  const focusItems = useMemo(() => [
    {
      id: 'low-attendance',
      label: 'Low attendance classes',
      value: loadingExtra ? null : lowAttendanceClasses,
      description: 'Classes with less than 70% present today',
      link: '/dashboard/attendance',
      status: lowAttendanceClasses > 0 ? 'alert' : 'ok',
    },
    {
      id: 'overdue-fees',
      label: 'Overdue fees',
      value: loadingExtra ? null : overdueFeeCount,
      description: 'Students with unsettled balances this term',
      link: '/dashboard/fees',
      status: overdueFeeCount > 0 ? 'alert' : 'ok',
    },
    {
      id: 'pending-approvals',
      label: 'Pending approvals',
      value: loadingExtra ? null : totalPendingApprovals,
      description: 'Expenses or leave requests waiting for action',
      link: totalPendingApprovals > 0 ? '/dashboard/expense-approvals' : '/dashboard/leave-approvals',
      status: totalPendingApprovals > 0 ? 'alert' : 'ok',
    },
  ], [lowAttendanceClasses, overdueFeeCount, totalPendingApprovals, loadingExtra])

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <div className="ph-title truncate">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub truncate">{school?.name} • {academicYear} Term {currentTerm}</div>
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

      {students.length === 0 && !loadingExtra && (
        <OnboardingTips schoolId={school?.id} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {focusItems.map((item) => (
          <Link
            key={item.id}
            href={item.link}
            className={`rounded-[22px] border p-5 shadow-sm transition hover:shadow-md active:scale-[0.98] ${
              item.status === 'alert'
                ? 'border-amber/30 bg-amber-soft/50'
                : 'border-outline-variant bg-surface-lowest'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{item.label}</p>
              {item.status === 'alert' && (
                <span className="flex h-2 w-2 rounded-full bg-amber animate-pulse" title="Urgent" />
              )}
            </div>
            <div className="mt-4 text-3xl font-bold text-on-surface tracking-tight">
              {item.value === null ? '…' : item.value}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-3 font-medium">{item.description}</p>
          </Link>
        ))}
      </div>

      <div className="stat-grid">
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
                <div style={{ fontFamily: 'Outfit', fontSize: '20px', fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>{attendanceRate}%</div>
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
            <div className="flex gap-2 mt-2">
              <div className="flex-1 bg-[var(--bg)] rounded-md p-1.5 min-w-0">
                <div className="text-[10px] text-[var(--t3)] font-bold uppercase truncate">Today</div>
                <div className="text-xs font-bold text-[var(--t1)] truncate">{formatCurrency(feesToday)}</div>
              </div>
              <div className="flex-1 bg-[var(--bg)] rounded-md p-1.5 min-w-0">
                <div className="text-[10px] text-[var(--t3)] font-bold uppercase truncate">Week</div>
                <div className="text-xs font-bold text-[var(--t1)] truncate">{formatCurrency(feesThisWeek)}</div>
              </div>
              <div className="flex-1 bg-[var(--bg)] rounded-md p-1.5 min-w-0">
                <div className="text-[10px] text-[var(--t3)] font-bold uppercase truncate">Term</div>
                <div className="text-xs font-bold text-[var(--t1)] truncate">{formatCurrency(feesThisTerm)}</div>
              </div>
            </div>
          </div>
          <div className="stat-footer">
            <span className="stat-foot-label truncate max-w-[120px]">Cash + MTN + Airtel</span>
            <span className="stat-foot-val" style={{ color: collectionRate >= 80 ? 'var(--green)' : 'var(--amber)' }}>{collectionRate >= 80 ? 'On target' : 'Below'}</span>
          </div>
        </Link>

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

      <div className="main-grid">
        <div className="main-col">
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

        <div className="main-col">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Alerts</div>
                <div className="card-sub">Needs attention</div>
              </div>
              <span className="badge badge-red">{loadingExtra ? '...' : alertCount} active</span>
            </div>
            <div className="card-body">
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

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">At-Risk Students</div>
                <div className="card-sub">Academic warning</div>
              </div>
              <span className="badge badge-red font-mono">{loadingExtra ? '...' : atRiskStudents.length} FLAGS</span>
            </div>
            <div className="no-scrollbar max-h-[300px] overflow-y-auto">
              {loadingExtra ? (
                <div className="p-5 flex flex-col gap-3">
                  <div className="h-12 bg-[var(--bg)] rounded-xl animate-pulse" />
                  <div className="h-12 bg-[var(--bg)] rounded-xl animate-pulse" />
                </div>
              ) : atRiskStudents.length > 0 ? (
                atRiskStudents.map((student: any, idx: number) => (
                  <Link key={student?.id || idx} href={`/dashboard/students/${student?.id}`} className="warn-row">
                    <div className="warn-av" style={{ background: 'var(--navy)' }}>
                      {student?.first_name?.charAt(0) || '?'}{student?.last_name?.charAt(0) || ''}
                    </div>
                    <div className="warn-info">
                      <div className="warn-name truncate">{student?.first_name} {student?.last_name}</div>
                      <div className="warn-detail truncate">{student?.classes?.name} · Critical</div>
                    </div>
                    <MaterialIcon icon="chevron_right" className="text-[var(--t4)]" />
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-[var(--t3)]">
                  <MaterialIcon icon="check_circle" className="text-2xl text-[var(--green)] mb-2" />
                  <div className="text-xs font-semibold">No at-risk students</div>
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

export default function HeadmasterDashboard() {
  return (
    <ErrorBoundary>
      <HeadmasterDashboardContent />
    </ErrorBoundary>
  )
}
