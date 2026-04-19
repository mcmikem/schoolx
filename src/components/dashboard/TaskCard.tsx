'use client'
import Link from 'next/link'
import MaterialIcon from '@/components/MaterialIcon'

interface TaskCardProps {
  title: string
  description: string
  href: string
  icon: string
  status: 'pending' | 'completed' | 'alert'
}

export function TaskCard({ title, description, href, icon, status }: TaskCardProps) {
  const statusColors = {
    pending: 'bg-navy-soft text-navy',
    completed: 'bg-green-soft text-green',
    alert: 'bg-red-soft text-red'
  }

  return (
    <Link href={href} className="card flex items-center gap-4 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-[1px] hover:border-navy">
      <div className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${statusColors[status]} shadow-sm`}>
        <MaterialIcon icon={icon} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-[var(--t1)] truncate">{title}</div>
        <div className="text-xs text-[var(--t3)] truncate">{description}</div>
      </div>
      <span className="inline-flex items-center rounded-full border border-[#dce4ee] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--t3)]">{status}</span>
    </Link>
  )
}
