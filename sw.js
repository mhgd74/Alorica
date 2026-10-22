/* Alorica Booking System — offline cache */
const CACHE = 'alorica-v1';

const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './logo.png',
    './vendor/tailwind.js',
    './vendor/react.production.min.js',
    './vendor/react-dom.production.min.js',
    './vendor/babel.min.js',
    './vendor/lucide.js',
    './vendor/xlsx.bundle.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // fonts / external CDNs pass through

    // Network-first for the page itself so an update is never served stale.
    const isPage = request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/';
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

    // Cache-first for the local static assets.
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
});
