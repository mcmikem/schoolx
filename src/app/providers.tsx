'use client'
import { ReactNode, useEffect } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { AcademicProvider } from '@/lib/academic-context'
import { ThemeProvider } from '@/lib/theme-context'
import { NotificationsProvider } from '@/lib/notifications'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/Toast'
import { StuckLoadingOverlay, TopLoadingBar } from '@/components/ui/Skeleton'
import { logger } from '@/lib/logger'
import { setupErrorLogging } from '@/lib/error-logger'
import BrandProvider from '@/components/BrandProvider'
import { ReactQueryProvider } from './providers/ReactQueryProvider'

function FaviconUpdater() {
  const { school } = useAuth()

  useEffect(() => {
    if (!school?.logo_url) return

    const iconUrl = school.logo_url

    const setOrUpdate = (selector: string, attr: string, value: string) => {
      let el = document.querySelector<HTMLLinkElement | HTMLMetaElement>(selector)
      if (!el) {
        el = document.createElement(attr === "href" ? "link" : "meta")
        if (attr === "href") (el as HTMLLinkElement).rel = selector.includes("apple") ? "apple-touch-icon" : "icon"
        if (attr === "content") (el as HTMLMetaElement).name = selector.match(/name="([^"]+)"/)?.[1] || ""
        document.head.appendChild(el)
      }
      if (attr in el) (el as any)[attr] = value
    }

    setOrUpdate('link[rel="icon"]', "href", iconUrl)
    setOrUpdate('link[rel="apple-touch-icon"]', "href", iconUrl)

    if (school.primary_color) {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      if (meta) meta.content = school.primary_color
    }

    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')
    if (ogImage) ogImage.content = iconUrl
    const twitterImage = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]')
    if (twitterImage) twitterImage.content = iconUrl
  }, [school?.logo_url, school?.primary_color])

  return null
}

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

  // Do not block first paint on auth checks.
  // Render app shell immediately and show only a lightweight top loading hint.
  if (!authInitialized) {
    return (
      <>
        <TopLoadingBar />
        {children}
        <StuckLoadingOverlay delay={8000} />
      </>
    )
  }

  return <>{children}</>
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ReactQueryProvider>
        <ToastProvider>
          <ThemeProvider>
            <ServiceWorkerRegistration>
              <AuthProvider>
                <LoadingChecker>
                  <FaviconUpdater />
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
      </ReactQueryProvider>
    </ErrorBoundary>
  )
}
