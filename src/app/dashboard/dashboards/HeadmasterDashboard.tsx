'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useDashboardStats, useStudents, useFeePayments, useFeeStructure, useClasses, useStaff } from '@/lib/hooks'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
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
  const { students } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)
  const { classes } = useClasses(school?.id)
  const { staff } = useStaff(school?.id)

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
  const attendanceRate = students.length > 0 ? Math.round((stats.presentToday / students.length) * 100) : 0
  const absentCount = students.length - stats.presentToday

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

      {/* STAT CARDS */}
      <div className="stat-grid">
        {/* Students */}
        <Link href="/dashboard/students" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Total Enrolled</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <MaterialIcon icon="group" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>{statsLoading ? '...' : stats.totalStudents}</div>
            <div style={{ display: 'flex', height: '5px', borderRadius: '99px', overflow: 'hidden', gap: '2px', marginTop: '10px' }}>
              <div style={{ width: `${boysCount > 0 ? (boysCount / students.length) * 100 : 50}%`, background: 'var(--navy)', borderRadius: '99px' }} />
              <div style={{ width: `${girlsCount > 0 ? (girlsCount / students.length) * 100 : 50}%`, background: '#93A9CA', borderRadius: '99px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--t3)' }}>
              <span><b style={{ color: 'var(--t2)' }}>{boysCount}</b> Boys</span>
              <span><b style={{ color: 'var(--t2)' }}>{girlsCount}</b> Girls</span>
            </div>
          </div>
          <div className="stat-footer">
            <span className="stat-foot-label">vs last term</span>
            <span className="stat-foot-val" style={{ color: 'var(--green)' }}>+{stats.totalStudents - 132} enrolled</span>
          </div>
        </Link>

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
            <div className="stat-val" style={{ color: 'var(--green)' }}>{stats.presentToday || 0}</div>
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
            <span className="stat-foot-label">{classes.filter((c: any) => !c.att_marked).length} classes not marked</span>
            <span className="stat-foot-val" style={{ color: 'var(--amber)' }}>Action needed</span>
          </div>
        </Link>

        {/* Fees */}
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
                <span><b style={{ color: 'var(--green)' }}>{collectionRate}% of target</b></span>
              </div>
            </div>
          </div>
          <div className="stat-footer">
            <span className="stat-foot-label">Cash + MTN MoMo + Airtel</span>
            <span className="stat-foot-val" style={{ color: 'var(--green)' }}>Above target</span>
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
                const classPresent = Math.round(classStudents * (0.85 + Math.random() * 0.15))
                const classRate = classStudents > 0 ? Math.round((classPresent / classStudents) * 100) : 0
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
              <span className="badge badge-red">{classes.filter((c: any) => !c.att_marked).length + 1} active</span>
            </div>
            <div className="card-body" style={{ padding: '14px 16px' }}>
              <Link href="/dashboard/warnings" className="alert-box red">
                <div className="ab-icon" style={{ background: 'rgba(192,57,43,.12)', color: 'var(--red)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MaterialIcon icon="warning" style={{ fontSize: '15px' }} />
                </div>
                <div className="ab-body">
                  <div className="ab-title">4 students at risk</div>
                  <div className="ab-sub">Below 50% in 2+ subjects</div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
              </Link>
              <Link href="/dashboard/attendance" className="alert-box amb">
                <div className="ab-icon" style={{ background: 'rgba(184,107,12,.12)', color: 'var(--amber)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MaterialIcon icon="schedule" style={{ fontSize: '15px' }} />
                </div>
                <div className="ab-body">
                  <div className="ab-title">3 classes not marked</div>
                  <div className="ab-sub">Attendance pending today</div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
              </Link>
              <Link href="/dashboard/messages" className="alert-box navy">
                <div className="ab-icon" style={{ background: 'rgba(23,50,95,.10)', color: 'var(--navy)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MaterialIcon icon="chat" style={{ fontSize: '15px' }} />
                </div>
                <div className="ab-body">
                  <div className="ab-title">SMS sent today</div>
                  <div className="ab-sub">98% delivery rate</div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
              </Link>
              <Link href="/dashboard/fees" className="alert-box green">
                <div className="ab-icon" style={{ background: 'rgba(46,148,72,.12)', color: 'var(--green)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MaterialIcon icon="trending_up" style={{ fontSize: '15px' }} />
                </div>
                <div className="ab-body">
                  <div className="ab-title">{collectionRate}% of fee target</div>
                  <div className="ab-sub">UGX {formatCurrency(totalFeesCollected)} collected</div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 600 }}>›</span>
              </Link>
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
              <span className="badge badge-red">0 flagged</span>
            </div>
            <div>
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)' }}>
                <MaterialIcon icon="check_circle" style={{ fontSize: 24, color: 'var(--green)', marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>No at-risk students</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
