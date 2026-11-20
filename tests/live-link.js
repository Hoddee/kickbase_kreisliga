const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { localStorage.setItem('kl-intro-v1', 'true'); });
  const row = { uid: 'abcdef123456', updated_at: new Date().toISOString(), data: { v: 1, gid: 'gameid12345', i: 0, n: 1, p: 'Klenk', nm: 'Klenk', vn: 'Silas', team: 'vfrk', opp: 'tsc', home: true, us: 2, them: 1, t: 87, ended: false, h2: true, ht: false, clock: { el: 3100, run: true, at: Date.now() }, rows: [{ p: 90, l: 'Tor', r: '52’', id: 3 }] } };
  await ctx.route(/supabase\.co/, r => {
    const u = r.request().url();
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, body: '[]' });
    if (u.includes('/live_spiele')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row]) });
    return r.continue();
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/?live=gameid12345', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  console.log('Live-Blatt offen:', await p.evaluate(() => !document.getElementById('watch').hidden), '| URL:', p.url());
  await p.screenshot({ path: 'out/lv1.png' });
  await p.evaluate(() => document.querySelector('[data-lw="share"]').click()); await p.waitForTimeout(400);
  console.log('Teilen ->', await p.evaluate(() => (document.getElementById('toast') || {}).textContent));
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto('http://localhost:8123/?live=gibtsnicht99', { waitUntil: 'networkidle' }); await p2.waitForTimeout(2500);
  console.log('Unbekanntes Spiel ->', await p2.evaluate(() => (document.getElementById('toast') || {}).textContent));
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
