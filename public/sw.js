/**
 * Estratégia por tipo de arquivo:
 *  - arquivos com hash no nome (/assets/) nunca mudam de conteúdo, então
 *    vale cache primeiro: abre instantâneo e não depende da rede;
 *  - páginas tentam a rede e caem no cache quando ela falha;
 *  - o que a rede não entregar e não estiver em cache não vira erro de
 *    página em branco: a navegação recebe a casca guardada.
 */
const CACHE = 'sge-casca-v2';

/**
 * Lista dos arquivos deste build, preenchida na publicação. Guardar tudo já
 * na instalação evita a tela sem formatação quando a rede falha no meio do
 * carregamento seguinte.
 */
const ARQUIVOS = '__ARQUIVOS__';
const PRECARGA = Array.isArray(ARQUIVOS) ? ARQUIVOS : [];

self.addEventListener('install', (evento) => {
  self.skipWaiting();
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(PRECARGA.map((url) => cache.add(new Request(url, { cache: 'reload' })))),
    ),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

async function guardar(req, resp) {
  if (resp && resp.ok && resp.type === 'basic') {
    const copia = resp.clone();
    const cache = await caches.open(CACHE);
    await cache.put(req, copia);
  }
  return resp;
}

async function cachePrimeiro(req) {
  const guardado = await caches.match(req);
  if (guardado) return guardado;
  const resp = await fetch(req);
  return guardar(req, resp);
}

async function redePrimeiro(req) {
  try {
    return await guardar(req, await fetch(req));
  } catch (erro) {
    const guardado = await caches.match(req);
    if (guardado) return guardado;
    throw erro;
  }
}

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Arquivos versionados pelo build: o nome muda quando o conteúdo muda.
  if (url.pathname.includes('/assets/')) {
    evento.respondWith(cachePrimeiro(req).catch(() => caches.match(req)));
    return;
  }

  if (req.mode === 'navigate') {
    evento.respondWith(
      redePrimeiro(req).catch(async () => (await caches.match('index.html')) ?? (await caches.match('./')) ?? Response.error()),
    );
    return;
  }

  evento.respondWith(redePrimeiro(req).catch(() => Response.error()));
});
