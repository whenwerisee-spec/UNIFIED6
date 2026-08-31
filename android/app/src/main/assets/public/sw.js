const CACHE_NAME = 'sovereign-live-v4';
const ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          // Graceful asset caching
        }
      }
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy for pages & JS to guarantee live updates
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Never intercept API routes or dynamic state calls
  if (url.pathname.startsWith('/api/')) return;

  // For HTML navigation requests, always fetch from network first so new deploys are instant
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(e.request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // For static assets (icons, manifests), try network first, then cache
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});


