// ZIMRAH 2026 Progressive Web App Service Worker
const CACHE_NAME = 'zimrah-2026-v1';
const STATIC_ASSETS = [
  '/',
  '/static/images/zimrah_logo.png',
  '/static/images/csi_diocese_emblem.png',
  '/static/images/icon-192.png',
  '/static/images/icon-512.png',
  '/static/manifest.json'
];

// Install event: Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network-first for public data, never cache /portal/ or /admin/
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Security: Do NOT cache admin portal or non-GET requests
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/portal/') ||
    url.pathname.startsWith('/admin/')
  ) {
    return;
  }

  // Network-first strategy: always fetch live result data
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Optionally cache static files
        if (
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/static/') || url.pathname === '/')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network fails (offline), fall back to cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fall back to homepage shell if navigating
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
