'use client'
import MaterialIcon from '@/components/MaterialIcon'

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
  icon: string
  accentColor: string
  loading?: boolean
}

export default function StatCard({ label, value, subValue, icon, accentColor, loading }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-accent bg-${accentColor}`} />
      <div className="stat-inner">
        <div className="stat-meta">
          <div className="stat-label">{label}</div>
          <div className={`stat-icon-box bg-${accentColor}-soft text-${accentColor}`}>
            <MaterialIcon icon={icon} size={18} />
          </div>
        </div>
        <div className={`stat-val text-${accentColor}`}>{loading ? '...' : value}</div>
        {subValue && <div className="text-[12px] text-[var(--t3)] font-medium mt-1 uppercase tracking-wider">{subValue}</div>}
      </div>
    </div>
  )
}
