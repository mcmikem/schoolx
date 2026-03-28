import { NextRequest, NextResponse } from 'next/server'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export function apiSuccess<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  })
}

export function apiError(error: string, status: number = 400): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  )
}

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  // Sanitize error messages to prevent information leakage
  const sanitizedMessage = 'An unexpected error occurred. Please try again later.'
  
  // Log the full error server-side for debugging
  if (error instanceof Error) {
    console.error('[Server Error]', {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })
  }
  
  return apiError(sanitizedMessage, 500)
}

export function validateRequiredFields(
  body: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Missing required field: ${field}`
    }
  }
  return null
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60000 // Cleanup every minute
const MAX_MAP_SIZE = 10000 // Prevent unbounded growth

export function rateLimit(
  request: NextRequest,
  limit: number = 100,
  windowMs: number = 60000
): { success: boolean; remaining: number; resetTime: number } {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  const key = `rate_limit:${ip}`
  const now = Date.now()
  
  // Periodic cleanup of expired entries to prevent memory leak
  if (rateLimitMap.size > MAX_MAP_SIZE || now - lastCleanup > CLEANUP_INTERVAL) {
    Array.from(rateLimitMap.entries()).forEach(([k, v]) => {
      if (now > v.resetTime) rateLimitMap.delete(k)
    })
    lastCleanup = now
  }

  // Don't allow new entries if map is too large
  if (rateLimitMap.size >= MAX_MAP_SIZE) {
    return { success: false, remaining: 0, resetTime: now + windowMs }
  }
  
  const record = rateLimitMap.get(key)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return { success: true, remaining: limit - 1, resetTime: now + windowMs }
  }
  
  if (record.count >= limit) {
    return { success: false, remaining: 0, resetTime: record.resetTime }
  }
  
  record.count++
  return { success: true, remaining: limit - record.count, resetTime: record.resetTime }
}

export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  limit: number = 100,
  windowMs: number = 60000
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { success, remaining, resetTime } = rateLimit(request, limit, windowMs)
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
          }
        }
      )
    }
    
    const response = await handler(request)
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString())
    return response
  }
}

// CSRF Protection
export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token')
  const cookie = request.cookies.get('csrf-token')?.value
  
  if (!token || !cookie) {
    return false
  }
  
  return token === cookie
}

export function withCSRFProtection(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (request.method !== 'GET' && !validateCSRFToken(request)) {
      return NextResponse.json(
        { success: false, error: 'Invalid CSRF token' },
        { status: 403 }
      )
    }
    return handler(request)
  }
}

// Combined middleware
export function withSecurity(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: { rateLimit?: { limit: number; windowMs: number }; csrf?: boolean } = {}
) {
  let securedHandler = handler
  
  if (options.csrf) {
    securedHandler = withCSRFProtection(securedHandler)
  }
  
  if (options.rateLimit) {
    securedHandler = withRateLimit(
      securedHandler,
      options.rateLimit.limit,
      options.rateLimit.windowMs
    )
  }
  
  return securedHandler
}
