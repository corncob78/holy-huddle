/*  sw.js  –  robust cache-then-network + graceful install  */
const CACHE = 'holy-huddle-v4';

const ASSETS = [
  '/',                     // index.html is served from here
  '/index.html',
  '/create-session.html',
  '/session.html',
  '/styles.css',
  '/manifest.json',
  '/bibles/net.json',      // <-- correct path
  '/js/create-session.js',
  '/js/session.js',
  '/icons/icon-192.png',   // base-64 placeholder (added below)
  '/icons/icon-512.png'    // base-64 placeholder (added below)
];

/* -------------------------------------------------
   INSTALL – add every asset, ignore failures
------------------------------------------------- */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // addAll will reject if *any* request fails → we catch it
      return cache.addAll(ASSETS).catch(err => {
        console.warn('SW: some assets could not be cached on install', err);
        // still continue installing
        return Promise.resolve();
      });
    }).then(() => self.skipWaiting())
  );
});

/* -------------------------------------------------
   FETCH – cache-first, then network (with fallback)
------------------------------------------------- */
self.addEventListener('fetch', e => {
  // ignore non-GET requests (e.g. chrome-extension://)
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // 1. Return cached version if we have it
      if (cached) return cached;

      // 2. Otherwise go to network
      return fetch(e.request).then(networkResponse => {
        // Cache the fresh response for next time
        const clone = networkResponse.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return networkResponse;
      }).catch(() => {
        // 3. Network failed & no cache → show offline fallback
        if (e.request.destination === 'document') {
          return caches.match('/index.html');
        }
        return new Response('Offline – no cached version', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});

/* -------------------------------------------------
   ACTIVATE – clean old caches
------------------------------------------------- */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});