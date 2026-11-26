/* Absicherung des laufenden Spiels gegen verlorenen Handy-Speicher (iOS-Home-Bildschirm-Apps nach dem Wegwischen).
   Drei Stellen: localStorage (wie bisher), IndexedDB (js/core/vault.js) und die Tabelle spiel_sicherung in Supabase
   (eine Zeile pro Gerät, Geräteschlüssel wie bei live_spiele, Migration 014). Jeder Stand trägt eine laufende Nummer (rev).
   Beim Start: IndexedDB neuer als localStorage → still übernehmen. Läuft danach kein Spiel, aber in Supabase liegt eine
   frische Sicherung (< 8 Std.) → fragen. Außerdem merkt sich die App die letzten Starts (Diagnose im Admin-Bereich). */
import { KEYS } from '../config.js';
import { readJson, writeJson } from '../core/util.js';
import { store, normalizeGame, replaceGame, isRunning, applyMatchNames } from '../core/game.js';
import { vaultGet, vaultSet } from '../core/vault.js';
import { rest } from './api.js';
import { deviceKey } from './live.js';

const MAX_AGE = 8 * 3600e3, EVERY = 5000;
const info = s => (!s ? 'leer' : !s.match ? 'kein Spiel' : (s.squad ? s.squad.length : 1) + ' Sp. · #' + (s.rev || 0) + (s.ended ? ' · beendet' : ''));
const parse = j => { try { return normalizeGame(typeof j === 'string' ? JSON.parse(j) : j); } catch (e) { return null; } };

/* ---------- Diagnose: die letzten Starts ---------- */
async function logStart(entry) {
  const next = [entry].concat(await startLog()).slice(0, 15);
  writeJson(KEYS.diag, next); vaultSet('diag', JSON.stringify(next));
}
/* Liste aus beiden Speichern – die längere gewinnt (falls einer verloren ging) */
export async function startLog() {
  const a = readJson(KEYS.diag, null), b = await vaultGet('diag').then(j => { try { return JSON.parse(j); } catch (e) { return null; } });
  return (Array.isArray(b) && (!Array.isArray(a) || b.length >= a.length) ? b : Array.isArray(a) ? a : []);
}

/* ---------- Supabase ---------- */
async function cloudGet() {
  const key = await deviceKey();
  const r = await rest('spiel_sicherung?select=data,updated_at&key_hash=eq.' + key.hash, { headers: { 'x-live-key': key.k } });
  const rows = await r.json();
  const row = rows && rows[0];
  if (!row || Date.now() - new Date(row.updated_at).getTime() > MAX_AGE) return null;
  return parse(row.data);
}
export async function cloudDrop() {
  try { const key = await deviceKey(); await rest('spiel_sicherung?key_hash=eq.' + key.hash, { method: 'DELETE', headers: { 'x-live-key': key.k } }); } catch (e) {}
  sentRev = -1; writeJson(KEYS.backupOn, false);
}

/* ---------- Beim Start ---------- */
/* onRestored(): Ansicht neu zeichnen. offer(state, accept, discard): Blatt „Laufendes Spiel gefunden“ zeigen */
export async function restoreOnStart({ onRestored, offer }) {
  const local = store.S.remote ? null : store.S;
  const entry = { t: Date.now(), ls: info(local && local.events ? local : null), idb: '–', cloud: '–', act: '' };
  const vault = parse(await vaultGet('game'));
  entry.idb = info(vault);
  if (vault && isRunning(vault) && (vault.rev || 0) > ((store.S.remote ? 0 : store.S.rev) || 0) && !store.S.remote) {
    replaceGame(vault); applyMatchNames(); entry.act = 'aus IndexedDB'; onRestored('idb');
  }
  if (!isRunning(store.S) && !store.S.remote && navigator.onLine !== false) {
    try {
      const cloud = await cloudGet();
      entry.cloud = info(cloud);
      if (cloud && isRunning(cloud) && (cloud.rev || 0) > (store.S.rev || 0) && !isRunning(store.S)) {
        entry.act = 'Sicherung angeboten';
        offer(cloud, () => { replaceGame(cloud); applyMatchNames(); onRestored('cloud'); }, () => cloudDrop());
      }
    } catch (e) { entry.cloud = e.status === 404 ? 'Tabelle fehlt' : 'nicht erreichbar'; }
  }
  logStart(entry);
}

/* ---------- Laufend sichern ---------- */
let sentRev = -1, busy = false, pause = 0;
async function push(force) {
  const S = store.S;
  if (busy || S.remote || !navigator.onLine || (!force && Date.now() < pause)) return;
  const run = isRunning(S);
  if (run && S.rev === sentRev) return;
  if (!run) { if (readJson(KEYS.backupOn, false)) { busy = true; await cloudDrop(); busy = false; } return; }
  busy = true;
  try {
    const key = await deviceKey();
    await rest('spiel_sicherung?on_conflict=key_hash', {
      method: 'POST', body: JSON.stringify({ key_hash: key.hash, data: S }),
      headers: { 'x-live-key': key.k, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
    });
    sentRev = S.rev; writeJson(KEYS.backupOn, true);
  } catch (e) { pause = Date.now() + 30000; }
  finally { busy = false; }
}
export function startBackup() {
  setInterval(() => push(), EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(true); });
  window.addEventListener('online', () => push(true));
}
