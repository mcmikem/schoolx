'use client'

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
}

function MaterialIcon({ icon }: { icon: string }) {
  return <span className="material-symbols-outlined">{icon}</span>
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
      role="status"
      aria-label={title}
    >
      {icon && (
        <div className="mb-4 p-3 bg-gray-100 rounded-full">
          <MaterialIcon icon={icon} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 max-w-md mb-6">{description}</p>
      )}
      <div className="flex gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}

// Pre-built empty states
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
