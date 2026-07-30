/*
 * BillDoor Service Worker — PWA Lifecycle & Asset Caching (v4)
 * 
 * Satisfies PWA installability requirements while letting Next.js Turbopack
 * and Supabase handle HTTP caching, SSR navigation, and redirects natively.
 */

const CACHE_NAME = 'billdoor-pwa-v4';

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
  // Standard browser network stack handling — prevents SW response pipeline errors on mobile
  return;
});
