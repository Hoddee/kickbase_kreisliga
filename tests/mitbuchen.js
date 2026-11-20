// Mitbuch-Modus mit zwei Handys (zwei Browser-Kontexte) über echten Supabase-Broadcast (landet nicht in der Datenbank)
const L = require('./lib.js');
const { devices } = require('playwright');
(async () => {
  const t = await L.setup(); const { p, c } = t, errs = [];
  await L.startGame(t, ['Klenk', 'Krauss', 'Reule']);
  await c('.tabs [data-tab="spiel"]'); await p.waitForTimeout(200);
  await c('[data-mt="host"]'); await p.waitForTimeout(1500);
  const url = await p.evaluate(() => import('./js/services/mit.js').then(m => m.joinUrl()));
  console.log('Link:', url.replace(/^.*\?/, '?'), '| QR:', await p.$$eval('.mt-qr svg', e => e.length));
  await p.evaluate(() => document.querySelector('.mt-card').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/mit1.png' });

  /* zweites Handy */
  const ctx = await t.b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-intro-v3', 'kl-tour-book-v1', 'kl-tour-book-v2', 'kl-mvp-news']) localStorage.setItem(k, 'true'); localStorage.setItem('kl-recorder', JSON.stringify('Max')); localStorage.setItem('kl-mvp-seen', JSON.stringify('2099-01-01')); });
  await ctx.route(/supabase\.co\/(rest|storage)/, r => (r.request().method() !== 'GET' ? r.fulfill({ status: 201, body: '[]' }) : r.continue()));
  const q = await ctx.newPage(); q.on('pageerror', e => errs.push('B: ' + e.message));
  const qc = sel => q.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  await q.goto('http://localhost:8123/' + url.replace(/^.*\?/, '?'), { waitUntil: 'networkidle' });
  await q.waitForFunction(() => document.querySelector('#edit') && !document.querySelector('#edit').hidden, null, { timeout: 15000 });
  await q.waitForTimeout(600);
  console.log('B im Spiel:', await q.evaluate(() => document.querySelectorAll('.mt-p').length + ' Spieler, Leiste ' + document.querySelectorAll('#squadE .sqb').length));
  await p.waitForTimeout(500);
  console.log('A sieht Mitbucher:', await p.$$eval('.mt-devs li b', e => e.map(x => x.textContent).join(',')));

  /* B sperrt Spieler 2 (Krauss) und bucht */
  const u2 = await q.evaluate(() => document.querySelectorAll('.mt-p')[1].dataset.mt.slice(3));
  await qc('[data-mt="lk:' + u2 + '"]'); await q.waitForTimeout(900);
  await q.evaluate(() => document.querySelector('.mt-ps').scrollIntoView({ block: 'center' })); await q.waitForTimeout(200);
  await q.screenshot({ path: 'out/mit2.png' });
  await p.evaluate(() => document.querySelector('.mt-card').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/mit1b.png' });
  console.log('B Leiste:', await q.$$eval('#squadE .sqn', e => e.map(x => x.textContent).join(',')));
  await qc('.tabs [data-tab="att"]'); await q.waitForTimeout(200);
  const k1 = await q.$eval('#actList [data-k]', e => e.dataset.k);
  await qc('#actList [data-k="' + k1 + '"]'); await q.waitForTimeout(150); await qc('#actList [data-k="' + k1 + '"]'); await q.waitForTimeout(1200);
  const krauss = () => t.S().then(S => L.evs(S).find(x => /Krauss|krauss/.test(x.p)) || L.evs(S)[1]);
  console.log('A hat für Krauss:', JSON.stringify(await krauss()));

  /* A darf Krauss nicht buchen */
  await c('.tabs [data-tab="att"]'); await p.waitForTimeout(200);
  await c('#squadE [data-sq="1"]'); await p.waitForTimeout(300);
  console.log('A Hinweis:', await p.$eval('.mt-lock', e => e.textContent).catch(() => '-'), '| Badge:', await p.$$eval('#squadE .sqlk', e => e.length));
  await p.screenshot({ path: 'out/mit3.png' });
  const before = (await krauss()).ev;
  await c('#actList [data-k="' + k1 + '"]'); await p.waitForTimeout(300);
  console.log('A blockiert:', (await krauss()).ev === before);

  /* B meldet ein Tor mit Torschütze Reule */
  await qc('.tabs [data-tab="spiel"]'); await q.waitForTimeout(200);
  await qc('#edit [data-k="tg"]'); await q.waitForTimeout(400);
  await qc('[data-ga="sc:2"]'); await q.waitForTimeout(200); await qc('[data-ga="done"]'); await q.waitForTimeout(1500);
  console.log('A nach Tor von B:', JSON.stringify(L.evs(await t.S())), '| Stand A:', await p.evaluate(() => import('./js/core/game.js').then(g => g.score().us)));

  /* B löscht eine eigene Aktion über „Zuletzt gebucht“ */
  await qc('.tabs [data-tab="att"]'); await q.waitForTimeout(200);
  const chips = await q.$$eval('#undoTx .rbc', e => e.map(x => x.textContent));
  console.log('B zuletzt:', chips.join(' | '));
  await qc('#undoTx .rbc:last-child'); await q.waitForTimeout(150); await qc('[data-rb-del]'); await q.waitForTimeout(1200);
  console.log('A nach Löschen:', JSON.stringify(await krauss()));

  /* A übernimmt Krauss wieder */
  await c('[data-mt="take"]'); await p.waitForTimeout(1200);
  console.log('A übernommen:', await p.$$eval('.mt-lock', e => e.length) === 0, '| B Leiste:', await q.$$eval('#squadE .sqb', e => e.length));

  /* A beendet das Spiel → B ist raus und hat kein Spiel gespeichert */
  await c('.tabs [data-tab="spiel"]'); await p.waitForTimeout(200);
  await c('[data-do="end"]'); await p.waitForTimeout(150); await c('[data-do="end-yes"]'); await p.waitForTimeout(2000);
  console.log('B nach Abpfiff:', await q.evaluate(() => (window.__nav || '') + [...document.querySelectorAll('main > section:not([hidden]), section.view:not([hidden])')].map(s => s.id).join(',')),
    '| B Speicher:', await q.evaluate(() => localStorage.getItem('matchday-punkte-v3') === null ? 'leer' : 'Spiel!'), '| mit:', await q.evaluate(() => localStorage.getItem('kl-mit')));
  console.log('Fehler:', [...t.errs, ...errs].length ? [...t.errs, ...errs] : 'keine'); await t.b.close();
})();
