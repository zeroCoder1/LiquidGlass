// Minimal offline-first service worker for the Liquid Glass PWA / TV app shell.
const CACHE = 'liquid-glass-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './src/params.js',
  './src/shaders.js',
  './src/webgl-renderer.js',
  './src/glass-pool.js',
  './src/css-fallback.js',
  './src/liquid-glass.js',
  './src/web-component.js',
  './src/react.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin GET so live code changes always load when
// online; falls back to the cache when offline. Keeps the app installable and
// offline-capable without serving stale JS during development.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
