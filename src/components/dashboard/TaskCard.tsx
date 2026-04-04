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
    <Link href={href} className="card p-4 flex items-center gap-4 hover:border-navy transition">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusColors[status]}`}>
        <MaterialIcon icon={icon} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-[var(--t1)] truncate">{title}</div>
        <div className="text-xs text-[var(--t3)] truncate">{description}</div>
      </div>
      <MaterialIcon icon="chevron_right" className="text-[var(--t4)]" />
    </Link>
  )
}
