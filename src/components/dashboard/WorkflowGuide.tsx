'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import MaterialIcon from '@/components/MaterialIcon'

type Step = {
  key: string
  label: string
  description: string
  href: string
  icon: string
}

const STEPS: Step[] = [
  { key: 'students', label: 'Enroll Students', description: 'Create/verify student records', href: '/dashboard/students', icon: 'group_add' },
  { key: 'attendance', label: 'Take Attendance', description: 'Mark daily class attendance', href: '/dashboard/attendance', icon: 'how_to_reg' },
  { key: 'fees', label: 'Record Fees', description: 'Capture payments and balances', href: '/dashboard/fees', icon: 'payments' },
  { key: 'reports', label: 'Generate Reports', description: 'Share progress and outcomes', href: '/dashboard/reports', icon: 'assessment' },
]

export function resolveActiveStep(pathname: string | null): number {
  if (!pathname) return 0
  if (pathname.startsWith('/dashboard/attendance')) return 1
  if (pathname.startsWith('/dashboard/fees')) return 2
  if (pathname.startsWith('/dashboard/reports')) return 3
  return 0
}

export default function WorkflowGuide() {
  const pathname = usePathname()
  const activeStep = resolveActiveStep(pathname)
  const nextStep = STEPS[Math.min(activeStep + 1, STEPS.length - 1)]

  return (
    <section className="mx-2 sm:mx-4 mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[12px] uppercase tracking-wider font-bold text-[var(--t4)]">Guided workflow</div>
          <div className="text-[14px] font-semibold text-[var(--t1)]">No dead ends — follow the next best step</div>
        </div>
        <Link
          href={nextStep.href}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[var(--navy)] text-white text-[12px] font-semibold no-underline whitespace-nowrap"
        >
          <MaterialIcon icon="arrow_forward" style={{ fontSize: 15 }} />
          Next: {nextStep.label}
        </Link>
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
    </section>
  )
}
