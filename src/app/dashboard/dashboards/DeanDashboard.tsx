'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects, useDashboardStats } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'
import ErrorBoundary from '@/components/ErrorBoundary'
import { StatsGridSkeleton } from '@/components/Skeletons'

import StatCard from '@/components/dashboard/StatCard'

function DeanDashboardContent() {
  const router = useRouter()
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const { stats, loading: statsLoading } = useDashboardStats(school?.id)

  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  if (statsLoading) {
    return (
      <div className="content">
        <StatsGridSkeleton cols={3} />
      </div>
    )
  }

  const getStudentCountForClass = (classId: string) => {
    return students.filter(s => s.class_id === classId).length
  }

  const attendanceRate = stats.totalStudents > 0
    ? Math.round((stats.presentToday / stats.totalStudents) * 100)
    : 0

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <div className="ph-title">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub">{school?.name} • {currentDate.toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost" onClick={() => router.push('/dashboard/grades')}>
            <MaterialIcon icon="filter_list" />
            Filter
          </button>
          <button className="btn btn-primary" onClick={() => router.push('/dashboard/grades')}>
            <MaterialIcon icon="add" />
            Quick Entry
          </button>
        </div>
      </div>

      <div className="stat-grid sm:grid-cols-3">
        <StatCard label="Students" value={students.length} subValue={`${classes.length} Classes enrolled`} icon="group" accentColor="navy" />
        <StatCard label="Attendance" value={`${attendanceRate}%`} subValue="Average rate today" icon="how_to_reg" accentColor="green" />
        <StatCard label="Subjects" value={subjects.length} subValue={`Across ${classes.length} classes`} icon="school" accentColor="amber" />
      </div>

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
    </div>
  )
}

export default function DeanDashboard() {
  return (
    <ErrorBoundary>
      <DeanDashboardContent />
    </ErrorBoundary>
  )
}