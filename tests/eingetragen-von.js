const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const missing of [false, true]) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
    await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-tour-book-v1', 'kl-mvp-news']) localStorage.setItem(k, 'true'); localStorage.setItem('kl-mvp-seen', JSON.stringify('x')); });
    const posts = [];
    await ctx.route(/supabase\.co/, r => {
      const q = r.request(), u = q.url();
      if (q.method() === 'POST' && u.includes('/rest/v1/spiele')) {
        const body = JSON.parse(q.postData()); posts.push('erfasst_von' in body ? 'mit:' + body.erfasst_von : 'ohne');
        if (missing && 'erfasst_von' in body) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: "Could not find the 'erfasst_von' column of 'spiele' in the schema cache" }) });
        return r.fulfill({ status: 201, body: '' });
      }
      if (q.method() !== 'GET') return r.fulfill({ status: 201, body: '[]' });
      if (missing && u.includes('erfasst_von')) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'column spiele.erfasst_von does not exist' }) });
      return r.continue();
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const c = s => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, s);
    await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
    const listed = await p.evaluate(() => document.querySelectorAll('#startBody .glist li').length);
    await c('[data-mvp="x"]'); await c('[data-tb="game"]'); await p.waitForTimeout(400); await c('[data-pick="p:Klenk"]');
    if (await p.$eval('#goBtn', e => e.disabled)) await c('[data-pick^="o:"]');
    await c('#goBtn'); await p.waitForTimeout(400);
    const sheet = await p.evaluate(() => { const s = document.querySelector('.sheet-bg h3'); return s ? s.textContent + ' | Knopf aus: ' + document.getElementById('nmGo').disabled : '-'; });
    if (!missing) await p.screenshot({ path: 'out/n1.png' });
    await p.fill('#nmI', '  Niklas  '); await c('#nmGo'); await p.waitForTimeout(500);
    const by = await p.evaluate(() => JSON.parse(localStorage.getItem('matchday-punkte-v3')).by);
    // Spiel durchziehen: Uhr, Zeit vorstellen, beenden, speichern
    await c('[data-nav="edit"]'); await p.waitForTimeout(300); await c('[data-do="clock"]');
    await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('matchday-punkte-v3')); S.clock.startedAt -= 3000e3; localStorage.setItem('matchday-punkte-v3', JSON.stringify(S)); });
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
    await c('[data-nav="edit"]'); await p.waitForTimeout(300); await c('[data-do="end"]'); await p.waitForTimeout(200); await c('[data-do="end-yes"]'); await p.waitForTimeout(500);
    await c('[data-sv="ask"]'); await p.waitForTimeout(200); await c('[data-sv="yes"]'); await p.waitForTimeout(1500);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('matchday-punkte-v3')).saved);
    console.log((missing ? 'OHNE Migration' : 'MIT Migration') + ' | Liste geladen: ' + listed + ' | Blatt: ' + sheet + ' | S.by: ' + by + ' | POSTs: ' + posts.join(', ') + ' | gespeichert: ' + saved + ' | Fehler: ' + (errs.length ? errs : 'keine'));
    // zweites Spiel: keine erneute Abfrage
    if (!missing) { await c('[data-nav="start"]'); await p.waitForTimeout(300); await c('[data-st="new"]'); await p.waitForTimeout(300); await c('[data-pick="p:Klenk"]'); if (await p.$eval('#goBtn', e => e.disabled)) await c('[data-pick^="o:"]'); await c('#goBtn'); await p.waitForTimeout(400);
      console.log('  2. Spiel: Abfrage erneut?', await p.evaluate(() => !!document.querySelector('.sheet-bg #nmI'))); }
    await ctx.close();
  }
  await b.close();
})();
