'use client'
import { forwardRef, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'

// Accessible Button with proper ARIA
interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: string
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, disabled, style, ...props }, ref) => {
    const getBackground = () => {
      switch (variant) {
        case 'primary': return 'var(--navy)'
        case 'secondary': return 'var(--bg)'
        case 'danger': return 'var(--red)'
        case 'ghost': return 'transparent'
        default: return 'var(--navy)'
      }
    }

    const getTextColor = () => {
      switch (variant) {
        case 'primary': return 'white'
        case 'danger': return 'white'
        default: return 'var(--t1)'
      }
    }

    const getMinHeight = () => {
      switch (size) {
        case 'sm': return 36
        case 'md': return 44
        case 'lg': return 48
        default: return 44
      }
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-disabled={disabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: size === 'sm' ? '8px 12px' : '12px 16px',
          background: getBackground(),
          color: getTextColor(),
          border: variant === 'secondary' || variant === 'ghost' ? '1px solid var(--border)' : 'none',
          borderRadius: 8,
          fontSize: size === 'sm' ? 13 : 14,
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 0.15s',
          minHeight: getMinHeight(),
          minWidth: 44,
          ...style,
        }}
        {...props}
      >
        {loading && (
          <span style={{ 
            width: 16, 
            height: 16, 
            border: '2px solid currentColor', 
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite' 
          }} />
        )}
        {icon && !loading && (
          <span className="material-symbols-outlined" style={{ fontSize: size === 'sm' ? 16 : 18 }}>{icon}</span>
        )}
        {children}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  ({ label, error, hint, required, icon, id, style, ...props }, ref) => {
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`
    const errorId = `${inputId}-error`
    const hintId = `${inputId}-hint`

    return (
      <div style={{ marginBottom: 16 }}>
        <label 
          htmlFor={inputId}
          style={{ 
            display: 'block', 
            fontSize: 14, 
            fontWeight: 500, 
            color: error ? 'var(--red)' : 'var(--t2)', 
            marginBottom: 6 
          }}
        >
          {label}
          {required && (
            <span aria-hidden="true" style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>
          )}
          {required && <span className="sr-only">(required)</span>}
        </label>
        
        <div style={{ position: 'relative' }}>
          {icon && (
            <span 
              className="material-symbols-outlined" 
              style={{ 
                position: 'absolute', 
                left: 12, 
                top: '50%', 
                transform: 'translateY(-50%)',
                fontSize: 20, 
                color: 'var(--t4)',
                pointerEvents: 'none'
              }}
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
            style={{
              width: '100%',
              padding: icon ? '12px 14px 12px 44px' : '12px 14px',
              border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
              borderRadius: 8,
              fontSize: 16, // Prevents iOS zoom
              color: 'var(--t1)',
              background: 'var(--surface)',
              outline: 'none',
              transition: 'border-color 0.15s',
              minHeight: 44,
              ...style,
            }}
            {...props}
          />
        </div>

        {hint && !error && (
          <p id={hintId} style={{ marginTop: 4, fontSize: 12, color: 'var(--t4)' }}>
            {hint}
          </p>
        )}

        {error && (
          <p 
            id={errorId} 
            role="alert"
            style={{ 
              marginTop: 4, 
              fontSize: 12, 
              color: 'var(--red)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
            {error}
          </p>
        )}
      </div>
    )
  }
)

AccessibleInput.displayName = 'AccessibleInput'

// Accessible Select
interface AccessibleSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const AccessibleSelect = forwardRef<HTMLSelectElement, AccessibleSelectProps>(
  ({ label, error, hint, options, placeholder, required, id, ...props }, ref) => {
    const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`
    const errorId = `${selectId}-error`
    const hintId = `${selectId}-hint`

    return (
      <div style={{ marginBottom: 16 }}>
        <label 
          htmlFor={selectId}
          style={{ 
            display: 'block', 
            fontSize: 14, 
            fontWeight: 500, 
            color: error ? 'var(--red)' : 'var(--t2)', 
            marginBottom: 6 
          }}
        >
          {label}
          {required && <span aria-hidden="true" style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>}
        </label>
        
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          aria-required={required}
          style={{
            width: '100%',
            padding: '12px 14px',
            border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: 8,
            fontSize: 16,
            color: 'var(--t1)',
            background: 'var(--surface)',
            outline: 'none',
            cursor: 'pointer',
            minHeight: 44,
          }}
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
          <p id={hintId} style={{ marginTop: 4, fontSize: 12, color: 'var(--t4)' }}>
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>error</span>
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
      style={{
        position: 'absolute',
        top: -40,
        left: 0,
        background: 'var(--navy)',
        color: 'white',
        padding: '8px 16px',
        zIndex: 1000,
        transition: 'top 0.3s',
      }}
      onFocus={e => { e.currentTarget.style.top = '0' }}
      onBlur={e => { e.currentTarget.style.top = '-40px' }}
    >
      Skip to main content
    </a>
  )
}

// Screen reader only text
export function SrOnly({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      borderWidth: 0,
    }}>
      {children}
    </span>
  )
}
