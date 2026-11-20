const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  await L.startGame(t, ['Klenk']);
  for (const tb of ['att', 'def', 'err']) {
    await c('.tabs [data-tab="' + tb + '"]'); await p.waitForTimeout(200);
    console.log(tb + ':', await p.$$eval('#actList h2', e => e.map(h => h.textContent + ' [' + [...h.nextElementSibling.matches('.ahint') ? h.nextElementSibling.nextElementSibling.children : h.nextElementSibling.children].slice(0, 3).map(b => b.querySelector('.pt').textContent).join(',') + '…]').join('  ')));
  }
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
