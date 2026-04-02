'use client'
import { ReactNode, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { AcademicProvider } from '@/lib/academic-context'
import { ThemeProvider } from '@/lib/theme-context'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/Toast'
import AppLoader from '@/components/Loader'

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

function LoadingChecker({ children }: { children: ReactNode }) {
  const { loading } = useAuth()
  const [showLoader, setShowLoader] = useState(true)

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setShowLoader(false), 300)
      return () => clearTimeout(timer)
    }
  }, [loading])

  if (showLoader && loading) {
    return <AppLoader />
  }

  return <>{children}</>
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ThemeProvider>
          <ServiceWorkerRegistration>
            <AuthProvider>
              <LoadingChecker>
                <AcademicProvider>{children}</AcademicProvider>
              </LoadingChecker>
            </AuthProvider>
          </ServiceWorkerRegistration>
        </ThemeProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
