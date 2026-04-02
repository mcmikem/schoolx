'use client'
import { forwardRef, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Accessible Button with proper ARIA
interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: string
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, disabled, className, ...props }, ref) => {
    const variants = {
      primary: 'bg-primary text-white border-none hover:bg-primary-600 shadow-sm',
      secondary: 'bg-surface text-onSurface border border-outline hover:bg-surface-bright',
      danger: 'bg-error text-white border-none hover:opacity-90',
      ghost: 'bg-transparent text-onSurface border border-outline hover:bg-surface-container-low',
    }

    const sizes = {
      sm: 'px-3 py-2 text-xs min-h-[36px]',
      md: 'px-4 py-3 text-sm min-h-[44px]',
      lg: 'px-4 py-3 text-sm min-h-[48px]',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 min-w-[44px] rounded-lg',
          variants[variant],
          sizes[size],
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          !disabled && !loading && 'active:scale-[0.98]',
          className
        )}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {icon && !loading && (
          <span className={cn('material-symbols-outlined', size === 'sm' ? 'text-[16px]' : 'text-[18px]')}>
            {icon}
          </span>
        )}
        {children}
        <style>{`
          @keyframes spin { 
            to { transform: rotate(360deg); } 
          }
          .animate-spin { 
            animation: spin 1s linear infinite; 
          }
        `}</style>
      </button>
    )
  }
)

AccessibleButton.displayName = 'AccessibleButton'

// Accessible Input with proper labels
interface AccessibleInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  required?: boolean
  icon?: string
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ label, error, hint, required, icon, id, className, ...props }, ref) => {
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`
    const errorId = `${inputId}-error`
    const hintId = `${inputId}-hint`

    return (
      <div className="mb-4">
        <label 
          htmlFor={inputId}
          className={cn(
            'block text-sm font-medium mb-1.5 transition-colors',
            error ? 'text-error' : 'text-onSurface-variant'
          )}
        >
          {label}
          {required && (
            <span aria-hidden="true" className="text-error ml-1">*</span>
          )}
          {required && <span className="sr-only">(required)</span>}
        </label>
        
        <div className="relative">
          {icon && (
            <span 
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline pointer-events-none"
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            aria-required={required}
            className={cn(
              'w-full px-3.5 py-3 border rounded-lg text-base text-onSurface bg-surface outline-none transition-all min-h-[44px]',
              icon && 'pl-11',
              error ? 'border-error ring-1 ring-error' : 'border-outline hover:border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary',
              className
            )}
            {...props}
          />
        </div>

        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-outline">
            {hint}
          </p>
        )}

        {error && (
          <p 
            id={errorId} 
            role="alert"
            className="mt-1 text-xs text-error flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">error</span>
            {error}
          </p>
        )}
      </div>
    )
  }
)

AccessibleInput.displayName = 'AccessibleInput'

// Accessible Select
interface AccessibleSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const AccessibleSelect = forwardRef<HTMLSelectElement, AccessibleSelectProps>(
  ({ label, error, hint, options, placeholder, required, id, className, ...props }, ref) => {
    const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`
    const errorId = `${selectId}-error`
    const hintId = `${selectId}-hint`

    return (
      <div className="mb-4">
        <label 
          htmlFor={selectId}
          className={cn(
            'block text-sm font-medium mb-1.5',
            error ? 'text-error' : 'text-onSurface-variant'
          )}
        >
          {label}
          {required && <span aria-hidden="true" className="text-error ml-1">*</span>}
        </label>
        
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          aria-required={required}
          className={cn(
            'w-full px-3.5 py-3 border rounded-lg text-base text-onSurface bg-surface outline-none cursor-pointer min-h-[44px] transition-all',
            error ? 'border-error ring-1 ring-error' : 'border-outline hover:border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-outline">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-error flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {error}
          </p>
        )}
      </div>
    )
  }
)

AccessibleSelect.displayName = 'AccessibleSelect'

// Skip to content link (for keyboard users)
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="absolute -top-10 left-0 bg-primary text-white px-4 py-2 z-[1000] focus:top-0 transition-[top] duration-300"
    >
      Skip to main content
    </a>
  )
}

// Screen reader only text
export function SrOnly({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute w-[1px] h-[1px] p-0 -m-[1px] overflow-hidden clip-[rect(0,0,0,0)] whitespace-nowrap border-0">
      {children}
    </span>
  )
}
