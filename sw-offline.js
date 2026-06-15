const CACHE_NAME = 'villa-tropical-offline-v1';
const TILE_CACHE = 'villa-tropical-tiles-v1';
const ASSETS = ['./index-offline.html', './manifest-offline.json'];

self.addEventListener('install', e =>
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  )
);

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    )
  )
);

self.addEventListener('fetch', e => {
  const url = e.request.url;

  if (url.includes('arcgisonline.com') || url.includes('api.maptiler.com')) {
    e.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const response = await fetch(e.request);
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }
});
