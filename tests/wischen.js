const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p } = t;
  const cdp = await p.context().newCDPSession(p);
  const swipe = async (x1, y1, x2, y2, steps = 8, ms = 16) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / steps, y: y1 + (y2 - y1) * i / steps }] }); await p.waitForTimeout(ms); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(700);
  };
  const cur = () => p.evaluate(() => ['start', 'kader', 'hof', 'admin', 'me'].find(id => !document.getElementById(id).hidden));
  console.log('Start:', await cur());
  await swipe(300, 500, 80, 505); console.log('nach links wischen:', await cur());
  await swipe(300, 500, 80, 505); console.log('nach links wischen:', await cur());
  await swipe(300, 500, 80, 505); console.log('nach links wischen:', await cur());
  await swipe(300, 500, 80, 505); console.log('am Ende nochmal:', await cur());
  await swipe(80, 500, 320, 505); console.log('nach rechts:', await cur());
  await swipe(200, 600, 190, 300); console.log('senkrecht (scrollen):', await cur());
  await swipe(250, 500, 215, 505, 4); console.log('kurz/langsam (kein Wechsel):', await cur());
  await swipe(80, 500, 320, 505); await swipe(80, 500, 320, 505); console.log('zurück zur Liga:', await cur());
  // Leiste „Nächste Spiele“ scrollt selbst
  const fx = await p.evaluate(() => { const e = document.querySelector('.fxs'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { y: r.top + r.height / 2, w: e.scrollWidth > e.clientWidth }; });
  if (fx) { await p.waitForTimeout(300); await swipe(330, fx.y, 80, fx.y); console.log('auf Spiele-Leiste (scrollbar=' + fx.w + '):', await cur()); }
  const st = await p.evaluate(() => [...document.querySelectorAll('#start > *, #kader > *')].filter(e => e.style.transform || e.getAnimations().length).length);
  console.log('Reste von Transform/Animation:', st, '| Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
