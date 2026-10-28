/* Quiz Arena service worker – offline support only; never alters the game. */
const VERSION = 'v1';
const CORE_CACHE = 'quiz-arena-core-' + VERSION;
const RUNTIME_CACHE = 'quiz-arena-runtime-' + VERSION;
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('quiz-arena-') && k !== CORE_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Leave third-party API calls (TTS etc.) completely alone.
  if (url.origin !== location.origin &&
      !/(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) return;

  // Page navigations: cache-first (instant/offline), refresh cache in background.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        const refresh = fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CORE_CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        }).catch(() => null);
        return cached || refresh || caches.match('./');
      })
    );
    return;
  }

  // Everything else (fonts, icons, etc.): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
