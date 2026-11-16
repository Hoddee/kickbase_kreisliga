/* Korrekturen an gespeicherten Spielen (nur Admin), wie bei Kickbase:
   - Entfernte Aktionen bleiben im Verlauf stehen, ausgegraut und ohne Punkte (Feld x: 1).
   - Nachgetragene Aktionen oder freie Punkte bekommen c: 1.
   Punkte, Tore und Vorlagen des Spiels werden danach aus den Aktionen neu gezählt. */
import { GROUPS, GOAL_KEYS, ASSIST_KEYS, CLEAN_SHEET } from '../data/actions.js';

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
  let i = out.findIndex(e => e.k === 'auto' || (item.t >= 0 && ((e.k === 'ht' && item.t < 2700) || (!MARK[e.k] && e.t != null && e.t > item.t))));
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
    else if (e.c && !((e.k === 'tg' || e.k === 'cg') && !e.p)) out.push({ p: e.p, label: e.l, t: e.t });
  }
  return out;
}
export const hasCorrections = ev => ev.some(e => e.x || e.c);

/* ---------- Ergebnis korrigieren ----------
   Der Spielstand hängt an den Aktionen Team-Tor / Gegentor. Ändert sich daran etwas, werden die Boni,
   die vom Ergebnis abhängen (Zu null, Sieg/Niederlage), automatisch nachgezogen:
   ax = automatisch entfernt, ac = automatisch dazugebucht. Beides wird bei jeder Änderung neu berechnet. */
const isGoal = (e, k) => e.k === k && !e.x;
export const goalCount = (ev, k) => ev.filter(e => isGoal(e, k)).length;
/* Abweichung zwischen gespeichertem Ergebnis und den Tor-Aktionen (bei alten Spielen möglich) */
export const scoreBase = (g, ev) => ({ us: g.us - goalCount(ev, 'tg'), them: g.them - goalCount(ev, 'cg') });

/* War der Spieler überhaupt im Einsatz? (ohne Minutenbonus-Zeile saß er nur auf der Bank) */
export const didPlay = ev => ev.some(e => e.l === 'Minutenbonus');
/* Stand er zur Sekunde t auf dem Platz? Startelf ab Anpfiff, Eingewechselte erst ab ihrem Wechsel. */
export function onField(ev, t) {
  if (!didPlay(ev)) return false;
  const subs = ev.filter(e => e.k === 'sub');
  let on = !(subs.length && subs[0].o === 'in');
  for (const e of subs) { if (e.t != null && e.t > t) break; on = e.o === 'in'; }
  return on;
}

const END = { clean: ['Zu null'], result: ['Spiel gewonnen', 'Spiel verloren'] };
/* Ergebnis, wie es ursprünglich gebucht wurde (ohne nachgetragene, mit später entfernten Toren) */
export function scoreOrig(base, ev) {
  const n = k => ev.filter(e => e.k === k && !e.c).length;
  return { us: base.us + n('tg'), them: base.them + n('cg') };
}
export function settle(evIn, g, base, orig) {
  /* 1. frühere automatische Folgebuchungen zurücknehmen */
  let ev = evIn.filter(e => !e.ac).map(e => { if (!e.ax) return e; const y = Object.assign({}, e); delete y.ax; delete y.x; return y; });
  const us = Math.max(0, base.us + goalCount(ev, 'tg')), them = Math.max(0, base.them + goalCount(ev, 'cg'));
  /* Ergebnis wie ursprünglich gebucht: Schluss-Boni bleiben, wie sie damals gespeichert wurden */
  if (us === orig.us && them === orig.them) return { ev, us, them };
  /* Nur wer gespielt hat, bekommt Schluss-Boni (dann gibt es immer die Zeile „Minutenbonus“) */
  if (!didPlay(ev)) return { ev, us, them };
  /* Minutenbonus zählt so, wie er gerade steht (eine Korrektur daran wirkt sich auf „Zu null“ aus) */
  const mb = ev.reduce((s, e) => (!e.x && e.l === 'Minutenbonus' ? s + (e.p || 0) : s), 0);
  const want = {
    clean: them === 0 && mb > 0 ? { l: 'Zu null', p: mb * (CLEAN_SHEET[g.pos] || 2) } : null,
    result: us > them ? { l: 'Spiel gewonnen', p: 15 } : us < them ? { l: 'Spiel verloren', p: -15 } : null
  };
  for (const kind of ['clean', 'result']) {
    const w = want[kind];
    let have = false;
    ev = ev.map(e => {
      if (e.k !== 'auto' || e.a !== 'e' || !END[kind].includes(e.l)) return e;
      if (w && e.l === w.l) { have = true; return e; }       // passt schon (oder vom Admin bewusst entfernt)
      return e.x ? e : Object.assign({}, e, { x: 1, ax: 1 });  // passt nicht mehr zum Ergebnis
    });
    if (w && !have) ev.push({ k: 'auto', a: 'e', l: w.l, p: w.p, t: -1, c: 1, ac: 1 });
  }
  return { ev, us, them };
}
