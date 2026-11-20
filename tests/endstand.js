const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  await L.startGame(t, ['Klenk']);
  await c('.tabs [data-tab="att"]'); await p.waitForTimeout(150);
  for (const k of ['sot', 'pf3', 'poh', 'cross', 'bcc']) { await c('#editBody [data-k="' + k + '"]'); await p.waitForTimeout(60); }
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('matchday-punkte-v3')); S.clock.startedAt -= 5500e3; localStorage.setItem('matchday-punkte-v3', JSON.stringify(S)); });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  await c('[data-nav="edit"]'); await p.waitForTimeout(300); await c('.tabs [data-tab="spiel"]'); await p.waitForTimeout(200);
  await c('[data-do="end"]'); await p.waitForTimeout(300); await c('[data-do="end-yes"], [data-do="endok"]'); await p.waitForTimeout(500);
  console.log('Ansicht:', await p.evaluate(() => [...document.querySelectorAll('body > section, body > div[id]')].filter(e => !e.hidden && e.id).map(e => e.id).join(',')));
  if (!(await p.evaluate(() => !document.getElementById('home').hidden))) { await c('[data-nav="home"]'); await p.waitForTimeout(500); }
  const y = await p.evaluate(() => { const s = document.querySelector('#summary .svc'); return s ? s.getBoundingClientRect().top + scrollY : null; });
  console.log('svc y', y);
  for (const off of [600, 760, 900, 1400]) {
    await p.evaluate(v => scrollTo(0, v), y - off); await p.waitForTimeout(250);
    console.log('scroll', y - off, 'away=', await p.evaluate(() => document.getElementById('cta').classList.contains('away')));
  }
  await p.evaluate(v => scrollTo(0, v), y - 700); await p.waitForTimeout(300); await p.screenshot({ path: 'out/16-ende.png' });
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: 'out/17-ende-oben.png' });
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
