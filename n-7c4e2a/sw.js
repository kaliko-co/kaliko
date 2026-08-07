// Offline cache. Bump CACHE when any file below changes, or an installed copy
// will keep serving the old one.
const CACHE = 'nourish-v1';

const ASSETS = [
  '.',
  'index.html',
  'css/app.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/parse.js',
  'js/nutrition.js',
  'js/suggest.js',
  'js/store.js',
  'js/data/foods.js',
  'js/data/dishes.js',
  'js/data/portions.js',
  'js/data/targets.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    // addAll fails the whole install if any single request fails, which would
    // leave no cache at all — so add them individually and tolerate misses.
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // Cache first: the app must open with no network at all. Nothing here is
  // time-sensitive, and a stale build is better than a blank screen.
  e.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((res) => {
          // Cache same-origin successes plus the web fonts, so an installed copy
          // keeps its typography offline.
          const url = new URL(request.url);
          const cacheable = res.ok && (url.origin === self.location.origin
            || url.hostname.endsWith('gstatic.com')
            || url.hostname.endsWith('googleapis.com'));
          if (cacheable) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => (request.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    }),
  );
});
