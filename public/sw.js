// Service Worker for OmutoSMS PWA
const CACHE_NAME = 'omuto-sms-v1'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/register',
  '/dashboard',
  '/manifest.json'
]

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseClone = response.clone()
        
        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        
        return response
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((response) => {
          if (response) return response
          
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/')
          }
          
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData())
  }
})

async function syncOfflineData() {
  // This will be called when connection is restored
  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE' })
  })
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'OmutoSMS'
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: data.url || '/'
  }
  
  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data)
  )
})
