const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  await L.startGame(t, ['Klenk', 'Krauss', 'Reule', 'Schauss']);
  await c('#edit [data-k="tg"]'); await p.waitForTimeout(200); await c('[data-ga="sc:1"]'); await c('[data-ga="as:0"]'); await c('[data-ga="done"]'); await p.waitForTimeout(200);
  await c('#edit [data-k="tg"]'); await p.waitForTimeout(200); await c('[data-ga="sc:1"]'); await c('[data-ga="as:2"]'); await c('[data-ga="done"]'); await p.waitForTimeout(200);
  for (let i = 0; i < 90; i++) await c('[data-do="m+1"]');
  await c('[data-do="end"]'); await p.waitForTimeout(100); await c('[data-do="end-yes"]'); await p.waitForTimeout(1200);
  console.log('Team-Knopf:', await p.evaluate(() => (document.querySelector('[data-sv="team"]') || {}).textContent));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), c('[data-sv="team"]')]);
  await dl.saveAs('out/team.png'); console.log('Bild:', dl.suggestedFilename());
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
