/* Alorica Booking System — offline cache */
const CACHE = 'alorica-v4';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './logo.png',
  './icon-72x72.png',
  './icon-96x96.png',
  './icon-128x128.png',
  './icon-144x144.png',
  './icon-152x152.png',
  './icon-192x192.png',
  './icon-384x384.png',
  './icon-512x512.png',
  './vendor/tailwind.js',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/lucide.js',
  './vendor/xlsx.bundle.js',

  // The application modules. index.html used to carry the whole app as inline
  // Babel-compiled JSX; it is now split into these files, so they have to be
  // precached or the app would not start offline. Babel itself is gone: it is a
  // build-time tool now, not a 2.8 MB download for every visitor.
  './src/main.js',
  './src/App.js',
  './src/lib/config.js',
  './src/lib/roles.js',
  './src/lib/session.js',
  './src/lib/store.js',
  './src/lib/crypto.js',
  './src/lib/preferences.js',
  './src/lib/settings.js',
  './src/lib/vacation.js',
  './src/lib/format.js',
  './src/lib/booking.js',
  './src/lib/report.js',
  './src/components/common.js',
  './src/components/dialogs.js',
  './src/components/auth.js',
  './src/components/booking.js',
  './src/components/vacation.js',
  './src/components/notifications.js',
  './src/components/settings.js',
  './src/components/admin.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts / external CDNs pass through

  // Live data must never be cached, or the app would keep reading a stale revision.
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for the page itself so an update is never served stale.
  const isPage =
    request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/';
  if (isPage) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for icons and CSS (most likely to be used frequently)
  const isIcon = url.pathname.match(/icon-\d+x\d+\.png$/);
  const isCSS = url.pathname.endsWith('.css');

  if (isIcon || isCSS) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for other assets (vendor libraries, etc.)
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
