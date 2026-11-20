// Einmalige Frage nach Benachrichtigungen: erscheint einmal, „Aktivieren“ meldet an, danach nie wieder
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const run = async (choice) => {
    const ctx = await b.newContext({ ...devices['Pixel 7'] });
    await ctx.addInitScript(() => {
      let perm = 'default', sub = null;
      Object.defineProperty(Notification, 'permission', { get: () => perm });
      Notification.requestPermission = async () => (perm = 'granted');
      PushManager.prototype.getSubscription = async () => sub;
      PushManager.prototype.subscribe = async () => (sub = { endpoint: 'https://push.example/abc', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'k', auth: 'a' } }; } });
      for (const k of ['kl-intro-v3', 'kl-tour-book-v2', 'kl-mvp-news']) localStorage.setItem(k, 'true'); { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); const r = new Date(d); r.setDate(r.getDate() + 6); r.setHours(19); if (new Date() < r) d.setDate(d.getDate() - 7); const z = n => (n < 10 ? '0' : '') + n; localStorage.setItem('kl-mvp-seen', JSON.stringify(d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()))); }
    });
    const calls = [];
    await ctx.route(/supabase\.co/, r => { const u = r.request().url();
      if (u.includes('rpc/push_')) { calls.push(u.split('rpc/')[1]); return r.fulfill({ status: 204, body: '' }); }
      return r.request().method() !== 'GET' ? r.fulfill({ status: 201, body: '[]' }) : r.continue(); });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(4500);
    const shown = await p.$$eval('.pask', e => e.length);
    if (shown) await p.screenshot({ path: 'out/push-frage.png' });
    await p.evaluate(c => { const x = document.querySelector('[data-pa="' + c + '"]'); if (x) x.click(); }, choice); await p.waitForTimeout(2500);
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(4500);
    console.log(choice + ': Frage', shown ? 'da' : 'fehlt', '| Anmeldung:', calls.join(',') || '–', '| nach Neuladen nochmal:', await p.$$eval('.pask', e => e.length) ? 'ja' : 'nein');
    await ctx.close();
  };
  await run('on'); await run('no');
  /* Erster Start: erst die Einführung, danach die Frage */
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript(() => { let perm = 'default'; Object.defineProperty(Notification, 'permission', { get: () => perm }); PushManager.prototype.getSubscription = async () => null; { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); const r = new Date(d); r.setDate(r.getDate() + 6); r.setHours(19); if (new Date() < r) d.setDate(d.getDate() - 7); const z = n => (n < 10 ? '0' : '') + n; localStorage.setItem('kl-mvp-seen', JSON.stringify(d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()))); } });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(3500);
  const during = await p.$$eval('.pask', e => e.length);
  await p.evaluate(() => document.querySelector('[data-tr="skip"]').click()); await p.waitForTimeout(1800);
  console.log('Erststart: während Einführung', during ? 'ja' : 'nein', '| danach', await p.$$eval('.pask', e => e.length) ? 'ja' : 'nein');
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
