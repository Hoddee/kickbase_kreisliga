const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [label, time] of [['So 18:59', '2026-11-15T18:59:00'], ['So 19:01', '2026-11-15T19:01:00']]) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
    await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-tour-book-v1']) localStorage.setItem(k, 'true'); });
    await ctx.route(/supabase\.co/, r => r.request().method() !== 'GET' ? r.fulfill({ status: 201, body: '[]' }) : r.continue());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date(time) });
    await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
    await p.clock.runFor(2500); await p.waitForTimeout(500);
    const st = () => p.evaluate(() => ({ mvp: !document.getElementById('mvp').hidden, cls: document.getElementById('mvp').className }));
    console.log(label, '| Karte:', await p.evaluate(() => { const h = [...document.querySelectorAll('#startBody h2')].find(x => x.textContent.startsWith('Spieltag')); return h ? h.textContent + ' / ' + ((document.querySelector('.md-next') || {}).textContent || '-') + ' / Top: ' + [...document.querySelectorAll('.mdc-p')].map(x => x.textContent).join(', ') : 'keine'; }), '| Stage:', JSON.stringify(await st()));
    if (label === 'So 18:59') { await p.screenshot({ path: 'out/m0.png' }); await p.close(); await ctx.close(); continue; }
    for (const [ms, n] of [[1400, 'm1'], [1600, 'm2'], [1300, 'm3'], [2600, 'm4']]) { await p.clock.runFor(ms); await p.waitForTimeout(700); await p.screenshot({ path: 'out/' + n + '.png' }); }
    console.log('nach Animation:', JSON.stringify(await st()), '| Punkte:', await p.$$eval('.mp-v', e => e.map(x => x.textContent).join(',')));
    await p.evaluate(() => document.querySelector('.mvp-cta [data-md="close"]').click()); await p.clock.runFor(500); await p.waitForTimeout(300);
    console.log('Schließen:', JSON.stringify(await st()));
    await p.reload({ waitUntil: 'networkidle' }); await p.clock.runFor(2500); await p.waitForTimeout(400);
    console.log('nach Neuladen (schon gesehen):', JSON.stringify(await st()));
    await p.evaluate(() => document.querySelector('[data-md="stage"]').click()); await p.clock.runFor(800); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#mvp').click()); await p.clock.runFor(300); await p.waitForTimeout(300);
    console.log('Karte → Stage, Tipp = überspringen:', JSON.stringify(await st()), await p.$$eval('.mp-v', e => e.map(x => x.textContent).join(',')));
    await p.evaluate(() => history.back()); await p.clock.runFor(300); await p.waitForTimeout(300);
    console.log('Zurück-Taste:', JSON.stringify(await st()));
    console.log('Fehler:', errs.length ? errs : 'keine'); await ctx.close();
  }
  await b.close();
})();
