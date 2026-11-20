const { chromium, devices } = require('playwright');
const X = '<img src=x onerror="window.__pwned=(window.__pwned||0)+1">';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-tour-book-v1', 'kl-mvp-news']) localStorage.setItem(k, 'true'); localStorage.setItem('kl-mvp-seen', JSON.stringify('x')); });
  const evil = { uid: 'evil1234567890', created_at: new Date().toISOString(), played_at: new Date().toISOString(), season: '2026/2027', player: 'Klenk', opp: 'tsc', home: true, pos: 'MIT" onmouseover="x', us: X, them: 1, minutes: 90, points: X, goals: X, assists: 0, manual: false, team: 'vfrk', player_foto: X, opp_foto: null, erfasst_von: X };
  const evilEv = [{ k: 'goal', l: X, p: X, t: X }, { k: 'sub', o: X, t: 600 }];
  const liveRow = { uid: 'evilive12345', updated_at: new Date().toISOString(), data: { v: 1, gid: X, i: 0, n: 1, p: 'Klenk', nm: X, vn: X, team: 'vfrk', opp: 'tsc', home: true, us: X, them: X, t: X, ended: false, clock: { el: X, run: true, at: Date.now() }, rows: [{ p: X, l: X, r: X, id: 1 }], by: X, byP: X } };
  await ctx.route(/supabase\.co/, async r => {
    const q = r.request(), u = q.url();
    if (q.method() !== 'GET') return r.fulfill({ status: 201, body: '[]' });
    if (u.includes('/live_spiele')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([liveRow]) });
    if (u.includes('select=events')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ uid: 'evil1234567890', events: evilEv }]) });
    if (u.includes('/rest/v1/spiele?select=uid,created_at')) { const res = await r.fetch(); const d = await res.json(); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([evil, ...d]) }); }
    return r.continue();
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
  const c = s => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, s);
  await c('[data-lv]'); await p.waitForTimeout(1000); await p.evaluate(() => history.back()); await p.waitForTimeout(400);
  await p.evaluate(() => import('./js/ui/match.js').then(m => m.openMatch('evil1234567890'))); await p.waitForTimeout(1500); await p.evaluate(() => history.back()); await p.waitForTimeout(400);
  await c('[data-tb="hof"]'); await p.waitForTimeout(800);
  for (const t of ['players', 'records', 'all', 'mvp']) { await c('[data-hof="t:' + t + '"]'); await p.waitForTimeout(300); }
  await p.evaluate(() => import('./js/ui/profile.js').then(m => m.openProfile('Klenk'))); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ pwned: window.__pwned || 0, imgX: document.querySelectorAll('img[src="x"]').length, mouse: document.querySelectorAll('[onmouseover],[onerror]').length }));
  console.log('Ausgeführt:', r.pwned, '| eingeschleuste img:', r.imgX, '| Event-Attribute:', r.mouse, '| JS-Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
