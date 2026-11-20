// Push: Schalter im Konto, Anmelden (Supabase abgefangen), Vereinsnamen im Live-Stand
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  /* Headless-Chromium meldet Benachrichtigungen immer als blockiert – Browser-Schnittstelle durch Attrappe ersetzen */
  await ctx.addInitScript(() => {
    let perm = 'default', sub = null;
    Object.defineProperty(Notification, 'permission', { get: () => perm });
    Notification.requestPermission = async () => (perm = 'granted');
    PushManager.prototype.getSubscription = async () => sub;
    PushManager.prototype.subscribe = async () => (sub = { endpoint: 'https://push.example/abc', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'k', auth: 'a' } }; }, unsubscribe: async () => { sub = null; return true; } });
  });
  await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-tour-book-v1', 'kl-mvp-news']) localStorage.setItem(k, 'true'); localStorage.setItem('kl-mvp-seen', JSON.stringify('x')); localStorage.setItem('kl-recorder', JSON.stringify('Test')); });
  const calls = [], liveBodies = [];
  await ctx.route(/supabase\.co/, r => { const q = r.request(), u = q.url();
    if (u.includes('rpc/push_')) { calls.push(u.split('rpc/')[1] + ' ' + Object.keys(JSON.parse(q.postData())).join(',')); return r.fulfill({ status: 204, body: '' }); }
    if (u.includes('live_spiele') && q.method() === 'POST') { liveBodies.push(JSON.parse(q.postData())); return r.fulfill({ status: 201, body: '' }); }
    if (q.method() !== 'GET') return r.fulfill({ status: 201, body: '[]' }); return r.continue(); });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('[data-tb="me"]').click()); await p.waitForTimeout(1200);
  console.log('Konto-Karte:', await p.evaluate(() => { const c = document.getElementById('pushCard'); return c ? c.textContent : 'fehlt'; }));
  await p.evaluate(() => document.querySelector('[data-adm="push-on"]').click()); await p.waitForTimeout(6000);
  const toast = await p.evaluate(() => (document.getElementById('toast') || {}).textContent);
  console.log('Nach „An“:', await p.evaluate(() => document.getElementById('pushCard').textContent), '| Toast:', toast, '| RPC:', calls.join(' / ') || '–');
  await p.evaluate(() => document.getElementById('pushCard').scrollIntoView({ block: 'center' })); await p.waitForTimeout(400); await p.screenshot({ path: 'out/push.png' });
  await p.evaluate(() => document.querySelector('[data-adm="push-off"]').click()); await p.waitForTimeout(1500);
  console.log('Nach „Aus“:', await p.evaluate(() => document.getElementById('pushCard').textContent), '| RPC:', calls.join(' / '));
  // Live-Stand mit Vereinsnamen
  await p.evaluate(() => document.querySelector('[data-tb="game"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { document.querySelector('[data-pick="multi"]').click(); for (const id of ['Klenk', 'Krauss']) document.querySelector('[data-pick="p:' + id + '"]').click(); });
  if (await p.$eval('#goBtn', e => e.disabled)) await p.evaluate(() => document.querySelector('[data-pick^="o:"]').click());
  await p.evaluate(() => document.getElementById('goBtn').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-nav="edit"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-do="clock"]').click()); await p.waitForTimeout(4500);
  const d = liveBodies.map(x => x.data).filter(Boolean);
  console.log('Live gesendet:', d.map(x => 'i=' + x.i + ' n=' + x.n + ' tn=' + x.tn + ' on=' + x.on).join(' | '));
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
