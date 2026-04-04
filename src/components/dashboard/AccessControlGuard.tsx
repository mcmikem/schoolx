'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { canAccess, type UserRole, type RolePermissions } from '@/lib/roles'
import { useToast } from '@/components/Toast'
import { useStudents, useClasses, useFeePayments, useFeeStructure } from '@/lib/hooks'
import { FEATURE_STAGES, FeatureStage, DEFAULT_FEATURE_STAGE, canUseModule, ModuleKey } from '@/lib/featureStages'

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
  '/dashboard/sync-center': 'settings',
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

export { roleBasedRoutes, MODULE_FOR_ROUTE }

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
  '/dashboard/sync-center': 'Sync Center',
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

export function getPageTitle(pathname: string): string {
  const basePathname = `/${pathname.split('/').slice(0, 3).join('/').replace(/^\//, '')}`
  return PAGE_TITLE_OVERRIDES[basePathname] ??
    pathname
      .replace('/dashboard/', '')
      .replace(/\/[0-9a-f-]{8,}(\/.+)?$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
}

export function useAccessControl() {
  const { user, school } = useAuth()
  const pathname = usePathname()
  const toast = useToast()

  const featureStage = (school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE

  useEffect(() => {
    if (!user || !pathname || pathname === '/dashboard') return

    const routeKey = Object.keys(roleBasedRoutes).find(key => pathname.startsWith(key))
    if (routeKey) {
      const permission = roleBasedRoutes[routeKey]
      if (user.role && !canAccess(user.role as UserRole, permission)) {
        const lastDenied = sessionStorage.getItem('lastDeniedPath')
        if (lastDenied !== pathname) {
          sessionStorage.setItem('lastDeniedPath', pathname)
          toast?.error(`Access denied: ${routeKey.split('/').pop()} requires ${permission} permission`)
        }
        window.history.replaceState(null, '', '/dashboard')
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
          toast?.error('Upgrade your package to access this module')
        }
        window.history.replaceState(null, '', '/dashboard')
        return
      }
    }
    sessionStorage.removeItem('lastDeniedPath')
  }, [user, pathname, toast, featureStage])
}

export function useDashboardNotifications() {
  const { school, isDemo } = useAuth()
  const { currentTerm, academicYear } = useAcademic()
  const { students } = useStudents(isDemo ? undefined : school?.id)
  const { classes } = useClasses(isDemo ? undefined : school?.id)
  const { payments } = useFeePayments(isDemo ? undefined : school?.id)
  const { feeStructure } = useFeeStructure(isDemo ? undefined : school?.id)

  const notifications = useMemo(() => {
    if (isDemo) {
      return [
        {
          id: 'demo-fees',
          title: 'Demo: 30 payments recorded',
          desc: 'UGX 4,175,000 collected across 32 students. Fee collection at ~45%.',
          time: 'Term 1 · 2025',
          icon: 'payments',
          color: 'var(--green)',
          href: '/dashboard/fees',
        },
        {
          id: 'demo-students',
          title: 'Demo: 32 students enrolled',
          desc: 'Across 14 classes from Baby Class to P.7. 29 active, 1 transferred, 1 completed.',
          time: 'Academic Year 2025',
          icon: 'group',
          color: 'var(--navy)',
          href: '/dashboard/students',
        },
        {
          id: 'demo-attendance',
          title: 'Demo: Attendance tracking active',
          desc: '32 attendance records for today. 2 absent, 2 late, 28 present.',
          time: 'Today',
          icon: 'how_to_reg',
          color: 'var(--amber)',
          href: '/dashboard/attendance',
        },
      ]
    }

    const items: Array<{ id: string; title: string; desc: string; time: string; icon: string; color: string; href: string }> = []
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
  }, [isDemo, students.length, classes.length, payments.length, feeStructure.length, currentTerm, academicYear])

  return { notifications }
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
