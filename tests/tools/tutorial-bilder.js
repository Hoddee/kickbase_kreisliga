// Bilder für die Rundgänge: node tutgen.js  → tut/*.png
const { chromium } = require('playwright');
const mk = (uid, i, p, nm, vn, t) => ({ uid, updated_at: new Date().toISOString(), data: { v: 1, gid: 'gameid12345', i, n: 3, p, nm, vn, team: 'vfrk', opp: 'tsc', home: true, us: 2, them: 1, t, ended: false, h2: true, ht: false, clock: { el: 3100, run: true, at: Date.now() }, rows: [{ p: 90, l: 'Tor', r: '52’', id: 3 }, { p: 12, l: 'Torschuss (aufs Tor)', r: '52’', id: 2 }, { p: 5, l: 'Ballgewinn', r: '40’', id: 1 }] } });
const rows = [mk('abcdef123456', 0, 'Klenk', 'Klenk', 'Silas', 287), mk('abcdef123457', 1, 'Krauss', 'Krauss', 'Levin', 161), mk('abcdef123458', 2, 'Reule', 'Reule', 'Noah', 48)];
const CSS = `.tut-hl{outline:3px solid #28de86!important;outline-offset:3px;box-shadow:0 0 0 9px rgba(40,222,134,.22)!important}
.tut-tap{position:fixed;z-index:999;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 0 0 8px rgba(255,255,255,.28),0 6px 18px rgba(0,0,0,.5);pointer-events:none}`;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 440 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await ctx.addInitScript(() => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-intro-v3', 'kl-tour-book-v1', 'kl-tour-book-v2', 'kl-mvp-news']) localStorage.setItem(k, 'true');
    localStorage.setItem('kl-recorder', JSON.stringify('Gast'));
    /* MVP-Stage des letzten Spieltags als gesehen markieren (sonst öffnet sie sich mitten drin) */
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); const r = new Date(d); r.setDate(r.getDate() + 6); r.setHours(19); if (new Date() < r) d.setDate(d.getDate() - 7);
    const z = n => (n < 10 ? '0' : '') + n; localStorage.setItem('kl-mvp-seen', JSON.stringify(d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()))); });
  await ctx.route(/supabase\.co/, r => { const u = r.request().url();
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, body: '[]' });
    if (u.includes('/live_spiele')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    return r.continue(); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message, e.stack); });
  const c = s => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, s);
  const hl = (sel, tap = true) => p.evaluate(([sel, tap]) => {
    document.querySelectorAll('.tut-hl,.tut-tap').forEach(e => e.classList.contains('tut-tap') ? e.remove() : e.classList.remove('tut-hl'));
    if (!sel) return;
    const e = document.querySelector(sel); if (!e) return 'fehlt';
    e.classList.add('tut-hl');
    if (tap) { const r = e.getBoundingClientRect(), d = document.createElement('i'); d.className = 'tut-tap'; d.style.left = (r.left + r.width * .5) + 'px'; d.style.top = (r.bottom - 4) + 'px'; document.body.appendChild(d); }
  }, [sel, tap]);
  const shot = async n => { await p.waitForTimeout(700); await p.screenshot({ path: 'out/tut/' + n + '.png' }); console.log('ok', n); };
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.addStyleTag({ content: CSS }); await p.waitForTimeout(2200);
  // ---- Einführung
  await shot('a-liga');
  await c('[data-lv]'); await p.waitForTimeout(900); await p.evaluate(() => { const s = document.getElementById('watchScroll'), h = s.querySelector('.mhero'); s.scrollTop = h.offsetHeight - 300; }); await p.waitForTimeout(200); await p.evaluate(() => document.getElementById('watchMini').classList.remove('on')); await shot('a-live'); await p.evaluate(() => history.back()); await p.waitForTimeout(500);
  await c('[data-tb="kader"]'); await p.waitForTimeout(500);
  await p.evaluate(() => [...document.querySelectorAll('[data-open^="p:"]')].find(e => e.textContent.includes('Sipala')).click()); await p.waitForTimeout(1800); await p.evaluate(() => { const s = document.getElementById('profileScroll'), n = s.querySelector('.pnames'); s.scrollTop = n.getBoundingClientRect().top + s.scrollTop - 170; }); await p.waitForTimeout(200); await p.evaluate(() => document.getElementById('profileMini').classList.remove('on')); await shot('a-profil');
  await p.evaluate(() => history.back()); await p.waitForTimeout(500);
  await c('[data-tb="hof"]'); await p.waitForTimeout(1500); await shot('a-ranking');
  await c('[data-tb="game"]'); await p.waitForTimeout(600); await c('[data-pick="multi"]');
  for (const id of ['Klenk', 'Krauss', 'Reule']) { await c('[data-pick="p:' + id + '"]'); await p.waitForTimeout(80); }
  if (await p.$eval('#goBtn', e => e.disabled)) await c('[data-pick^="o:"]');
  await p.waitForTimeout(300); await hl('#goBtn'); await shot('a-neu'); await hl(null);
  // ---- Punktevergabe
  await c('#goBtn'); await p.waitForTimeout(600); await c('[data-nav="edit"]'); await p.waitForTimeout(500);
  await c('[data-do="clock"]'); await p.waitForTimeout(300);
  await c('.tabs [data-tab="att"]'); await p.waitForTimeout(400); await p.evaluate(() => { const e = document.querySelector('#actList'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 210); }); await p.waitForTimeout(300); await hl('#actList .act'); await shot('b-start'); await hl(null);
  await c('.tabs [data-tab="spiel"]'); await p.waitForTimeout(400);
  await p.evaluate(() => { const e = document.querySelector('#editBody [data-k="tg"]'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 170); }); await p.waitForTimeout(300);
  await hl('#editBody [data-k="tg"]'); await shot('b-tor'); await hl(null);
  await c('#editBody [data-k="tg"]'); await p.waitForTimeout(500); await c('[data-ga="sc:1"]'); await p.waitForTimeout(200); await c('[data-ga="sb:sot"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const b = document.querySelector('.ga-body'); b.scrollTop = 0; }); await hl('.ga-p.on', false); await shot('b-schuetze'); await hl(null);
  await c('[data-ga="next"]'); await p.waitForTimeout(400); await c('[data-ga="as:0"]'); await p.waitForTimeout(200);
  for (const k of ['intent', 'bcc']) { await c('[data-ga="ab:' + k + '"]'); await p.waitForTimeout(100); }
  await p.evaluate(() => { const b = document.querySelector('.ga-body'), e = b.querySelector('[data-ga="ab:intent"]'); b.scrollTop += e.getBoundingClientRect().top - b.getBoundingClientRect().top - 40; }); await p.waitForTimeout(200);
  await hl('[data-ga="ab:bcc"]', true); await shot('b-vorlage'); await hl(null);
  await c('[data-ga="done"]'); await p.waitForTimeout(400);
  await c('#editBody [data-k="cg"]'); await p.waitForTimeout(500); await c('[data-ga="fx:2"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const b = document.querySelector('.ga-body'); b.scrollTop = 0; }); await hl('.ga-p.on', false); await shot('b-gegentor'); await hl(null);
  await c('[data-ga="done"]'); await p.waitForTimeout(300);
  await c('.tabs [data-tab="att"]'); await p.waitForTimeout(300); await c('#actList [data-k="cross"]'); await p.waitForTimeout(300);
  await c('#actList [data-k="icpt"]'); await p.waitForTimeout(300);
  await c('#undoTx .rbc'); await p.waitForTimeout(400); await hl('#undoTx .rbc', false); await shot('b-zuletzt');
  await c('[data-rb-x]'); await p.waitForTimeout(200); await p.evaluate(() => window.scrollTo(0, 0));
  await c('[data-oh="toggle"]'); await p.waitForTimeout(400); await hl('.oh-grid', false); await shot('b-einhand'); await hl(null); await c('[data-oh="toggle"]');
  await c('.tabs [data-tab="spiel"]'); await p.waitForTimeout(300); await c('[data-mt="host"]'); await p.waitForTimeout(1500);
  await p.evaluate(() => { for (const id of ['squadE', 'undo']) document.getElementById(id).style.display = 'none'; const e = document.querySelector('.mt-qr'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 84); }); await shot('b-mit');
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
