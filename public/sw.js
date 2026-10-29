// Bumped by hand only as an emergency: prebuild stamps this with the build id
// on every real deploy. Raised here so installs already holding a stale runtime
// chunk purge their caches the moment this worker activates.
const CACHE_VERSION = 'skoolmate-v16';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
// RSC payloads get their own store: a payload and the HTML for the same URL
// must never overwrite each other.
const RSC_CACHE = `${CACHE_VERSION}-rsc`;
const OFFLINE_FALLBACK = '/offline.html';

/**
 * When a page was never downloaded, the nearest saved page is served so the
 * user keeps the app chrome. That substitution must not be silent: inject the
 * requested path into the document so the app can say "this page was not saved
 * offline" and offer the saved pages instead. Without this, a teacher could
 * believe they were looking at the page they tapped.
 */
async function markOfflineFallback(response, requestedPath) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    const html = await response.text();
    const payload = JSON.stringify(requestedPath).replace(/</g, '\\u003c');
    const script = `<script>window.__SKOOLMATE_OFFLINE_FALLBACK__=${payload};</script>`;
    const injected = html.includes('</body>') ? html.replace('</body>', script + '</body>') : html + script;
    const headers = new Headers(response.headers);
    // The body changed, so the original length/encoding no longer describe it.
    headers.delete('content-length');
    headers.delete('content-encoding');
    return new Response(injected, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

async function warmRoute(route) {
  if (typeof route !== 'string' || !route.startsWith('/')) return false;
  try {
    const pageCache = await caches.open(PAGE_CACHE);
    const response = await fetch(route, { credentials: 'same-origin' });
    if (response.ok && !response.redirected) {
      await pageCache.put(route, response);
      return true;
    }
    return false;
  } catch {
    // Offline, a redirect, or a route the current role cannot open. The
    // client will retry on the next online warm-up.
    return false;
  }
}

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
  '/parent-portal/',
  '/student-portal/',
  '/super-admin/',
];

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.destination === 'document');
}

// Client-side App Router navigations fetch an RSC payload. Next adds a fresh
// `_rsc` cache-busting value to every one of those URLs, so keying the cache by
// the full URL meant an offline navigation could never hit the copy saved by
// the previous (online) visit or by <Link> prefetching -- every dashboard page
// appeared to be unusable offline even after it had been opened. Normalise the
// key by dropping `_rsc` and keep prefetch payloads separate: a prefetch can be
// a partial tree, while a real navigation needs the full one.
function rscCacheKey(request) {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  const isRsc = request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
  if (!isRsc) return null;
  url.searchParams.delete('_rsc');
  const prefetch = request.headers.get('Next-Router-Prefetch') === '1' || request.headers.get('next-router-prefetch') === '1';
  return { key: url.toString() + (prefetch ? '#prefetch' : ''), fallbackKey: prefetch ? null : url.toString() + '#prefetch' };
}

// For a detail URL that was never opened (a pupil, an invoice), the nearest
// cached list page is far more useful offline than the marketing site or a
// generic error. Walk up the path until one of the parent pages is cached.
const APP_SECTIONS = ['/dashboard', '/parent-portal', '/student-portal', '/super-admin', '/onboarding'];
async function matchNearestSectionPage(pathname) {
  if (!APP_SECTIONS.some((section) => pathname === section || pathname.startsWith(section + '/'))) return null;
  const pageCache = await caches.open(PAGE_CACHE);
  let candidate = pathname.replace(/\/$/, '');
  while (candidate.length > 0) {
    const cached = await pageCache.match(candidate + '/');
    if (cached) return cached;
    // Never climb out of the app section into a public marketing page.
    if (APP_SECTIONS.includes(candidate)) return null;
    const slash = candidate.lastIndexOf('/');
    if (slash <= 0) break;
    candidate = candidate.slice(0, slash);
  }
  return null;
}

/**
 * Fill the offline app-shell routes.
 *
 * This is not an install-only job any more. Install running while the account
 * was logged out meant every shell fetch hit the login redirect and was
 * skipped -- the guard is there so a logged-out install never caches the
 * redirect AS IF it were the app. The result was a school whose PAGE cache
 * held nothing but the login page: offline, every link fell through to the
 * fallback screen even though she had been using the app all day, because the
 * document for /dashboard/ simply was never stored.
 *
 * So the same warm-up runs again on activate, and on demand from the app
 * (WARM_SHELL) whenever the tab is known to be logged in and online. Idempotent:
 * every attempt is a guarded, non-redirecting GET of the current document.
 */
async function warmAppShell() {
  const pageCache = await caches.open(PAGE_CACHE);
  await Promise.all(
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
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        // Use individual adds so one failing URL doesn't abort the whole install
        return Promise.allSettled(PAGES_TO_CACHE.map((url) => cache.add(url)));
      }),
      warmAppShell(),
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
      warmAppShell(),
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

  const rsc = rscCacheKey(request);
  if (rsc) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const clone = response.clone();
            caches.open(RSC_CACHE).then((cache) => cache.put(rsc.key, clone));
          }
          return response;
        } catch {
          const rscCache = await caches.open(RSC_CACHE);
          const cached = await rscCache.match(rsc.key);
          if (cached) return cached;
          if (rsc.fallbackKey) {
            const prefetched = await rscCache.match(rsc.fallbackKey);
            if (prefetched) return prefetched;
          }
          // A failed RSC fetch makes the App Router fall back to a normal
          // navigation, which the handler below serves from PAGE_CACHE.
          return new Response('', { status: 504, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  if (isNavigationRequest(request)) {
    const isDashboardRoute = url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/onboarding');

    // Navigations stay network-first so a fresh deploy is picked up. A cached
    // navigation is the PREVIOUS deploy's HTML, and its <script> URLs can name
    // chunks the current deploy no longer serves. Serving that copy while the
    // network is still answering is exactly what produced the field report of
    // a landing page blinking for a second and then the error screen: the old
    // HTML booted against the new module graph. So the cache is never raced
    // against a connected network — it is used only when the device is offline
    // or the fetch actually fails/times out.
    //
    // The deadline still exists for the reload after tapping "Update now",
    // which otherwise hangs on a stalled fetch and leaves the banner frozen on
    // "Updating…". It is generous enough that a slow-but-working link still
    // gets the current HTML rather than yesterday's.
    const NAVIGATION_TIMEOUT_MS = 4000;

    event.respondWith(
      (async () => {
        const pageCache = await caches.open(PAGE_CACHE);
        const cachedPage = await pageCache.match(request);

        // Offline: no point waiting for a network that is not there.
        if (self.navigator && self.navigator.onLine === false && cachedPage) return cachedPage;

        let navigationTimer;
        const navigationTimeout = new Promise((_, reject) => {
          navigationTimer = setTimeout(() => reject(new Error('navigation timeout')), NAVIGATION_TIMEOUT_MS);
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
          if (cachedPage) return cachedPage;

          // An uncached dashboard URL falls back to its nearest cached list
          // page (a pupil detail opens the student list), and only then to the
          // dashboard app shell -- never to "/", the public marketing page,
          // which made an offline teacher land on the sales site instead of
          // the app.
          if (isDashboardRoute) {
            const nearest = await matchNearestSectionPage(url.pathname);
            if (nearest) return markOfflineFallback(nearest, url.pathname);
            const dashboardShell = await pageCache.match('/dashboard/');
            if (dashboardShell) return markOfflineFallback(dashboardShell, url.pathname);
          } else {
            const nearest = await matchNearestSectionPage(url.pathname);
            if (nearest) return markOfflineFallback(nearest, url.pathname);
          }

          // Last stop before the fallback screen: ANY cached app-shell
          // document. The exact keys can all be absent (a shell warmed during
          // a logged-out window is the known case), while a page the teacher
          // hard-loaded this week sits in the same store. Landing her there
          // keeps the app alive; the fallback screen is for nothing cached.
          const sectionDocs = await pageCache.keys();
          for (const doc of sectionDocs) {
            if (url.origin !== new URL(doc.url).origin) continue;
            const path = new URL(doc.url).pathname;
            if (APP_SECTIONS.some((section) => path.startsWith(section + '/') || path === section || path === section + '/')) {
              const cachedDoc = await pageCache.match(doc);
              if (cachedDoc) return markOfflineFallback(cachedDoc, url.pathname);
            }
          }

          // The PWA start_url resolves server-side when there is a network;
          // offline, resolve it from the cache instead: the dashboard shell
          // for a signed-in school device, the login doc otherwise.
          if (url.pathname === '/start/' || url.pathname === '/start') {
            const fallbackShell =
              (await pageCache.match('/dashboard/')) || (await pageCache.match('/login/'));
            if (fallbackShell) return markOfflineFallback(fallbackShell, url.pathname);
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

  if (event.data && event.data.type === 'WARM_SHELL') {
    event.waitUntil(warmAppShell());
  }

  if (event.data && event.data.type === 'WARM_ROUTE') {
    const route = event.data.url;
    const responsePort = event.ports && event.ports[0];
    event.waitUntil(
      warmRoute(route).then((cached) => {
        if (responsePort) responsePort.postMessage({ type: 'WARM_ROUTE_RESULT', route, cached });
      })
    );
  }

  // The app's warmer persists a "done" list, but the browser can evict the
  // PAGE cache at any time and a new deploy wipes it on activate. Asking the
  // cache what it actually holds is the only way to know what still needs
  // downloading -- otherwise the app skips every route forever and offline
  // opens fall through to offline.html with only the signed-out pages.
  if (event.data && event.data.type === 'CHECK_ROUTES') {
    const routes = Array.isArray(event.data.routes) ? event.data.routes : [];
    const responsePort = event.ports && event.ports[0];
    event.waitUntil(
      (async () => {
        const pageCache = await caches.open(PAGE_CACHE);
        const cached = [];
        for (const route of routes) {
          if (typeof route !== 'string' || !route.startsWith('/')) continue;
          if (await pageCache.match(route)) cached.push(route);
        }
        if (responsePort) {
          responsePort.postMessage({ type: 'CHECK_ROUTES_RESULT', version: CACHE_VERSION, cached });
        }
      })()
    );
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
