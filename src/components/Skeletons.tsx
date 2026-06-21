'use client'

const Pulse = () => (
  <div className="animate-pulse rounded bg-[var(--surface-container)]" />
)

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-[var(--surface-container)]" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-3/4 rounded bg-[var(--surface-container)]" />
                <div className="h-6 w-1/2 rounded bg-[var(--surface-container)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)]">
        <div className="p-4 border-b border-[var(--border)] space-y-2">
          <div className="h-5 w-32 rounded bg-[var(--surface-container)]" />
          <div className="h-3 w-48 rounded bg-[var(--surface-container)]" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b border-[var(--border)] flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-[var(--surface-container)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 max-w-[220px] rounded bg-[var(--surface-container)]" />
              <div className="h-3 w-1/2 max-w-[160px] rounded bg-[var(--surface-container)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return <PageSkeleton />
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 border-b border-[var(--border)] flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-[var(--surface-container)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 max-w-[240px] rounded bg-[var(--surface-container)]" />
            <div className="h-3 w-1/3 max-w-[180px] rounded bg-[var(--surface-container)]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-[var(--surface-container)]" />
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-[var(--surface-container)]" />
          <div className="h-6 w-16 rounded bg-[var(--surface-container)]" />
        </div>
      </div>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 rounded bg-[var(--surface-container)]" />
          <div className="h-10 rounded bg-[var(--surface-container)]" />
        </div>
      ))}
      <div className="h-10 w-32 rounded bg-[var(--surface-container)]" />
    </div>
  )
}

export function StatsGridSkeleton({ cols = 4 }: { cols?: number }) {
  const colClass = cols === 2 ? 'grid-cols-1 md:grid-cols-2' : cols === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  return (
    <div className={`grid ${colClass} gap-4`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-[var(--surface-container)]" />
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-[var(--surface-container)]" />
              <div className="h-6 w-16 rounded bg-[var(--surface-container)]" />
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
        <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] space-y-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--surface-container)]" />
          <div className="h-3 w-16 rounded bg-[var(--surface-container)]" />
          <div className="h-2 w-20 rounded bg-[var(--surface-container)]" />
        </div>
      ))}
    </div>
  )
}
