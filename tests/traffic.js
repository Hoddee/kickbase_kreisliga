// Traffic: Zählen und Melden (abgefangen), Admin-Karte mit vorgetäuschtem Admin und Beispieldaten
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  // 1) normales Gerät: zählt und meldet beim Verlassen
  let ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-intro-v3', 'kl-tour-book-v2', 'kl-tour-book-v1', 'kl-mvp-news']) localStorage.setItem(k, 'true'); localStorage.setItem('kl-mvp-seen', JSON.stringify('x')); });
  const reports = [];
  await ctx.route(/supabase\.co/, r => { const q = r.request(), u = q.url();
    if (u.includes('rpc/traffic_melden')) { reports.push(JSON.parse(q.postData())); return r.fulfill({ status: 204, body: '' }); }
    if (q.method() !== 'GET') return r.fulfill({ status: 201, body: '[]' }); return r.continue(); });
  let p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('kl-traffic')));
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(800);
  console.log('Gezählt:', st.bytes, 'Bytes | Gerät:', st.id, '| Meldung:', JSON.stringify(reports[0] || null));
  await ctx.close();
  // 2) Admin: Karte mit Beispieldaten
  ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-intro-v3', 'kl-tour-book-v2', 'kl-tour-book-v1', 'kl-mvp-news']) localStorage.setItem(k, 'true'); localStorage.setItem('kl-mvp-seen', JSON.stringify('x'));
    localStorage.setItem('kl-auth-v1', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 36e5, user: { id: 'u1', email: 'admin@test.de' } })); });
  await ctx.route(/supabase\.co/, r => { const q = r.request(), u = q.url();
    if (u.includes('rpc/is_admin')) return r.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    if (u.includes('rpc/traffic_monat')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ tag: '2026-11-01', bytes: 900e6, geraete: 6 }, { tag: '2026-11-02', bytes: 1200e6, geraete: 8 }, { tag: '2026-11-03', bytes: 1700e6, geraete: 9 }]) });
    if (u.includes('spieler_konten') || u.includes('rpc/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (q.method() !== 'GET') return r.fulfill({ status: 201, body: '[]' });
    const h = Object.assign({}, q.headers()); delete h.authorization; return r.continue({ headers: h }); });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('[data-tb="me"]').click()); await p.waitForTimeout(1500);
  console.log('Admin-Karte:', await p.evaluate(() => { const c = document.getElementById('trafficCard'); return c ? c.textContent + ' | Warnung: ' + c.classList.contains('warn') : 'fehlt'; }));
  await p.evaluate(() => document.getElementById('trafficCard').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200); await p.screenshot({ path: 'out/traffic.png' });
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
