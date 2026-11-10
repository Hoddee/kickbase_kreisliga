/* Live verfolgen.
   Senden: Das Handy, das gerade Punkte vergibt, schreibt alle 2 Sekunden (nur bei Änderungen) den Stand
   jedes Spielers in die Tabelle live_spiele. Gespeicherte oder verworfene Spiele werden dort gelöscht.
   Empfangen: Alle anderen holen die Liste einmal und bekommen Änderungen danach sofort über Supabase Realtime
   (WebSocket). Fällt die Verbindung weg, wird nachgeladen, bis sie wieder steht. */
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { rest } from './api.js';
import { PL } from '../data/players.js';
import {
  store, eachPlayer, isMulti, started, elapsed, total, score, isHome, teamOf, endLines, startLine, withMarkers
} from '../core/game.js';

const KEY_LS = 'kl-live-key', PUB_LS = 'kl-live-pub';
const MAX_AGE = 8 * 3600e3;

/* ---------- Gerät: geheimer Schreibschlüssel ---------- */
let keyCache = null;
async function deviceKey() {
  if (keyCache) return keyCache;
  let k = null;
  try { k = localStorage.getItem(KEY_LS); } catch (e) {}
  if (!k || k.length < 32) {
    const b = new Uint8Array(24); crypto.getRandomValues(b);
    k = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(KEY_LS, k); } catch (e) {}
  }
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k));
  keyCache = { k, hash: [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('') };
  return keyCache;
}
const readPub = () => { try { return JSON.parse(localStorage.getItem(PUB_LS) || '{}'); } catch (e) { return {}; } };
const writePub = v => { try { localStorage.setItem(PUB_LS, JSON.stringify(v)); } catch (e) {} };
/* Eigene Live-Spiele (die zeigt die Startseite nicht doppelt an) */
export const ownLive = uid => uid in readPub();

/* ---------- Senden ---------- */
function rows() {
  const out = endLines().map(l => ({ p: l.p, l: l.l, r: l.r, id: 'e' + l.l }));
  for (const it of withMarkers(store.S.events.slice().reverse())) {
    if (it.ht) out.push({ ht: 1 });
    else if (it.sub) out.push({ sub: { o: it.sub.o, t: it.sub.t } });
    else out.push({ p: it.e.pts, l: it.e.label, r: it.e.t >= 0 ? (Math.floor(it.e.t / 60) + 1) + '’' : '', id: it.e.id });
  }
  const s = startLine(); if (s) out.push({ p: s.p, l: s.l, r: s.r, id: 's' });
  return out;
}

/* Stand aller Spieler, die gerade live sind: uid → Daten */
function snapshots() {
  const S = store.S, out = {};
  if (!S.match || S.manual || !started()) return out;
  const gid = isMulti() ? S.squad[0].uid : S.uid, n = isMulti() ? S.squad.length : 1;
  const clock = { el: Math.floor(elapsed()), run: !!S.clock.startedAt, at: Date.now() };
  eachPlayer(i => {
    const P = store.S;
    if (P.saved || !P.uid) return;
    const id = P.match.p, pl = PL[id] || {}, sc = score();
    out[P.uid] = {
      v: 1, gid, i, n, p: id, nm: pl.n || id, vn: pl.vn || '', pf: P.match.pf || null, of: P.match.of || null,
      pos: P.pos, team: teamOf(P.match), opp: P.match.o, home: isHome(), us: sc.us, them: sc.them,
      t: total(), ended: !!S.ended, h2: !!S.h2, clock, rows: rows()
    };
  });
  return out;
}

const sent = new Map();
let pubBusy = false, pauseUntil = 0;
async function publish(force) {
  if (pubBusy || !navigator.onLine || (!force && Date.now() < pauseUntil)) return;
  pubBusy = true;
  try {
    const want = snapshots(), pub = readPub(), key = await deviceKey();
    const headers = { 'x-live-key': key.k, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
    for (const [uid, data] of Object.entries(want)) {
      /* Uhr-Zeitpunkt nicht vergleichen, sonst würde jede Sekunde gesendet */
      const sig = JSON.stringify(Object.assign({}, data, { clock: { run: data.clock.run, el: data.clock.run ? 0 : data.clock.el } }));
      if (sent.get(uid) === sig && pub[uid]) continue;
      await rest('live_spiele?on_conflict=uid', { method: 'POST', headers, body: JSON.stringify({ uid, key_hash: key.hash, data }) });
      sent.set(uid, sig); pub[uid] = 1; writePub(pub);
    }
    for (const uid of Object.keys(pub)) {
      if (want[uid]) continue;
      await rest('live_spiele?uid=eq.' + encodeURIComponent(uid), { method: 'DELETE', headers: { 'x-live-key': key.k } });
      delete pub[uid]; sent.delete(uid); writePub(pub);
    }
  } catch (e) { /* offline oder Tabelle fehlt noch: 30 Sekunden warten, dann wieder versuchen */ pauseUntil = Date.now() + 30000; }
  finally { pubBusy = false; }
}
export function startPublisher() {
  setInterval(() => publish(), 2000);
  window.addEventListener('online', () => publish(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') publish(true); });
}
/* Nach dem Speichern sofort aufräumen statt bis zu 2 Sekunden zu warten */
export const publishNow = () => publish(true);

/* ---------- Empfangen ---------- */
export const live = { map: new Map(), ready: false };
const listeners = new Set();
export const onLive = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (ev) => { for (const fn of listeners) try { fn(ev); } catch (e) {} };

const fresh = r => r && r.data && r.data.v === 1 && Date.now() - new Date(r.updated_at || Date.now()).getTime() < MAX_AGE;
function apply(r) { if (fresh(r)) live.map.set(r.uid, { data: r.data, at: Date.now() }); }

async function loadAll() {
  try {
    const since = new Date(Date.now() - MAX_AGE).toISOString();
    const r = await rest('live_spiele?select=uid,data,updated_at&updated_at=gt.' + encodeURIComponent(since));
    const list = await r.json();
    live.map.clear();
    for (const x of list) apply(x);
    live.ready = true;
    emit({ type: 'all' });
  } catch (e) {}
}

/* Supabase Realtime (Phoenix-Protokoll) ohne Zusatzbibliothek */
let ws = null, hb = null, retry = 0, poll = null, ref = 0;
const send = (topic, event, payload) => { try { ws.send(JSON.stringify({ topic, event, payload, ref: String(++ref) })); } catch (e) {} };
function connect() {
  if (ws || document.visibilityState === 'hidden') return;
  const url = SUPABASE_URL.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(SUPABASE_KEY) + '&vsn=1.0.0';
  try { ws = new WebSocket(url); } catch (e) { ws = null; return schedule(); }
  ws.onopen = () => {
    retry = 0;
    send('realtime:kl-live', 'phx_join', { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'live_spiele' }] } });
    hb = setInterval(() => send('phoenix', 'heartbeat', {}), 25000);
    loadAll();
  };
  ws.onmessage = m => {
    let msg; try { msg = JSON.parse(m.data); } catch (e) { return; }
    if (msg.event !== 'postgres_changes' || !msg.payload || !msg.payload.data) return;
    const d = msg.payload.data;
    if (d.type === 'DELETE') {
      const uid = d.old_record && d.old_record.uid;
      if (uid && live.map.has(uid)) { const last = live.map.get(uid); live.map.delete(uid); emit({ type: 'end', uid, last }); }
    } else if (d.record) { apply(d.record); emit({ type: 'up', uid: d.record.uid }); }
  };
  ws.onclose = () => { clearInterval(hb); ws = null; schedule(); };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
}
function schedule() {
  if (document.visibilityState === 'hidden') return;
  retry = Math.min(retry + 1, 6);
  setTimeout(connect, 1000 * 2 ** retry);
}
export function startViewer() {
  loadAll();
  connect();
  /* Sicherheitsnetz: ohne offene Verbindung alle 20 Sekunden nachladen */
  poll = setInterval(() => { if (!ws || ws.readyState !== 1) loadAll(); }, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { loadAll(); connect(); }
    else if (ws) { try { ws.close(); } catch (e) {} }
  });
}

/* Spielminute beim Zuschauer: aus dem gesendeten Stand weiterzählen */
export function liveSeconds(d) {
  const c = d.clock || {};
  return Math.max(0, (c.el || 0) + (c.run && !d.ended ? (Date.now() - (c.at || Date.now())) / 1000 : 0));
}
export function liveStatus(d) {
  if (d.ended) return 'Abpfiff';
  const sec = liveSeconds(d), m = Math.floor(sec / 60) + 1;
  if (!d.clock || !d.clock.run) return sec > 0 ? 'Pause · ' + m + '’' : 'Gleich geht’s los';
  return m + '’';
}
