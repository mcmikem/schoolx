const CACHE_VERSION = 'skoolmate-v8';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const OFFLINE_FALLBACK = '/offline.html';

const PAGES_TO_CACHE = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/manifest.json',
  '/offline.html',
  '/sw.js',
];

const STATIC_ASSETS = [
  '/_next/static/chunks/main-',
  '/_next/static/chunks/webpack-',
  '/_next/static/css/',
];

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.destination === 'document');
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/i)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        // Use individual adds so one failing URL doesn't abort the whole install
        return Promise.allSettled(PAGES_TO_CACHE.map((url) => cache.add(url)));
      }),
      self.skipWaiting(),
    ])
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !name.startsWith(CACHE_VERSION))
            .map((name) => caches.delete(name))
        );
      }),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.hostname === location.hostname && url.pathname.startsWith('/api/')) {
    return;
  }

  if (url.hostname.includes('supabase')) {
    return;
  }

  if (url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) {
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  if (isNavigationRequest(request)) {
    const isDashboardRoute = url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/onboarding');

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          if (isDashboardRoute) {
            const dashboardCached = await caches.match('/');
            if (dashboardCached) return dashboardCached;
          }

          const offlinePage = await caches.match(OFFLINE_FALLBACK);
          if (offlinePage) return offlinePage;

          return new Response(
            '<html><body><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Images - cache first
  if (request.destination === 'image' || /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(IMAGE_CACHE).then((cache) => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // Static assets (JS, CSS, fonts) - network first to avoid stale app versions
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    /\.(js|css|woff2?|ttf|eot)$/i.test(url.pathname)
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Default - network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  try {
    const clients = await self.clients.matchAll();
    const syncClient = clients.find((c) => c.url.includes('dashboard'));

    if (syncClient) {
      syncClient.postMessage({ type: 'SYNC_STARTED' });
    }

    const registration = await self.registration;
    const notification = await registration.showNotification('Syncing data...', {
      body: 'Your offline changes will be synced now.',
      icon: '/SkoolMate logos/SchoolMate icon.svg',
      tag: 'sync-status',
    });

    await self.clients.matchAll().forEach((client) => {
      client.postMessage({ type: 'SYNC_STARTED' });
    });

    if (notification) notification.close();
  } catch (err) {
    console.error('Sync queue error:', err);
  }
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_DATA') {
    const { key, data } = event.data;
    caches.open(PAGE_CACHE).then((cache) => {
      cache.put(key, new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      }));
    });
  }
});

// Push notification support
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/SkoolMate logos/SchoolMate icon.svg',
    badge: '/SkoolMate logos/SchoolMate icon.svg',
    vibrate: [100, 50, 100],
    data: data.url || '/',
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SkoolMate OS', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    clients.openWindow(url)
  );
});
