'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSyncStatus } from '@/lib/useSyncStatus'
import { canAccess, type UserRole, type RolePermissions } from '@/lib/roles'
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

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/dashboard/students', label: 'Students', icon: 'group' },
  { href: '/dashboard/attendance', label: 'Attendance', icon: 'event_available' },
  { href: '/dashboard/grades', label: 'Grades', icon: 'menu_book' },
  { href: '/dashboard/uneb', label: 'UNEB', icon: 'workspace_ premium' },
  { href: '/dashboard/fees', label: 'Finance', icon: 'payments' },
  { href: '/dashboard/reports', icon: 'analytics' },
  { href: '/dashboard/messages', label: 'Messages', icon: 'mail' },
  { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_today' },
  { href: '/dashboard/staff', label: 'Staff', icon: 'badge' },
  { href: '/dashboard/discipline', label: 'Discipline', icon: 'gavel' },
  { href: '/dashboard/trends', label: 'Trends', icon: 'trending_up' },
  { href: '/dashboard/visitors', label: 'Visitors', icon: 'person_search' },
  { href: '/dashboard/calendar', label: 'Events', icon: 'event' },
  { href: '/dashboard/export', label: 'Export', icon: 'download' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
]

function MaterialIcon({ icon, className, style }: { icon: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-outlined ${className || ''}`} style={style}>
      {icon}
    </span>
  )
}

function SyncStatusIndicator() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useSyncStatus()

  if (isSyncing) {
    return (
      <button onClick={syncNow} className="flex items-center gap-1 text-primary animate-pulse">
        <MaterialIcon icon="sync" className="text-lg" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Syncing</span>
      </button>
    )
  }

  if (!isOnline) {
    return (
      <button onClick={syncNow} className="flex items-center gap-2 text-orange-600" title="Offline">
        <MaterialIcon icon="cloud_off" className="text-lg" />
        {pendingCount > 0 && (
          <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
        )}
      </button>
    )
  }

  if (pendingCount > 0) {
    return (
      <button onClick={syncNow} className="flex items-center gap-2 text-yellow-600" title="Pending changes">
        <MaterialIcon icon="schedule" className="text-lg" />
        <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 text-secondary" title="Synced">
      <MaterialIcon icon="cloud_done" className="text-lg" style={{ fontVariationSettings: 'FILL 1' }} />
      <span className="text-[10px] font-bold uppercase tracking-wider">Synced</span>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, school, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved === 'true') {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    if (!user || !pathname) return

    const routeKey = Object.keys(roleBasedRoutes).find(key => 
      pathname.startsWith(key)
    )

    if (routeKey) {
      const permission = roleBasedRoutes[routeKey]
      if (user.role && !canAccess(user.role as UserRole, permission)) {
        toast.error('Access denied')
        router.push('/dashboard')
      }
    }
  }, [user, pathname, router, toast])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    if (newMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
    router.push('/login')
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-surface dark:bg-slate-950 ${darkMode ? 'dark' : ''}`}>
        {/* Mobile Header */}
        <header className="md:hidden fixed top-0 left-0 right-0 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 z-40">
          <div className="flex items-center justify-between px-4 h-16">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="p-2 -ml-2 text-on-surface hover:bg-surface-container-low rounded-full transition-colors"
            >
              <MaterialIcon icon="menu" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
                <MaterialIcon icon="school" className="text-on-primary-container" style={{ fontVariationSettings: 'FILL 1' }} />
              </div>
              <div>
                <h1 className="font-headline font-extrabold text-primary tracking-tight">SchoolX</h1>
                <p className="text-[10px] font-bold text-on-surface-variant opacity-60">{school?.school_code || ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-on-surface hover:bg-surface-container-low rounded-full transition-colors">
                <MaterialIcon icon="search" />
              </button>
              <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center text-xs font-bold text-primary">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Desktop Sidebar */}
        <aside className={`
          hidden md:flex fixed inset-y-0 left-0 z-[60] flex-col py-4 h-full w-72 
          bg-surface-container-low dark:bg-slate-950 border-r border-outline-variant/15 
          mt-16 rounded-r-xl transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="px-6 mb-8 flex flex-col gap-1">
            <p className="font-headline font-bold text-primary dark:text-blue-400">{school?.name || 'Academic Curator'}</p>
            <p className="font-body text-xs text-on-surface-variant opacity-70">
              {user?.role === 'school_admin' ? 'Administrator' : user?.role || ''}
            </p>
          </div>
          
          <nav className="flex flex-col gap-1 flex-1 px-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 py-3 px-4 mx-2 rounded-lg font-headline font-semibold text-sm transition-colors
                    ${isActive 
                      ? 'bg-primary-container text-on-primary-container dark:bg-blue-900/30 dark:text-blue-200' 
                      : 'text-on-surface-variant dark:text-slate-400 hover:bg-surface-bright'
                    }
                  `}
                >
                  <MaterialIcon icon={item.icon} className="text-lg" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          
          <div className="px-6 py-4 flex items-center gap-2 border-t border-outline-variant/15">
            <div className="h-2 w-2 rounded-full bg-secondary animate-pulse"></div>
            <span className="text-xs font-medium text-on-surface-variant">System Active</span>
            <button 
              onClick={toggleDarkMode}
              className="ml-auto p-1.5 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors"
            >
              <MaterialIcon icon={darkMode ? 'light_mode' : 'dark_mode'} className="text-lg" />
            </button>
          </div>
        </aside>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-16 px-4 pb-safe bg-surface-container-lowest/80 backdrop-blur-lg border-t border-outline-variant/15 shadow-lg">
          <Link href="/dashboard" className={`flex flex-col items-center justify-center p-2 rounded-xl ${pathname === '/dashboard' ? 'text-primary' : 'text-on-surface-variant'}`}>
            <MaterialIcon icon="home" className="text-xl" style={pathname === '/dashboard' ? { fontVariationSettings: 'FILL 1' } : {}} />
            <span className="font-body text-[10px] font-medium tracking-wide">Home</span>
          </Link>
          <Link href="/dashboard/students" className={`flex flex-col items-center justify-center p-2 rounded-xl ${pathname?.startsWith('/dashboard/students') ? 'text-primary' : 'text-on-surface-variant'}`}>
            <MaterialIcon icon="group" className="text-xl" />
            <span className="font-body text-[10px] font-medium tracking-wide">Students</span>
          </Link>
          <Link href="/dashboard/fees" className={`flex flex-col items-center justify-center p-2 rounded-xl ${pathname?.startsWith('/dashboard/fees') ? 'text-primary' : 'text-on-surface-variant'}`}>
            <MaterialIcon icon="payments" className="text-xl" style={pathname?.startsWith('/dashboard/fees') ? { fontVariationSettings: 'FILL 1' } : {}} />
            <span className="font-body text-[10px] font-medium tracking-wide">Finance</span>
          </Link>
          <Link href="/dashboard/messages" className={`flex flex-col items-center justify-center p-2 rounded-xl ${pathname?.startsWith('/dashboard/messages') ? 'text-primary' : 'text-on-surface-variant'}`}>
            <MaterialIcon icon="chat_bubble" className="text-xl" />
            <span className="font-body text-[10px] font-medium tracking-wide">Messages</span>
          </Link>
          <Link href="/dashboard/settings" className={`flex flex-col items-center justify-center p-2 rounded-xl ${pathname?.startsWith('/dashboard/settings') ? 'text-primary' : 'text-on-surface-variant'}`}>
            <MaterialIcon icon="settings" className="text-xl" />
            <span className="font-body text-[10px] font-medium tracking-wide">Settings</span>
          </Link>
        </nav>

        {/* Main Content */}
        <main className="pt-20 pb-24 md:pt-8 md:pb-8 md:pl-80 px-4 md:px-8 max-w-7xl mx-auto min-h-screen">
          {/* Top Bar for Sync Status on Desktop */}
          <div className="hidden md:flex items-center justify-end gap-4 mb-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low rounded-full">
              <SyncStatusIndicator />
            </div>
          </div>
          {children}
        </main>
      </div>
    </ErrorBoundary>
  )
}