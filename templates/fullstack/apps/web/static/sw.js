/**
 * Mosaic PWA service worker.
 * - App shell: cache-first (precached on install)
 * - Business APIs and uploads: network only; no private records in shared caches
 * - Navigations: cached shell, /offline.html fallback when offline
 */

const CACHE_PREFIX = '__PROJECT_SLUG__-v';
const VERSION = `${CACHE_PREFIX}2`;
const SHELL = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Private data must not survive logout in an unpartitioned service-worker cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/files/') || req.headers.has('Authorization')) return;

  // Navigations: shell from cache, offline page as last resort
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const shell = await caches.match('/');
          return shell ?? (await caches.match('/offline.html')) ?? Response.error();
        }),
    );
    return;
  }

  // Static assets: cache-first, then network (and update the cache)
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached ?? Response.error());
      return cached ?? network;
    }),
  );
});
