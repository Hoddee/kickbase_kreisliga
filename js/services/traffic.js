/* Geschätzter Supabase-Traffic dieses Geräts (Datenbank-Abfragen und Live-Nachrichten).
   Antworten ohne Größenangabe werden mit Faktor 0,3 geschätzt (gzip). Einmal pro Tag-Summe melden,
   höchstens alle 10 Minuten und beim Verlassen der App. Admins sehen die Summe aller Geräte im Admin-Bereich. */
import { SUPABASE_URL, SUPABASE_KEY, KEYS } from '../config.js';
import { readJson, writeJson, pad2 } from '../core/util.js';

const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
let st = readJson(KEYS.traffic, null);
if (!st || st.tag !== today()) st = { tag: today(), bytes: 0, sent: 0, id: (st && st.id) || null };
if (!st.id) { const b = new Uint8Array(12); crypto.getRandomValues(b); st.id = [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
const save = () => writeJson(KEYS.traffic, st);

export function countBytes(n) {
  if (!(n > 0)) return;
  if (st.tag !== today()) { st = { tag: today(), bytes: 0, sent: 0, id: st.id }; }
  st.bytes += Math.round(n); save();
}
/* Antwort einer REST-Anfrage zählen (ohne den Inhalt für den Aufrufer zu verbrauchen) */
export function countResponse(r) {
  const cl = +r.headers.get('content-length');
  if (cl) { countBytes(cl + 300); return; }
  try { r.clone().arrayBuffer().then(b => countBytes(b.byteLength * 0.3 + 300), () => {}); } catch (e) {}
}

let lastSend = 0;
async function report(force) {
  if (!st.bytes || st.bytes === st.sent || !navigator.onLine) return;
  if (!force && Date.now() - lastSend < 600000) return;
  lastSend = Date.now();
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/traffic_melden', { method: 'POST', keepalive: true,
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_tag: st.tag, p_geraet: st.id, p_bytes: st.bytes }) });
    if (r.ok || r.status === 204) { st.sent = st.bytes; save(); }
  } catch (e) {}
}
export function startTraffic() {
  setInterval(() => report(false), 120000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') report(true); });
}
