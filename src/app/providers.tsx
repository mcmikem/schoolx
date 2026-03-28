'use client'
import { ReactNode, useEffect } from 'react'
import { AuthProvider } from '@/lib/auth-context'
import { AcademicProvider } from '@/lib/academic-context'
import { ThemeProvider } from '@/lib/theme-context'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/Toast'

function ServiceWorkerRegistration({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope)
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
    }
  }, [])
  return <>{children}</>
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ThemeProvider>
          <ServiceWorkerRegistration>
            <AuthProvider>
              <AcademicProvider>{children}</AcademicProvider>
            </AuthProvider>
          </ServiceWorkerRegistration>
        </ThemeProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
