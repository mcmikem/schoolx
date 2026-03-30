'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects } from '@/lib/hooks'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

const subjectIcons: Record<string, string> = {
  'English': 'menu_book',
  'Maths': 'calculate',
  'Mathematics': 'calculate',
  'Science': 'science',
  'SST': 'public',
  'Social Studies': 'public',
  'CRE': 'auto_stories',
  'Religious Education': 'auto_stories',
  'PE': 'sports_soccer',
  'Physical Education': 'sports_soccer',
  'Music': 'music_note',
  'Art': 'palette',
  'ICT': 'computer',
  'Agriculture': 'grass',
}

const getSubjectIcon = (name: string) => {
  const key = Object.keys(subjectIcons).find(k => name.toLowerCase().includes(k.toLowerCase()))
  return subjectIcons[key || ''] || 'school'
}

const classColors = [
  { bg: '#FEF3C7', color: '#D97706' },
  { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#EDE9FE', color: '#6D28D9' },
  { bg: '#FEE2E2', color: '#DC2626' },
  { bg: '#E0F2FE', color: '#0284C7' },
  { bg: '#FCE7F3', color: '#DB2777' },
]
const getClassColor = (index: number) => classColors[index % classColors.length]

export default function TeacherDashboard() {
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

  const myClasses = classes.slice(0, 6)
  const mySubjects = subjects.slice(0, 6)

  const getStudentCountForClass = (classId: string) => {
    return students.filter(s => s.class_id === classId).length
  }

  return (
    <div className="content" style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* PAGE HEADER */}
      <div className="page-header-responsive" style={{ 
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
          <Link href="/dashboard/timetable" style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', 
            padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', 
            background: 'var(--white)', fontSize: '13px', fontWeight: 600, color: 'var(--t1)', 
            cursor: 'pointer', textDecoration: 'none', boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.2s'
          }}>
            <MaterialIcon icon="calendar_month" style={{ fontSize: 16, color: 'var(--t2)' }} />
            My Schedule
          </Link>
          <Link href="/dashboard/grades" style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', 
            padding: '10px 16px', borderRadius: 10, border: 'none', 
            background: '#1A3A6B', fontSize: '13px', fontWeight: 600, color: 'white', 
            cursor: 'pointer', textDecoration: 'none', boxShadow: 'var(--shadow)',
            transition: 'all 0.2s'
          }}>
            <MaterialIcon icon="add" style={{ fontSize: 16 }} />
            Quick Entry
          </Link>
        </div>
      </div>

      {/* GREETING CARD */}
      <div className="greeting-responsive" style={{ 
        background: '#1A3A6B', 
        borderRadius: 16, 
        padding: '24px', 
        boxShadow: 'var(--shadow-md)', 
        position: 'relative', 
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}></div>
        <div style={{ position: 'absolute', bottom: -50, left: 30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}></div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>{school?.name}</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Term {currentTerm} • {academicYear}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Academic Year</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>{academicYear}</div>
          </div>
        </div>

        {/* STATS */}
        <div className="stats-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '20px', position: 'relative', zIndex: 2 }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <MaterialIcon icon="school" style={{ fontSize: 20, color: '#FCD34D' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'white' }}>{myClasses.length}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>My Classes</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <MaterialIcon icon="menu_book" style={{ fontSize: 20, color: '#C4B5FD' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'white' }}>{mySubjects.length}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subjects</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <MaterialIcon icon="group" style={{ fontSize: 20, color: '#93C5FD' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'white' }}>{students.length}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Students</div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="quick-actions-responsive" style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.1px' }}>Quick Actions</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <Link href="/dashboard/attendance" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF3C7' }}>
              <MaterialIcon icon="how_to_reg" style={{ fontSize: 20, color: '#D97706' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Take Attendance</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Daily register</div>
            </div>
          </Link>
          <Link href="/dashboard/grades" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDE9FE' }}>
              <MaterialIcon icon="edit_note" style={{ fontSize: 20, color: '#6D28D9' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Enter Grades</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Marks entry</div>
            </div>
          </Link>
          <Link href="/dashboard/homework" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#DCFCE7' }}>
              <MaterialIcon icon="assignment_add" style={{ fontSize: 20, color: '#15803D' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Assign Homework</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Create assignment</div>
            </div>
          </Link>
          <Link href="/dashboard/lesson-plans" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEFCE8' }}>
              <MaterialIcon icon="event_note" style={{ fontSize: 20, color: '#CA8A04' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Lesson Plans</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Plan lessons</div>
            </div>
          </Link>
        </div>
      </div>

      {/* CLASSES & SUBJECTS */}
      <div className="columns-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* CLASSES */}
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>My Classes</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2, fontWeight: 500 }}>{myClasses.length} classes assigned</div>
            </div>
            <Link href="/dashboard/attendance" style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 600, textDecoration: 'none' }}>View all</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {myClasses.map((cls: any, idx: number) => {
              const count = getStudentCountForClass(cls.id)
              const colors = getClassColor(idx)
              return (
                <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} style={{ 
                  borderRadius: 10, 
                  padding: '12px', 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  background: colors.bg,
                  textDecoration: 'none',
                  border: 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                    <MaterialIcon icon="school" style={{ fontSize: 18, color: colors.color }} />
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: colors.color }}>{cls.name}</div>
                  <div style={{ fontSize: 10, color: colors.color, marginTop: 2, fontWeight: 500, opacity: 0.8 }}>{count} students</div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* SUBJECTS */}
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>My Subjects</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2, fontWeight: 500 }}>{mySubjects.length} subjects assigned</div>
            </div>
            <Link href="/dashboard/grades" style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 600, textDecoration: 'none' }}>View all</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {mySubjects.map((subject: any) => (
              <Link key={subject.id} href={`/dashboard/grades?subject=${subject.id}`} style={{ 
                borderRadius: 10, 
                padding: '12px', 
                textAlign: 'center', 
                cursor: 'pointer', 
                background: 'var(--bg)',
                textDecoration: 'none',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                  <MaterialIcon icon={getSubjectIcon(subject.name)} style={{ fontSize: 18, color: 'var(--navy)' }} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)' }}>{subject.name}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, fontWeight: 500 }}>{subject.code}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .stats-grid-responsive {
          grid-template-columns: repeat(3, 1fr);
        }
        .quick-actions-responsive > div:last-child {
          grid-template-columns: repeat(4, 1fr);
        }
        .columns-responsive {
          grid-template-columns: 1fr 1fr;
        }
        
        /* Tablet */
        @media (max-width: 1024px) {
          .quick-actions-responsive > div:last-child {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .columns-responsive {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        
        /* Mobile */
        @media (max-width: 768px) {
          .content {
            padding: 12px 12px 90px !important;
          }
          .page-header-responsive {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 12px !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
          }
          .page-header-responsive > div:first-child {
            min-width: unset !important;
          }
          .page-header-responsive > div:first-child > div:first-child {
            font-size: 16px !important;
          }
          .page-header-responsive > div:first-child > div:last-child {
            font-size: 11px !important;
            display: none !important;
          }
          .page-header-responsive > div:last-child {
            justify-content: flex-start !important;
            margin-top: 0;
          }
          .page-header-responsive > div:last-child > a {
            padding: 8px 12px !important;
            font-size: 12px !important;
          }
          .greeting-responsive {
            padding: 16px !important;
          }
          .stats-grid-responsive {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .quick-actions-responsive {
            margin-bottom: 16px !important;
          }
          .quick-actions-responsive > div:last-child {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .columns-responsive {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .columns-responsive > div > div:last-child {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        
        /* Small mobile */
        @media (max-width: 480px) {
          .columns-responsive > div > div:last-child {
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
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.08)'
      }}>
        <Link href="/dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="home" style={{ fontSize: 22, color: 'var(--navy)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--navy)' }}>Home</span>
        </Link>
        <Link href="/dashboard/attendance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="school" style={{ fontSize: 22, color: 'var(--t3)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--t3)' }}>Classes</span>
        </Link>
        <Link href="/dashboard/grades" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="menu_book" style={{ fontSize: 22, color: 'var(--t3)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--t3)' }}>Subjects</span>
        </Link>
        <Link href="/dashboard/profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="person" style={{ fontSize: 22, color: 'var(--t3)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--t3)' }}>Profile</span>
        </Link>
      </div>
    </div>
  )
}