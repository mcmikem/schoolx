'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects } from '@/lib/hooks'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

export default function TeacherDashboard() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)

  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  const myClasses = classes.slice(0, 6)
  const mySubjects = subjects.slice(0, 6)

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
            <MaterialIcon icon="calendar_month" style={{ fontSize: '16px' }} />
            My Schedule
          </button>
          <button className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: '16px' }} />
            Quick Entry
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--amber)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">My Classes</div>
              <div className="stat-icon-box" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                <MaterialIcon icon="school" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--amber)' }}>{myClasses.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>Classes assigned</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-accent" style={{ background: '#7C3AED' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">My Subjects</div>
              <div className="stat-icon-box" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
                <MaterialIcon icon="menu_book" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: '#7C3AED' }}>{mySubjects.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>Subjects teaching</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Total Students</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <MaterialIcon icon="group" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>{students.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>In my classes</div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Link href="/dashboard/attendance" className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
            <MaterialIcon icon="how_to_reg" style={{ fontSize: 20, color: 'var(--navy)' }} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--t1)' }}>Take Attendance</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>Daily register</div>
          </div>
        </Link>
        <Link href="/dashboard/grades" className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
            <MaterialIcon icon="edit_note" style={{ fontSize: 20, color: '#7C3AED' }} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--t1)' }}>Enter Grades</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>Marks entry</div>
          </div>
        </Link>
        <Link href="/dashboard/homework" className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
            <MaterialIcon icon="assignment_add" style={{ fontSize: 20, color: 'var(--green)' }} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--t1)' }}>Assign Homework</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>Create assignment</div>
          </div>
        </Link>
        <Link href="/dashboard/planning" className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--amber-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
            <MaterialIcon icon="event_note" style={{ fontSize: 20, color: 'var(--amber)' }} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--t1)' }}>Lesson Plans</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>Plan lessons</div>
          </div>
        </Link>
      </div>

      {/* CLASSES & SUBJECTS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">My Classes</div>
              <div className="card-sub">{myClasses.length} classes assigned</div>
            </div>
          </div>
          <div style={{ padding: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {myClasses.map((cls: any) => {
                const count = students.filter(s => s.class_id === cls.id).length
                return (
                  <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} className="qa-item" style={{ padding: '12px' }}>
                    <MaterialIcon icon="school" style={{ fontSize: '18px', color: 'var(--amber)' }} />
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t1)' }}>{cls.name}</div>
                    <div style={{ fontSize: '9px', color: 'var(--t3)' }}>{count} students</div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">My Subjects</div>
              <div className="card-sub">{mySubjects.length} subjects assigned</div>
            </div>
          </div>
          <div style={{ padding: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {mySubjects.map((subject: any) => (
                <Link key={subject.id} href={`/dashboard/grades?subject=${subject.id}`} className="qa-item" style={{ padding: '12px' }}>
                  <MaterialIcon icon="menu_book" style={{ fontSize: '18px', color: '#7C3AED' }} />
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t1)' }}>{subject.name}</div>
                  <div style={{ fontSize: '9px', color: 'var(--t3)' }}>{subject.code}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav - Only shows on mobile */}
      <div className="mobile-bottom-nav">
        <Link href="/dashboard" className="mobile-nav-item">
          <MaterialIcon icon="home" style={{ fontSize: 22 }} />
          <span>Home</span>
        </Link>
        <Link href="/dashboard/attendance" className="mobile-nav-item">
          <MaterialIcon icon="school" style={{ fontSize: 22 }} />
          <span>Classes</span>
        </Link>
        <Link href="/dashboard/grades" className="mobile-nav-item">
          <MaterialIcon icon="menu_book" style={{ fontSize: 22 }} />
          <span>Subjects</span>
        </Link>
        <Link href="/dashboard/profile" className="mobile-nav-item">
          <MaterialIcon icon="person" style={{ fontSize: 22 }} />
          <span>Profile</span>
        </Link>
      </div>
    </div>
  )
}
