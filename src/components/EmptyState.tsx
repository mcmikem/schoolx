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
      className={`flex flex-col items-center justify-center py-10 px-4 text-center ${className}`}
      role="status"
      aria-label={title}
    >
      {icon && (
        <div className="mb-4 p-4 bg-[var(--surface-container)] rounded-2xl">
          <MaterialIcon icon={icon} className="text-3xl text-[var(--t3)]" />
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--t1)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--t3)] max-w-sm mb-6">{description}</p>
      )}
      <div className="flex gap-3">
        {action && (
          <Button variant="primary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="secondary" size="sm" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
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