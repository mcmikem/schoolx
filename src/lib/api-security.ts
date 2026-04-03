// API Security Middleware - Input sanitization and validation utilities

import { NextRequest } from 'next/server'
import { sanitizeString, sanitizePhone, sanitizeNumber, isValidPhone, isValidEmail } from '@/lib/validation'

export interface SanitizedRequest {
  body: Record<string, unknown>
  errors: string[]
}

export function sanitizeRequestBody(body: Record<string, unknown>, fields: string[]): SanitizedRequest {
  const sanitized: Record<string, unknown> = {}
  const errors: string[] = []

  for (const field of fields) {
    const value = body[field]
    
    if (value === undefined || value === null || value === '') {
      errors.push(`Missing required field: ${field}`)
      continue
    }

    if (typeof value === 'string') {
      if (field.includes('phone')) {
        sanitized[field] = sanitizePhone(value)
        if (!isValidPhone(sanitized[field] as string)) {
          errors.push(`Invalid phone number: ${field}`)
        }
      } else if (field.includes('email')) {
        if (!isValidEmail(value)) {
          errors.push(`Invalid email: ${field}`)
        }
        sanitized[field] = value.toLowerCase().trim()
      } else {
        sanitized[field] = sanitizeString(value)
      }
    } else if (typeof value === 'number') {
      sanitized[field] = sanitizeNumber(value.toString())
    } else {
      sanitized[field] = value
    }
  }

  return { body: sanitized, errors }
}

export function sanitizeQueryParams(request: NextRequest, params: string[]): Record<string, string> {
  const sanitized: Record<string, string> = {}
  
  for (const param of params) {
    const value = request.nextUrl.searchParams.get(param)
    if (value) {
      sanitized[param] = sanitizeString(value)
    }
  }

  return sanitized
}

export function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

export function sanitizeForSQL(input: string): string {
  return input.replace(/['";\\]/g, '')
}
