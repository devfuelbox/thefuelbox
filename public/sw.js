const CACHE_NAME = 'fuelbox-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
];

// Install Event: cache initial shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: handle requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Navigation requests (SPA routes like /menu, /nutrition, etc.)
  // If offline, serve /index.html from cache so the React SPA can boot up and render.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 2. Static assets (JS, CSS, images, fonts, SVG)
  // Use Stale-While-Revalidate: serve cached version instantly for fast loads,
  // then fetch and update the cache in the background.
  const isStaticAsset = 
    url.origin === self.location.origin && 
    (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2|woff|ttf|ico)$/) || url.pathname.includes('/assets/'));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Fallback to standard network fetch for dynamic/API requests
  event.respondWith(fetch(event.request));
});
