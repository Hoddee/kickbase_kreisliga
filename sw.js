/* Service Worker: App läuft auch bei schlechtem Netz am Sportplatz.
   App-Dateien: erst Netz, bei Ausfall aus dem Cache (so kommen Updates sofort an).
   Spielerfotos und Wappen: aus dem Cache, im Hintergrund aktualisiert.
   Datenbank-Anfragen (REST/Auth) werden nie zwischengespeichert. */
const VERSION = 'kl-v2.2.0';
const APP = 'app-' + VERSION;
const IMG = 'img-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/fonts.css', 'css/tokens.css', 'css/base.css', 'css/live.css', 'css/booking.css', 'css/views.css', 'css/theme.css', 'css/admin.css',
  'js/main.js', 'js/config.js', 'js/router.js',
  'js/data/actions.js', 'js/data/clubs.js', 'js/data/players.js', 'js/data/schedule.js', 'js/core/cutout.js',
  'js/core/game.js', 'js/core/icons.js', 'js/core/market.js', 'js/core/util.js',
  'js/services/api.js', 'js/services/auth.js',
  'js/ui/admin.js', 'js/ui/booking.js', 'js/ui/components.js', 'js/ui/hof.js', 'js/ui/live.js', 'js/ui/setup.js', 'js/ui/share.js',
  'assets/fonts/oxanium-latin-700-normal.woff2', 'assets/fonts/oxanium-latin-800-normal.woff2',
  'assets/fonts/inter-tight-latin-400-normal.woff2', 'assets/fonts/inter-tight-latin-500-normal.woff2',
  'assets/fonts/inter-tight-latin-600-normal.woff2', 'assets/fonts/inter-tight-latin-700-normal.woff2',
  'assets/icons/icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('app-') && k !== APP).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return;

  /* Nur normale Bild-Anfragen cachen; CORS-Anfragen (Teilen-Bild) gehen direkt ans Netz */
  if (url.pathname.includes('/storage/v1/object/public/') && req.mode === 'no-cors') {
    e.respondWith(caches.open(IMG).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(APP).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  }
});
