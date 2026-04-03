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
    console.log('[Loader] loading changed to:', loading)
    if (!loading) {
      console.log('[Loader] Not loading, will hide loader in 300ms')
      const timer = setTimeout(() => {
        console.log('[Loader] Hiding loader now')
        setShowLoader(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [loading])

  // Force show content after 8 seconds regardless of loading state
  useEffect(() => {
    const forceTimeout = setTimeout(() => {
      console.log('[Loader] FORCED: Hiding loader after 8 seconds')
      setShowLoader(false)
    }, 8000)
    return () => clearTimeout(forceTimeout)
  }, [])

  console.log('[Loader] Rendering, showLoader:', showLoader, 'loading:', loading)
  
  if (showLoader && loading) {
    console.log('[Loader] Showing loader')
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
