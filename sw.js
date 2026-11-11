const CACHE_VERSION = 'pdftools-v2.0.0-beta.11';

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

const CORS_CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js',
    'https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js'
];

const NO_CORS_CDN_ASSETS = [
    'https://cdn.tailwindcss.com/3.4.17'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_VERSION);

        // 1. Precache local app shell bypassing HTTP cache so updates always pull fresh files
        await Promise.all(APP_SHELL.map(async (path) => {
            const req = new Request(path, { cache: 'reload' });
            const res = await fetch(req);
            if (!res.ok) throw new Error(`Failed to cache ${path}: ${res.status}`);
            await cache.put(path, res);
        }));

        // 2. Precache CORS-enabled CDN scripts so SRI verification works offline
        await Promise.all(CORS_CDN_ASSETS.map(async (url) => {
            const req = new Request(url, { mode: 'cors', credentials: 'omit' });
            const res = await fetch(req);
            if (!res.ok) throw new Error(`Failed to cache CORS asset ${url}: ${res.status}`);
            await cache.put(url, res);
        }));

        // 3. Precache opaque CDN scripts that do not send CORS headers (Tailwind Play CDN)
        await Promise.all(NO_CORS_CDN_ASSETS.map(async (url) => {
            const req = new Request(url, { mode: 'no-cors' });
            const res = await fetch(req);
            await cache.put(url, res);
        }));
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // App shell navigation: serve cached index.html immediately (works 100% offline)
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_VERSION);
            const cached = await cache.match('./index.html') || await cache.match('./');
            if (cached) return cached;
            return fetch(request);
        })());
        return;
    }

    // Subresources (scripts, workers, icons, images): Cache-First with network fallback
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(request.url) || await cache.match(request);
        if (cached) return cached;

        try {
            const networkResponse = await fetch(request);
            if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        } catch (err) {
            return Response.error();
        }
    })());
});
