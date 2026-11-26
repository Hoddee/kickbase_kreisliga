// Spielstand-Sicherung: iOS verliert den Handy-Speicher → IndexedDB holt das Spiel zurück; ist auch der weg → Supabase-Sicherung
const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  /* Sicherung in Supabase abfangen und merken */
  let cloud = null; const calls = [];
  await p.route(/spiel_sicherung/, r => { const q = r.request(); calls.push(q.method());
    if (q.method() === 'POST') { cloud = { data: JSON.parse(q.postData()).data, updated_at: new Date().toISOString() }; return r.fulfill({ status: 201, body: '' }); }
    if (q.method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud ? [cloud] : []) });
    if (q.method() === 'DELETE') { cloud = null; return r.fulfill({ status: 204, body: '' }); }
    return r.continue(); });
  await L.startGame(t, ['Klenk', 'Krauss', 'Reule']);
  await c('.tabs [data-tab="att"]'); await p.waitForTimeout(200);
  for (let i = 0; i < 3; i++) { await c('#squadE [data-sq="' + i + '"]'); await p.waitForTimeout(100); await c('#actList [data-k]'); await p.waitForTimeout(80); }
  await p.waitForTimeout(6500);
  console.log('Sicherung hochgeladen:', !!cloud, cloud ? (cloud.data.squad || []).length + ' Spieler' : '');
  const count = () => p.evaluate(() => import('./js/core/game.js').then(g => g.store.S.match ? (g.store.S.squad ? g.store.S.squad.length : 1) + ' Spieler, ' + g.store.S.squad.reduce((n, x, i) => n + (i === g.store.S.cur ? g.store.S.events : x.events).length, 0) + ' Aktionen' : 'kein Spiel'));
  const before = await count();
  /* 1) Handy-Speicher (localStorage) weg, IndexedDB noch da */
  await p.evaluate(() => localStorage.removeItem('matchday-punkte-v3'));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  console.log('vorher:', before, '| ohne Handy-Speicher:', await count(), '| Hinweis:', await p.evaluate(() => (document.getElementById('toast') || {}).textContent));
  /* 2) Alles lokal weg (localStorage komplett + IndexedDB) – nur die Sicherung in Supabase bleibt */
  await p.evaluate(() => new Promise(res => { const keep = {}; for (const k of ['kl-intro-v3', 'kl-tour-book-v2', 'kl-mvp-news', 'kl-push-ask', 'kl-recorder', 'kl-mvp-seen']) keep[k] = localStorage.getItem(k);
    const lk = localStorage.getItem('kl-live-key'); localStorage.clear(); for (const k in keep) if (keep[k] != null) localStorage.setItem(k, keep[k]);
    window.__lk = lk; const d = indexedDB.deleteDatabase('kl-vault'); d.onsuccess = d.onerror = d.onblocked = () => res(); }));
  await p.evaluate(() => localStorage.setItem('kl-live-key', window.__lk));
  console.log('nach Löschen:', 'Handy-Speicher', await p.evaluate(() => localStorage.getItem('matchday-punkte-v3') ? 'da' : 'leer'));
  /* Geräteschlüssel ist auch weg → ohne Schlüssel keine Sicherung; Test 2a: Schlüssel da (z. B. nur Spiel verloren) */
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  console.log('Blatt „Laufendes Spiel gefunden“:', await p.$$eval('.rs-sheet', e => e.length) ? 'ja' : 'nein', '|', await p.$eval('.rs-n', e => e.textContent).catch(() => '-'));
  await p.screenshot({ path: 'out/sicherung.png' });
  await c('[data-rs="ok"]'); await p.waitForTimeout(800);
  console.log('nach Wiederherstellen:', await count());
  /* Diagnose im Admin-Bereich (Liste der Starts) */
  console.log('Diagnose:', JSON.stringify(await p.evaluate(() => import('./js/services/backup.js').then(b => b.startLog().then(l => l.slice(0, 3).map(x => x.ls + ' | ' + x.idb + ' | ' + x.cloud + ' | ' + x.act))))));
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
