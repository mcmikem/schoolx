'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects } from '@/lib/hooks'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'

export default function TeacherDashboard() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const [settingUp, setSettingUp] = useState(false)

  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  const myClasses = classes.slice(0, 6)
  const mySubjects = subjects.slice(0, 6)

  const needsSetup = classes.length === 0 || subjects.length === 0

  const runSetup = async () => {
    if (!school?.id) return
    setSettingUp(true)
    try {
      const currentYear = new Date().getFullYear().toString()
      
      // Create default classes
      const defaultClasses = [
        { school_id: school.id, name: 'P1', level: 'primary', academic_year: currentYear },
        { school_id: school.id, name: 'P2', level: 'primary', academic_year: currentYear },
        { school_id: school.id, name: 'P3', level: 'primary', academic_year: currentYear },
        { school_id: school.id, name: 'P4', level: 'primary', academic_year: currentYear },
        { school_id: school.id, name: 'P5', level: 'primary', academic_year: currentYear },
        { school_id: school.id, name: 'P6', level: 'primary', academic_year: currentYear },
        { school_id: school.id, name: 'P7', level: 'primary', academic_year: currentYear },
      ]
      await supabase.from('classes').insert(defaultClasses)
      
      // Create default subjects
      const defaultSubjects = [
        { school_id: school.id, name: 'English', code: 'ENG', level: 'primary' },
        { school_id: school.id, name: 'Mathematics', code: 'MTC', level: 'primary' },
        { school_id: school.id, name: 'Science', code: 'SCI', level: 'primary' },
        { school_id: school.id, name: 'Social Studies', code: 'SST', level: 'primary' },
        { school_id: school.id, name: 'Religious Education', code: 'CRE', level: 'primary' },
        { school_id: school.id, name: 'Physical Education', code: 'PE', level: 'primary' },
      ]
      await supabase.from('subjects').insert(defaultSubjects)
      
      // Create academic year
      await supabase.from('academic_years').insert({
        school_id: school.id,
        name: currentYear,
        start_date: `${currentYear}-01-01`,
        end_date: `${currentYear}-12-31`,
        is_current: true,
      })
      
      window.location.reload()
    } catch (err) {
      console.error('Setup error:', err)
      alert('Setup failed. Please try again.')
    } finally {
      setSettingUp(false)
    }
  }

  return (
    <div className="content">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <div className="ph-title truncate">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub truncate">{school?.name} • {academicYear} Term {currentTerm}</div>
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
      <div className="stat-grid">
        <Link href="/dashboard/attendance" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--amber)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">My Classes</div>
              <div className="stat-icon-box" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                <MaterialIcon icon="school" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--amber)' }}>{myClasses.length}</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1">Classes assigned</div>
          </div>
        </Link>

        <Link href="/dashboard/grades" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">My Subjects</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <MaterialIcon icon="menu_book" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>{mySubjects.length}</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1">Subjects teaching</div>
          </div>
        </Link>

        <Link href="/dashboard/students" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Total Students</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <MaterialIcon icon="group" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>{students.length}</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1">In my classes</div>
          </div>
        </Link>
      </div>

      {/* SETUP NEEDED PROMPT */}
      {needsSetup && (
        <div className="card !bg-amber-soft/50 border-amber/30 p-5 mt-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon icon="warning" className="text-amber text-2xl" />
            <div>
              <div className="text-sm font-bold text-on-surface">Setup Required</div>
              <div className="text-[11px] text-on-surface-variant font-medium">Your school needs initial setup</div>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
            It looks like your school doesn&apos;t have classes or subjects yet. Click below to set up automatically.
          </p>
          <button 
            onClick={runSetup} 
            disabled={settingUp}
            className="btn btn-primary !bg-amber border-none shadow-lg shadow-amber/20"
          >
            {settingUp ? 'Setting up...' : 'Run Setup'}
          </button>
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 mt-6">
        <Link href="/dashboard/attendance" className="qa-item !flex-row !justify-start !p-4">
          <div className="qa-icon !mb-0 !mr-3" style={{ background: 'var(--navy-soft)', borderColor: 'rgba(23,50,95,0.1)', color: 'var(--navy)' }}>
            <MaterialIcon icon="how_to_reg" style={{ fontSize: 20 }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--t1)] truncate">Attendance</div>
            <div className="text-[10px] text-[var(--t3)] font-medium truncate">Daily register</div>
          </div>
        </Link>
        <Link href="/dashboard/grades" className="qa-item !flex-row !justify-start !p-4">
          <div className="qa-icon !mb-0 !mr-3" style={{ background: 'var(--green-soft)', borderColor: 'rgba(46,148,72,0.1)', color: 'var(--green)' }}>
            <MaterialIcon icon="edit_note" style={{ fontSize: 20 }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--t1)] truncate">Enter Grades</div>
            <div className="text-[10px] text-[var(--t3)] font-medium truncate">Marks entry</div>
          </div>
        </Link>
        <Link href="/dashboard/homework" className="qa-item !flex-row !justify-start !p-4">
          <div className="qa-icon !mb-0 !mr-3" style={{ background: 'var(--green-soft)', borderColor: 'rgba(46,148,72,0.1)', color: 'var(--green)' }}>
            <MaterialIcon icon="assignment_add" style={{ fontSize: 20 }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--t1)] truncate">Homework</div>
            <div className="text-[10px] text-[var(--t3)] font-medium truncate">Assign task</div>
          </div>
        </Link>
        <Link href="/dashboard/planning" className="qa-item !flex-row !justify-start !p-4">
          <div className="qa-icon !mb-0 !mr-3" style={{ background: 'var(--amber-soft)', borderColor: 'rgba(184,107,12,0.1)', color: 'var(--amber)' }}>
            <MaterialIcon icon="event_note" style={{ fontSize: 20 }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--t1)] truncate">Lesson Plans</div>
            <div className="text-[10px] text-[var(--t3)] font-medium truncate">Plan teaching</div>
          </div>
        </Link>
      </div>

      {/* CLASSES & SUBJECTS */}
      <div className="main-grid">
        <div className="main-col">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">My Classes</div>
                <div className="card-sub">{myClasses.length} assigned</div>
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-3">
                {myClasses.map((cls: any) => {
                  const count = students.filter(s => s.class_id === cls.id).length
                  return (
                    <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} className="qa-item !py-3">
                      <MaterialIcon icon="school" className="text-amber mb-1" />
                      <div className="text-[12px] font-bold text-[var(--t1)] truncate w-full">{cls.name}</div>
                      <div className="text-[10px] text-[var(--t3)] font-medium">{count} students</div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="main-col lg:col-span-4">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">My Subjects</div>
                <div className="card-sub">{mySubjects.length} subjects</div>
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                {mySubjects.map((subject: any) => (
                  <Link key={subject.id} href={`/dashboard/grades?subject=${subject.id}`} className="qa-item !flex-row !justify-start !p-3">
                    <MaterialIcon icon="menu_book" className="text-green mr-3" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-[var(--t1)] truncate">{subject.name}</div>
                      <div className="text-[10px] text-[var(--t3)] font-medium uppercase tracking-wider">{subject.code}</div>
                    </div>
                  </Link>
                ))}
              </div>
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
