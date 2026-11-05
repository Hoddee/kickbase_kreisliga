/* Zugriff auf die Supabase-REST-Schnittstelle (Tabellen "spiele" und "kader") */
import { SUPABASE_URL, SUPABASE_KEY, KEYS } from '../config.js';
import { accessToken } from './auth.js';
import { PL, PLAYER_LIST, addPlayer } from '../data/players.js';
import { CL } from '../data/clubs.js';
import { applyMedia } from '../core/game.js';
import { applySchedule } from '../data/schedule.js';
import { readJson, writeJson } from '../core/util.js';

export async function rest(path, opt = {}) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
  const headers = Object.assign({ apikey: SUPABASE_KEY }, opt.headers || {});
  const token = await accessToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, Object.assign({}, opt, { headers, signal: ctl.signal }));
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      const e = new Error(body.message || 'HTTP ' + r.status); e.status = r.status; throw e;
    }
    return r;
  } finally { clearTimeout(timer); }
}
const json = { 'Content-Type': 'application/json' };

/* ---------- Spiele ---------- */
const LIST_FIELDS = 'uid,created_at,played_at,season,player,opp,home,pos,us,them,minutes,points,goals,assists,manual,team,player_foto,opp_foto';

export const games = { list: null, busy: false, error: false };
const gameListeners = new Set();
export const onGamesChange = fn => gameListeners.add(fn);

export async function loadGames(force = false) {
  if (games.busy || (games.list && !force)) return games.list;
  games.busy = true; games.error = false;
  try {
    const r = await rest('spiele?select=' + LIST_FIELDS + '&order=played_at.desc&limit=2000');
    const d = await r.json();
    games.list = (Array.isArray(d) ? d : []).filter(g => PL[g.player] && CL[g.opp]);
    for (const g of games.list.slice().reverse()) applyMedia(g.player, g.opp, g.player_foto, g.opp_foto);
  } catch (e) { games.error = true; }
  games.busy = false;
  gameListeners.forEach(fn => fn());
  return games.list;
}

export async function insertGame(row) {
  try {
    await rest('spiele', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, json), body: JSON.stringify(row) });
  } catch (e) {
    if (e.status !== 409) throw e; // 409 = schon gespeichert (z. B. doppelter Tipp)
  }
}
export async function updateGame(uid, patch) {
  patch.updated_at = new Date().toISOString();
  const r = await rest('spiele?uid=eq.' + encodeURIComponent(uid), { method: 'PATCH', headers: Object.assign({ Prefer: 'return=representation' }, json), body: JSON.stringify(patch) });
  const d = await r.json();
  if (!d.length) throw new Error('Keine Berechtigung.');
  return d[0];
}
export async function deleteGame(uid) {
  const r = await rest('spiele?uid=eq.' + encodeURIComponent(uid), { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const d = await r.json();
  if (!d.length) throw new Error('Keine Berechtigung.');
}

const eventCache = new Map();
export async function loadEvents(uid) {
  if (eventCache.has(uid)) return eventCache.get(uid);
  const r = await rest('spiele?select=events&uid=eq.' + encodeURIComponent(uid));
  const d = await r.json();
  const ev = d[0] && Array.isArray(d[0].events) ? d[0].events : [];
  eventCache.set(uid, ev);
  return ev;
}
export const cachedEvents = uid => eventCache.get(uid);
export const forgetEvents = uid => (uid ? eventCache.delete(uid) : eventCache.clear());

/* ---------- Kader ---------- */
function applyRoster(rows) {
  for (const r of rows) {
    if (!CL[r.verein]) continue;
    const p = PL[r.id] || addPlayer({ id: r.id });
    Object.assign(p, {
      vn: r.vorname, n: r.nachname, c: r.verein, pos: r.pos, mw: Number(r.mw_start), exact: r.mw_exakt, status: r.status,
      info: r.status_info || '', active: r.aktiv, sort: r.sort, foto: r.foto, fotoV: r.foto ? Date.parse(r.updated_at) || 0 : 0
    });
  }
  PLAYER_LIST.sort((a, b) => (a.sort || 0) - (b.sort || 0));
}
const cached = readJson(KEYS.roster, null);
if (Array.isArray(cached)) applyRoster(cached);

export async function loadRoster() {
  try {
    const r = await rest('kader?select=*&order=sort');
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length) { applyRoster(rows); writeJson(KEYS.roster, rows); }
    return true;
  } catch (e) { return false; }
}
/* Neuer Stammspieler (nur Admin) */
export async function insertPlayer(row) {
  row.updated_at = new Date().toISOString();
  const r = await rest('kader', { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, json), body: JSON.stringify(row) });
  const d = await r.json();
  applyRoster(d);
  writeJson(KEYS.roster, readJson(KEYS.roster, []).concat(d));
  return d[0];
}
async function upload(path, blob, upsert) {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'image/png', 'x-upsert': upsert ? 'true' : 'false' };
  const token = await accessToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(SUPABASE_URL + '/storage/v1/object/kickbase/' + path, { method: 'POST', headers, body: blob, signal: ctl.signal });
    if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || b.error || 'Upload fehlgeschlagen'); }
    return path;
  } catch (e) {
    throw e.name === 'AbortError' ? new Error('Upload hat zu lange gedauert.') : e;
  } finally { clearTimeout(timer); }
}
/* Spielerfoto in den Bucket laden (nur Admin); liefert den Pfad im Bucket */
export async function uploadPhoto(id, blob) {
  if (!(await accessToken())) throw new Error('Nicht angemeldet.');
  return upload('spieler/' + id + '.png', blob, true);
}
/* Bild für Gastspieler / eigenen Gegner (darf jeder hochladen, nur neue Dateien) */
export function uploadGuestImage(blob) {
  const rnd = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
  return upload('gast/' + rnd + '.png', blob, false);
}

export async function updatePlayer(id, patch) {
  patch.updated_at = new Date().toISOString();
  const r = await rest('kader?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: Object.assign({ Prefer: 'return=representation' }, json), body: JSON.stringify(patch) });
  const d = await r.json();
  if (!d.length) throw new Error('Keine Berechtigung.');
  applyRoster(d);
  const all = readJson(KEYS.roster, []);
  writeJson(KEYS.roster, all.map(x => (x.id === id ? d[0] : x)));
  return d[0];
}

/* ---------- Spielerkonten (Admin) ---------- */
export async function loadAccounts() {
  const r = await rest('spieler_konten?select=*&order=created_at.desc');
  return r.json();
}
export async function decideAccount(userId, status) {
  const r = await rest('spieler_konten?user_id=eq.' + encodeURIComponent(userId), {
    method: 'PATCH', headers: Object.assign({ Prefer: 'return=representation' }, json),
    body: JSON.stringify({ status, entschieden_at: new Date().toISOString() })
  });
  const d = await r.json();
  if (!d.length) throw new Error('Keine Berechtigung.');
  return d[0];
}

/* ---------- Spielplan ---------- */
const cachedPlan = readJson(KEYS.schedule, null);
if (Array.isArray(cachedPlan) && cachedPlan.length) applySchedule(cachedPlan);
let planRows = Array.isArray(cachedPlan) ? cachedPlan : null;
export async function loadSchedule() {
  try {
    const r = await rest('spielplan?select=id,team,anstoss,gegner,heim&order=anstoss&limit=1000');
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length) { planRows = rows; applySchedule(rows); writeJson(KEYS.schedule, rows); }
    return true;
  } catch (e) { return false; }
}
function storePlan() { applySchedule(planRows || []); writeJson(KEYS.schedule, planRows || []); }
export async function saveFixture(row, id = null) {
  row.updated_at = new Date().toISOString();
  const r = await rest(id ? 'spielplan?id=eq.' + id : 'spielplan', {
    method: id ? 'PATCH' : 'POST', headers: Object.assign({ Prefer: 'return=representation' }, json), body: JSON.stringify(row)
  });
  const d = await r.json();
  if (!d.length) throw new Error('Keine Berechtigung.');
  planRows = (planRows || []).filter(x => x.id !== d[0].id).concat(d);
  storePlan();
  return d[0];
}
export async function deleteFixture(id) {
  const r = await rest('spielplan?id=eq.' + id, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const d = await r.json();
  if (!d.length) throw new Error('Keine Berechtigung.');
  planRows = (planRows || []).filter(x => x.id !== id);
  storePlan();
}
