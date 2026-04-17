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
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          logger.log('Service Worker registered:', registration.scope)
          // Check for updates and activate immediately
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available - skip waiting and reload
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                  window.location.reload()
                }
              })
            }
          })
        })
        .catch((error) => {
          logger.error('Service Worker registration failed:', error)
        })
    }
  }, [])
  return <>{children}</>
}

function LoadingChecker({ children }: { children: ReactNode }) {
  // Skip loader entirely - show content immediately
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
