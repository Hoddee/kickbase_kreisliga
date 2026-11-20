// Spiel mit 15 Spielern: Leiste scrollt, aktiver Spieler im Bild, Tor-Assistent zeigt alle, Team-Bild
const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  await c('[data-st="new"]'); await p.waitForTimeout(300); await c('[data-pick="multi"]'); await p.waitForTimeout(200);
  const ids = await p.$$eval('[data-pick^="p:"]', e => [...new Set(e.map(x => x.dataset.pick.slice(2)))].slice(0, 16));
  for (const id of ids) { await c('[data-pick="p:' + id + '"]'); await p.waitForTimeout(60); }
  if (await p.$eval('#goBtn', e => e.disabled)) { await c('[data-pick^="o:"]'); await p.waitForTimeout(150); }
  await c('#goBtn'); await p.waitForTimeout(400); await c('[data-nav="edit"]'); await p.waitForTimeout(300); await c('[data-do="clock"]'); await p.waitForTimeout(200);
  const S = await t.S();
  console.log('Spieler im Spiel:', S.squad ? S.squad.length : 1, '| max:', await p.$eval('[data-pick="multi"]', e => e.textContent).catch(() => '-'));
  const bar = () => p.evaluate(() => { const r = document.querySelector('#squadE .sqrow'); const on = r.querySelector('[aria-pressed="true"]').getBoundingClientRect(); return { many: r.classList.contains('many'), scroll: r.scrollWidth > r.clientWidth, sichtbar: on.left >= 0 && on.right <= innerWidth, breit: document.documentElement.scrollWidth <= innerWidth }; });
  console.log('Leiste:', JSON.stringify(await bar()));
  await c('#squadE [data-sq="12"]'); await p.waitForTimeout(500);
  console.log('nach Wechsel auf 13:', JSON.stringify(await bar()));
  await p.screenshot({ path: 'out/viele1.png' });
  await c('.tabs [data-tab="spiel"]'); await p.waitForTimeout(200); await c('#edit [data-k="tg"]'); await p.waitForTimeout(400);
  console.log('Tor-Assistent Kacheln:', await p.$$eval('.ga-grid .ga-p:not(.none)', e => e.length));
  await p.screenshot({ path: 'out/viele2.png' });
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
