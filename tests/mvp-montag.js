const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [label, time] of [['So 15.11. 20:00', '2026-11-15T20:00:00'], ['Mo 16.11. 18:59', '2026-11-16T18:59:00'], ['Mo 16.11. 19:01', '2026-11-16T19:01:00'], ['Mo 07.12. (Ankündigung)', '2026-12-08T10:00:00']]) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
    await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-tour-book-v1']) localStorage.setItem(k, 'true'); });
    await ctx.route(/supabase\.co/, r => r.request().method() !== 'GET' ? r.fulfill({ status: 201, body: '[]' }) : r.continue());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date(time) });
    await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.clock.runFor(2500); await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({ stage: !document.getElementById('mvp').hidden ? document.querySelector('.mvp-head small').textContent : '-',
      h2: [...document.querySelectorAll('#startBody h2')].map(h => h.textContent).filter(t => /Spieltag|MVP/.test(t)).join(','),
      news: !!document.querySelector('.md-news'), next: (document.querySelector('.md-next') || {}).textContent || '-' }));
    console.log(label, JSON.stringify(r), errs.length ? errs : '');
    if (label.startsWith('Mo 16.11. 18')) { await p.evaluate(() => history.back()); await p.clock.runFor(800); await p.screenshot({ path: 'out/mo1.png' });
      await p.evaluate(() => document.querySelector('[data-md="news-x"]').click()); await p.clock.runFor(200);
      console.log('  Ankündigung weg:', await p.evaluate(() => !document.querySelector('.md-news')), '| nach Neuladen:', await (async () => { await p.reload({ waitUntil: 'networkidle' }); await p.clock.runFor(2000); return p.evaluate(() => !document.querySelector('.md-news')); })()); }
    await ctx.close();
  }
  await b.close();
})();
