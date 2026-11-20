const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  // 1 Spieler: Team-Tor -> Blatt, er selbst trifft
  await L.startGame(t, ['Klenk']);
  await c('#edit [data-k="tg"]'); await p.waitForTimeout(200);
  console.log('Blatt (1 Spieler):', await p.$$eval('.ga-p span', e => e.map(x => x.textContent)));
  await c('[data-ga="sc:0"]'); await c('[data-ga="long"]'); await c('[data-ga="done"]'); await p.waitForTimeout(200);
  // Altes Verhalten: Team-Tor, Blatt schliessen, danach "Tor" im Angriff -> kein zweites Team-Tor
  await c('#edit [data-k="tg"]'); await p.waitForTimeout(200); await c('[data-ga="done"]'); await p.waitForTimeout(200);
  await c('.tabs [data-tab="att"]'); await p.waitForTimeout(200); await c('#editBody [data-k="goal"]'); await p.waitForTimeout(200); await c('[data-ga="done"]');
  let S = await t.S(); console.log('1 Spieler:', JSON.stringify(L.evs(S)), '| Tore Team:', S.events.filter(e => e.key === 'tg').length);
  // Undo-Knopf
  await c('[data-do="undo"]'); await p.waitForTimeout(200);
  S = await t.S(); console.log('nach Rueckgaengig:', JSON.stringify(L.evs(S)));
  // Abpfiff + Speichern (abgefangen)
  for (let i = 0; i < 90; i++) await c('[data-do="m+1"]');
  await c('.tabs [data-tab="spiel"]'); await c('[data-do="end"]'); await c('[data-do="end-yes"]'); await p.waitForTimeout(800);
  await c('[data-sv="ask"]'); await p.waitForTimeout(100); await c('[data-sv="yes"]'); await p.waitForTimeout(1500);
  console.log('Events gespeichert:', (JSON.parse(L.lastBody || '{}').events || []).map(e => e.k).join(' ')); console.log('Speichern:', t.writes.filter(w => /^POST spiele/.test(w)), '| ok:', await p.evaluate(() => !!document.querySelector('.svc .ok')));
  // Nachtrag (Admin-Modus ohne Anmeldung: nur Oberflaeche pruefen) -> Tor oeffnet kein Blatt
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('matchday-punkte-v3')); s.manual = true; s.ended = false; localStorage.setItem('matchday-punkte-v3', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await c('[data-nav="edit"]'); await p.waitForTimeout(300);
  await c('.tabs [data-tab="att"]'); await p.waitForTimeout(200); await c('#editBody [data-k="goal"]'); await p.waitForTimeout(300);
  console.log('Nachtrag: Blatt offen?', await p.evaluate(() => !!document.querySelector('#gaSheet:not([hidden])')));
  console.log('Fehler:', t.errs.length ? t.errs : 'keine'); await t.b.close();
})();
