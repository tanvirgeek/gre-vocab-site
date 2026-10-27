/* Offline support. Cache name carries a version: bump it when you change any file. */
const VERSION = 'v3';
const CACHE = 'gre-vocab-' + VERSION;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/util.js', 'js/store.js', 'js/data.js', 'js/speech.js', 'js/quiz.js', 'js/app.js', 'js/views1.js', 'js/views2.js', 'js/views3.js', 'js/views4.js',
  'fonts/Lora.woff2', 'fonts/Lora-Italic.woff2', 'fonts/Poppins-Regular.woff2', 'fonts/Poppins-Medium.woff2', 'fonts/Poppins-Bold.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/days.json', 'data/index.json'
];
const VOLS = [1, 2, 3, 4, 5, 6].map(v => `data/vol${v}.json`);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);                       // the app itself: must succeed
    await Promise.all(VOLS.map(u => c.add(u).catch(() => {})));   // word data: best effort, fetched again on demand
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('gre-vocab-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return caches.match('index.html');
      throw err;
    }
  })());
});
