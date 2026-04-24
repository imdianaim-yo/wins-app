// sw.js — Service Worker: caches the app shell for offline use.
// This is what makes Wins a PWA — it can load even without internet.

const CACHE = 'wins-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/db.js',
  '/parser.js',
  '/calendar.js',
  '/export.js',
  '/app.js',
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Cache-first for app shell; network-first for API calls
  if (event.request.url.includes('anthropic.com') || event.request.url.includes('unpkg.com')) {
    return; // don't cache external requests
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
