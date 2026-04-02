'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'

export default function DeanDashboard() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)

  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const getStudentCountForClass = (classId: string) => {
    return students.filter(s => s.class_id === classId).length
  }

  return (
    <div className="content">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="min-w-0">
          <div className="ph-title truncate">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub truncate">{school?.name} • {formatDate(currentDate)}</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost">
            <MaterialIcon icon="filter_list" style={{ fontSize: 16 }} />
            Filter
          </button>
          <button className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: 16 }} />
            Quick Entry
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="stat-grid sm:grid-cols-3 lg:grid-cols-3">
        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Students</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <MaterialIcon icon="group" style={{ fontSize: 18 }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>{students.length}</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1 uppercase tracking-wider">{classes.length} Classes enrolled</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--green)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Attendance</div>
              <div className="stat-icon-box" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                <MaterialIcon icon="how_to_reg" style={{ fontSize: 18 }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--green)' }}>85%</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1 uppercase tracking-wider">Average rate today</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--amber)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Subjects</div>
              <div className="stat-icon-box" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                <MaterialIcon icon="school" style={{ fontSize: 18 }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--amber)' }}>{subjects.length}</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1 uppercase tracking-wider">{subjects.length} active</div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="mb-6">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-[var(--t1)]">Academic Actions</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Link href="/dashboard/grades" className="qa-item">
            <div className="qa-icon" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
              <MaterialIcon icon="grade" style={{ fontSize: 18 }} />
            </div>
            <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Grades</div>
          </Link>
          <Link href="/dashboard/attendance" className="qa-item">
            <div className="qa-icon" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
              <MaterialIcon icon="how_to_reg" style={{ fontSize: 18 }} />
            </div>
            <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Attendance</div>
          </Link>
          <Link href="/dashboard/homework" className="qa-item">
            <div className="qa-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
              <MaterialIcon icon="assignment" style={{ fontSize: 18 }} />
            </div>
            <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Homework</div>
          </Link>
          <Link href="/dashboard/planning" className="qa-item">
            <div className="qa-icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
              <MaterialIcon icon="event_note" style={{ fontSize: 18 }} />
            </div>
            <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Lesson Plans</div>
          </Link>
          <Link href="/dashboard/timetable" className="qa-item">
            <div className="qa-icon" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
              <MaterialIcon icon="calendar_month" style={{ fontSize: 18 }} />
            </div>
            <div className="text-[12px] font-bold text-[var(--t1)] mt-2">Timetable</div>
          </Link>
          <Link href="/dashboard/uneb" className="qa-item">
            <div className="qa-icon" style={{ background: 'var(--bg)', color: 'var(--t2)' }}>
              <MaterialIcon icon="workspace_premium" style={{ fontSize: 18 }} />
            </div>
            <div className="text-[12px] font-bold text-[var(--t1)] mt-2">UNEB</div>
          </Link>
        </div>
      </div>

      {/* CLASSES */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Classes - {academicYear} Term {currentTerm}</div>
            <div className="card-sub">{classes.length} classes enrolled</div>
          </div>
          <button className="btn btn-ghost !text-xs">Manage</button>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {classes.map((cls: any) => {
              const count = getStudentCountForClass(cls.id)
              return (
                <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} className="qa-item !bg-[var(--bg)] border-none">
                  <MaterialIcon icon="school" className="text-navy text-2xl mb-1" />
                  <div className="text-[13px] font-bold text-[var(--t1)] truncate w-full">{cls.name}</div>
                  <div className="text-[11px] text-[var(--t3)] font-medium">{count} students</div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="mobile-bottom-nav">
        <Link href="/dashboard" className="mobile-nav-item active">
          <MaterialIcon icon="home" />
          <span>Home</span>
        </Link>
        <Link href="/dashboard/grades" className="mobile-nav-item">
          <MaterialIcon icon="menu_book" />
          <span>Grades</span>
        </Link>
        <Link href="/dashboard/attendance" className="mobile-nav-item">
          <MaterialIcon icon="how_to_reg" />
          <span>Attendance</span>
        </Link>
        <Link href="/dashboard/timetable" className="mobile-nav-item">
          <MaterialIcon icon="calendar_today" />
          <span>Table</span>
        </Link>
      </div>
    </div>
  )
}