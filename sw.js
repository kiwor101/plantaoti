// Service worker do Plantão TI (PWA).
// Regras para não quebrar a versão web:
// - Só mexe em GET do próprio site. Supabase, login Microsoft, CDN e fontes passam direto.
// - Sempre tenta a rede primeiro: com internet o usuário vê sempre a versão publicada.
// - O cache serve apenas quando não há conexão.
const CACHE = 'plantao-ti-v1';
const OFFLINE = './offline.html';
const PRECACHE = [OFFLINE, './icons/icon-192.png', './manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('plantao-ti-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Microsoft, CDN: sem interferência

  event.respondWith(
    fetch(req)
      .then(res => {
        // Guarda cópia só de arquivos estáticos (sem ?code= / #token do login).
        if (res.ok && !url.search) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        // Páginas sem rede vão para a tela "Sem conexão": o app depende do Supabase (CDN + API).
        if (req.mode === 'navigate') return caches.match(OFFLINE);
        return (await caches.match(req, { ignoreSearch: true })) || Response.error();
      })
  );
});
