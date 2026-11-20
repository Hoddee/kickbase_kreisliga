// Spieler-Vergleich im Profil: Knopf, Auswahl, Vergleich, Wechseln, zurück
const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  await c('[data-tb="kader"]'); await p.waitForTimeout(500);
  await p.evaluate(() => [...document.querySelectorAll('[data-open^="p:"]')].find(e => e.textContent.includes('Sipala')).click()); await p.waitForTimeout(1500);
  console.log('Knopf:', await p.$$eval('[data-pf="cmp"]', e => e.length));
  await c('[data-pf="cmp"]'); await p.waitForTimeout(400);
  const list = await p.$$eval('[data-pf^="cmpp:"]', e => e.map(x => x.dataset.pf.slice(5)));
  console.log('Auswahl:', list.length, 'Spieler, Sipala dabei:', list.includes('Sipala'), '| erste:', list.slice(0, 3).join(','));
  await c('[data-pf="cmpp:' + list[0] + '"]'); await p.waitForTimeout(600);
  console.log('Zeilen:', await p.$$eval('.cmp-row', e => e.map(x => x.querySelector('small').textContent + ' ' + [...x.querySelectorAll('b')].map(b => b.textContent).join('/')).join(' | ')));
  console.log('Ergebnis:', await p.$eval('.cmp-sum', e => e.textContent), '| breit ok:', await p.evaluate(() => document.getElementById('profileScroll').scrollWidth <= innerWidth));
  await p.screenshot({ path: 'out/vergleich.png' });
  await c('[data-pf="cmp"]'); await p.waitForTimeout(300); await c('[data-pf="cmpp:' + list[1] + '"]'); await p.waitForTimeout(300);
  console.log('gewechselt:', await p.$eval('.cmp-pl.r b', e => e.textContent));
  await c('[data-pf="cmp-x"]'); await p.waitForTimeout(300);
  console.log('zurück im Profil:', await p.$$eval('.phero', e => e.length) === 1);
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
