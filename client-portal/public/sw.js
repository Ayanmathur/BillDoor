/*
 * BillDoor Service Worker — PWA Caching & iOS Offline Resilience (v2)
 * 
 * Strategy:
 * - Network-First for API routes, Server Actions, Supabase requests & HTML navigation
 * - Cache-First for static assets (CSS, JS, images, fonts)
 * - Safe individual asset precaching to prevent install failures
 */

const CACHE_NAME = 'billdoor-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/favicon.png',
  '/brand-logo.png',
  '/apple-touch-icon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.log('PWA cache add skipped:', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always use Network-Only for non-GET requests (POST Server Actions, API calls)
  if (event.request.method !== 'GET') {
    return;
  }

  // Network-Only for Supabase DB & Auth endpoints, API routes, and Server Actions
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('_next/action')
  ) {
    return;
  }

  // Network-First strategy for HTML navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || fetch(event.request);
          });
        })
    );
    return;
  }

  // Cache-First strategy for static assets (images, fonts, scripts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
