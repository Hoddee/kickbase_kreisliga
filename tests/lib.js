const { chromium, devices } = require('playwright');
exports.setup = async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { localStorage.setItem('kl-intro-v1', 'true'); localStorage.setItem('kl-intro-v2', 'true'); localStorage.setItem('kl-tour-book-v1', 'true'); localStorage.setItem('kl-mvp-news', 'true'); localStorage.setItem('kl-recorder', JSON.stringify('Test')); { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); const r = new Date(d); r.setDate(r.getDate() + 6); r.setHours(19); if (new Date() < r) d.setDate(d.getDate() - 7); const p = n => (n < 10 ? '0' : '') + n; localStorage.setItem('kl-mvp-seen', JSON.stringify(d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()))); } });
  const writes = [];
  await ctx.route(/supabase\.co/, r => { if (r.request().method() !== 'GET') { writes.push(r.request().method() + ' ' + r.request().url().split('/rest/v1/')[1]); if (/\/rest\/v1\/spiele/.test(r.request().url())) exports.lastBody = r.request().postData(); return r.fulfill({ status: 201, body: '[]', contentType: 'application/json' }); } return r.continue(); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const c = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const S = () => p.evaluate(() => JSON.parse(localStorage.getItem('matchday-punkte-v3')));
  return { b, p, c, S, errs, writes };
};
// Spiel mit Spielern starten (ids), Uhr laufen lassen, in Punktevergabe
exports.startGame = async (t, ids) => {
  const { p, c } = t;
  await c('[data-st="new"]'); await p.waitForTimeout(300);
  if (ids.length > 1) { await c('[data-pick="multi"]'); await p.waitForTimeout(150); }
  for (const id of ids) { await c('[data-pick="p:' + id + '"]'); await p.waitForTimeout(120); }
  if (await p.$eval('#goBtn', e => e.disabled)) { await c('[data-pick^="o:"]'); await p.waitForTimeout(150); }
  await c('#goBtn'); await p.waitForTimeout(400);
  await c('[data-nav="edit"]'); await p.waitForTimeout(300);
  await c('[data-do="clock"]'); await p.waitForTimeout(200);
};
exports.evs = S => (S.squad ? S.squad.map((x, i) => (i === S.cur ? S : x)) : [S]).map(x => ({ p: (x.p || S.match.p), ev: x.events.map(e => e.key + (e.pts ? '(' + e.pts + ')' : '')).join(' ') }));
