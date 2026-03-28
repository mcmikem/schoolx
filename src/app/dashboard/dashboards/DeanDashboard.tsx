'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects } from '@/lib/hooks'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function DeanDashboard() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)

  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="content">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <div className="ph-title">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub">{school?.name} • {academicYear} Term {currentTerm}</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost">
            <MaterialIcon icon="filter_list" style={{ fontSize: '16px' }} />
            Filter
          </button>
          <button className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: '16px' }} />
            Quick Entry
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Students</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <MaterialIcon icon="group" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>{students.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>{classes.length} Classes · {subjects.length} Subjects</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--green)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Attendance</div>
              <div className="stat-icon-box" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                <MaterialIcon icon="how_to_reg" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--green)' }}>85%</div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>Average attendance rate</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-accent" style={{ background: '#7C3AED' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Classes</div>
              <div className="stat-icon-box" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
                <MaterialIcon icon="school" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: '#7C3AED' }}>{classes.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>{classes.filter((c: any) => c.is_active).length} Active</div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Academic Actions</div>
            <div className="card-sub">Common academic tasks</div>
          </div>
        </div>
        <div className="card-body">
          <div className="qa-grid">
            <Link href="/dashboard/grades" className="qa-item">
              <div className="qa-icon" style={{ background: '#EDE9FE', borderColor: 'rgba(124,58,237,.12)', color: '#7C3AED' }}>
                <MaterialIcon icon="grade" style={{ fontSize: '20px' }} />
              </div>
              <div className="qa-label">Grades</div>
            </Link>
            <Link href="/dashboard/attendance" className="qa-item">
              <div className="qa-icon" style={{ background: 'var(--navy-soft)', borderColor: 'rgba(23,50,95,.12)', color: 'var(--navy)' }}>
                <MaterialIcon icon="how_to_reg" style={{ fontSize: '20px' }} />
              </div>
              <div className="qa-label">Attendance</div>
            </Link>
            <Link href="/dashboard/homework" className="qa-item">
              <div className="qa-icon" style={{ background: 'var(--green-soft)', borderColor: 'rgba(46,148,72,.12)', color: 'var(--green)' }}>
                <MaterialIcon icon="assignment" style={{ fontSize: '20px' }} />
              </div>
              <div className="qa-label">Homework</div>
            </Link>
            <Link href="/dashboard/planning" className="qa-item">
              <div className="qa-icon" style={{ background: 'var(--amber-soft)', borderColor: 'rgba(184,107,12,.12)', color: 'var(--amber)' }}>
                <MaterialIcon icon="event_note" style={{ fontSize: '20px' }} />
              </div>
              <div className="qa-label">Lesson Plans</div>
            </Link>
            <Link href="/dashboard/timetable" className="qa-item">
              <div className="qa-icon" style={{ background: 'var(--red-soft)', borderColor: 'rgba(192,57,43,.12)', color: 'var(--red)' }}>
                <MaterialIcon icon="calendar_month" style={{ fontSize: '20px' }} />
              </div>
              <div className="qa-label">Timetable</div>
            </Link>
            <Link href="/dashboard/uneb" className="qa-item">
              <div className="qa-icon" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--t2)' }}>
                <MaterialIcon icon="workspace_premium" style={{ fontSize: '20px' }} />
              </div>
              <div className="qa-label">UNEB</div>
            </Link>
          </div>
        </div>
      </div>

      {/* CLASSES */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Classes - {academicYear} Term {currentTerm}</div>
            <div className="card-sub">{classes.length} classes enrolled</div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 10px' }}>Manage</button>
        </div>
        <div style={{ padding: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {classes.map((cls: any) => {
              const count = students.filter(s => s.class_id === cls.id).length
              return (
                <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} className="qa-item" style={{ padding: '14px 10px' }}>
                  <MaterialIcon icon="school" style={{ fontSize: '22px', color: '#7C3AED' }} />
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>{cls.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--t3)' }}>{count} students</div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
