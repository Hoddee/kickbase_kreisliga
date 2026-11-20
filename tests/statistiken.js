const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  await c('[data-tb="hof"]'); await p.waitForTimeout(800);
  console.log('Knopf:', await c('[data-hof="t:stats"]')); await p.waitForTimeout(2000);
  console.log('Ranglisten:', await p.$$eval('.hb-h h3', e => e.map(x => x.textContent).join(' | ')));
  console.log('Aktionen im Auswahlfeld:', await p.$$eval('#statPick option', e => e.length - 1));
  await p.screenshot({ path: 'out/s1.png' });
  await p.selectOption('#statPick', 'lball'); await p.waitForTimeout(300);
  console.log('Gewählt:', await p.evaluate(() => { const c = document.querySelector('.hb-card'); return c.querySelector('h3').textContent + ': ' + [...c.querySelectorAll('.hb-row')].map(r => r.querySelector('.hb-n b').textContent + ' ' + r.querySelector('.hb-v').textContent).join(', '); }));
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: 'out/s2.png' });
  await c('[data-hof="t:ov"]'); await p.waitForTimeout(300); console.log('Zurück zur Übersicht:', await p.evaluate(() => !!document.querySelector('.hb-mvp')));
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
