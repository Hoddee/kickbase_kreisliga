/* Spielzustand (lokal gespeichert) und die komplette Punkteberechnung.
   Ein Spiel läuft immer nur auf dem Gerät, auf dem es gebucht wird. */
import { KEYS } from '../config.js';
import { GROUPS, CLEAN_SHEET, GOAL_KEYS, ASSIST_KEYS } from '../data/actions.js';
import { PL, POS_NAME } from '../data/players.js';
import { CL } from '../data/clubs.js';
import { minStamp } from './util.js';

/* ---------- Zustand ---------- */
export function freshGame(keep = {}) {
  return {
    pos: keep.pos || 'ABW', match: keep.match || null, startelf: true, stints: [{ from: 0, to: null }],
    clock: { offset: 0, startedAt: null }, ended: false, events: [], nextId: 1, subs: []
  };
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(KEYS.game) || 'null');
    if (s && s.events && s.clock && s.stints) {
      if (!POS_NAME[s.pos]) s.pos = 'ABW';
      if (!s.match || !PL[s.match.p] || !CL[s.match.o]) s.match = null;
      else applyMedia(s.match.p, s.match.o, s.match.pf, s.match.of);
      s.subs = s.subs || [];
      return s;
    }
  } catch (e) {}
  return null;
}
export const store = { S: loadGame() || freshGame() };
export function saveGame() { try { localStorage.setItem(KEYS.game, JSON.stringify(store.S)); } catch (e) {} }
export function replaceGame(next) { store.S = next; saveGame(); }

/* Eigene Bilder von Gastspielern / eigenen Gegnern an die (temporären) Einträge hängen */
export function applyMedia(p, o, pf, of) {
  if (pf && PL[p] && PL[p].guest) PL[p].foto = pf;
  if (of && CL[o] && CL[o].custom) CL[o].f = of;
}
/* Eigene Mannschaft: im Spiel gespeichert (z. B. B5-Einsatz), sonst der Verein des Spielers */
export const teamOf = m => (m && m.team && CL[m.team] ? m.team : PL[m.p].c);
export const recordTeam = g => (g.team && CL[g.team] ? g.team : PL[g.player].c);

/* Anzeigenamen des laufenden Spiels */
export const names = { player: '', team: '', opp: '' };
export function applyMatchNames() {
  const m = store.S.match;
  if (!m || !PL[m.p] || !CL[m.o]) return;
  names.player = PL[m.p].n; names.team = CL[teamOf(m)].n; names.opp = CL[m.o].n;
  document.title = names.player + ' – Kreisliga Edition';
}
export const isHome = () => !!(store.S.match && store.S.match.home);
export const scoreText = (sc, home) => (home ? sc.us + ' : ' + sc.them : sc.them + ' : ' + sc.us);

/* ---------- Aktionskatalog ---------- */
export const ACT = {
  tg: { get l() { return 'Tor ' + names.team; }, s: 'Team-Tor', side: 'us', v: () => (onField() ? 5 : 0) },
  cg: { get l() { return 'Tor ' + names.opp; }, s: 'Gegentor', side: 'them', v: () => (onField() ? -5 : 0) }
};
export const CAT = { tg: 'Einsatz & Team', cg: 'Einsatz & Team' };
for (const k of ['att', 'def', 'err']) {
  for (const g of GROUPS[k]) {
    for (const [key, label, v] of g.a) {
      ACT[key] = { l: label, v, only: g.only };
      CAT[key] = k === 'err' ? 'Fehler & Strafen' : g.t;
    }
  }
}

/* ---------- Zeit und Einsatz ---------- */
export function elapsed() { const c = store.S.clock; return c.offset + (c.startedAt ? (Date.now() - c.startedAt) / 1000 : 0); }
export function onField() {
  const S = store.S;
  const l = S.stints[S.stints.length - 1];
  return !!(l && l.to === null);
}
export function started() { const S = store.S; return S.ended || S.clock.startedAt !== null || S.clock.offset > 0 || S.events.length > 0; }
export function playedSec() {
  const el = elapsed();
  return Math.max(0, store.S.stints.reduce((s, x) => s + ((x.to === null ? el : x.to) - x.from), 0));
}
export const minPlayed = () => Math.floor(playedSec() / 60);

export function val(a) {
  const S = store.S, v = a.v;
  if (typeof v === 'function') return v();
  if (typeof v === 'number') return v;
  if (!S.startelf && v.SUB != null) return v.SUB;
  return v[S.pos];
}
export const count = key => store.S.events.filter(e => e.key === key).length;
export function score() {
  let us = 0, them = 0;
  for (const e of store.S.events) { const a = ACT[e.key]; if (a && a.side === 'us') us++; if (a && a.side === 'them') them++; }
  return { us, them };
}

/* Startelf bzw. Einwechslung zählt von Anfang an */
export function startLine() {
  const S = store.S;
  if (!started() || !S.stints.length) return null;
  return S.startelf ? { l: 'Startelf', p: 5, r: '1’' } : { l: 'Eingewechselt', p: 2, r: minStamp(Math.floor(S.stints[0].from)) };
}
/* Minutenbonus, Zu null und Sieg/Niederlage kommen erst nach Spielende dazu.
   Zu null: nur wenn das eigene Team im ganzen Spiel kein Gegentor bekommt (auch nicht nach einer Auswechslung)
   und der Spieler mindestens eine Halbzeit gespielt hat. */
export function endLines() {
  const S = store.S, out = [], m = minPlayed(), sc = score(), r = Math.ceil(playedSec() / 60) + '’';
  if (!S.ended || !S.stints.length) return out;
  if (sc.them === 0 && m >= 45) {
    const v = CLEAN_SHEET[S.pos] || 2;
    out.push({ l: 'Zu null', h: '+' + v + ' je 10 Minuten, +' + v + ' bei voller Spielzeit', p: Math.floor(m / 10) * v + (m >= 90 ? v : 0), r });
  }
  out.push({ l: 'Minutenbonus', h: '+1 je 10 Minuten, +1 bei voller Spielzeit', p: Math.floor(m / 10) + (m >= 90 ? 1 : 0), r });
  if (sc.us > sc.them) out.push({ l: 'Spiel gewonnen', p: 15, r });
  else if (sc.us < sc.them) out.push({ l: 'Spiel verloren', p: -15, r });
  return out;
}
export function total() {
  const s = startLine();
  return store.S.events.reduce((t, e) => t + e.pts, 0) + (s ? s.p : 0) + endLines().reduce((t, l) => t + l.p, 0);
}

/* ---------- Marken: Halbzeit und Wechsel ---------- */
export function markers() {
  const S = store.S, m = [];
  if (S.h2 && S.h2Id != null) m.push({ at: S.h2Id, t: 2700, ht: 1 });
  for (const x of S.subs || []) m.push({ at: x.at, t: x.t, sub: x });
  return m.sort((a, b) => b.at - a.at || b.t - a.t);
}
/* Ereignisse (neueste zuerst) mit Marken an der richtigen Stelle */
export function withMarkers(list) {
  const mk = markers(), out = [];
  let i = 0;
  const flush = id => { while (i < mk.length && mk[i].at > id) { out.push(mk[i].ht ? { ht: 1 } : { sub: mk[i].sub }); i++; } };
  for (const e of list) { flush(e.id); out.push({ e }); }
  flush(-Infinity);
  return out;
}

/* ---------- Auswertung ---------- */
export function breakdown() {
  const map = new Map(), add = (n, p) => map.set(n, (map.get(n) || 0) + p);
  for (const e of store.S.events) add(CAT[e.key] || 'Sonstiges', e.pts);
  const s = startLine(); if (s) add('Einsatz & Team', s.p);
  for (const l of endLines()) add('Einsatz & Team', l.p);
  return [...map].map(([n, p]) => ({ n, p })).filter(x => x.p !== 0).sort((a, b) => b.p - a.p);
}
export function matchEntry() {
  const S = store.S, sc = score();
  let g = 0, a = 0;
  for (const e of S.events) { if (GOAL_KEYS[e.key]) g++; if (ASSIST_KEYS[e.key]) a++; }
  return { tm: teamOf(S.match), t: total(), m: Math.ceil(playedSec() / 60), us: sc.us, them: sc.them, g, a, p: S.match.p, o: S.match.o, h: isHome() ? 1 : 0 };
}

/* Datensatz für die Hall of Fame (chronologische Ereignisse inkl. Marken und Automatik-Zeilen) */
export function gameRecord(season) {
  const S = store.S, e = matchEntry(), evs = [];
  const mk = markers().reverse();
  let mi = 0;
  const mkPush = id => { while (mi < mk.length && mk[mi].at <= id) { const q = mk[mi++]; evs.push(q.ht ? { k: 'ht' } : { k: 'sub', o: q.sub.o, t: q.sub.t }); } };
  for (const x of S.events.slice().sort((a, b) => a.id - b.id)) { mkPush(x.id); evs.push({ k: x.key, l: x.label, p: x.pts, t: x.t }); }
  mkPush(Infinity);
  const st = startLine(); if (st) evs.push({ k: 'auto', a: 's', l: st.l, p: st.p, t: -1 });
  for (const l of endLines()) evs.push({ k: 'auto', a: 'e', l: l.l, p: l.p, t: -1 });
  const row = {
    uid: S.uid, season, player: S.match.p, opp: S.match.o, home: !!S.match.home, pos: S.pos, team: teamOf(S.match),
    player_foto: S.match.pf || null, opp_foto: S.match.of || null,
    us: e.us, them: e.them, minutes: e.m, points: e.t, goals: e.g, assists: e.a, events: evs
  };
  if (S.manual) { row.manual = true; row.played_at = S.playedAt; }
  return row;
}

/* Textzusammenfassung zum Kopieren */
export function summaryText() {
  const S = store.S, sc = score(), agg = new Map();
  for (const e of S.events) {
    const a = agg.get(e.key) || { l: e.label, n: 0, p: 0 };
    a.n++; a.p += e.pts; agg.set(e.key, a);
  }
  const autos = [startLine(), ...endLines()].filter(Boolean);
  const f = n => (n > 0 ? '+' + n : String(n));
  const out = [
    names.player + ' (' + POS_NAME[S.pos] + ') – ' + names.team,
    'Gesamt: ' + total() + ' Punkte',
    (isHome() ? names.team : names.opp) + ' ' + scoreText(sc, isHome()).replace(/ /g, '') + ' ' + (isHome() ? names.opp : names.team) +
      ', Spielzeit ' + minPlayed() + ' Min.' + (S.ended ? '' : ' (Spiel läuft)'),
    ''
  ];
  if (autos.length) { out.push('Automatisch'); autos.forEach(l => out.push('  ' + l.l + ': ' + f(l.p))); out.push(''); }
  out.push('Aktionen');
  if (!agg.size) out.push('  noch keine');
  for (const g of agg.values()) out.push('  ' + g.n + 'x ' + g.l + ': ' + f(g.p));
  return out.join('\n');
}
