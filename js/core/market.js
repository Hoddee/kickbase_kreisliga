/* Marktwerte im Kickbase-Stil.
   Startwert: individuell aus dem Kader (leicht "krumm" gemacht, fest pro Spieler, auf allen Geräten gleich).
   Pro gespeichertem Spiel gibt es Bewertungspunkte (-5 bis +10); jeder Punkt = 1 % Marktwertänderung:
     Kickbase-Punkte: 300+ +3 · 140–299 +2 · 70–139 +1 · 50–69 0 · 20–49 -1 · 0–19 -2 · unter 0 -3
     Spielzeit:       90 Min. +3 · 60–89 +2 · 30–59 +1 · unter 30 0
     Ergebnis:        Sieg +2 · Unentschieden 0 · Niederlage -2 (nur mit Einsatzminuten)
     Zu null:         +2 (kein Gegentor und mindestens 10 Minuten gespielt – wie bei den Punkten)
   Dazu ein kleines Markt-Rauschen (±0,25 %), damit die Werte nicht glatt wirken.
   Grenzen: mindestens 500.000 €, höchstens 30.000.000 €.
   Alles wird aus den gespeicherten Spielen berechnet – Regeländerungen gelten rückwirkend für alle Spiele. */
import { PL } from '../data/players.js';
import { hash01, cleanSheet } from './util.js';

export const MW_MIN = 500000;
export const MW_MAX = 30000000;
const PCT_PER_POINT = 0.01;
const NOISE = 0.005;

const clamp = v => Math.max(MW_MIN, Math.min(MW_MAX, Math.round(v)));

export function startValue(id) {
  const p = PL[id], base = (p && p.mw) || 1000000;
  if (p && p.exact) return clamp(base);
  return clamp(base * (0.975 + hash01('mw:' + id) * 0.06));
}

/* Bewertung eines Spiels: g = { points, minutes, us, them } */
export function rating(g) {
  const pts = g.points, m = g.minutes || 0;
  const kb = pts >= 300 ? 3 : pts >= 140 ? 2 : pts >= 70 ? 1 : pts >= 50 ? 0 : pts >= 20 ? -1 : pts >= 0 ? -2 : -3;
  const time = m >= 90 ? 3 : m >= 60 ? 2 : m >= 30 ? 1 : 0;
  /* Ohne Einsatzminuten zählt das Ergebnis nicht (nicht eingesetzt = 0) */
  const result = m <= 0 ? 0 : g.us > g.them ? 2 : g.us < g.them ? -2 : 0;
  const clean = cleanSheet(g) ? 2 : 0;
  return {
    total: kb + time + result + clean,
    parts: [['Kickbase-Punkte', kb], ['Spielzeit', time], ['Ergebnis', result], ['Zu null', clean]]
  };
}

export function nextValue(value, g, seed) {
  const pct = rating(g).total * PCT_PER_POINT + (hash01(seed) - 0.5) * NOISE;
  return clamp(value * (1 + pct));
}

/* games: Liste aller Spiele (aufsteigend sortiert wird intern) */
export function marketOf(id, games) {
  let v = startValue(id), last = 0;
  const series = [{ v }];
  for (const g of byDate(games.filter(x => x.player === id))) {
    const nv = nextValue(v, g, g.uid);
    last = nv - v; v = nv; series.push({ v, g });
  }
  return { v, last, series };
}

export const byDate = list => list.slice().sort((a, b) => (a.played_at < b.played_at ? -1 : 1));
