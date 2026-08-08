// Offline cache. CACHE only needs bumping if a file is added to or removed
// from ASSETS — everyday edits self-heal, see the fetch handler below.
const CACHE = 'nourish-v2';

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

  const url = new URL(request.url);
  const cacheable = url.origin === self.location.origin
    || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com');

  // Stale-while-revalidate: answer instantly from cache so the app opens with
  // no network at all, but refetch in the background and update the cache
  // every time — otherwise a code change never reaches an installed copy
  // until CACHE is bumped by hand, which is exactly the bug this replaced.
  const network = fetch(request).then((res) => {
    if (res.ok && cacheable) caches.open(CACHE).then((c) => c.put(request, res.clone()));
    return res;
  }).catch(() => null);

  // Keep the background refetch alive even after respondWith answers — the
  // browser is free to kill the worker the moment the response is sent otherwise.
  e.waitUntil(network);

  e.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => hit
      || network.then((res) => res || (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
