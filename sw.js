const CACHE = 'villa-tropical-v2';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Apenas o app shell (mesmo site). Supabase/Google Maps vão direto à rede.
  if (!url.startsWith(self.location.origin)) return;

  // Network-first: com internet pega sempre a versão mais nova do GitHub Pages
  // e atualiza o cache; sem internet, cai pro que estiver guardado.
  e.respondWith(
    caches.open(CACHE).then(async cache => {
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
});
