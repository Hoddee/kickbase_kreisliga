/* Korrekturen an gespeicherten Spielen (nur Admin), wie bei Kickbase:
   - Entfernte Aktionen bleiben im Verlauf stehen, ausgegraut und ohne Punkte (Feld x: 1).
   - Nachgetragene Aktionen oder freie Punkte bekommen c: 1.
   Punkte, Tore und Vorlagen des Spiels werden danach aus den Aktionen neu gezählt. */
import { GROUPS, GOAL_KEYS, ASSIST_KEYS } from '../data/actions.js';

const MARK = { ht: 1, sub: 1 };
const TEAM = { t: 'Team', a: [['tg', 'Team-Tor', 5], ['cg', 'Gegentor', -5]] };

/* Auswahl zum Nachtragen: Bereiche wie beim Punkte vergeben, passend zur Position */
export function pickerGroups(pos) {
  const out = [];
  for (const [k, list] of Object.entries(GROUPS)) for (const g of list) if (!g.only || g.only === pos) out.push({ k, t: g.t, a: g.a });
  out.push({ k: 'team', ...TEAM });
  return out;
}
export const pointsFor = (val, pos, sub) => (typeof val === 'number' ? val : (sub && val.SUB != null ? val.SUB : val[pos] != null ? val[pos] : 0));
export const wasSubbedIn = ev => ev.some(e => e.k === 'sub' && e.o === 'in') && !ev.some(e => e.k === 'auto' && e.a === 's');

/* Neue Aktion an der richtigen Stelle einsortieren (nach Minute, vor den Schluss-Boni) */
export function insertAction(ev, item) {
  const out = ev.slice();
  let i = out.findIndex(e => e.k === 'auto' || (e.k === 'ht' && item.t < 2700) || (!MARK[e.k] && e.t != null && e.t > item.t));
  if (i < 0) i = out.length;
  out.splice(i, 0, item);
  return out;
}

/* Was gerade zählt */
export function recount(ev) {
  let points = 0, goals = 0, assists = 0;
  for (const e of ev) {
    if (MARK[e.k] || e.x) continue;
    points += e.p || 0;
    if (GOAL_KEYS[e.k]) goals++;
    if (ASSIST_KEYS[e.k]) assists++;
  }
  return { points, goals, assists };
}

/* Liste der Korrekturen: entfernte Aktion = Gegenbuchung, nachgetragene = wie gebucht */
export function corrections(ev) {
  const out = [];
  for (const e of ev) {
    if (e.x && e.p) out.push({ p: -e.p, label: e.l, t: e.t });
    else if (e.c) out.push({ p: e.p, label: e.l, t: e.t });
  }
  return out;
}
export const hasCorrections = ev => ev.some(e => e.x || e.c);
