'use client'
import { useState, useCallback } from 'react'

interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  custom?: (value: any) => boolean | string
  message?: string
}

type ValidationRules<T> = {
  [K in keyof T]?: ValidationRule
}

interface FieldError {
  field: string
  message: string
}

export function useFormValidation<T extends Record<string, any>>(rules: ValidationRules<T>) {
  const [errors, setErrors] = useState<FieldError[]>([])
  const [touched, setTouched] = useState<Set<string>>(new Set())

  const validateField = useCallback((field: keyof T, value: any): string | null => {
    const rule = rules[field]
    if (!rule) return null

    if (rule.required && (value === undefined || value === null || value === '')) {
      return rule.message || `${String(field)} is required`
    }

    if (value === undefined || value === null || value === '') {
      return null // Skip other validations if empty and not required
    }

    if (rule.minLength && String(value).length < rule.minLength) {
      return rule.message || `${String(field)} must be at least ${rule.minLength} characters`
    }

    if (rule.maxLength && String(value).length > rule.maxLength) {
      return rule.message || `${String(field)} must be at most ${rule.maxLength} characters`
    }

    if (rule.min !== undefined && Number(value) < rule.min) {
      return rule.message || `${String(field)} must be at least ${rule.min}`
    }

    if (rule.max !== undefined && Number(value) > rule.max) {
      return rule.message || `${String(field)} must be at most ${rule.max}`
    }

    if (rule.pattern && !rule.pattern.test(String(value))) {
      return rule.message || `${String(field)} is invalid`
    }

    if (rule.custom) {
      const result = rule.custom(value)
      if (typeof result === 'string') return result
      if (!result) return rule.message || `${String(field)} is invalid`
    }

    return null
  }, [rules])

  const validate = useCallback((data: T): boolean => {
    const newErrors: FieldError[] = []

    for (const [field, rule] of Object.entries(rules) as [keyof T, ValidationRule][]) {
      const error = validateField(field, data[field])
      if (error) {
        newErrors.push({ field: String(field), message: error })
      }
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }, [rules, validateField])

  const validateSingle = useCallback((field: keyof T, value: any) => {
    const error = validateField(field, value)
    
    setErrors(prev => {
      const filtered = prev.filter(e => e.field !== String(field))
      if (error) {
        return [...filtered, { field: String(field), message: error }]
      }
      return filtered
    })

    return error
  }, [validateField])

  const markTouched = useCallback((field: string) => {
    setTouched(prev => new Set(prev).add(field))
  }, [])

  const clearErrors = useCallback(() => {
    setErrors([])
    setTouched(new Set())
  }, [])

  const getFieldError = useCallback((field: string): string | undefined => {
    return errors.find(e => e.field === field)?.message
  }, [errors])

  const hasError = useCallback((field: string): boolean => {
    return errors.some(e => e.field === field)
  }, [errors])

  const isTouched = useCallback((field: string): boolean => {
    return touched.has(field)
  }, [touched])

  return {
    errors,
    validate,
    validateSingle,
    markTouched,
    clearErrors,
    getFieldError,
    hasError,
    isTouched,
    isValid: errors.length === 0,
  }
}

// Common validation rules
export const ValidationRules = {
  required: { required: true, message: 'This field is required' },
  phone: { 
    pattern: /^[0-9+]{10,15}$/, 
    message: 'Enter a valid phone number' 
  },
  email: { 
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
    message: 'Enter a valid email address' 
  },
  positiveNumber: { 
    min: 0, 
    custom: (v: any) => !isNaN(v) && v >= 0,
    message: 'Enter a valid positive number' 
  },
  score: { 
    min: 0, 
    max: 100, 
    message: 'Score must be between 0 and 100' 
  },
  studentName: {
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
    message: 'Enter a valid name (letters only)'
  },
}

// Input component with validation
interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  touched?: boolean
  onTouched?: () => void
}

export function ValidatedInput({ 
  label, 
  error, 
  touched, 
  onTouched, 
  onBlur,
  ...props 
}: ValidatedInputProps) {
  const showError = touched && error

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ 
        display: 'block', 
        fontSize: 14, 
        fontWeight: 500, 
        color: showError ? 'var(--red)' : 'var(--t2)', 
        marginBottom: 6 
      }}>
        {label}
        {props.required && <span style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>}
      </label>
      <input
        {...props}
        onBlur={(e) => {
          onTouched?.()
          onBlur?.(e)
        }}
        style={{
          ...props.style,
          width: '100%',
          padding: '10px 12px',
          border: `1px solid ${showError ? 'var(--red)' : 'var(--border)'}`,
          borderRadius: 8,
          fontSize: 14,
          color: 'var(--t1)',
          background: 'var(--surface)',
          outline: 'none',
          transition: 'border-color 0.15s',
          minHeight: 44,
        }}
      />
      {showError && (
        <p style={{ 
          marginTop: 4, 
          fontSize: 12, 
          color: 'var(--red)',
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
          {error}
        </p>
      )}
    </div>
  )
}
