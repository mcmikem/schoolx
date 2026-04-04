import { supabase } from '@/lib/supabase'

export async function logError(error: {
  message: string
  stack?: string
  pageUrl?: string
  severity?: 'info' | 'warning' | 'error' | 'critical'
  schoolId?: string
  userId?: string
  userRole?: string
}) {
  try {
    await supabase.from('error_logs').insert({
      school_id: error.schoolId || null,
      user_id: error.userId || null,
      user_role: error.userRole || null,
      error_message: error.message,
      error_stack: error.stack || null,
      page_url: error.pageUrl || (typeof window !== 'undefined' ? window.location.pathname : null),
      browser_info: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      severity: error.severity || 'error',
    })
  } catch {
    // Silently fail - don't crash the app trying to log an error
  }
}

// Global error handler for uncaught errors
export function setupErrorLogging() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    logError({
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      severity: 'error',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    logError({
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack,
      severity: 'warning',
    })
  })
}
