// Nachtrag mit mehreren Spielern (Admin): Auswahl, gemeinsames Ergebnis, Einsatz je Spieler, Speichern für alle
const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  /* Als Admin angemeldet (Sitzung und Rechte-Abfrage vorgetäuscht, nichts geht an Supabase) */
  const bodies = [];
  await p.route(/supabase\.co/, r => { const q = r.request(), u = q.url();
    if (u.includes('rpc/is_admin')) return r.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    if (u.includes('/auth/v1/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (u.includes('spieler_konten')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (q.method() === 'POST' && u.includes('/rest/v1/spiele')) { bodies.push(JSON.parse(q.postData())); return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    if (q.method() !== 'GET') return r.fulfill({ status: 201, body: '[]' });
    return r.continue(); });
  await p.evaluate(() => localStorage.setItem('kl-auth-v1', JSON.stringify({ access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 3600e3, user: { id: 'u1', email: 'admin@example.org' } })));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  console.log('Admin:', await p.evaluate(() => import('./js/services/auth.js').then(a => a.isAdmin())));
  await p.evaluate(() => import('./js/ui/setup.js').then(s => s.openSetup(null, { manual: true }))); await p.waitForTimeout(600);
  console.log('Mehrere-Knopf im Nachtrag:', await p.$$eval('[data-pick="multi"]', e => e.length));
  await c('[data-pick="multi"]'); await p.waitForTimeout(200);
  for (const id of ['Klenk', 'Krauss', 'Reule']) { await c('[data-pick="p:' + id + '"]'); await p.waitForTimeout(80); }
  if (await p.$eval('#goBtn', e => e.disabled)) await c('[data-pick^="o:"]');
  await c('#goBtn'); await p.waitForTimeout(800);
  let S = await t.S();
  console.log('Nachtrag mit', S.squad ? S.squad.length : 1, 'Spielern, manual:', S.manual, '| Leiste:', await p.$$eval('#squadE .sqn', e => e.map(x => x.textContent).join(',')));
  const set = async (k, v) => { await p.fill('[data-mf="' + k + '"]', String(v)); await p.$eval('[data-mf="' + k + '"]', e => e.dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(150); };
  /* gemeinsam: 2:1; Klenk: beide Tore mit ihm; Krauss: Bank, rein 60.; Reule: raus 70., 1 Tor mit ihm */
  await set('us', 2); await set('them', 1); await set('usOn', 2); await set('themOn', 1);
  await c('#squadE [data-sq="1"]'); await p.waitForTimeout(300); await c('[data-do="start0"]'); await p.waitForTimeout(200); await set('inMin', 60); await set('usOn', 1);
  await c('#squadE [data-sq="2"]'); await p.waitForTimeout(300); await set('outMin', 70); await set('usOn', 1); await set('themOn', 1);
  await c('.tabs [data-tab="att"]'); await p.waitForTimeout(200); await c('#actList [data-k]'); await p.waitForTimeout(150);
  await c('.tabs [data-tab="spiel"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/nachtrag-mehrere.png', fullPage: true });
  console.log('Spielstand je Spieler:', await p.evaluate(() => import('./js/core/game.js').then(g => g.eachPlayer(() => g.store.S.match.p + ' ' + g.score().us + ':' + g.score().them + ' ' + g.minPlayed() + 'min ' + g.total() + 'P').join(' | '))));
  await c('[data-do="end"]'); await p.waitForTimeout(150); await c('[data-do="end-yes"]'); await p.waitForTimeout(800);
  await c('[data-sv="ask"]'); await p.waitForTimeout(150); await c('[data-sv="yes"]'); await p.waitForTimeout(2000);
  const rows = bodies.flat();
  console.log('Gespeichert:', rows.map(r => r.player + ' ' + r.us + ':' + r.them + ' ' + r.minutes + 'min ' + r.points + 'P manual=' + r.manual).join(' | '));
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
