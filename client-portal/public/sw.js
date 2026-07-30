/*
 * BillDoor Service Worker — PWA Static Asset Caching (v3)
 * 
 * Strategy:
 * - Does NOT intercept navigation requests (HTML pages, SSR, redirects pass natively to browser)
 * - Does NOT intercept API calls, Supabase endpoints, or Server Actions
 * - Caches static assets (images, icons, fonts, CSS/JS bundles) safely
 */

const CACHE_NAME = 'billdoor-static-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 1. Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 2. DO NOT intercept navigation requests (HTML pages, SSR, Next.js redirects)
  if (event.request.mode === 'navigate') {
    return;
  }

  // 3. DO NOT intercept API calls, Supabase endpoints, or Server Actions
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('_next/action')
  ) {
    return;
  }

  // 4. Cache static assets only (images, icons, fonts, CSS/JS bundles)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {});
            });
          }
          return networkResponse;
        }).catch(() => {
          // If network fetch fails, fallback gracefully
        });
      })
    );
  }
});
