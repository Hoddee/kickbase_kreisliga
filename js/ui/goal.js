/* Tor-Assistent: nach „Tor <Team>“ (oder „Tor“/„Elfmeter verwandelt“ bei einem Spieler) Torschütze, Vorlage und
   typische Begleitaktionen in einem Blatt wählen; nach einem Gegentor optional den Verursacher.
   Das Team-Tor ist beim Öffnen schon gebucht. Jeder Tipp im Blatt bucht sofort (Einträge mit gg = Tor-Gruppe, ga = 1),
   Schließen oder „Fertig“ verliert also nichts. Begleitaktionen werden nie automatisch gebucht – nur, was man antippt
   (Opta/Kickbase vergeben sie nicht bei jedem Tor). */
import { esc, fmt, cls, minStamp, buzz } from '../core/util.js';
import { PL } from '../data/players.js';
import { store, saveGame, ACT, val, onField, eachPlayer, withPlayer, score, isHome, scoreText } from '../core/game.js';
import { avatar } from './components.js';

const SCORE_KINDS = [['goal', 'Tor'], ['pen', 'Elfmeter']];
const ASSIST_KINDS = [['ast', 'Torvorlage'], ['defl', 'Abgefälscht'], ['reb', 'Abgeprallt'], ['wood', 'Aluminium']];
const SCORE_EXTRAS = [['long', 'Fernschuss'], ['sot', 'Torschuss aufs Tor']];
const ASSIST_EXTRAS = [['intent', 'Absichtlich'], ['bcc', 'Großchance kreiert'], ['deadly', 'Pass des Todes'], ['cross', 'Flanke'],
  ['pf3', 'Pass vorderes Drittel'], ['poh', 'Pass gegn. Hälfte'], ['lball', 'Präziser langer Ball']];
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

/* Alles, was das Blatt gebucht hat, neu aus der Auswahl aufbauen */
function sync() {
  const g = st.grp, picks = [];
  if (st.side === 'us') {
    if (st.sc != null) { picks.push([st.sc, st.sk]); for (const k of st.sb) if (k !== 'long' || st.sk === 'goal') picks.push([st.sc, k]); }
    if (st.as != null) {
      picks.push([st.as, st.sk === 'pen' ? 'pwon' : st.ak]);
      if (st.sk !== 'pen') for (const k of st.ab) picks.push([st.as, k]);
    }
    if (st.su != null) picks.push([st.su, 'setup']);
  } else if (st.fx != null) picks.push([st.fx, st.fk]);
  eachPlayer(i => {
    const P = store.S;
    P.events = P.events.filter(e => !(e.ga && e.gg === g));
    for (const e of P.events) if (e.grp === g) e.sc = st.side === 'us' && st.sc != null ? 1 : 0;
    for (const [pi, key] of picks) if (pi === i) {
      const a = ACT[key];
      P.events.push({ id: P.nextId++, key, label: a.s || a.l, pts: val(a), t: st.t, ts: Date.now(), gg: g, ga: 1 });
    }
  });
  saveGame();
  onChange();
}

const chip = (attr, on, label, p) => '<button type="button" class="ga-c' + (on ? ' on' : '') + '" data-ga="' + attr + '" aria-pressed="' + on + '">' +
  esc(label) + (p != null ? '<b class="' + cls(p) + '">' + fmt(p) + '</b>' : '') + '</button>';
function pickRow(role, cur, exclude, key, noneLabel) {
  return '<div class="ga-ps">' + players().filter(x => !exclude.includes(x.i)).map(x =>
    '<button type="button" class="ga-p' + (cur === x.i ? ' on' : '') + '" data-ga="' + role + ':' + x.i + '" aria-pressed="' + (cur === x.i) + '">' + avatar(x.p) +
    '<span>' + esc(PL[x.p].n) + '</span><b class="' + cls(pts(x.i, key)) + '">' + fmt(pts(x.i, key)) + '</b></button>').join('') +
    '<button type="button" class="ga-p none' + (cur == null ? ' on' : '') + '" data-ga="' + role + ':-" aria-pressed="' + (cur == null) + '"><i>–</i><span>' + esc(noneLabel) + '</span></button></div>';
}

function html() {
  const sc = score(), us = st.side === 'us';
  let h = '<div class="ga-panel" role="dialog" aria-label="' + (us ? 'Tor' : 'Gegentor') + '"><div class="ga-grab"><i></i></div>' +
    '<div class="ga-head"><span class="ga-k ' + (us ? 'us' : 'them') + '">' + (us ? 'Tor' : 'Gegentor') + '</span>' +
    '<b>' + scoreText(sc, isHome()) + '</b><small>' + (minStamp(st.t) || '') + '</small></div>';
  if (us) {
    h += '<h3>Torschütze</h3>' + pickRow('sc', st.sc, [], st.sk, 'Anderer');
    if (st.sc != null) h += '<div class="ga-cs">' + SCORE_KINDS.map(([k, l]) => chip('sk:' + k, st.sk === k, l, pts(st.sc, k))).join('') +
      '</div><div class="ga-cs extra"><span>dazu</span>' + SCORE_EXTRAS.filter(([k]) => k !== 'long' || st.sk === 'goal')
        .map(([k, l]) => chip('sb:' + k, st.sb.has(k), l, pts(st.sc, k))).join('') + '</div>';
    const ak = st.sk === 'pen' ? 'pwon' : st.ak;
    h += '<h3>' + (st.sk === 'pen' ? 'Elfmeter rausgeholt' : 'Vorlage') + '</h3>' + pickRow('as', st.as, st.sc != null ? [st.sc] : [], ak, 'Keine');
    if (st.as != null && st.sk !== 'pen') {
      h += '<div class="ga-cs">' + ASSIST_KINDS.map(([k, l]) => chip('ak:' + k, st.ak === k, l, pts(st.as, k))).join('') + '</div>' +
        '<div class="ga-cs extra"><span>dazu</span>' + ASSIST_EXTRAS.map(([k, l]) => chip('ab:' + k, st.ab.has(k), l, pts(st.as, k))).join('') + '</div>';
    }
    if (st.sk !== 'pen' && (st.su != null || st.showSu)) h += '<h3>Tor eingeleitet</h3>' + pickRow('su', st.su, [st.sc, st.as].filter(x => x != null), 'setup', 'Keiner');
    else if (st.sk !== 'pen') h += '<button type="button" class="lnk inline ga-more" data-ga="showsu">+ Tor eingeleitet</button>';
  } else {
    h += '<h3>Beteiligt?</h3>' + pickRow('fx', st.fx, [], st.fk, 'Niemand');
    if (st.fx != null) h += '<div class="ga-cs">' + FAULT_KINDS.map(([k, l]) => chip('fk:' + k, st.fk === k, l, pts(st.fx, k))).join('') + '</div>';
  }
  return h + '<button type="button" class="btn primary full ga-done" data-ga="done">Fertig</button></div>';
}
function render() { const w = wrap(); if (w && st) w.innerHTML = html(); }

/* side: 'us' | 'them'; grp: Gruppe des schon gebuchten Team-Tors; scorer/kind: vorbelegt (Tipp auf „Tor“ beim Spieler) */
export function openGoal(side, grp, t, { scorer = null, kind = 'goal' } = {}) {
  st = { side, grp, t, sc: scorer, sk: kind, sb: new Set(), as: null, ak: 'ast', ab: new Set(), su: null, showSu: false, fx: null, fk: 'mgoal' };
  let w = wrap();
  if (!w) {
    w = document.createElement('div'); w.id = 'gaSheet'; w.className = 'ga-wrap';
    document.body.appendChild(w);
    w.addEventListener('click', onClick);
  }
  w.hidden = false;
  if (scorer != null) sync();
  render();
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
  const idx = arg === '-' ? null : +arg;
  if (v === 'done') { closeGoal(); return; }
  if (v === 'showsu') { st.showSu = true; render(); return; }
  if (k === 'sb') { if (st.sb.has(arg)) st.sb.delete(arg); else st.sb.add(arg); }
  else if (k === 'sc') { st.sc = idx; if (st.as === idx) st.as = null; if (st.su === idx) st.su = null; }
  else if (k === 'as') { st.as = idx; if (st.su === idx) st.su = null; }
  else if (k === 'su') st.su = idx;
  else if (k === 'fx') st.fx = idx;
  else if (k === 'sk') { st.sk = arg; if (arg === 'pen') { st.sb.delete('long'); st.su = null; } }
  else if (k === 'ak') st.ak = arg;
  else if (k === 'fk') st.fk = arg;
  else if (k === 'ab') { if (st.ab.has(arg)) st.ab.delete(arg); else st.ab.add(arg); }
  else return;
  buzz(8);
  sync();
  render();
}
