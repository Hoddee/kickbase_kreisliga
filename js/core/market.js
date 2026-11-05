/* Marktwerte im Kickbase-Stil.
   Startwert aus dem Kader (leicht "krumm" gemacht, fest pro Spieler, auf allen Geräten gleich).
   Pro gespeichertem Spiel ändert sich der Wert prozentual: (Punkte - 120) x 0,04 %,
   begrenzt auf -8 % bis +12 %, plus kleines Markt-Rauschen von ±0,6 %. */
import { PL } from '../data/players.js';
import { hash01 } from './util.js';

const MW_MIN = 250000;

export function startValue(id) {
  const p = PL[id], base = (p && p.mw) || 1000000;
  if (p && p.exact) return base;
  return Math.round(base * (0.975 + hash01('mw:' + id) * 0.06));
}
function stepPct(points, seed) {
  const pc = Math.max(-0.08, Math.min(0.12, (points - 120) * 0.0004));
  return pc + (hash01(seed) - 0.5) * 0.012;
}
export function nextValue(value, points, seed) {
  return Math.max(MW_MIN, Math.round(value * (1 + stepPct(points, seed))));
}

/* games: Liste aller Spiele (aufsteigend sortiert wird intern) */
export function marketOf(id, games) {
  let v = startValue(id), last = 0;
  const series = [{ v }];
  for (const g of byDate(games.filter(x => x.player === id))) {
    const nv = nextValue(v, g.points, g.uid);
    last = nv - v; v = nv; series.push({ v, g });
  }
  return { v, last, series };
}

export const byDate = list => list.slice().sort((a, b) => (a.played_at < b.played_at ? -1 : 1));
