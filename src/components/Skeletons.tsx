'use client'

// Loading skeleton components

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 bg-[var(--surface-container)] rounded w-48"></div>
        <div className="h-10 bg-[var(--surface-container)] rounded w-32"></div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-[var(--surface-container)] rounded-lg"></div>
              <div className="space-y-2">
                <div className="h-4 bg-[var(--surface-container)] rounded w-24"></div>
                <div className="h-6 bg-[var(--surface-container)] rounded w-16"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Table */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)]">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="h-6 bg-[var(--surface-container)] rounded w-32"></div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b border-[var(--border)] flex items-center gap-4">
            <div className="h-10 w-10 bg-[var(--surface-container)] rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[var(--surface-container)] rounded w-1/3"></div>
              <div className="h-3 bg-[var(--surface-container)] rounded w-1/4"></div>
            </div>
            <div className="h-8 bg-[var(--surface-container)] rounded w-20"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)]">
        {[1, 2, 3, 4, 5].slice(0, rows).map((i) => (
          <div key={i} className="p-4 border-b border-[var(--border)] flex items-center gap-4">
            <div className="h-10 w-10 bg-[var(--surface-container)] rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[var(--surface-container)] rounded w-1/3"></div>
              <div className="h-3 bg-[var(--surface-container)] rounded w-1/4"></div>
            </div>
            <div className="h-8 bg-[var(--surface-container)] rounded w-20"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 bg-[var(--surface-container)] rounded-lg"></div>
        <div className="space-y-2">
          <div className="h-4 bg-[var(--surface-container)] rounded w-24"></div>
          <div className="h-6 bg-[var(--surface-container)] rounded w-16"></div>
        </div>
      </div>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="space-y-2">
        <div className="h-4 bg-[var(--surface-container)] rounded w-24"></div>
        <div className="h-10 bg-[var(--surface-container)] rounded w-full"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-[var(--surface-container)] rounded w-32"></div>
        <div className="h-10 bg-[var(--surface-container)] rounded w-full"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-[var(--surface-container)] rounded w-20"></div>
        <div className="h-10 bg-[var(--surface-container)] rounded w-full"></div>
      </div>
      <div className="h-10 bg-[var(--surface-container)] rounded w-32 mt-4"></div>
    </div>
  )
}

export function StatsGridSkeleton({ cols = 4 }: { cols?: number }) {
  const colClass = cols === 2 ? 'grid-cols-1 md:grid-cols-2' : cols === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  return (
    <div className={`grid ${colClass} gap-4`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-[var(--surface-container)] rounded-lg"></div>
            <div className="space-y-2">
              <div className="h-4 bg-[var(--surface-container)] rounded w-24"></div>
              <div className="h-6 bg-[var(--surface-container)] rounded w-16"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function QuickActionsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] animate-pulse">
          <div className="h-10 w-10 bg-[var(--surface-container)] rounded-full mx-auto mb-2"></div>
          <div className="h-3 bg-[var(--surface-container)] rounded w-16 mx-auto"></div>
        </div>
      ))}
    </div>
  )
}
