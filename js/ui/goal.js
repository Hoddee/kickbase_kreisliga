/* Tor-Assistent: nach „Tor <Team>“ (oder „Tor“/„Elfmeter verwandelt“ bei einem Spieler) in kurzen Schritten
   Torschütze → Vorlage → Einleitung wählen; nach einem Gegentor optional den Verursacher.
   Das Blatt hat eine feste Höhe: Kopf, Schritte und „Fertig“ bleiben stehen, nur der Inhalt scrollt.
   Das Team-Tor ist beim Öffnen schon gebucht. Jeder Tipp bucht sofort (Einträge mit gg = Tor-Gruppe, ga = 1),
   Schließen oder „Fertig“ verliert also nichts. Begleitaktionen werden nie automatisch gebucht – nur, was man antippt
   (Opta/Kickbase vergeben sie nicht bei jedem Tor). */
import { esc, fmt, cls, minStamp, buzz } from '../core/util.js';
import { PL } from '../data/players.js';
import { store, saveGame, ACT, val, onField, eachPlayer, withPlayer, score, isHome, scoreText } from '../core/game.js';
import { avatar } from './components.js';

/* [Schlüssel, Name] */
const SCORE_KINDS = [['goal', 'Tor'], ['pen', 'Elfmeter']];
const SCORE_EXTRAS = [['long', 'Fernschuss'], ['sot', 'Schuss aufs Tor']];
const ASSIST_KINDS = [['ast', 'Torvorlage'], ['defl', 'Abgefälscht'], ['reb', 'Abgeprallt'], ['wood', 'Aluminium']];
const ASSIST_EXTRAS = [['intent', 'Absichtlich'], ['bcc', 'Großchance kreiert'],
  ['deadly', 'Pass des Todes'], ['cross', 'Flanke'],
  ['pf3', 'Pass vorderes Drittel'], ['poh', 'Pass gegn. Hälfte'],
  ['lball', 'Präziser langer Ball']];
const FAULT_KINDS = [['mgoal', 'Fehler vor Gegentor'], ['own', 'Eigentor'], ['pcon', 'Elfmeter verschuldet']];

let st = null, onChange = () => {};
const wrap = () => document.getElementById('gaSheet');
export const goalOpen = () => !!st;

/* Spieler im Spiel: wer auf dem Platz steht (vor dem Anpfiff alle) */
function players() {
  const all = eachPlayer(i => ({ i, p: store.S.match.p, on: onField() }));
  const on = all.filter(x => x.on);
  return on.length ? on : all;
}
const pts = (i, key) => withPlayer(i, () => val(ACT[key]));
const nm = i => (i == null ? '' : PL[withPlayer(i, () => store.S.match.p)].n);
/* Schritte je nach Lage: Tor = Torschütze, Vorlage, Einleitung; Elfmeter = Schütze, rausgeholt; Gegentor = Verursacher */
const free = ex => players().some(x => !ex.includes(x.i));
const steps = () => {
  if (st.side === 'them') return ['fx'];
  const out = ['sc'];
  /* Schritte ohne mögliche Auswahl weglassen (z. B. ein Spieler, der selbst getroffen hat) */
  if (free(st.sc != null ? [st.sc] : [])) out.push('as');
  if (st.sk !== 'pen' && (st.as != null || st.step === 'su') && free([st.sc, st.as].filter(x => x != null))) out.push('su');
  return out;
};

/* Alles, was das Blatt gebucht hat, neu aus der Auswahl aufbauen */
function picks() {
  const out = [];
  if (st.side === 'us') {
    if (st.sc != null) { out.push([st.sc, st.sk]); for (const k of st.sb) if (k !== 'long' || st.sk === 'goal') out.push([st.sc, k]); }
    if (st.as != null) {
      out.push([st.as, st.sk === 'pen' ? 'pwon' : st.ak]);
      if (st.sk !== 'pen') for (const k of st.ab) out.push([st.as, k]);
    }
    if (st.su != null && st.as != null && st.sk !== 'pen') out.push([st.su, 'setup']);
  } else if (st.fx != null) out.push([st.fx, st.fk]);
  return out;
}
function sync() {
  const g = st.grp, list = picks();
  eachPlayer(i => {
    const P = store.S;
    P.events = P.events.filter(e => !(e.ga && e.gg === g));
    for (const e of P.events) if (e.grp === g) e.sc = st.side === 'us' && st.sc != null ? 1 : 0;
    for (const [pi, key] of list) if (pi === i) {
      const a = ACT[key];
      P.events.push({ id: P.nextId++, key, label: a.s || a.l, pts: val(a), t: st.t, ts: Date.now(), gg: g, ga: 1 });
    }
  });
  saveGame();
  onChange();
}

/* ---------- Bausteine ---------- */
const ptsTag = p => '<b class="' + cls(p) + '">' + fmt(p) + '</b>';
/* Spieler als Kacheln (3 pro Reihe), dazu „niemand“ */
function playerGrid(role, cur, exclude, key, noneLabel) {
  return '<div class="ga-grid">' + players().filter(x => !exclude.includes(x.i)).map(x =>
    '<button type="button" class="ga-p' + (cur === x.i ? ' on' : '') + '" data-ga="' + role + ':' + x.i + '" aria-pressed="' + (cur === x.i) + '">' + avatar(x.p) +
    '<span>' + esc(PL[x.p].n) + '</span>' + ptsTag(pts(x.i, key)) + '</button>').join('') +
    '<button type="button" class="ga-p none' + (cur == null ? ' on' : '') + '" data-ga="' + role + ':-" aria-pressed="' + (cur == null) + '"><i>–</i><span>' + esc(noneLabel) + '</span></button></div>';
}
/* Auswahl-Zeilen: eine (radio) oder mehrere (check) – mit Erklärung und Punkten */
function optRows(list, attr, isOn, who, multi) {
  return '<div class="ga-opts">' + list.map(([k, l]) => {
    const on = isOn(k);
    return '<button type="button" class="ga-o' + (on ? ' on' : '') + (multi ? ' ga-multi' : '') + '" data-ga="' + attr + ':' + k + '" role="' + (multi ? 'checkbox' : 'radio') + '" aria-checked="' + on + '">' +
      '<i class="ga-mk" aria-hidden="true"></i><span><b>' + esc(l) + '</b></span>' + ptsTag(pts(who, k)) + '</button>';
  }).join('') + '</div>';
}

function stepHtml(s) {
  if (s === 'sc') {
    let h = '<h3>Wer hat das Tor geschossen?</h3>' + playerGrid('sc', st.sc, [], st.sk, 'Anderer');
    if (st.sc != null) {
      h += '<h3>Wie?</h3>' + optRows(SCORE_KINDS, 'sk', k => st.sk === k, st.sc, false) +
        '<h3>Dazu</h3>' + optRows(SCORE_EXTRAS.filter(([k]) => k !== 'long' || st.sk === 'goal'), 'sb', k => st.sb.has(k), st.sc, true);
    }
    return h;
  }
  if (s === 'as') {
    const pen = st.sk === 'pen';
    let h = '<h3>' + (pen ? 'Wer hat den Elfmeter rausgeholt?' : 'Wer hat vorgelegt?') + '</h3>' +
      playerGrid('as', st.as, st.sc != null ? [st.sc] : [], pen ? 'pwon' : st.ak, pen ? 'Niemand' : 'Keine Vorlage');
    if (st.as != null && !pen) {
      h += '<h3>Art der Vorlage</h3>' + optRows(ASSIST_KINDS, 'ak', k => st.ak === k, st.as, false) +
        '<h3>Was war besonders?</h3>' + optRows(ASSIST_EXTRAS, 'ab', k => st.ab.has(k), st.as, true);
    }
    return h;
  }
  if (s === 'su') {
    return '<h3>Wer hat das Tor eingeleitet?</h3>' +
      playerGrid('su', st.su, [st.sc, st.as].filter(x => x != null), 'setup', 'Keiner');
  }
  let h = '<h3>War einer von uns schuld?</h3>' + playerGrid('fx', st.fx, [], st.fk, 'Niemand');
  if (st.fx != null) h += '<h3>Was ist passiert?</h3>' + optRows(FAULT_KINDS, 'fk', k => st.fk === k, st.fx, false);
  return h;
}

/* Reiter oben: zeigt pro Schritt, was gewählt ist */
function stepper() {
  const list = steps();
  if (list.length < 2) return '';
  const label = { sc: 'Torschütze', as: st.sk === 'pen' ? 'Rausgeholt' : 'Vorlage', su: 'Einleitung' };
  const val = { sc: nm(st.sc), as: nm(st.as), su: nm(st.su) };
  return '<div class="ga-steps" role="tablist">' + list.map((s, i) =>
    '<button type="button" role="tab" class="ga-st' + (st.step === s ? ' on' : '') + (val[s] ? ' done' : '') + '" data-ga="step:' + s + '" aria-selected="' + (st.step === s) + '">' +
    '<i>' + (val[s] ? '✓' : i + 1) + '</i><span><small>' + label[s] + '</small><b>' + esc(val[s] || '–') + '</b></span></button>').join('') + '</div>';
}

/* Fußzeile: was gebucht ist + Weiter/Fertig – bleibt immer sichtbar */
function footer() {
  const list = steps(), i = list.indexOf(st.step), last = i === list.length - 1;
  const per = new Map();
  for (const [pi, key] of picks()) per.set(pi, (per.get(pi) || 0) + pts(pi, key));
  const sum = [...per].map(([pi, p]) => '<span>' + esc(nm(pi)) + ' ' + ptsTag(p) + '</span>').join('');
  const nextLabel = 'Weiter';
  return '<div class="ga-foot">' + (sum ? '<div class="ga-sum">' + sum + '</div>' : '<div class="ga-sum"></div>') +
    '<div class="ga-btns">' + (last ? '<button type="button" class="btn primary full" data-ga="done">Fertig</button>'
      : '<button type="button" class="btn" data-ga="done">Fertig</button><button type="button" class="btn primary" data-ga="next">' + nextLabel + ' ›</button>') + '</div></div>';
}

/* Inhalt des Blatts – das Blatt selbst (.ga-panel) bleibt stehen, damit es beim Tippen nicht neu einfährt */
function html() {
  const sc = score(), us = st.side === 'us';
  return '<div class="ga-grab"><i></i></div>' +
    '<div class="ga-head"><span class="ga-k ' + (us ? 'us' : 'them') + '">' + (us ? 'Tor' : 'Gegentor') + '</span>' +
    '<b>' + scoreText(sc, isHome()) + '</b><small>' + (minStamp(st.t) || '') + '</small>' +
    '<button type="button" class="ga-x" data-ga="done" aria-label="Schließen">×</button></div>' +
    stepper() + '<div class="ga-body" id="gaBody">' + stepHtml(st.step) + '</div>' + footer();
}
function render(scrollTop) {
  const w = wrap();
  if (!w || !st) return;
  let pn = w.querySelector('.ga-panel');
  if (!pn) { pn = document.createElement('div'); pn.className = 'ga-panel'; pn.setAttribute('role', 'dialog'); w.appendChild(pn); }
  pn.setAttribute('aria-label', st.side === 'us' ? 'Tor' : 'Gegentor');
  const old = pn.querySelector('.ga-body'), top = old ? old.scrollTop : 0;
  pn.innerHTML = html();
  const b = pn.querySelector('.ga-body');
  if (b) b.scrollTop = scrollTop ? 0 : top;
}
/* Schritt wechseln mit kurzem Gleiten in Leserichtung */
function goStep(s) {
  const list = steps(), dir = list.indexOf(s) >= list.indexOf(st.step) ? 1 : -1;
  st.step = s; render(true);
  const b = wrap().querySelector('.ga-body');
  if (b && b.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    b.animate([{ opacity: 0, transform: 'translateX(' + 24 * dir + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' });
}

/* side: 'us' | 'them'; grp: Gruppe des schon gebuchten Team-Tors; scorer/kind: vorbelegt (Tipp auf „Tor“ beim Spieler) */
export function openGoal(side, grp, t, { scorer = null, kind = 'goal' } = {}) {
  st = { side, grp, t, sc: scorer, sk: kind, sb: new Set(), as: null, ak: 'ast', ab: new Set(), su: null, fx: null, fk: 'mgoal', step: side === 'them' ? 'fx' : 'sc' };
  let w = wrap();
  if (!w) {
    w = document.createElement('div'); w.id = 'gaSheet'; w.className = 'ga-wrap';
    document.body.appendChild(w);
    w.addEventListener('click', onClick);
  }
  w.hidden = false; w.innerHTML = '';
  if (scorer != null) sync();
  render(true);
}
export function closeGoal() {
  const w = wrap();
  if (w) { w.hidden = true; w.innerHTML = ''; }
  if (st) { st = null; onChange(); }
}
export function initGoal(changed) { onChange = changed; }

function onClick(e) {
  if (e.target === wrap()) { closeGoal(); return; }
  const b = e.target.closest('[data-ga]');
  if (!b || !st) return;
  const v = b.getAttribute('data-ga'), [k, arg] = v.split(':');
  const idx = arg === '-' ? null : +arg, list = steps();
  if (v === 'done') { closeGoal(); return; }
  if (v === 'next') { const n = list[list.indexOf(st.step) + 1]; if (n) goStep(n); return; }
  if (k === 'step') { goStep(arg); return; }
  if (k === 'sc') { st.sc = idx; if (st.as === idx) st.as = null; if (st.su === idx) st.su = null; }
  else if (k === 'as') { st.as = idx; if (st.su === idx) st.su = null; }
  else if (k === 'su') st.su = idx;
  else if (k === 'fx') st.fx = idx;
  else if (k === 'sk') { st.sk = arg; if (arg === 'pen') { st.sb.delete('long'); st.su = null; st.ab.clear(); } }
  else if (k === 'ak') st.ak = arg;
  else if (k === 'fk') st.fk = arg;
  else if (k === 'sb' || k === 'ab') { const set = st[k]; if (set.has(arg)) set.delete(arg); else set.add(arg); }
  else return;
  buzz(8);
  sync();
  render();
  /* Ohne Vorlage gibt es keine Einleitung */
  if (k === 'as' && idx == null) st.su = null;
}
