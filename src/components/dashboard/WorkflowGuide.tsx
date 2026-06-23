'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import MaterialIcon from '@/components/MaterialIcon'
import { PLATFORM_SUPPORT_PHONE_DISPLAY, PLATFORM_SUPPORT_WHATSAPP_URL } from '@/lib/support-contact'

type Step = {
  key: string
  label: string
  description: string
  href: string
  icon: string
}

const SUPPORT_PHONE = PLATFORM_SUPPORT_PHONE_DISPLAY
const SUPPORT_WHATSAPP_URL = PLATFORM_SUPPORT_WHATSAPP_URL

const STEPS: Step[] = [
  { key: 'students', label: 'Add Learners', description: 'Start by adding your first student records', href: '/dashboard/students', icon: 'group_add' },
  { key: 'attendance', label: 'Mark Today Attendance', description: 'Record who is present in a few taps', href: '/dashboard/attendance', icon: 'how_to_reg' },
  { key: 'fees', label: 'Record First Payment', description: 'Capture fees paid and see balances clearly', href: '/dashboard/fees', icon: 'payments' },
  { key: 'reports', label: 'Print First Report', description: 'Generate and share a simple progress report', href: '/dashboard/reports', icon: 'assessment' },
]

export function resolveActiveStep(pathname: string | null): number {
  if (!pathname) return 0
  const attendanceRoutes = ['/dashboard/attendance', '/dashboard/period-attendance', '/dashboard/dorm-attendance']
  const feeRoutes = ['/dashboard/fees', '/dashboard/fees/lookup', '/dashboard/payment-plans', '/dashboard/budget', '/dashboard/cashbook']
  const reportingRoutes = ['/dashboard/reports', '/dashboard/report-cards', '/dashboard/grades', '/dashboard/exams', '/dashboard/analytics', '/dashboard/moes-reports', '/dashboard/uneb']

  if (attendanceRoutes.some(route => pathname.startsWith(route))) return 1
  if (feeRoutes.some(route => pathname.startsWith(route))) return 2
  if (reportingRoutes.some(route => pathname.startsWith(route))) return 3
  return 0
}

export default function WorkflowGuide() {
  const pathname = usePathname()
  const { school, isDemo } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const schoolData = (school as any) || null
  const onboardingCompleted = Boolean(
    schoolData?.onboarding_complete ||
    schoolData?.onboarding_completed ||
    Number(schoolData?.student_count || 0) > 0,
  )

  // Hide if dismissed, demo mode, or school is already set up
  if (dismissed || isDemo || onboardingCompleted) return null

  const activeStep = resolveActiveStep(pathname)
  const nextStep = STEPS[Math.min(activeStep + 1, STEPS.length - 1)]

  return (
    <section className="mx-2 sm:mx-4 mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[12px] uppercase tracking-wider font-bold text-[var(--t4)]">First-time setup guide</div>
          <div className="text-[14px] font-semibold text-[var(--t1)]">One step at a time. We&apos;ll guide you through the basics.</div>
          <div className="text-[12px] text-[var(--t3)] mt-1">Step {activeStep + 1} of {STEPS.length}</div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={nextStep.href}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[var(--navy)] text-white text-[12px] font-semibold no-underline whitespace-nowrap"
          >
            <MaterialIcon icon="arrow_forward" style={{ fontSize: 15 }} />
            Do this next: {nextStep.label}
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 text-[var(--t4)] hover:text-[var(--t1)] transition-colors"
            aria-label="Dismiss guide"
          >
            <MaterialIcon icon="close" style={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {STEPS.map((step, index) => {
          const isActive = index === activeStep
          const isComplete = index < activeStep
          return (
            <Link
              key={step.key}
              href={step.href}
              className={`rounded-xl border p-3 no-underline transition-all ${
                isActive
                  ? 'border-[var(--navy)] bg-[var(--navy-soft)]'
                  : isComplete
                    ? 'border-[var(--green)] bg-[var(--green-soft)]'
                    : 'border-[var(--border)] hover:bg-[var(--bg)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--t1)]">
                  <MaterialIcon icon={step.icon} style={{ fontSize: 16 }} />
                  {step.label}
                </div>
                {isComplete && <MaterialIcon icon="check_circle" style={{ fontSize: 16, color: 'var(--green)' }} />}
                {isActive && <span className="text-[10px] font-bold text-[var(--navy)] uppercase">Current</span>}
              </div>
              <div className="text-[11px] text-[var(--t3)] mt-1.5">{step.description}</div>
            </Link>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[var(--t3)]">
        <span className="font-medium">Need help now?</span>
        <a href={`tel:${SUPPORT_PHONE}`} className="text-[var(--primary)] font-semibold hover:underline">
          Call {SUPPORT_PHONE}
        </a>
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--primary)] font-semibold hover:underline"
        >
          WhatsApp support
        </a>
      </div>
    </section>
  )
}
