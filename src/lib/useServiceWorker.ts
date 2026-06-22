'use client'
import { useEffect } from 'react'
import { logger } from './logger'

export function useServiceWorker() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (process.env.NODE_ENV !== 'production' || isLocalhost) {
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch((err) => logger.debug('SW unregister error:', err))
        return
      }

      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          logger.debug('Service Worker registered:', registration.scope)
        })
        .catch((error) => {
          logger.error('Service Worker registration failed:', error)
        })
    }
  }, [])
}
