'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects } from '@/lib/hooks'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

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
    <div className="content" style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* PAGE HEADER */}
      <div style={{ 
        background: 'var(--white)', 
        padding: '20px 24px', 
        borderBottom: '1px solid var(--border)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '16px',
        marginBottom: '20px',
        borderRadius: 'var(--r)',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#1A3A6B', lineHeight: 1.2 }}>
            {greeting}, {user?.full_name?.split(' ')[0]}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--t3)', marginTop: '4px', fontWeight: 500 }}>
            {school?.name} • {formatDate(currentDate)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', 
            padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', 
            background: 'var(--white)', fontSize: '13px', fontWeight: 600, color: 'var(--t1)', 
            cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
          }}>
            <MaterialIcon icon="filter_list" style={{ fontSize: 16, color: 'var(--t2)' }} />
            Filter
          </button>
          <button style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', 
            padding: '10px 16px', borderRadius: 10, border: 'none', 
            background: '#1A3A6B', fontSize: '13px', fontWeight: 600, color: 'white', 
            cursor: 'pointer', boxShadow: 'var(--shadow)'
          }}>
            <MaterialIcon icon="add" style={{ fontSize: 16 }} />
            Quick Entry
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: 'var(--white)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-soft)', color: 'var(--navy)' }}>
              <MaterialIcon icon="group" style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Students</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)' }}>{students.length}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{classes.length} Classes · {subjects.length} Subjects</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--white)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-soft)', color: 'var(--green)' }}>
              <MaterialIcon icon="how_to_reg" style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Attendance</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>85%</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>Average rate</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--white)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDE9FE', color: '#7C3AED' }}>
              <MaterialIcon icon="school" style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Classes</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#7C3AED' }}>{classes.length}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{classes.filter((c: any) => c.is_active).length} Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Academic Actions</h3>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Common academic tasks</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          <Link href="/dashboard/grades" style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDE9FE' }}>
              <MaterialIcon icon="grade" style={{ fontSize: 18, color: '#7C3AED' }} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>Grades</div>
          </Link>
          <Link href="/dashboard/attendance" style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-soft)' }}>
              <MaterialIcon icon="how_to_reg" style={{ fontSize: 18, color: 'var(--navy)' }} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>Attendance</div>
          </Link>
          <Link href="/dashboard/homework" style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-soft)' }}>
              <MaterialIcon icon="assignment" style={{ fontSize: 18, color: 'var(--green)' }} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>Homework</div>
          </Link>
          <Link href="/dashboard/planning" style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--amber-soft)' }}>
              <MaterialIcon icon="event_note" style={{ fontSize: 18, color: 'var(--amber)' }} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>Lesson Plans</div>
          </Link>
          <Link href="/dashboard/timetable" style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--red-soft)' }}>
              <MaterialIcon icon="calendar_month" style={{ fontSize: 18, color: 'var(--red)' }} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>Timetable</div>
          </Link>
          <Link href="/dashboard/uneb" style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
              <MaterialIcon icon="workspace_premium" style={{ fontSize: 18, color: 'var(--t2)' }} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>UNEB</div>
          </Link>
        </div>
      </div>

      {/* CLASSES */}
      <div style={{ background: 'var(--white)', padding: '20px', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Classes - {academicYear} Term {currentTerm}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{classes.length} classes enrolled</div>
          </div>
          <button style={{ fontSize: '12px', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--t2)', cursor: 'pointer' }}>Manage</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {classes.map((cls: any) => {
            const count = getStudentCountForClass(cls.id)
            return (
              <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                <MaterialIcon icon="school" style={{ fontSize: 24, color: '#7C3AED' }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>{cls.name}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{count} students</div>
              </Link>
            )
          })}
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 1024px) {
          .content > div:nth-child(3) > div:last-child {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .content {
            padding: 70px 12px 20px !important;
          }
          .content > div:first-child {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 16px !important;
          }
          .content > div:first-child > div:last-child {
            justify-content: flex-start !important;
            margin-top: 12px;
          }
          .content > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
          .content > div:nth-child(3) > div:last-child {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .content > div:nth-child(4) > div:last-child {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .content > div:nth-child(3) > div:last-child {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .content > div:nth-child(4) > div:last-child {
            grid-template-columns: 1fr !important;
          }
        }

        /* Mobile Bottom Nav */
        .mobile-bottom-nav {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex !important;
          }
          .content {
            padding-bottom: 80px !important;
          }
        }
      `}</style>

      {/* Mobile Bottom Nav */}
      <div className="mobile-bottom-nav" style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        background: 'var(--white)', 
        borderTop: '1px solid var(--border)', 
        padding: '10px 8px 24px',
        justifyContent: 'space-around',
        zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.08)'
      }}>
        <Link href="/dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="home" style={{ fontSize: 22, color: 'var(--navy)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--navy)' }}>Home</span>
        </Link>
        <Link href="/dashboard/grades" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="menu_book" style={{ fontSize: 22, color: 'var(--t3)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--t3)' }}>Grades</span>
        </Link>
        <Link href="/dashboard/attendance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="how_to_reg" style={{ fontSize: 22, color: 'var(--t3)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--t3)' }}>Attendance</span>
        </Link>
        <Link href="/dashboard/timetable" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="calendar_month" style={{ fontSize: 22, color: 'var(--t3)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--t3)' }}>Timetable</span>
        </Link>
      </div>
    </div>
  )
}