const CACHE_NAME = 'golds-gym-portal-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Perform asset caching on installation (failsafe approach)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use Map to cache assets individually, ensuring a single failed network fetch 
      // doesn't block the entire service worker from installing
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((asset) => 
          cache.add(asset).catch((err) => 
            console.warn(`Asset failed to cache: ${asset}`, err)
          )
        )
      );
    })
  );
  self.skipWaiting();
});

// Clean up old caches
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

// Network-first falling back to cache fetch strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests to prevent issues with POST/PUT
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If successful, clone and update the cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network request fails, look up the cache
        return caches.match(event.request);
      })
  );
});
