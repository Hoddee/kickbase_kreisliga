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

/* ---------- Daten aus der Datenbank prüfen ----------
   Jeder darf Spiele speichern (gewollt). Damit ein präparierter Eintrag keinen Code in die Seite schleust,
   werden Zahlen hier zu echten Zahlen, IDs müssen ein gültiges Format haben – Texte escapt die Anzeige (esc). */
export const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : d; };
export const str = (v, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const okId = v => (typeof v === 'string' && ID_RE.test(v) ? v : null);
export const okFoto = v => (typeof v === 'string' && /^gast\/[a-f0-9]{24}\.(png|webp)$/.test(v) ? v : null);
const POS = ['TW', 'ABW', 'MIT', 'ANG'];
function cleanGame(g) {
  if (!g || !okId(g.uid) || !okId(g.player) || !okId(g.opp) || isNaN(new Date(g.played_at))) return null;
  return Object.assign(g, {
    points: num(g.points), us: num(g.us), them: num(g.them), minutes: num(g.minutes), goals: num(g.goals), assists: num(g.assists),
    pos: POS.includes(g.pos) ? g.pos : 'MIT', team: okId(g.team), home: !!g.home, manual: !!g.manual,
    player_foto: okFoto(g.player_foto), opp_foto: okFoto(g.opp_foto), erfasst_von: str(g.erfasst_von, 40) || null, season: str(g.season, 20)
  });
}
const cleanEvents = ev => (Array.isArray(ev) ? ev : []).filter(e => e && typeof e === 'object')
  .map(e => Object.assign({}, e, { k: str(e.k, 24), l: str(e.l), p: num(e.p), t: num(e.t, -1), o: e.o === 'out' ? 'out' : e.o === 'in' ? 'in' : undefined }));

/* ---------- Spiele ---------- */
const LIST_FIELDS = 'uid,created_at,played_at,season,player,opp,home,pos,us,them,minutes,points,goals,assists,manual,team,player_foto,opp_foto';
/* „erfasst_von“ kommt mit Migration 011 – bis sie ausgeführt ist, ohne die Spalte weiterarbeiten */
let byCol = true;
const noByCol = e => /erfasst_von/.test(e && e.message || '');

export const games = { list: null, busy: false, error: false, failedAt: 0 };
const gameListeners = new Set();
export const onGamesChange = fn => gameListeners.add(fn);

export async function loadGames(force = false) {
  if (games.busy || (games.list && !force)) return games.list;
  /* Nach einem Fehler höchstens alle 20 Sekunden neu versuchen (verhindert Endlosschleifen beim Neuzeichnen) */
  if (!force && games.error && Date.now() - games.failedAt < 20000) return games.list;
  games.busy = true; games.error = false;
  try {
    let r;
    try { r = await rest('spiele?select=' + LIST_FIELDS + (byCol ? ',erfasst_von' : '') + '&order=played_at.desc&limit=2000'); }
    catch (e) { if (!byCol || !noByCol(e)) throw e; byCol = false; r = await rest('spiele?select=' + LIST_FIELDS + '&order=played_at.desc&limit=2000'); }
    const d = await r.json();
    /* Live gebuchte Spiele ohne Einsatzminuten (nur auf der Bank) zählen nirgends mit.
       Nachträge hat jemand bewusst eingetragen – die bleiben immer. */
    games.list = (Array.isArray(d) ? d : []).map(cleanGame).filter(g => g && PL[g.player] && CL[g.opp] && (g.minutes > 0 || g.manual));
    playerEventCache.clear();
    for (const g of games.list.slice().reverse()) applyMedia(g.player, g.opp, g.player_foto, g.opp_foto);
  } catch (e) { games.error = true; games.failedAt = Date.now(); }
  games.busy = false;
  gameListeners.forEach(fn => fn());
  return games.list;
}

export async function insertGame(row) {
  const post = r => rest('spiele', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, json), body: JSON.stringify(r) });
  try {
    try { await post(row); }
    catch (e) { if (!('erfasst_von' in row) || !noByCol(e)) throw e; byCol = false; const r = Object.assign({}, row); delete r.erfasst_von; await post(r); }
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
  const ev = cleanEvents(d[0] && d[0].events);
  eventCache.set(uid, ev);
  return ev;
}
export const cachedEvents = uid => eventCache.get(uid);
/* Aktionen aller Spiele auf einmal (für die Detail-Statistiken) – klein (~7 KB bei 30 Spielen), einmal pro Sitzung */
let allEventsP = null;
export function loadAllEvents() {
  if (!allEventsP) allEventsP = rest('spiele?select=uid,events&limit=2000').then(r => r.json()).then(d => {
    for (const x of Array.isArray(d) ? d : []) if (x && okId(x.uid)) eventCache.set(x.uid, cleanEvents(x.events));
    return true;
  }).catch(e => { allEventsP = null; throw e; });
  return allEventsP;
}
export const rememberEvents = (uid, ev) => { forgetEvents(uid); eventCache.set(uid, ev); };
export const forgetEvents = uid => { playerEventCache.clear(); return uid ? eventCache.delete(uid) : eventCache.clear(); };

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
/* Dateiendung passend zum Bildformat (WebP, wo der Browser es erzeugen kann, sonst PNG) */
const ext = blob => (blob.type === 'image/webp' ? '.webp' : '.png');
async function upload(path, blob, upsert) {
  /* Lange Cache-Dauer: jedes Bild wird pro Gerät nur einmal geladen */
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': blob.type || 'image/png', 'x-upsert': upsert ? 'true' : 'false', 'cache-control': 'max-age=31536000' };
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
/* Jedes Foto bekommt einen eigenen Namen und wird neu angelegt.
   „Überschreiben“ (x-upsert) verlangt im Storage zusätzliche Rechte und schlug deshalb fehl. */
export async function uploadPhoto(id, blob) {
  if (!(await accessToken())) throw new Error('Nicht angemeldet. Bitte neu anmelden.');
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return upload('spieler/' + id + '-' + stamp + ext(blob), blob, false);
}
/* Bild für Gastspieler / eigenen Gegner (darf jeder hochladen, nur neue Dateien) */
export function uploadGuestImage(blob) {
  const rnd = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
  return upload('gast/' + rnd + ext(blob), blob, false);
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

/* Aktionen aller Spiele eines Spielers (für Startelf-, Karten- und Elfmeter-Zähler im Profil) */
const playerEventCache = new Map();
export async function loadPlayerEvents(id) {
  if (playerEventCache.has(id)) return playerEventCache.get(id);
  const r = await rest('spiele?select=uid,events&player=eq.' + encodeURIComponent(id));
  const d = await r.json();
  const map = new Map((Array.isArray(d) ? d : []).filter(x => x && okId(x.uid)).map(x => [x.uid, cleanEvents(x.events)]));
  for (const [uid, ev] of map) eventCache.set(uid, ev);
  playerEventCache.set(id, map);
  return map;
}
export const forgetPlayerEvents = () => playerEventCache.clear();
