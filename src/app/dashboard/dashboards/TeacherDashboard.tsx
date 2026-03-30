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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const myClasses = classes.slice(0, 6)
  const mySubjects = subjects.slice(0, 6)

  const getStudentCountForClass = (classId: string) => {
    return students.filter(s => s.class_id === classId).length
  }

  return (
    <div className="content">
      {/* PAGE HEADER - Wireframe style */}
      <div className="page-header" style={{ background: 'var(--white)', padding: '24px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div className="ph-title" style={{ fontSize: '21px', fontWeight: 900, color: '#1A3A6B', lineHeight: 1.1, letterSpacing: '-0.3px' }}>
            {greeting}, {user?.full_name?.split(' ')[0]}
          </div>
          <div className="ph-sub" style={{ fontSize: '12px', color: 'var(--slate)', fontWeight: 600, marginTop: '4px' }}>
            {school?.name} • {formatDate(currentDate)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <button className="icon-btn" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <MaterialIcon icon="notifications" style={{ fontSize: 18, color: 'var(--slate)' }} />
            <span style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, background: '#EF4444', borderRadius: '50%', border: '1.5px solid var(--white)' }}></span>
          </button>
          <button className="icon-btn" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <MaterialIcon icon="dark_mode" style={{ fontSize: 18, color: 'var(--slate)' }} />
          </button>
          <button style={{ height: 36, background: '#1A3A6B', border: 'none', borderRadius: 20, display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px 0 5px', cursor: 'pointer', boxShadow: 'var(--shadow)' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'white' }}>{user?.full_name?.charAt(0) || 'T'}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{user?.full_name?.split(' ')[0]}</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* GREETING CARD - Blue wireframe style */}
        <div style={{ background: '#1A3A6B', borderRadius: 16, padding: '18px 18px 16px', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}></div>
          <div style={{ position: 'absolute', bottom: -40, left: 20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
            <div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginTop: 4 }}>{school?.name}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{academicYear}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Term {currentTerm}</div>
            </div>
          </div>

          {/* STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '14px', position: 'relative', zIndex: 2 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
                <MaterialIcon icon="school" style={{ fontSize: 16, color: '#FCD34D' }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: '-0.8px', lineHeight: 1 }}>{myClasses.length}</div>
              <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 3 }}>My Classes</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
                <MaterialIcon icon="menu_book" style={{ fontSize: 16, color: '#C4B5FD' }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: '-0.8px', lineHeight: 1 }}>{mySubjects.length}</div>
              <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 3 }}>Subjects</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
                <MaterialIcon icon="group" style={{ fontSize: 16, color: '#93C5FD' }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: '-0.8px', lineHeight: 1 }}>{students.length}</div>
              <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 3 }}>Students</div>
            </div>
          </div>
        </div>

        {/* QUICK BTNS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Link href="/dashboard/timetable" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--white)', fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', cursor: 'pointer', textDecoration: 'none', boxShadow: 'var(--shadow-sm)' }}>
            <MaterialIcon icon="calendar_month" style={{ fontSize: 16 }} />
            My Schedule
          </Link>
          <Link href="/dashboard/grades" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', borderRadius: 12, border: 'none', background: '#1A3A6B', fontSize: '13.5px', fontWeight: 700, color: 'white', cursor: 'pointer', textDecoration: 'none', boxShadow: 'var(--shadow)' }}>
            <MaterialIcon icon="add" style={{ fontSize: 16 }} />
            Quick Entry
          </Link>
        </div>

        {/* QUICK ACTIONS - Scrollable tiles */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.1px' }}>Quick Actions</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', margin: '0 -16px', padding: '2px 16px 6px', scrollbarWidth: 'none' }}>
            <Link href="/dashboard/attendance" style={{ flexShrink: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 11px', width: 92, display: 'flex', flexDirection: 'column', gap: 9, cursor: 'pointer', textDecoration: 'none', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF3C7' }}>
                <MaterialIcon icon="how_to_reg" style={{ fontSize: 18, color: '#D97706' }} />
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>Take Attendance</div>
              <div style={{ fontSize: 10, color: 'var(--slate)', lineHeight: 1.2, marginTop: -5, fontWeight: 500 }}>Daily register</div>
            </Link>
            <Link href="/dashboard/grades" style={{ flexShrink: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 11px', width: 92, display: 'flex', flexDirection: 'column', gap: 9, cursor: 'pointer', textDecoration: 'none', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDE9FE' }}>
                <MaterialIcon icon="edit_note" style={{ fontSize: 18, color: '#6D28D9' }} />
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>Enter Grades</div>
              <div style={{ fontSize: 10, color: 'var(--slate)', lineHeight: 1.2, marginTop: -5, fontWeight: 500 }}>Marks entry</div>
            </Link>
            <Link href="/dashboard/homework" style={{ flexShrink: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 11px', width: 92, display: 'flex', flexDirection: 'column', gap: 9, cursor: 'pointer', textDecoration: 'none', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#DCFCE7' }}>
                <MaterialIcon icon="assignment_add" style={{ fontSize: 18, color: '#15803D' }} />
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>Assign Homework</div>
              <div style={{ fontSize: 10, color: 'var(--slate)', lineHeight: 1.2, marginTop: -5, fontWeight: 500 }}>Create assignment</div>
            </Link>
            <Link href="/dashboard/lesson-plans" style={{ flexShrink: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 11px', width: 92, display: 'flex', flexDirection: 'column', gap: 9, cursor: 'pointer', textDecoration: 'none', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEFCE8' }}>
                <MaterialIcon icon="event_note" style={{ fontSize: 18, color: '#CA8A04' }} />
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>Lesson Plans</div>
              <div style={{ fontSize: 10, color: 'var(--slate)', lineHeight: 1.2, marginTop: -5, fontWeight: 500 }}>Plan lessons</div>
            </Link>
          </div>
        </div>

        {/* CLASSES & SUBJECTS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* CLASSES */}
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)' }}>My Classes</div>
            <div style={{ fontSize: '10.5px', color: 'var(--slate)', marginTop: 2, marginBottom: 10, fontWeight: 500 }}>{myClasses.length} classes assigned</div>
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 10 }}></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {myClasses.map((cls: any) => (
                <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} style={{ border: '1.5px solid var(--border)', borderRadius: 10, padding: '9px 6px', textAlign: 'center', cursor: 'pointer', background: 'var(--white)', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
                    <MaterialIcon icon="school" style={{ fontSize: 14, color: '#D97706' }} />
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{cls.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--slate)', marginTop: 2, fontWeight: 500 }}>{getStudentCountForClass(cls.id)} students</div>
                </Link>
              ))}
            </div>
          </div>

          {/* SUBJECTS */}
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)' }}>My Subjects</div>
            <div style={{ fontSize: '10.5px', color: 'var(--slate)', marginTop: 2, marginBottom: 10, fontWeight: 500 }}>{mySubjects.length} subjects assigned</div>
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 10 }}></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {mySubjects.map((subject: any) => (
                <Link key={subject.id} href={`/dashboard/grades?subject=${subject.id}`} style={{ border: '1.5px solid var(--border)', borderRadius: 10, padding: '9px 6px', textAlign: 'center', cursor: 'pointer', background: 'var(--white)', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
                    <MaterialIcon icon="menu_book" style={{ fontSize: 14, color: '#6D28D9' }} />
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{subject.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--slate)', marginTop: 2, fontWeight: 500 }}>{subject.code}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
