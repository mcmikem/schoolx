'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSyncStatus } from '@/lib/useSyncStatus'
import { useTheme } from '@/lib/theme-context'
import { canAccess, type UserRole, type RolePermissions } from '@/lib/roles'
import { useStudents, useClasses, useFeePayments, useAttendance } from '@/lib/hooks'
import { useAcademic } from '@/lib/academic-context'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useToast } from '@/components/Toast'

const roleBasedRoutes: Record<string, keyof RolePermissions> = {
  '/dashboard/students': 'students',
  '/dashboard/attendance': 'attendance',
  '/dashboard/grades': 'grades',
  '/dashboard/fees': 'fees',
  '/dashboard/messages': 'messages',
  '/dashboard/reports': 'reports',
  '/dashboard/staff': 'staff',
  '/dashboard/settings': 'settings',
  '/dashboard/discipline': 'discipline',
  '/dashboard/invoicing': 'invoicing',
  '/dashboard/assets': 'assets',
  '/dashboard/analytics': 'analytics',
  '/dashboard/export': 'export',
  '/dashboard/board-report': 'boardReport',
  '/dashboard/auto-sms': 'autoSMS',
  '/dashboard/warnings': 'warnings',
  '/dashboard/visitors': 'visitors',
}

const navItemsByRole: Record<string, { href: string; label: string; icon: string; badge?: string }[]> = {
  headmaster: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/analytics', label: 'Analytics', icon: 'analytics', badge: 'New' },
    { href: '/dashboard/students', label: 'Students', icon: 'group', badge: '140' },
    { href: '/dashboard/attendance', label: 'Attendance', icon: 'how_to_reg', badge: '3' },
    { href: '/dashboard/grades', label: 'Grades', icon: 'menu_book' },
    { href: '/dashboard/uneb', label: 'UNEB', icon: 'workspace_premium' },
    { href: '/dashboard/fees', label: 'Finance', icon: 'payments' },
    { href: '/dashboard/reports', label: 'Reports', icon: 'description' },
    { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
    { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
    { href: '/dashboard/staff', label: 'Staff', icon: 'person' },
    { href: '/dashboard/discipline', label: 'Discipline', icon: 'warning', badge: '2' },
    { href: '/dashboard/trends', label: 'Trends', icon: 'trending_up' },
  ],
  dean_of_studies: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/students', label: 'Students', icon: 'group' },
    { href: '/dashboard/attendance', label: 'Attendance', icon: 'how_to_reg' },
    { href: '/dashboard/grades', label: 'Grades', icon: 'menu_book' },
    { href: '/dashboard/homework', label: 'Homework', icon: 'assignment' },
    { href: '/dashboard/planning', label: 'Planning', icon: 'event_note' },
    { href: '/dashboard/uneb', label: 'UNEB', icon: 'workspace_premium' },
    { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
    { href: '/dashboard/discipline', label: 'Discipline', icon: 'warning' },
    { href: '/dashboard/calendar', label: 'Calendar', icon: 'event' },
  ],
  bursar: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/fees', label: 'Finance', icon: 'payments' },
    { href: '/dashboard/invoicing', label: 'Invoicing', icon: 'description' },
    { href: '/dashboard/cashbook', label: 'Cashbook', icon: 'book' },
    { href: '/dashboard/students', label: 'Students', icon: 'group' },
    { href: '/dashboard/reports', label: 'Reports', icon: 'analytics' },
    { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
    { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
  ],
  teacher: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/attendance', label: 'Attendance', icon: 'how_to_reg' },
    { href: '/dashboard/grades', label: 'Grades', icon: 'menu_book' },
    { href: '/dashboard/homework', label: 'Homework', icon: 'assignment' },
    { href: '/dashboard/planning', label: 'Planning', icon: 'event_note' },
    { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
  ],
}

function MaterialIcon({ icon, className, style }: { icon: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-outlined ${className || ''}`} style={style}>
      {icon}
    </span>
  )
}

function SyncStatus() {
  const { isOnline, pendingCount, isSyncing } = useSyncStatus()
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 500, color: 'var(--green)' }}>
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? 'var(--green)' : 'var(--red)', animation: isOnline && !isSyncing ? 'blink 2.5s ease-in-out infinite' : 'none' }} />
      {isOnline ? (isSyncing ? 'Syncing...' : 'System Active') : 'Offline'}
      {pendingCount > 0 && <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--amber)', fontFamily: 'DM Mono' }}>{pendingCount} pending</span>}
    </div>
  )
}

function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ type: string; name: string; link: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const searchResults = [
      { type: 'Student', name: `${query} (P7A)`, link: '/dashboard/students' },
      { type: 'Page', name: 'Fees Management', link: '/dashboard/fees' },
      { type: 'Page', name: 'Attendance Report', link: '/dashboard/attendance' },
      { type: 'Page', name: 'Student Reports', link: '/dashboard/reports' },
    ].filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
    setResults(searchResults)
  }, [query])

  const handleSelect = (link: string) => {
    router.push(link)
    onClose()
    setQuery('')
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r2)', width: '100%', maxWidth: 480, boxShadow: 'var(--sh3)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <MaterialIcon icon="search" style={{ fontSize: 18, color: 'var(--t3)' }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search students, fees, reports..." style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: 'var(--t1)', outline: 'none' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--t3)' }}><MaterialIcon icon="close" style={{ fontSize: 16 }} /></button>
        </div>
        {results.length > 0 && (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {results.map((r, i) => (
              <div key={i} onClick={() => handleSelect(r.link)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                <MaterialIcon icon={r.type === 'Student' ? 'person' : 'description'} style={{ fontSize: 16, color: 'var(--t3)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>No results found</div>
        )}
        {!query && (
          <div style={{ padding: 16, fontSize: 11, color: 'var(--t4)' }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Quick Links</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: 'var(--bg)', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>⌘K to search</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notifications = [
    { id: 1, title: '3 classes not marked', desc: 'Attendance pending today', time: '5m ago', icon: 'schedule', color: 'var(--amber)' },
    { id: 2, title: '4 students at risk', desc: 'Below 50% in 2+ subjects', time: '1h ago', icon: 'warning', color: 'var(--red)' },
    { id: 3, title: 'Fee payment received', desc: 'UGX 150,000 from Parent', time: '2h ago', icon: 'payments', color: 'var(--green)' },
    { id: 4, title: 'SMS sent successfully', desc: '98% delivery rate', time: '3h ago', icon: 'sms', color: 'var(--navy)' },
  ]

  if (!open) return null

  return (
    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: 'var(--sh3)', minWidth: 280, zIndex: 100, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Notifications</span>
        <button style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--navy)', cursor: 'pointer' }}>Mark all read</button>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {notifications.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${n.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MaterialIcon icon={n.icon} style={{ fontSize: 15, color: n.color }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{n.title}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{n.desc}</div>
              <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 4 }}>{n.time}</div>
            </div>
          </div>
        ))}
      </div>
      <Link href="/dashboard/notices" onClick={onClose} style={{ display: 'block', padding: '10px 14px', textAlign: 'center', fontSize: 12, color: 'var(--navy)', borderTop: '1px solid var(--border)', textDecoration: 'none' }}>
        View all notifications
      </Link>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, school, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const { theme, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { currentTerm, academicYear } = useAcademic()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuOpen && !(event.target as Element).closest('.user-menu')) {
        setUserMenuOpen(false)
      }
      if (notifOpen && !(event.target as Element).closest('.notif-panel')) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [userMenuOpen, notifOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!user || !pathname) return
    const routeKey = Object.keys(roleBasedRoutes).find(key => pathname.startsWith(key))
    if (routeKey) {
      const permission = roleBasedRoutes[routeKey]
      if (user.role && !canAccess(user.role as UserRole, permission)) {
        toast.error('Access denied')
        router.push('/dashboard')
      }
    }
  }, [user, pathname, router, toast])

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
  }

  const currentDate = new Date()
  const pageTitle = pathname === '/dashboard' ? 'Dashboard Overview' : 
    pathname.replace('/dashboard/', '').replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())

  const schoolName = school?.name || 'My School'
  const schoolInitial = schoolName.charAt(0).toUpperCase()

  return (
    <ErrorBoundary>
      <OfflineIndicator />
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} style={{ width: 240, minWidth: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100, boxShadow: 'var(--sh1)' }}>
          <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              {school?.logo_url ? (
                <img src={school.logo_url} alt={schoolName} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Sora', fontWeight: 700, fontSize: 16, color: '#fff' }}>
                  {schoolInitial}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-.2px', lineHeight: 1.1 }}>{schoolName}</div>
                <div style={{ fontSize: 10, color: 'var(--t4)', letterSpacing: '.3px', marginTop: 1 }}>by Omuto Foundation</div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="sidebar-close-btn" style={{ display: 'none', width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcon icon="close" style={{ fontSize: 20, color: 'var(--t2)' }} />
              </button>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{school?.name || 'Loading...'}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                {user?.role?.replace('_', ' ') || 'User'} · Term {currentTerm || '...'}
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', scrollbarWidth: 'none' }}>
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--t4)', padding: '10px 10px 5px' }}>Overview</div>
              <Link href="/dashboard" className="nav-item active" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: pathname === '/dashboard' ? 'var(--navy)' : 'var(--t2)', fontSize: 14, fontWeight: pathname === '/dashboard' ? 600 : 500, cursor: 'pointer', background: pathname === '/dashboard' ? 'var(--navy-soft)' : 'transparent', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="dashboard" style={{ fontSize: 17 }} />
                Dashboard
              </Link>
              <Link href="/dashboard/analytics" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="analytics" style={{ fontSize: 17 }} />
                Analytics
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, fontFamily: 'DM Mono', background: 'var(--green-soft)', color: 'var(--green)' }}>New</span>
              </Link>
            </div>

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--t4)', padding: '10px 10px 5px' }}>Academics</div>
              <Link href="/dashboard/students" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="group" style={{ fontSize: 17 }} />
                Students
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, fontFamily: 'DM Mono', background: 'var(--navy-soft)', color: 'var(--navy)' }}>{students?.length || 0}</span>
              </Link>
              <Link href="/dashboard/attendance" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="how_to_reg" style={{ fontSize: 17 }} />
                Attendance
                {classes && classes.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, fontFamily: 'DM Mono', background: 'var(--amber-soft)', color: 'var(--amber)' }}>{classes.length}</span>
                )}
              </Link>
              <Link href="/dashboard/grades" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="menu_book" style={{ fontSize: 17 }} />
                Grades
              </Link>
              <Link href="/dashboard/exams" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="fact_check" style={{ fontSize: 17 }} />
                Exams
              </Link>
              <Link href="/dashboard/uneb-registration" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="assignment_ind" style={{ fontSize: 17 }} />
                UNEB Registration
              </Link>
              <Link href="/dashboard/promotion" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="trending_up" style={{ fontSize: 17 }} />
                Student Promotion
              </Link>
              <Link href="/dashboard/homework-submissions" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="assignment_turned_in" style={{ fontSize: 17 }} />
                Homework Submissions
              </Link>
              <Link href="/dashboard/lesson-plans" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="menu_book" style={{ fontSize: 17 }} />
                Lesson Plans
              </Link>
              <Link href="/dashboard/scheme-of-work" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="list_alt" style={{ fontSize: 17 }} />
                Scheme of Work
              </Link>
              <Link href="/dashboard/fees" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="payments" style={{ fontSize: 17 }} />
                Finance
              </Link>
              <Link href="/dashboard/payment-plans" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="calendar_month" style={{ fontSize: 17 }} />
                Payment Plans
              </Link>
              <Link href="/dashboard/reports" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="description" style={{ fontSize: 17 }} />
                Reports
              </Link>
              <Link href="/dashboard/dorm" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="bed" style={{ fontSize: 17 }} />
                Dormitory
              </Link>
              <Link href="/dashboard/dorm-attendance" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="nightlight" style={{ fontSize: 17 }} />
                Dorm Attendance
              </Link>
              <Link href="/dashboard/library" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="local_library" style={{ fontSize: 17 }} />
                Library
              </Link>
            </div>

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--t4)', padding: '10px 10px 5px' }}>Communication</div>
              <Link href="/dashboard/messages" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="chat" style={{ fontSize: 17 }} />
                Messages
              </Link>
              <Link href="/dashboard/notices" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="campaign" style={{ fontSize: 17 }} />
                Notices
              </Link>
              <Link href="/dashboard/sms-templates" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="sms" style={{ fontSize: 17 }} />
                SMS Templates
              </Link>
              <Link href="/dashboard/homework" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="assignment" style={{ fontSize: 17 }} />
                Homework
              </Link>
            </div>

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--t4)', padding: '10px 10px 5px' }}>Administration</div>
              <Link href="/dashboard/timetable" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="calendar_month" style={{ fontSize: 17 }} />
                Timetable
              </Link>
              <Link href="/dashboard/staff" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="person" style={{ fontSize: 17 }} />
                Staff
              </Link>
              <Link href="/dashboard/discipline" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="warning" style={{ fontSize: 17 }} />
                Discipline
              </Link>
              <Link href="/dashboard/trends" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="trending_up" style={{ fontSize: 17 }} />
                Trends
              </Link>
              <Link href="/dashboard/warnings" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="warning" style={{ fontSize: 17 }} />
                At Risk
              </Link>
              <Link href="/dashboard/visitors" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="badge" style={{ fontSize: 17 }} />
                Visitors
              </Link>
              <Link href="/dashboard/staff-attendance" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="how_to_reg" style={{ fontSize: 17 }} />
                Staff Attendance
              </Link>
              <Link href="/dashboard/leave" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="event_busy" style={{ fontSize: 17 }} />
                Leave Requests
              </Link>
              <Link href="/dashboard/allocations" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="assignment_ind" style={{ fontSize: 17 }} />
                Subject Allocations
              </Link>
              <Link href="/dashboard/health" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="medical_services" style={{ fontSize: 17 }} />
                Health Records
              </Link>
              <Link href="/dashboard/behavior" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="psychology" style={{ fontSize: 17 }} />
                Behavior Log
              </Link>
              <Link href="/dashboard/calendar" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="event" style={{ fontSize: 17 }} />
                Calendar
              </Link>
              <Link href="/dashboard/comments" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="comment" style={{ fontSize: 17 }} />
                Comments
              </Link>
              <Link href="/dashboard/uneb" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="workspace_premium" style={{ fontSize: 17 }} />
                UNEB
              </Link>
              <Link href="/dashboard/cashbook" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="book" style={{ fontSize: 17 }} />
                Cashbook
              </Link>
              <Link href="/dashboard/inventory" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="inventory_2" style={{ fontSize: 17 }} />
                Inventory
              </Link>
              <Link href="/dashboard/transport" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="directions_bus" style={{ fontSize: 17 }} />
                Transport
              </Link>
              <Link href="/dashboard/budget" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="account_balance_wallet" style={{ fontSize: 17 }} />
                Budget & Expenses
              </Link>
            </div>

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--t4)', padding: '10px 10px 5px' }}>Data</div>
              <Link href="/dashboard/moes-reports" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="assessment" style={{ fontSize: 17 }} />
                MOES Reports
              </Link>
              <Link href="/dashboard/import" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="upload" style={{ fontSize: 17 }} />
                Import
              </Link>
              <Link href="/dashboard/export" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="download" style={{ fontSize: 17 }} />
                Export
              </Link>
              <Link href="/dashboard/idcards" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="badge" style={{ fontSize: 17 }} />
                ID Cards
              </Link>
            </div>

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--t4)', padding: '10px 10px 5px' }}>System</div>
              <Link href="/dashboard/settings" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="settings" style={{ fontSize: 17 }} />
                Settings
              </Link>
              <Link href="/dashboard/audit" className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, color: 'var(--t2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur) var(--ease)' }}>
                <MaterialIcon icon="history" style={{ fontSize: 17 }} />
                Audit Log
              </Link>
            </div>
          </nav>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <SyncStatus />
          </div>
        </aside>

        <main className="main-content" style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', width: 'calc(100% - 240px)' }}>
          <header className="topbar" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', height: 60, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 18, position: 'sticky', top: 0, zIndex: 50, boxShadow: 'var(--sh1)', flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mobile-menu-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
              <MaterialIcon icon="menu" style={{ fontSize: 24, color: 'var(--t1)' }} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-.2px' }}>{pageTitle}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{currentDate.toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>

            <div className="search-bar" onClick={() => setSearchOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: 'var(--t3)', minWidth: 240, cursor: 'text' }}>
              <MaterialIcon icon="search" style={{ fontSize: 15, color: 'var(--t4)' }} />
              <span style={{ flex: 1 }}>Search students, fees, reports…</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono', fontSize: 10, color: 'var(--t4)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>⌘K</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="notif-panel" style={{ position: 'relative' }}>
                <div onClick={() => setNotifOpen(!notifOpen)} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--sh1)', position: 'relative' }}>
                  <MaterialIcon icon="notifications" style={{ fontSize: 16, color: 'var(--t2)' }} />
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', border: '1.5px solid var(--surface)' }} />
                </div>
                <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
              </div>
              <div onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--sh1)' }}>
                <MaterialIcon icon={theme === 'dark' ? 'light_mode' : 'dark_mode'} style={{ fontSize: 16, color: 'var(--t2)' }} />
              </div>
              <div style={{ position: 'relative' }}>
                <div className="user-menu" onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px 5px 5px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 99, cursor: 'pointer', boxShadow: 'var(--sh1)', transition: 'all var(--dur) var(--ease)' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'Sora' }}>
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{user?.full_name?.split(' ')[0] || 'User'}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{school?.name?.split(' ')[0] || 'School'}</div>
                  </div>
                </div>
                {userMenuOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: 'var(--sh3)', minWidth: 160, zIndex: 100, overflow: 'hidden' }}>
                    <Link href="/dashboard/settings" onClick={() => setUserMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13, color: 'var(--t2)', cursor: 'pointer', textDecoration: 'none' }}>
                      <MaterialIcon icon="settings" style={{ fontSize: 16 }} />
                      Settings
                    </Link>
                    <div style={{ borderTop: '1px solid var(--border)' }} />
                    <div onClick={() => { setUserMenuOpen(false); handleSignOut() }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)', cursor: 'pointer' }}>
                      <MaterialIcon icon="logout" style={{ fontSize: 16 }} />
                      Sign Out
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {children}
        </main>
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} className="sidebar-overlay visible" />
      )}
      <style>{`
        @keyframes blink { 0%,100%{ opacity:1 } 50%{ opacity:.3 } }
        .nav-item:hover { background: var(--bg); color: var(--t1); }
        .nav-item { min-height: 44px; }
        
        /* Desktop: sidebar always visible */
        @media (min-width: 1025px) {
          .sidebar { display: flex !important; left: 0 !important; }
          .mobile-menu-btn { display: none !important; }
          .sidebar-overlay { display: none !important; }
        }
        
        /* Mobile: sidebar hidden by default */
        @media (max-width: 768px), (max-width: 1024px) {
          .sidebar { 
            display: none !important;
          }
          .sidebar.open { 
            display: flex !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            width: 280px !important;
            z-index: 9999 !important;
          }
          .mobile-menu-btn { display: flex !important; }
          .sidebar-close-btn { display: flex !important; }
          .sidebar-overlay { display: none !important; }
          .sidebar-overlay.visible { display: block !important; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9998; }
          .nav-item { padding: 12px 14px !important; min-height: 48px; }
          .main-content { 
            margin-left: 0 !important; 
            padding: 0 12px !important; 
            width: 100% !important;
          }
          .topbar { padding: 0 12px !important; gap: 8px !important; }
          .search-bar { display: none !important; }
        }
        @media (max-width: 480px) {
          .topbar { padding: 0 8px !important; gap: 4px !important; }
          .main-content { padding: 0 8px !important; }
        }
      `}</style>
    </ErrorBoundary>
  )
}
