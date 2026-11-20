const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  await L.startGame(t, ['Klenk', 'Krauss', 'Reule']);
  await c('.tabs [data-tab="def"]'); await p.waitForTimeout(200);
  await c('#editBody [data-k="duel"]'); await c('#editBody [data-k="icpt"]'); await p.waitForTimeout(150);
  await c('.tabs [data-tab="spiel"]'); await p.waitForTimeout(150);
  await c('#edit [data-k="tg"]'); await p.waitForTimeout(200); await c('[data-ga="done"]'); await p.waitForTimeout(200);
  await c('.tabs [data-tab="def"]'); await p.waitForTimeout(200);
  console.log('Chips:', await p.$$eval('#undoTx .rbc', els => els.map(e => e.textContent)));
  await c('#undoTx .rbc:nth-child(2)'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/rb1.png' });
  await c('[data-rb-to="2"]'); await p.waitForTimeout(300);
  let S = await t.S(); console.log('nach Umbuchen:', JSON.stringify(L.evs(S)));
  await c('#undoTx .rbc:nth-child(1)'); await p.waitForTimeout(150); await c('[data-rb-del]'); await p.waitForTimeout(200);
  S = await t.S(); console.log('nach Loeschen (neueste):', JSON.stringify(L.evs(S)));
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
