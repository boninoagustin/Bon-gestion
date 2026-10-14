const CACHE_NAME = 'bon-gestion-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './icon.png'
];

// Install: cache critical assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(STATIC_ASSETS); })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    Promise.all([
      caches.keys().then(function(keys) {
        return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
      }),
      self.clients.claim()
    ])
  );
});

// Fetch: network-first for pages, stale-while-revalidate for assets
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip non-http requests
  if (!request.url.startsWith('http')) return;

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
          return response;
        })
        .catch(function() { return caches.match(request).then(function(r) { return r || caches.match('./'); }); })
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (request.url.match(/\.(js|css|png|svg|jpg|jpeg|webp|woff2?)(\?|$)/)) {
    event.respondWith(
      caches.match(request).then(function(cached) {
        var fetching = fetch(request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
          return response;
        });
        return cached || fetching;
      })
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(request)
      .then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
        }
        return response;
      })
      .catch(function() { return caches.match(request); })
  );
});
