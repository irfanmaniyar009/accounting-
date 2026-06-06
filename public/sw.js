const CACHE_NAME = 'accounting-ledger-cache-v1';
const PRE_CACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Perform install steps
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static skeleton assets...');
      return cache.addAll(PRE_CACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Purge obsolete cache stores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Clearing obsolete cached store:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Dynamic intercept fetches (Stale-While-Revalidate with full offline fallback)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Let bypass standard non-GET methods or non-http protocols (like chrome extension requests)
  if (request.method !== 'GET') {
    return;
  }
  
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Bypass dev HMR sockets or local reload systems
  if (url.pathname.includes('/socket.io') || url.pathname.includes('hmr') || url.pathname.includes('websocket')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Trigger background network fetch to keep cache up-to-date (stale-while-revalidate)
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Confirm resource matched perfectly before caching
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.log('[Service Worker] Active connection lost. Running fully offline.', err);
      });

      // Serve immediately from cache if available, otherwise fallback to web fetch promise
      return cachedResponse || fetchPromise;
    })
  );
});
