// Underline service worker.
// App code and library data: network-first (always the newest version when online), cached copy when offline.
// Icons: cache-first. Bump VERSION on every app release.
const VERSION = 'v5';
const SHELL = 'underline-shell-' + VERSION;
const DATA = 'underline-data';
const SHELL_FILES = ['./', './index.html', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const fresh = u => new Request(u, { cache: 'reload' }); // bypass the browser's HTTP cache

async function cacheData() {
  const c = await caches.open(DATA);
  const idx = await fetch(fresh('./data/index.json'));
  const { files = [] } = await idx.clone().json();
  await c.put('./data/index.json', idx);
  await c.addAll(['./data/libraries.json', './data/texts/index.json', ...files.map(f => './data/' + f)].map(fresh));
}

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([caches.open(SHELL).then(c => c.addAll(SHELL_FILES.map(fresh))), cacheData().catch(() => {})]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req, cacheName) {
  try {
    const r = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }); // plain URL: navigation requests can't be re-sent with options
    if (r.ok) { const copy = r.clone(); caches.open(cacheName).then(c => c.put(req, copy)); }
    return r;
  } catch {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const shell = await caches.match('./index.html'); if (shell) return shell; }
    throw new Error('offline');
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\.m4a$/.test(url.pathname)) return; // narration: let the browser stream it (Safari needs Range requests)
  if (url.pathname.includes('/icons/')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
    return;
  }
  e.respondWith(networkFirst(e.request, url.pathname.includes('/data/') ? DATA : SHELL));
});
