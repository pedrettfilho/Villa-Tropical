const CACHE_NAME = 'villa-tropical-offline-v2';
const TILE_CACHE = 'villa-tropical-tiles-v1';

// App shell (mesmo site) — precisa estar em cache.
const ASSETS = ['./index-offline.html', './manifest-offline.json'];

// Bibliotecas externas (CDNs) — sem elas o app não abre offline a frio.
const LIB_ASSETS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // App shell deve ser cacheado (falha a instalação se não conseguir).
      await cache.addAll(ASSETS);
      // Bibliotecas das CDNs: melhor-esforço (não derruba a instalação se uma CDN
      // estiver fora no momento). Guardadas como respostas opacas (no-cors), o que
      // basta para <script> e <link>.
      await Promise.all(LIB_ASSETS.map(url =>
        cache.add(new Request(url, { mode: 'no-cors' })).catch(() => {})
      ));
    })
  );
});

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Tiles do mapa — cache-first com gravação on-the-fly.
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

  // Bibliotecas das CDNs — cache-first (permite abrir offline a frio).
  if (url.includes('unpkg.com') || url.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const response = await fetch(e.request);
          if (response && (response.ok || response.type === 'opaque')) {
            cache.put(e.request, response.clone());
          }
          return response;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // Mesmo site (app shell) — network-first: com internet pega sempre a versão
  // mais nova do GitHub e atualiza o cache; sem internet, usa a versão guardada.
  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        try {
          const fresh = await fetch(e.request);
          if (fresh && fresh.ok) cache.put(e.request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(e.request);
          return cached || new Response('', { status: 503 });
        }
      })
    );
    return;
  }
});
