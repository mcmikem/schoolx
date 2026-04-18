'use client'
import Link from 'next/link'
import MaterialIcon from '@/components/MaterialIcon'

const ACTION_STYLES: Record<string, { solid: string; soft: string }> = {
  navy: { solid: 'var(--navy)', soft: 'var(--navy-soft)' },
  green: { solid: 'var(--green)', soft: 'var(--green-soft)' },
  amber: { solid: 'var(--amber)', soft: 'var(--amber-soft)' },
  purple: { solid: '#7c3aed', soft: '#f3e8ff' },
}

interface Action {
  label: string
  href: string
  icon: string
  color: string
}

export function QuickActions({ actions, title }: { actions: Action[], title: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold text-[var(--t1)]">{title}</h3>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--t4)]">
          Fast actions
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((action, i) => (
          <Link
            key={i}
            href={action.href}
            className="qa-item !items-start !justify-start !p-4 !rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh1)] hover:shadow-[var(--sh2)]"
          >
            <div
              className="qa-icon !mb-0 !mr-3"
              style={{
                background: (ACTION_STYLES[action.color] || ACTION_STYLES.navy).soft,
                color: (ACTION_STYLES[action.color] || ACTION_STYLES.navy).solid,
              }}
            >
              <MaterialIcon icon={action.icon} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[var(--t1)] truncate">{action.label}</div>
              <div className="mt-1 text-[11px] text-[var(--t3)]">
                Open {action.label.toLowerCase()}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
