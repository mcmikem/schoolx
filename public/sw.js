// Bumped by hand only as an emergency: prebuild stamps this with the build id
// on every real deploy. Raised here so installs already holding a stale runtime
// chunk purge their caches the moment this worker activates.
const CACHE_VERSION = 'skoolmate-v14';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const OFFLINE_FALLBACK = '/offline.html';

const PAGES_TO_CACHE = [
  '/login/',
  '/register/',
  '/forgot-password/',
  '/manifest.json',
  '/offline.html',
  '/fonts/material-symbols-outlined.woff2',
];

// App-shell routes worth having available offline. Cached at install with a
// guarded fetch that skips redirects, so a logged-out install never stores the
// /login redirect in place of a dashboard. Logged-in installs get these cached.
const APP_SHELL_ROUTES = [
  '/',
  '/dashboard/',
  '/dashboard/attendance/',
  '/dashboard/grades/',
  '/dashboard/fees/',
  '/dashboard/students/',
  '/dashboard/store/pos/',
  '/dashboard/sync-center/',
  '/onboarding/',
];

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.destination === 'document');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        // Use individual adds so one failing URL doesn't abort the whole install
        return Promise.allSettled(PAGES_TO_CACHE.map((url) => cache.add(url)));
      }),
      caches.open(PAGE_CACHE).then((cache) =>
        Promise.all(
          APP_SHELL_ROUTES.map((url) =>
            fetch(url, { credentials: 'same-origin' })
              .then((res) => {
                if (res.ok && !res.redirected) {
                  return cache.put(url, res);
                }
                return undefined;
              })
              .catch(() => undefined)
          )
        )
      ),
      // Deliberately no skipWaiting() here. A new worker waits so the app can
      // detect it and offer "Update now". Skipping would activate it silently,
      // leaving the page on the previous build with no way to prompt.
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

  // Next.js/Turbopack runtime chunks are NOT all content-hashed: an entry point
  // can keep its path across deploys while its bytes change. Serving /_next/
  // cache-first therefore handed back the previous deploy's runtime under a path
  // the new HTML also references, the module graph stopped lining up, and the
  // app threw during boot — an error screen on load with no working recovery
  // button. It only reached installs that had been opened across a deploy, which
  // is why it showed up on one teacher's phone and not another's.
  //
  // Network-first keeps a fresh deploy authoritative and still serves offline
  // from the cache, which the version purge on activate keeps current.
  if (url.hostname === location.hostname && url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // An empty body would be a script syntax error, turning a plain
          // network failure into a confusing parse crash.
          return new Response('/* offline: asset unavailable */', {
            status: 504,
            headers: { 'Content-Type': 'application/javascript' },
          });
        })
    );
    return;
  }

  if (isNavigationRequest(request)) {
    const isDashboardRoute = url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/onboarding');

    // Navigations stay network-first so a fresh deploy is picked up, but on a
    // slow link the fetch can hang long past any server timeout — including the
    // reload after tapping "Update now", which left the banner frozen on
    // "Updating…". Race the network against a deadline and fall through to the
    // same cache fallbacks below. The update flow precaches the app shell at
    // install, so the fallback usually serves the NEW build, not the old one.
    //
    // When we already hold a copy of this page the deadline is much shorter:
    // on a weak 2G/3G link a teacher would otherwise stare at a blank screen
    // for 8s before the page they opened yesterday appears. The network fetch
    // keeps running after the deadline and refreshes the cache for next time.
    // Held deliberately tight. These deadlines are pure waiting: the cached copy
    // is already in hand and the network fetch keeps running afterwards to
    // refresh the cache, so every millisecond spent here is a millisecond of
    // blank screen before content the user has seen before. An uncached route
    // still gets longer, because that copy is all the user will ever get.
    const NAVIGATION_TIMEOUT_MS = 3000;
    const NAVIGATION_TIMEOUT_CACHED_MS = 1200;

    event.respondWith(
      (async () => {
        const hasCachedCopy = Boolean(await caches.match(request));
        const timeoutMs = hasCachedCopy ? NAVIGATION_TIMEOUT_CACHED_MS : NAVIGATION_TIMEOUT_MS;
        let navigationTimer;
        const navigationTimeout = new Promise((_, reject) => {
          navigationTimer = setTimeout(() => reject(new Error('navigation timeout')), timeoutMs);
        });

        try {
          return await Promise.race([
            fetch(request).then((response) => {
              if (response.ok) {
                const clone = response.clone();
                caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
              }
              return response;
            }),
            navigationTimeout,
          ]);
        } catch (err) {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          // An uncached dashboard URL falls back to the dashboard app shell, never
          // to "/" — that is the public marketing page, which made an offline
          // teacher land on the sales site instead of the app.
          if (isDashboardRoute) {
            const dashboardShell = await caches.match('/dashboard/');
            if (dashboardShell) return dashboardShell;
          }

          const offlinePage = await caches.match(OFFLINE_FALLBACK);
          if (offlinePage) return offlinePage;

          return new Response(
            '<html><body><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        } finally {
          clearTimeout(navigationTimer);
        }
      })()
    );
    return;
  }

  // Self-hosted fonts (the 112 KB icon font especially) are cache-first. The
  // static cache is versioned per deploy and purged on activate, so a changed
  // font is still picked up, while repeat visits stop spending data and a
  // round trip on the same file over a slow link.
  if (url.hostname === location.hostname && url.pathname.startsWith('/fonts/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // Images - cache first
  if (request.destination === 'image' || /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Revalidate in the background, except when the user turned on Save-Data.
          const saveData = Boolean(self.navigator && self.navigator.connection && self.navigator.connection.saveData);
          if (!saveData) {
            fetch(request).then((response) => {
              if (response.ok) {
                caches.open(IMAGE_CACHE).then((cache) => cache.put(request, response));
              }
            }).catch(() => {});
          }
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

  // Other static assets (non-_next/ JS, CSS, fonts) - network first
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

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: 'SYNC_REQUESTED' });
    });

    const registration = await self.registration;
    const notification = await registration.showNotification('Syncing data...', {
      body: 'Your offline changes will be synced now.',
      icon: '/icons/icon-512x512.png',
      tag: 'sync-status',
    });

    if (notification) setTimeout(() => notification.close(), 3000);
  } catch (err) {
    console.error('Sync queue error:', err);
  }
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  // Sent by the "Update now" control to activate the waiting worker.
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data.type === 'APPLY_UPDATE')) {
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
    icon: '/icons/icon-512x512.png',
    badge: '/icons/icon-512x512.png',
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
