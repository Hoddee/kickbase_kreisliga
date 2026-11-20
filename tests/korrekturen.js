const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  await p.waitForTimeout(1500);
  await p.evaluate(() => import('./js/ui/match.js').then(m => m.openMatch('v4hmx938wptmpk6vwc74'))); await p.waitForTimeout(2500);
  const st = () => p.evaluate(() => ['match', 'corr'].filter(id => !document.getElementById(id).hidden).join('+'));
  console.log('offen:', await st(), '| Zeile:', await p.evaluate(() => (document.querySelector('.row.corr') || {}).textContent));
  await p.evaluate(() => { const s = document.getElementById('matchScroll'); s.scrollTop = s.querySelector('.mhero').offsetHeight - 300; }); await p.waitForTimeout(300);
  await c('.row.corr'); await p.waitForTimeout(600);
  console.log('nach Tipp:', await st(), '| Einträge:', await p.$$eval('#corrBody .row', e => e.map(x => x.textContent).join(' / ')));
  await p.screenshot({ path: 'out/c1.png' });
  await p.evaluate(() => history.back()); await p.waitForTimeout(500);
  console.log('Zurück-Taste:', await st());
  await c('.row.corr'); await p.waitForTimeout(500); await p.mouse.click(200, 30); await p.waitForTimeout(500);
  console.log('Tipp daneben:', await st());
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
