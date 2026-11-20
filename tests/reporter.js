const { chromium, devices } = require('playwright');
const mk = (uid, i, p, nm, t, by, byP) => ({ uid, updated_at: new Date().toISOString(), data: { v: 1, gid: 'g' + i + 'xxxxxx', i: 0, n: 1, p, nm, vn: '', team: 'vfrk', opp: 'tsc', home: true, us: 1, them: 0, t, ended: false, h2: true, ht: false, clock: { el: 3100, run: true, at: Date.now() }, rows: [{ p: 12, l: 'Torschuss (aufs Tor)', r: '52’', id: 1 }], by, byP } });
const rows = [mk('abcdef123456', 1, 'Klenk', 'Klenk', 120, 'Niklas Collin', 'Collin'), mk('abcdef123457', 2, 'Krauss', 'Krauss', 61, 'Papa Krauss', null)];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-tour-book-v1', 'kl-mvp-news']) localStorage.setItem(k, 'true'); localStorage.setItem('kl-mvp-seen', JSON.stringify('x')); });
  await ctx.route(/supabase\.co/, r => { const u = r.request().url(); if (r.request().method() !== 'GET') return r.fulfill({ status: 201, body: '[]' });
    if (u.includes('/live_spiele')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }); return r.continue(); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
  for (const [uid, n] of [['abcdef123456', 'r1'], ['abcdef123457', 'r2']]) {
    await p.evaluate(u => document.querySelector('[data-lv="' + u + '"]').click(), uid); await p.waitForTimeout(900);
    await p.evaluate(() => { const s = document.getElementById('watchScroll'); s.scrollTop = s.querySelector('.mhero').offsetHeight - 330; }); await p.waitForTimeout(300);
    console.log(n, await p.evaluate(() => { const r = document.querySelector('#watchBody .kl-rep'); return r ? r.textContent + ' | Foto: ' + !!r.querySelector('img') + ' | Profil-Link: ' + (r.dataset.open || '-') : 'keine'; }));
    await p.screenshot({ path: 'out/' + n + '.png' }); await p.evaluate(() => history.back()); await p.waitForTimeout(400);
  }
  await p.evaluate(async () => { const api = await import('./js/services/api.js'); api.games.list[0].erfasst_von = 'Niklas Collin'; const m = await import('./js/ui/match.js'); m.openMatch(api.games.list[0].uid); }); await p.waitForTimeout(2500);
  await p.evaluate(() => { const s = document.getElementById('matchScroll'); s.scrollTop = s.scrollHeight; }); await p.waitForTimeout(300);
  console.log('Spiel-Detail:', await p.evaluate(() => { const r = document.querySelector('#matchBody .kl-rep'); return r ? r.textContent + ' | Foto: ' + !!r.querySelector('img') : 'keine'; }));
  await p.screenshot({ path: 'out/r3.png' });
  await p.evaluate(() => document.querySelector('#matchBody .kl-rep').click()); await p.waitForTimeout(1200);
  console.log('Antippen → Profil offen:', await p.evaluate(() => !document.getElementById('profile').hidden));
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
