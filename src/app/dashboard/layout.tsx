'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSyncStatus } from '@/lib/useSyncStatus'
import { useTheme } from '@/lib/theme-context'
import { canAccess, type UserRole, type RolePermissions } from '@/lib/roles'
import { useStudents, useClasses, useFeePayments, useFeeStructure } from '@/lib/hooks'
import { useAcademic } from '@/lib/academic-context'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useToast } from '@/components/Toast'
import CollapsibleSidebar from '@/components/CollapsibleSidebar'
import GlobalSearch from '@/components/GlobalSearch'
import FavoritesBar from '@/components/FavoritesBar'
import { getNavigationForRole } from '@/lib/navigation'
import {
  FEATURE_STAGES,
  FeatureStage,
  DEFAULT_FEATURE_STAGE,
  canUseModule,
  ModuleKey,
} from '@/lib/featureStages'

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
  '/dashboard/dorm': 'students',
  '/dashboard/dorm-attendance': 'attendance',
  '/dashboard/dorm-supplies': 'students',
  '/dashboard/health': 'students',
  '/dashboard/behavior': 'discipline',
  '/dashboard/student-transfers': 'students',
  '/dashboard/dropout-tracking': 'students',
  '/dashboard/payroll': 'payroll',
  '/dashboard/staff-reviews': 'performance',
  '/dashboard/exams': 'grades',
  '/dashboard/uneb': 'grades',
  '/dashboard/uneb-registration': 'grades',
  '/dashboard/timetable': 'grades',
  '/dashboard/homework': 'grades',
  '/dashboard/homework-submissions': 'grades',
  '/dashboard/lesson-plans': 'grades',
  '/dashboard/scheme-of-work': 'grades',
  '/dashboard/promotion': 'students',
  '/dashboard/trends': 'reports',
  '/dashboard/notices': 'messages',
  '/dashboard/sms-templates': 'messages',
  '/dashboard/calendar': 'messages',
  '/dashboard/staff-attendance': 'staff',
  '/dashboard/staff-activity': 'staff',
  '/dashboard/leave': 'staff',
  '/dashboard/leave-approvals': 'staff',
  '/dashboard/expense-approvals': 'fees',
  '/dashboard/cashbook': 'fees',
  '/dashboard/budget': 'fees',
  '/dashboard/payment-plans': 'fees',
  '/dashboard/transport': 'students',
  '/dashboard/inventory': 'assets',
  '/dashboard/allocations': 'grades',
  '/dashboard/marks-completion': 'grades',
  '/dashboard/substitutions': 'grades',
  '/dashboard/workload': 'staff',
  '/dashboard/comments': 'discipline',
  '/dashboard/health-log': 'students',
  '/dashboard/library': 'students',
  '/dashboard/moes-reports': 'reports',
  '/dashboard/idcards': 'students',
  '/dashboard/import': 'export',
  '/dashboard/report-cards': 'reports',
  '/dashboard/pricing': 'settings',
  '/dashboard/audit': 'settings',
}

const MODULE_FOR_ROUTE: Record<string, ModuleKey> = {
  '/dashboard': 'dashboard',
  '/dashboard/attendance': 'attendance',
  '/dashboard/students': 'attendance',
  '/dashboard/grades': 'marks',
  '/dashboard/exams': 'exam',
  '/dashboard/uneb': 'exam',
  '/dashboard/uneb-registration': 'exam',
  '/dashboard/marks-completion': 'marks',
  '/dashboard/comments': 'communications',
  '/dashboard/messages': 'communications',
  '/dashboard/notices': 'communications',
  '/dashboard/sms-templates': 'communications',
  '/dashboard/homework': 'marks',
  '/dashboard/homework-submissions': 'marks',
  '/dashboard/lesson-plans': 'marks',
  '/dashboard/scheme-of-work': 'marks',
  '/dashboard/discipline': 'operations',
  '/dashboard/behavior': 'operations',
  '/dashboard/warnings': 'reports',
  '/dashboard/dorm': 'dorm',
  '/dashboard/dorm-attendance': 'dorm',
  '/dashboard/health': 'health',
  '/dashboard/library': 'operations',
  '/dashboard/visitors': 'operations',
  '/dashboard/fees': 'finance',
  '/dashboard/payment-plans': 'finance',
  '/dashboard/invoicing': 'finance',
  '/dashboard/payroll': 'finance',
  '/dashboard/cashbook': 'finance',
  '/dashboard/budget': 'finance',
  '/dashboard/expense-approvals': 'finance',
  '/dashboard/reports': 'reports',
  '/dashboard/moes-reports': 'reports',
  '/dashboard/analytics': 'analytics',
  '/dashboard/trends': 'analytics',
  '/dashboard/export': 'exports',
  '/dashboard/import': 'exports',
  '/dashboard/settings': 'operations',
  '/dashboard/staff': 'staff',
  '/dashboard/staff-attendance': 'staff',
  '/dashboard/staff-reviews': 'staff',
  '/dashboard/staff-activity': 'staff',
  '/dashboard/leave': 'staff',
  '/dashboard/leave-approvals': 'staff',
  '/dashboard/transport': 'operations',
  '/dashboard/dorm-supplies': 'operations',
}

const navItemsByRole: Record<string, { href: string; label: string; icon: string; badge?: string }[]> = {
  headmaster: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/analytics', label: 'Analytics', icon: 'analytics', badge: 'New' },
    { href: '/dashboard/students', label: 'Students', icon: 'group' },
    { href: '/dashboard/attendance', label: 'Attendance', icon: 'how_to_reg' },
    { href: '/dashboard/grades', label: 'Grades', icon: 'menu_book' },
    { href: '/dashboard/exams', label: 'Exams', icon: 'fact_check' },
    { href: '/dashboard/uneb-registration', label: 'UNEB Registration', icon: 'assignment_ind' },
    { href: '/dashboard/promotion', label: 'Promotion', icon: 'trending_up' },
    { href: '/dashboard/student-transfers', label: 'Student Transfers', icon: 'swap_horiz' },
    { href: '/dashboard/dropout-tracking', label: 'Dropout Tracking', icon: 'person_off' },
    { href: '/dashboard/uneb', label: 'UNEB', icon: 'workspace_premium' },
    { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
    { href: '/dashboard/homework', label: 'Homework', icon: 'assignment' },
    { href: '/dashboard/homework-submissions', label: 'Homework Submissions', icon: 'assignment_turned_in' },
    { href: '/dashboard/lesson-plans', label: 'Lesson Plans', icon: 'menu_book' },
    { href: '/dashboard/scheme-of-work', label: 'Scheme of Work', icon: 'list_alt' },
    { href: '/dashboard/discipline', label: 'Discipline', icon: 'warning' },
    { href: '/dashboard/behavior', label: 'Behavior Log', icon: 'psychology' },
    { href: '/dashboard/warnings', label: 'At Risk', icon: 'warning' },
    { href: '/dashboard/comments', label: 'Comments', icon: 'comment' },
    { href: '/dashboard/dorm', label: 'Dormitory', icon: 'bed' },
    { href: '/dashboard/dorm-attendance', label: 'Dorm Attendance', icon: 'nightlight' },
    { href: '/dashboard/health', label: 'Health Records', icon: 'medical_services' },
    { href: '/dashboard/library', label: 'Library', icon: 'local_library' },
    { href: '/dashboard/fees', label: 'Finance', icon: 'payments' },
    { href: '/dashboard/payment-plans', label: 'Payment Plans', icon: 'calendar_month' },
    { href: '/dashboard/invoicing', label: 'Invoicing', icon: 'description' },
    { href: '/dashboard/payroll', label: 'Payroll', icon: 'payments', badge: 'New' },
    { href: '/dashboard/cashbook', label: 'Cashbook', icon: 'book' },
    { href: '/dashboard/budget', label: 'Budget & Expenses', icon: 'account_balance_wallet' },
    { href: '/dashboard/expense-approvals', label: 'Expense Approvals', icon: 'request_quote' },
    { href: '/dashboard/reports', label: 'Reports', icon: 'description' },
    { href: '/dashboard/moes-reports', label: 'MOES Reports', icon: 'assessment' },
    { href: '/dashboard/trends', label: 'Trends', icon: 'trending_up' },
    { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
    { href: '/dashboard/notices', label: 'Notices', icon: 'campaign' },
    { href: '/dashboard/sms-templates', label: 'SMS Templates', icon: 'sms' },
    { href: '/dashboard/calendar', label: 'Calendar', icon: 'event' },
    { href: '/dashboard/visitors', label: 'Visitors', icon: 'badge' },
    { href: '/dashboard/staff', label: 'Staff', icon: 'person' },
    { href: '/dashboard/staff-attendance', label: 'Staff Attendance', icon: 'how_to_reg' },
    { href: '/dashboard/staff-reviews', label: 'Staff Performance', icon: 'monitoring', badge: 'New' },
    { href: '/dashboard/staff-activity', label: 'Staff Activity', icon: 'monitoring' },
    { href: '/dashboard/leave', label: 'Leave Requests', icon: 'event_busy' },
    { href: '/dashboard/leave-approvals', label: 'Leave Approvals', icon: 'approval' },
    { href: '/dashboard/marks-completion', label: 'Marks Completion', icon: 'checklist' },
    { href: '/dashboard/allocations', label: 'Subject Allocations', icon: 'assignment_ind' },
    { href: '/dashboard/inventory', label: 'Inventory', icon: 'inventory_2' },
    { href: '/dashboard/transport', label: 'Transport', icon: 'directions_bus' },
    { href: '/dashboard/import', label: 'Import', icon: 'upload' },
    { href: '/dashboard/export', label: 'Export', icon: 'download' },
    { href: '/dashboard/idcards', label: 'ID Cards', icon: 'badge' },
    { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
    { href: '/dashboard/audit', label: 'Audit Log', icon: 'history' },
  ],
  dean_of_studies: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/students', label: 'Students', icon: 'group' },
    { href: '/dashboard/attendance', label: 'Attendance', icon: 'how_to_reg' },
    { href: '/dashboard/grades', label: 'Grades', icon: 'menu_book' },
    { href: '/dashboard/exams', label: 'Exams', icon: 'fact_check' },
    { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
    { href: '/dashboard/homework', label: 'Homework', icon: 'assignment' },
    { href: '/dashboard/lesson-plans', label: 'Lesson Plans', icon: 'menu_book' },
    { href: '/dashboard/scheme-of-work', label: 'Scheme of Work', icon: 'list_alt' },
    { href: '/dashboard/uneb', label: 'UNEB', icon: 'workspace_premium' },
    { href: '/dashboard/promotion', label: 'Promotion', icon: 'trending_up' },
    { href: '/dashboard/student-transfers', label: 'Student Transfers', icon: 'swap_horiz' },
    { href: '/dashboard/dropout-tracking', label: 'Dropout Tracking', icon: 'person_off' },
    { href: '/dashboard/discipline', label: 'Discipline', icon: 'warning' },
    { href: '/dashboard/reports', label: 'Reports', icon: 'description' },
    { href: '/dashboard/calendar', label: 'Calendar', icon: 'event' },
    { href: '/dashboard/comments', label: 'Comments', icon: 'comment' },
    { href: '/dashboard/marks-completion', label: 'Marks Completion', icon: 'checklist' },
  ],
  bursar: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/students', label: 'Students', icon: 'group' },
    { href: '/dashboard/fees', label: 'Finance', icon: 'payments' },
    { href: '/dashboard/payment-plans', label: 'Payment Plans', icon: 'calendar_month' },
    { href: '/dashboard/invoicing', label: 'Invoicing', icon: 'description' },
    { href: '/dashboard/payroll', label: 'Payroll', icon: 'payments', badge: 'New' },
    { href: '/dashboard/cashbook', label: 'Cashbook', icon: 'book' },
    { href: '/dashboard/budget', label: 'Budget & Expenses', icon: 'account_balance_wallet' },
    { href: '/dashboard/expense-approvals', label: 'Expense Approvals', icon: 'request_quote' },
    { href: '/dashboard/reports', label: 'Reports', icon: 'analytics' },
    { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
    { href: '/dashboard/sms-templates', label: 'SMS Templates', icon: 'sms' },
  ],
  teacher: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/attendance', label: 'Attendance', icon: 'how_to_reg' },
    { href: '/dashboard/grades', label: 'Grades', icon: 'menu_book' },
    { href: '/dashboard/homework', label: 'Homework', icon: 'assignment' },
    { href: '/dashboard/lesson-plans', label: 'Lesson Plans', icon: 'menu_book' },
    { href: '/dashboard/scheme-of-work', label: 'Scheme of Work', icon: 'list_alt' },
    { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
  ],
  secretary: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/visitors', label: 'Visitors', icon: 'badge' },
    { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
    { href: '/dashboard/notices', label: 'Notices', icon: 'campaign' },
    { href: '/dashboard/sms-templates', label: 'SMS Templates', icon: 'sms' },
    { href: '/dashboard/calendar', label: 'Calendar', icon: 'event' },
  ],
  dorm_master: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/dorm', label: 'Dormitory', icon: 'bed' },
    { href: '/dashboard/dorm-attendance', label: 'Dorm Attendance', icon: 'nightlight' },
    { href: '/dashboard/health', label: 'Health Records', icon: 'medical_services' },
    { href: '/dashboard/discipline', label: 'Discipline', icon: 'warning' },
    { href: '/dashboard/students', label: 'Students', icon: 'group' },
  ],
}

function MaterialIcon({ icon, className, style }: { icon: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-outlined ${className || ''}`} style={style}>
      {icon}
    </span>
  )
}

type DashboardSearchResult = {
  id: string
  type: 'student' | 'class' | 'payment' | 'page'
  name: string
  description: string
  link: string
  icon: string
}

type DashboardNotification = {
  id: string
  title: string
  desc: string
  time: string
  icon: string
  color: string
  href: string
}

function formatRelativeTime(date?: string) {
  if (!date) return 'Just now'

  const timestamp = new Date(date).getTime()
  if (Number.isNaN(timestamp)) return 'Recently'

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000))
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
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

function SearchModal({
  open,
  onClose,
  resultsSource,
}: {
  open: boolean
  onClose: () => void
  resultsSource: DashboardSearchResult[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DashboardSearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setResults(resultsSource.slice(0, 6))
      return
    }
    const normalizedQuery = query.toLowerCase()
    const searchResults = resultsSource
      .filter(result =>
        result.name.toLowerCase().includes(normalizedQuery) ||
        result.description.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 8)
    setResults(searchResults)
  }, [query, resultsSource])

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
                <MaterialIcon icon={r.icon} style={{ fontSize: 16, color: 'var(--t3)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.description}</div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.slice(0, 4).map(result => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result.link)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 10px', borderRadius: 8, fontSize: 11, textAlign: 'left', color: 'var(--t2)', cursor: 'pointer' }}
                >
                  {result.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NotificationsPanel({
  open,
  onClose,
  notifications,
  onMarkAllRead,
}: {
  open: boolean
  onClose: () => void
  notifications: DashboardNotification[]
  onMarkAllRead: () => void
}) {
  if (!open) return null

  return (
    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: 'var(--sh3)', minWidth: 280, zIndex: 100, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Notifications</span>
        <button
          onClick={onMarkAllRead}
          style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--navy)', cursor: 'pointer' }}
        >
          Mark all read
        </button>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {notifications.length === 0 && (
          <div style={{ padding: '18px 14px', fontSize: 12, color: 'var(--t3)' }}>
            You are caught up. No urgent items right now.
          </div>
        )}
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
      <Link href={notifications[0]?.href || '/dashboard/notices'} onClick={onClose} style={{ display: 'block', padding: '10px 14px', textAlign: 'center', fontSize: 12, color: 'var(--navy)', borderTop: '1px solid var(--border)', textDecoration: 'none' }}>
        Open priority queue
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
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(new Set())

  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)
  const { currentTerm, academicYear } = useAcademic()

  const featureStage = (school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE
  const shouldShowRoute = (route: string) => {
    const moduleKey = MODULE_FOR_ROUTE[route]
    if (!moduleKey) return true
    return canUseModule(featureStage, moduleKey)
  }

  const searchResults = useMemo<DashboardSearchResult[]>(() => {
    const studentResults = students.slice(0, 8).map(student => ({
      id: `student-${student.id}`,
      type: 'student' as const,
      name: `${student.first_name} ${student.last_name}`,
      description: `${student.student_number || 'No student number'} · ${student.classes?.name || 'Unassigned class'}`,
      link: `/dashboard/students/${student.id}`,
      icon: 'person',
    }))

    const classResults = classes.slice(0, 6).map(cls => ({
      id: `class-${cls.id}`,
      type: 'class' as const,
      name: cls.name,
      description: `${cls.level} class`,
      link: '/dashboard/students',
      icon: 'school',
    }))

    const paymentResults = payments
      .slice()
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .slice(0, 5)
      .map(payment => ({
        id: `payment-${payment.id}`,
        type: 'payment' as const,
        name: `${Number(payment.amount_paid).toLocaleString()} UGX payment`,
        description: `${payment.students?.first_name || 'Student'} ${payment.students?.last_name || ''}`.trim(),
        link: '/dashboard/fees',
        icon: 'payments',
      }))

    const pages: DashboardSearchResult[] = [
      { id: 'page-students', type: 'page', name: 'Student Registry', description: 'Admissions, profiles, and parent contacts', link: '/dashboard/students', icon: 'group' },
      { id: 'page-fees', type: 'page', name: 'Finance', description: 'Balances, receipts, and collection tracking', link: '/dashboard/fees', icon: 'account_balance_wallet' },
      { id: 'page-attendance', type: 'page', name: 'Attendance', description: 'Daily roll call and absentee follow-up', link: '/dashboard/attendance', icon: 'how_to_reg' },
      { id: 'page-reports', type: 'page', name: 'Reports', description: 'Report cards, class summaries, and exports', link: '/dashboard/reports', icon: 'description' },
    ]

    return [...pages, ...studentResults, ...classResults, ...paymentResults]
  }, [students, classes, payments])

  const notifications = useMemo<DashboardNotification[]>(() => {
    const items: DashboardNotification[] = []
    const totalExpectedPerStudent = feeStructure.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const totalExpected = totalExpectedPerStudent * students.length
    const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0)
    const outstanding = Math.max(0, totalExpected - totalCollected)
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0
    const latestPayment = payments
      .slice()
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0]

    if (students.length === 0) {
      items.push({
        id: 'setup-students',
        title: 'Student registry is empty',
        desc: 'Add your first students to activate admissions, fees, and reporting flows.',
        time: 'Action needed',
        icon: 'group',
        color: 'var(--amber)',
        href: '/dashboard/students',
      })
    }

    if (classes.length === 0) {
      items.push({
        id: 'setup-classes',
        title: 'No classes configured yet',
        desc: 'Create classes before tracking attendance, marks, and timetables.',
        time: 'Action needed',
        icon: 'school',
        color: 'var(--red)',
        href: '/dashboard/setup',
      })
    }

    if (totalExpected > 0) {
      items.push({
        id: 'fees-health',
        title: `${collectionRate}% fee collection this term`,
        desc: outstanding > 0 ? `${outstanding.toLocaleString()} UGX still outstanding across active students.` : 'All expected fees are currently covered.',
        time: `Term ${currentTerm || '-'} · ${academicYear || 'Current year'}`,
        icon: outstanding > 0 ? 'warning' : 'check_circle',
        color: outstanding > 0 ? 'var(--amber)' : 'var(--green)',
        href: '/dashboard/fees',
      })
    }

    if (latestPayment) {
      items.push({
        id: 'latest-payment',
        title: 'Latest payment received',
        desc: `${Number(latestPayment.amount_paid).toLocaleString()} UGX via ${latestPayment.payment_method.replace('_', ' ')}.`,
        time: formatRelativeTime(latestPayment.payment_date),
        icon: 'payments',
        color: 'var(--green)',
        href: '/dashboard/fees',
      })
    }

    if (payments.length === 0 && students.length > 0) {
      items.push({
        id: 'no-payments',
        title: 'No fee payments recorded yet',
        desc: 'Start with the bursar workflow so balances and receipts become reliable.',
        time: 'Action needed',
        icon: 'receipt_long',
        color: 'var(--navy)',
        href: '/dashboard/fees',
      })
    }

    return items.slice(0, 5)
  }, [students, classes, payments, feeStructure, currentTerm, academicYear])

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
    if (!user || !pathname || pathname === '/dashboard') return
    
    const routeKey = Object.keys(roleBasedRoutes).find(key => pathname.startsWith(key))
    if (routeKey) {
      const permission = roleBasedRoutes[routeKey]
      if (user.role && !canAccess(user.role as UserRole, permission)) {
        // Prevent duplicate toasts by checking last denied path
        const lastDenied = sessionStorage.getItem('lastDeniedPath')
        if (lastDenied !== pathname) {
          sessionStorage.setItem('lastDeniedPath', pathname)
          console.log('[Access Denied]', user.role, 'trying to access', routeKey, 'requires', permission)
          if (toast) toast.error(`Access denied: ${routeKey.split('/').pop()} requires ${permission} permission`)
        }
        router.replace('/dashboard')
        return
      }
    }
    const stageRoute = Object.keys(MODULE_FOR_ROUTE).find(key => pathname.startsWith(key))
    if (stageRoute) {
      const moduleKey = MODULE_FOR_ROUTE[stageRoute]
      if (moduleKey && !canUseModule(featureStage, moduleKey)) {
        const lastDenied = sessionStorage.getItem('lastDeniedPath')
        if (lastDenied !== pathname) {
          sessionStorage.setItem('lastDeniedPath', pathname)
          if (toast) toast.error('Upgrade your package to access this module')
        }
        router.replace('/dashboard')
        return
      }
    }
    // Clear denied path when accessing an allowed route
    sessionStorage.removeItem('lastDeniedPath')
  }, [user, pathname, router, toast, featureStage])

  const handleSignOut = async () => {
    sessionStorage.removeItem('lastDeniedPath')
    await signOut()
    toast.success('Signed out successfully')
  }

  const currentDate = new Date()

  // Human-readable page title with known acronym corrections
  const PAGE_TITLE_OVERRIDES: Record<string, string> = {
    '/dashboard': 'Dashboard Overview',
    '/dashboard/moes': 'MoES Module',
    '/dashboard/moes-reports': 'MoES Reports',
    '/dashboard/uneb': 'UNEB Analysis',
    '/dashboard/uneb-registration': 'UNEB Registration',
    '/dashboard/idcards': 'ID Cards',
    '/dashboard/auto-sms': 'Auto SMS',
    '/dashboard/bulk-sms': 'Bulk SMS',
    '/dashboard/sms-templates': 'SMS Templates',
    '/dashboard/board-report': 'Board Report',
    '/dashboard/dorm-attendance': 'Dorm Attendance',
    '/dashboard/dorm-supplies': 'Dorm Supplies',
    '/dashboard/staff-reviews': 'Staff Performance',
    '/dashboard/dropout-tracking': 'Dropout Tracking',
    '/dashboard/marks-completion': 'Marks Completion',
    '/dashboard/period-attendance': 'Period Attendance',
    '/dashboard/payment-plans': 'Payment Plans',
    '/dashboard/expense-approvals': 'Expense Approvals',
    '/dashboard/leave-approvals': 'Leave Approvals',
    '/dashboard/lesson-plans': 'Lesson Plans',
    '/dashboard/staff-attendance': 'Staff Attendance',
    '/dashboard/staff-activity': 'Staff Activity',
    '/dashboard/health-log': 'Health Log',
    '/dashboard/fees-lookup': 'Fee Lookup',
    '/dashboard/student-lookup': 'Student Lookup',
    '/dashboard/student-transfers': 'Student Transfers',
    '/dashboard/class-comparison': 'Class Comparison',
    '/dashboard/scheme-of-work': 'Scheme of Work',
    '/dashboard/homework-submissions': 'Homework Submissions',
    '/dashboard/exam-timetable': 'Exam Timetable',
  }
  const basePathname = `/${pathname.split('/').slice(0, 3).join('/').replace(/^\//, '')}`
  const pageTitle = PAGE_TITLE_OVERRIDES[basePathname] ??
    // Strip dynamic segments (UUIDs / numeric IDs) then title-case
    pathname
      .replace('/dashboard/', '')
      .replace(/\/[0-9a-f-]{8,}(\/.+)?$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())

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
                <Image src={school.logo_url} alt={schoolName} width={36} height={36} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />
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

          <CollapsibleSidebar 
            groups={getNavigationForRole(user?.role || 'teacher')}
            onNavigate={() => setSidebarOpen(false)}
          />

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <SyncStatus />
          </div>
        </aside>

        <main className="main-content mobile-container" style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', width: 'calc(100% - 240px)', overflow: 'hidden' }}>
          <header className="topbar" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', height: 60, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 18, position: 'sticky', top: 0, zIndex: 50, boxShadow: 'var(--sh1)', flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mobile-menu-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
              <MaterialIcon icon="menu" style={{ fontSize: 24, color: 'var(--t1)' }} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-.2px' }}>{pageTitle}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{currentDate.toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>

            <div className="search-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: 'var(--t3)', minWidth: 240, cursor: 'text' }}>
              <GlobalSearch />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="notif-panel" style={{ position: 'relative' }}>
                <div onClick={() => setNotifOpen(!notifOpen)} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--sh1)', position: 'relative' }}>
                  <MaterialIcon icon="notifications" style={{ fontSize: 16, color: 'var(--t2)' }} />
                  {notifications.length > 0 && (
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', border: '1.5px solid var(--surface)' }} />
                  )}
                </div>
                <NotificationsPanel
                  open={notifOpen}
                  onClose={() => setNotifOpen(false)}
                  notifications={notifications.filter(n => !dismissedNotifs.has(n.id))}
                  onMarkAllRead={() => {
                    setDismissedNotifs(new Set(notifications.map(n => n.id)))
                    setNotifOpen(false)
                  }}
                />
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

      {/* Mobile Bottom Navigation - shows on all dashboard pages */}
      <div className="mobile-bottom-nav">
        <Link href="/dashboard" className={`mobile-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
          <MaterialIcon icon="dashboard" style={{ fontSize: 20 }} />
          <span>Home</span>
        </Link>
        <Link href="/dashboard/students" className={`mobile-nav-item ${pathname?.startsWith('/dashboard/students') ? 'active' : ''}`}>
          <MaterialIcon icon="group" style={{ fontSize: 20 }} />
          <span>Students</span>
        </Link>
        <Link href="/dashboard/attendance" className={`mobile-nav-item ${pathname?.startsWith('/dashboard/attendance') ? 'active' : ''}`}>
          <MaterialIcon icon="how_to_reg" style={{ fontSize: 20 }} />
          <span>Attendance</span>
        </Link>
        <Link href="/dashboard/fees" className={`mobile-nav-item ${pathname?.startsWith('/dashboard/fees') ? 'active' : ''}`}>
          <MaterialIcon icon="payments" style={{ fontSize: 20 }} />
          <span>Fees</span>
        </Link>
        <Link href="/dashboard/messages" className={`mobile-nav-item ${pathname?.startsWith('/dashboard/messages') ? 'active' : ''}`}>
          <MaterialIcon icon="chat" style={{ fontSize: 20 }} />
          <span>Messages</span>
        </Link>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} resultsSource={searchResults} />
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} className="sidebar-overlay visible" />
      )}
      {/* Layout animations & nav styles are in globals.css */}
    </ErrorBoundary>
  )
}
