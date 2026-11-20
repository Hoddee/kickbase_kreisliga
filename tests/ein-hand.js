const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  await L.startGame(t, ['Klenk', 'Krauss']);
  await c('.tabs [data-tab="att"]'); await p.waitForTimeout(200);
  console.log('Aus: Kacheln sichtbar?', await p.evaluate(() => !!document.querySelector('#ohPad:not([hidden])')));
  await c('[data-oh="toggle"]'); await p.waitForTimeout(200);
  const tiles = () => p.$$eval('#ohPad .oh-k span', e => e.map(x => x.textContent).join(' | '));
  console.log('An: Kacheln:', await tiles());
  await p.screenshot({ path: 'out/oh1.png' });
  const first = await p.$eval('#ohPad .oh-k', e => e.dataset.ohk);
  await c('#ohPad .oh-k'); await p.waitForTimeout(150); await c('#ohPad .oh-k'); await p.waitForTimeout(150);
  console.log('2× gebucht:', first, '→', JSON.stringify(L.evs(await t.S())[0]), '| Zähler:', await p.$eval('#ohPad .oh-k i', e => e.textContent));
  // 3× eine Aktion außerhalb der Kacheln (Flanke) → ersetzt die schwächste Kachel
  for (let i = 0; i < 3; i++) { await c('#actList [data-k="cross"]'); await p.waitForTimeout(80); }
  console.log('nach 3× Flanke:', await tiles());
  // Wischen über die Kacheln → Krauss
  const cdp = await p.context().newCDPSession(p); const box = await p.$eval('#ohPad', e => { const r = e.getBoundingClientRect(); return { y: r.top + r.height / 2 }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: box.y }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 300 - i * 35, y: box.y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
  console.log('nach Wischen:', await p.$eval('.oh-who span', e => e.textContent), '| Kacheln:', await tiles());
  await p.screenshot({ path: 'out/oh2.png' });
  await c('.tabs [data-tab="spiel"]'); await p.waitForTimeout(200); console.log('Reiter Spiel: Kacheln weg?', await p.evaluate(() => !document.querySelector('#ohPad:not([hidden])')));
  await c('.tabs [data-tab="def"]'); await p.waitForTimeout(200); console.log('Reiter Abwehr: Kacheln da?', await p.evaluate(() => !!document.querySelector('#ohPad:not([hidden])')));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800); await c('[data-nav="edit"]'); await p.waitForTimeout(300); await c('.tabs [data-tab="att"]'); await p.waitForTimeout(200);
  console.log('nach Neuladen noch an?', await p.evaluate(() => !!document.querySelector('#ohPad:not([hidden])')));
  await c('[data-oh="toggle"]'); await p.waitForTimeout(200); console.log('Aus:', await p.evaluate(() => !document.querySelector('#ohPad:not([hidden])')));
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
