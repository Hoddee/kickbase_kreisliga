/* Service Worker: App läuft auch bei schlechtem Netz am Sportplatz.
   App-Dateien: erst Netz, bei Ausfall aus dem Cache (so kommen Updates sofort an).
   Bilder (Spielerfotos, Wappen): nur einmal laden, danach immer aus dem Cache – kein erneutes Herunterladen.
   Geänderte Fotos bekommen eine neue Adresse (?v=…), alte Einträge werden beim Versionswechsel aufgeräumt.
   Datenbank-Anfragen (REST/Auth) werden nie zwischengespeichert. */
const VERSION = 'kl-v3.6.0';
const APP = 'app-' + VERSION;
const IMG = 'img-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/fonts.css', 'css/tokens.css', 'css/base.css', 'css/live.css', 'css/booking.css', 'css/views.css', 'css/theme.css', 'css/admin.css',
  'js/main.js', 'js/config.js', 'js/router.js',
  'js/data/actions.js', 'js/data/clubs.js', 'js/data/players.js', 'js/data/schedule.js', 'js/core/cutout.js', 'js/ui/start.js', 'js/ui/profile.js', 'js/ui/squad.js', 'js/ui/intro.js', 'js/ui/me.js', 'css/profile.css', 'css/sheet.css', 'js/ui/sheet.js', 'js/ui/match.js',
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
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('app-') && k !== APP) || (k.startsWith('img-') && k !== IMG)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return;

  /* Bilder: Cache zuerst, Netz nur beim allerersten Mal (Supabase-Bucket und assets/img im Repo) */
  const isImg = url.pathname.includes('/storage/v1/object/public/') || (url.origin === self.location.origin && url.pathname.includes('/assets/img/'));
  if (isImg) {
    e.respondWith(caches.open(IMG).then(async cache => {
      const hit = await cache.match(req, { ignoreVary: true });
      /* Teilen-Bild lädt mit CORS: eine „undurchsichtige“ Kopie darf dafür nicht verwendet werden */
      if (hit && !(req.mode === 'cors' && hit.type === 'opaque')) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') cache.put(req, r.clone());
      return r;
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
