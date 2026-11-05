/* Zugriff auf die Supabase-REST-Schnittstelle (Tabellen "spiele" und "kader") */
import { SUPABASE_URL, SUPABASE_KEY, KEYS } from '../config.js';
import { accessToken } from './auth.js';
import { PL, PLAYER_LIST } from '../data/players.js';
import { CL } from '../data/clubs.js';
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
const LIST_FIELDS = 'uid,created_at,played_at,season,player,opp,home,pos,us,them,minutes,points,goals,assists,manual';

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
    const p = PL[r.id];
    if (!p) continue;
    Object.assign(p, { vn: r.vorname, n: r.nachname, pos: r.pos, mw: Number(r.mw_start), exact: r.mw_exakt, status: r.status, info: r.status_info || '', active: r.aktiv, sort: r.sort });
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
