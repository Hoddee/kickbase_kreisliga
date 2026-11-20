// Edge Function „push“: verschickt Web-Push an alle Abos.
//  - type "live": Anpfiff (vom Trigger auf live_spiele) → „Silas Klenk ist live“ bzw. „3 Spieler von VfR Murrhardt sind live“, darunter „Live verfolgen 🔻“
//  - type "mvp":  Montag 19 Uhr (Cron) → „14. Spieltag: Die MVP-Stage ist live“ (nur ab 3 Spielern)
// Secrets: PUSH_SECRET, VAPID_PUBLIC, VAPID_PRIVATE (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY gibt es automatisch).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const APP = 'https://hoddee.github.io/kickbase_kreisliga/';
const ANCHOR = { ws: '2026-11-09', n: 13 }; // wie in js/ui/mvp.js
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(APP, Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);

/* Uhrzeit in Berlin */
function berlin(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hour12: false })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, wd: p.weekday };
}
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const mondayOf = (s: string) => { const t = new Date(s + 'T00:00:00Z'); return addDays(s, -((t.getUTCDay() + 6) % 7)); };

/* Nur einmal: Schlüssel eintragen, bei Konflikt schon verschickt */
async function once(key: string) {
  const { error } = await db.from('push_log').insert({ schluessel: key });
  return !error;
}
async function sendAll(msg: { title: string; body: string; url: string; tag: string }) {
  const { data: subs } = await db.from('push_abos').select('endpoint,p256dh,auth');
  let ok = 0;
  await Promise.all((subs || []).map(async s => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 3600 }); ok++; }
    catch (e: any) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.from('push_abos').delete().eq('endpoint', s.endpoint); }
  }));
  return ok;
}

async function live(d: Record<string, unknown>) {
  const gid = String(d.gid || '');
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(gid) || !(await once('live:' + gid))) return 0;
  const n = Number(d.n) || 1, name = [d.vn, d.nm].filter(Boolean).join(' ').slice(0, 40), team = String(d.tn || '').slice(0, 40);
  const title = n > 1 ? n + ' Spieler von ' + (team || 'unserem Team') + ' sind live' : (name || 'Ein Spieler') + ' ist live';
  const body = 'Live verfolgen 🔻';
  return sendAll({ title, body, url: APP + '?live=' + encodeURIComponent(gid), tag: 'live-' + gid });
}

async function mvp() {
  const b = berlin();
  if (b.wd !== 'Mon' || b.h !== 19) return 0;
  const thisMon = iso(b.y, b.m, b.d), ws = addDays(thisMon, -7);
  /* Einen Tag Puffer abfragen, dann nach Berliner Datum filtern (Sommer-/Winterzeit) */
  const { data: rows } = await db.from('spiele').select('player,played_at').gte('played_at', addDays(ws, -1)).lt('played_at', addDays(thisMon, 1));
  const games = (rows || []).filter(g => { const x = berlin(new Date(g.played_at)), d = iso(x.y, x.m, x.d); return d >= ws && d < thisMon; });
  if (new Set(games.map(g => g.player)).size < 3 || !(await once('mvp:' + ws))) return 0;
  /* Spieltag-Nummer wie in der App: Anker + Wochen mit Spielen im Spielplan */
  let no: number | null = null;
  if (ws <= ANCHOR.ws) no = ANCHOR.n - Math.round((Date.parse(ANCHOR.ws) - Date.parse(ws)) / 6048e5);
  else {
    const { data: plan } = await db.from('spielplan').select('anstoss');
    const weeks = new Set((plan || []).map(p => mondayOf(String(p.anstoss).slice(0, 10))));
    if (weeks.has(ws)) no = ANCHOR.n + [...weeks].filter(w => w > ANCHOR.ws && w <= ws).length;
  }
  return sendAll({ title: (no ? no + '. Spieltag' : 'Spieltag') + ': Die MVP-Stage ist live', body: 'Die Top 3 der Woche', url: APP, tag: 'mvp-' + ws });
}

Deno.serve(async req => {
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_SECRET')) return new Response('nein', { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sent = body.type === 'live' ? await live(body.data || {}) : body.type === 'mvp' ? await mvp() : 0;
  return Response.json({ sent });
});
