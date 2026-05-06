'use client'
import { ReactNode, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { AcademicProvider } from '@/lib/academic-context'
import { ThemeProvider } from '@/lib/theme-context'
import { NotificationsProvider } from '@/lib/notifications'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/Toast'
import AppLoader from '@/components/Loader'
import { logger } from '@/lib/logger'
import { setupErrorLogging } from '@/lib/error-logger'
import BrandProvider from '@/components/BrandProvider'

function ServiceWorkerRegistration({ children }: { children: ReactNode }) {
  useEffect(() => {
    setupErrorLogging()
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const authRoutePattern = /^\/(login|register|forgot-password)(\/|$)/
      const shouldForceAuthRouteUpdate = authRoutePattern.test(window.location.pathname)
      let hasReloadedForUpdate = false

      const reloadForActivatedUpdate = () => {
        if (!shouldForceAuthRouteUpdate || hasReloadedForUpdate) return
        hasReloadedForUpdate = true
        window.location.reload()
      }

      navigator.serviceWorker.addEventListener('controllerchange', reloadForActivatedUpdate)

      navigator.serviceWorker.register('/sw.js')
        .then(async (registration) => {
          logger.log('Service Worker registered:', registration.scope)
          await registration.update().catch(() => {})

          if (registration.waiting && shouldForceAuthRouteUpdate) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }

          // Check for updates and activate immediately
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  if (shouldForceAuthRouteUpdate) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' })
                    return
                  }

                  // Notify the UI that an update is available — let the user
                  // decide when to reload rather than forcing it mid-session,
                  // which can steal Supabase auth Web Locks.
                  window.dispatchEvent(new CustomEvent('sw-update-available', { detail: { registration } }))
                }
              })
            }
          })
        })
        .catch((error) => {
          logger.error('Service Worker registration failed:', error)
        })

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', reloadForActivatedUpdate)
      }
    }
  }, [])
  return <>{children}</>
}

function LoadingChecker({ children }: { children: ReactNode }) {
  const { authInitialized } = useAuth()
  const [showLoader, setShowLoader] = useState(true)

  // Show loader for at most 2 seconds, then render content anyway.
  // This prevents infinite blank screens if auth init hangs (e.g. Supabase down).
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!authInitialized && showLoader) return <AppLoader />
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
                <AcademicProvider>
                  <BrandProvider>
                    <NotificationsProvider>
                      {children}
                    </NotificationsProvider>
                  </BrandProvider>
                </AcademicProvider>
              </LoadingChecker>
            </AuthProvider>
          </ServiceWorkerRegistration>
        </ThemeProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
