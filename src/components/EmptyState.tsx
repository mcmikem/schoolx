'use client'
import MaterialIcon from '@/components/MaterialIcon'
import { Button } from './ui/index'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, secondaryAction, className = '' }: EmptyStateProps) {
  return (
    <div 
      className={`flex flex-col items-center justify-center py-20 px-8 text-center rounded-[var(--r2)] bg-motif-fade border border-dashed border-[var(--border)] transition-all animate-fade-in ${className}`}
      role="status"
      aria-label={title}
    >
      {icon && (
        <div className="relative mb-6">
          <div className="absolute -inset-4 bg-[var(--navy-soft)] rounded-full blur-2xl opacity-50 animate-pulse" />
          <div className="relative w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center border border-[var(--border)] group hover:scale-110 transition-transform">
             <MaterialIcon icon={icon} className="text-4xl text-[var(--navy)] group-hover:rotate-12 transition-transform" />
          </div>
        </div>
      )}
      <h3 className="text-xl font-heading text-[var(--t1)] mb-3 tracking-tight">{title}</h3>
      {description && (
        <p className="text-[13px] text-[var(--t3)] font-medium max-w-sm mb-8 leading-relaxed">{description}</p>
      )}
      <div className="flex gap-4">
        {action && (
          <button
            onClick={action.onClick}
            className="btn btn-primary shadow-lg shadow-navy/20 tap-effect"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="btn btn-ghost hover:bg-[var(--bg)] tap-effect"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}

export function NoStudents({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon="group"
      title="No students enrolled yet"
      description="Start by adding students to your school. You can add them one by one or import from a spreadsheet."
      action={{ label: 'Add Student', onClick: onAdd }}
    />
  )
}

export function NoClasses({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon="school"
      title="No classes created"
      description="Create your first class to start managing attendance, grades, and timetables."
      action={{ label: 'Create Class', onClick: onAdd }}
    />
  )
}

export function NoPayments({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon="payments"
      title="No payments recorded"
      description="Record fee payments to track school finances and generate receipts."
      action={{ label: 'Record Payment', onClick: onAdd }}
    />
  )
}

export function NoData({ title = 'No data available', description }: { title?: string; description?: string }) {
  return (
    <EmptyState
      icon="inbox"
      title={title}
      description={description}
    />
  )
}

export function SearchEmpty({ query }: { query: string }) {
  return (
    <EmptyState
      icon="search"
      title="No results found"
      description={`We couldn't find anything matching "${query}"`}
    />
  )
}

export function ErrorState({ onRetry, message = 'Something went wrong' }: { onRetry?: () => void; message?: string }) {
  return (
    <EmptyState
      icon="error_outline"
      title={message}
      description="Please try again or contact support if the problem persists."
      action={onRetry ? { label: 'Try Again', onClick: onRetry } : undefined}
    />
  )
}