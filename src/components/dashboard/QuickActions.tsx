'use client'
import Link from 'next/link'
import FeatherIcon from '@/components/FeatherIcon'

interface Action {
  label: string
  href: string
  icon: string
  color: string
}

export function QuickActions({ actions, title }: { actions: Action[], title: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-[var(--t1)] mb-3">{title}</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((action, i) => (
          <Link key={i} href={action.href} className="qa-item !flex-row !justify-start !p-4">
            <div className={`qa-icon !mb-0 !mr-3 bg-${action.color}-soft text-${action.color}`}>
              <FeatherIcon icon={action.icon} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[var(--t1)] truncate">{action.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
