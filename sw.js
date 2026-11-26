// Underline service worker: app shell cache-first, library data network-first (falls back to cache offline).
const SHELL = 'underline-shell-v1';
const DATA = 'underline-data';
const SHELL_FILES = ['./', './index.html', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

// Precache the library too, so the app works offline right after the first visit.
async function cacheData() {
  const c = await caches.open(DATA);
  const idx = await fetch('./data/index.json', { cache: 'no-cache' });
  const { files = [] } = await idx.clone().json();
  await c.put('./data/index.json', idx);
  await c.addAll(['./data/libraries.json', ...files.map(f => './data/' + f)]);
}

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([caches.open(SHELL).then(c => c.addAll(SHELL_FILES)), cacheData().catch(() => {})]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/data/')) {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(DATA).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  // Stale-while-revalidate: open instantly from cache, pick up new app versions on the next launch.
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
