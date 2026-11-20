// Menü, Spiel-Knopf, Zurück, Live-Wechsel, Ausweichen des Bearbeiten-Knopfs
const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  const st = () => p.evaluate(() => ({ view: [...document.querySelectorAll('body > section, body > div[id]')].filter(e => !e.hidden && e.id).map(e => e.id).join(','), bar: !document.getElementById('tabbar').hidden, cls: document.body.className }));
  await c('[data-tb="kader"]'); await p.waitForTimeout(300); console.log('Kader:', await st());
  await c('[data-tb="hof"]'); await p.waitForTimeout(300); console.log('HoF:', await st());
  await p.evaluate(() => history.back()); await p.waitForTimeout(400); console.log('Zurück-Taste:', await st());
  await c('[data-tb="me"]'); await p.waitForTimeout(300); console.log('Ich:', await st());
  await c('[data-tb="game"]'); await p.waitForTimeout(400); console.log('Spiel (kein Spiel):', await st());
  await c('[data-pick="p:Klenk"]'); await p.waitForTimeout(150);
  if (await p.$eval('#goBtn', e => e.disabled)) await c('[data-pick^="o:"]');
  await c('#goBtn'); await p.waitForTimeout(400);
  await c('[data-nav="start"]'); await p.waitForTimeout(300);
  console.log('Start mit Spiel:', await st(), await p.evaluate(() => ({ dot: !document.getElementById('tbDot').hidden, l: document.getElementById('tbGameL').textContent, newBtn: !!document.querySelector('.kb-new') })));
  await c('[data-tb="game"]'); await p.waitForTimeout(400); console.log('Spiel (läuft):', await st());
  // Spiel beenden und Endstand-Ansicht prüfen
  await c('[data-nav="edit"]'); await p.waitForTimeout(300); await c('[data-do="clock"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('matchday-punkte-v3')); }); 
  await c('[data-do="endq"]') ; await p.waitForTimeout(200);
  const ends = await p.$$eval('[data-do]', e => e.map(x => x.dataset.do)); console.log('Knöpfe:', ends.filter(x => /end|ht/.test(x)).join(','));
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
