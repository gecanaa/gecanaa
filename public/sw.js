/**
 * Cache só da casca do app: o que vem da planilha é sempre buscado na rede,
 * para ninguém fazer chamada sobre dados velhos.
 */
const CACHE = 'sge-casca-v1';

self.addEventListener('install', (evento) => {
  self.skipWaiting();
  evento.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  evento.respondWith(
    fetch(req)
      .then((resp) => {
        const copia = resp.clone();
        void caches.open(CACHE).then((c) => c.put(req, copia));
        return resp;
      })
      .catch(() => caches.match(req).then((achado) => achado ?? Response.error())),
  );
});
