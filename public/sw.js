// PWA: guarda só ficheiros estáticos e fotografias. Nunca guarda a página nem /api,
// para o convidado não ver confirmações, prazos ou presentes desactualizados.
const CACHE = 'convite-v8';
const SHELL = ['/offline/', '/css/convite.css', '/js/convite.js', '/icons/favicon.png', '/fonts/cormorant.woff2', '/fonts/cormorant-italic.woff2', '/fonts/jost.woff2'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  // O painel usa sempre a versão mais recente: uma cópia antiga esconderia secções novas.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || /^\/(js|css)\/(admin|excel)\./.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline/')));
    return;
  }
  if (url.pathname.startsWith('/media/')) {
    // Pedidos parciais de áudio ficam fora da cache: a Cache API não os aceita.
    if (request.headers.has('Range')) return;
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
      return res;
    })));
    return;
  }
  if (/^\/(css|js|fonts|icons)\//.test(url.pathname)) {
    // Mostra a versão guardada e actualiza em segundo plano.
    event.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(request);
      const fresh = fetch(request).then((res) => { if (res.ok) c.put(request, res.clone()); return res; });
      if (hit) { fresh.catch(() => {}); return hit; }
      return fresh;
    }));
  }
});
