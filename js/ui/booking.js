/* Punktevergabe: Reiter Spiel / Angriff / Abwehr / Fehler / Verlauf.
   Im Nachtrag-Modus (Admin) ersetzt eine Minuten- und Spielstand-Eingabe die Spieluhr. */
import { $, esc, fmt, cls, clock, minStamp, setNum, applyTier, buzz } from '../core/util.js';
import { GROUPS, QUICK_DEFAULTS } from '../data/actions.js';
import { POS_NAME, POS_ORDER } from '../data/players.js';
import {
  store, saveGame, replaceGame, freshGame, names, isHome, scoreText, ACT, val, count, score, elapsed, onField, started,
  startLine, endLines, total, withMarkers, summaryText, isMulti, withPlayer, eachPlayer, allSaved
} from '../core/game.js';
import { PL } from '../data/players.js';
import { halftimeLi, subLi, avatar } from './components.js';
import { renderSquadBar, bindSquad } from './squad.js';
import { registerView, show, nav } from '../router.js';
import { openSetup } from './setup.js';

let tab = 'spiel';
const confirm = { end: false, reset: false };
const main = () => $('editBody');

/* ---------- Bausteine ---------- */
function actBtn(key) {
  const a = ACT[key], p = val(a), c = count(key);
  return '<button type="button" class="act' + (c ? ' on' : '') + '" data-k="' + key + '"><span class="lb">' + esc(a.l) +
    '</span><span class="pt ' + cls(p) + '">' + fmt(p) + '</span>' + (c ? '<span class="cnt">' + c + '</span>' : '') + '</button>';
}
/* Aktionen nach Punktgröße gebündelt: klein oben, groß unten */
function groupsHtml(k) {
  const S = store.S, keys = [];
  for (const g of GROUPS[k]) { if (g.only && g.only !== S.pos) continue; for (const x of g.a) keys.push(x[0]); }
  const sm = [], mid = [], big = [];
  for (const key of keys) { const p = Math.abs(val(ACT[key])); (p >= 25 ? big : p >= 10 ? mid : sm).push(key); }
  const sec = (t, list, c) => (list.length ? '<h2>' + t + '</h2><div class="' + c + '">' + list.map(actBtn).join('') + '</div>' : '');
  return sec('Klein', sm, 'grid chips') + sec('Mittel', mid, 'grid') + sec('Hoch', big, 'grid big');
}
function autoHtml() {
  const ls = [startLine(), ...endLines()].filter(Boolean);
  return ls.length ? '<ul class="auto">' + ls.map(l => '<li><span>' + esc(l.l) + (l.h ? '<small>' + esc(l.h) + '</small>' : '') + '</span><span class="v ' + cls(l.p) + '">' + fmt(l.p) + '</span></li>').join('') + '</ul>' : '';
}
function seg(label, options, current) {
  return '<div class="fl">' + label + '</div><div class="seg full" role="group" aria-label="' + label + '">' +
    options.map(([k, t]) => '<button type="button" data-do="' + k + '" aria-pressed="' + (current === k) + '">' + t + '</button>').join('') + '</div>';
}
function settingsHtml(disabled) {
  const S = store.S;
  return seg('Position', POS_ORDER.map(k => ['p' + k, POS_NAME[k]]), 'p' + S.pos) +
    seg('Spielort', [['homeY', 'Heim'], ['homeN', 'Auswärts']], isHome() ? 'homeY' : 'homeN');
}
function endHtml() {
  const S = store.S;
  let h = '<h2>Spielende</h2>';
  if (S.ended) h += allSaved() ? '' : '<button type="button" class="btn full" style="min-height:54px" data-do="reopen">Spiel wieder öffnen</button>';
  else if (confirm.end) h += '<div class="duo" style="margin-top:0"><button type="button" class="btn primary" data-do="end-yes" style="min-height:54px">Ja, beenden</button><button type="button" class="btn" data-do="end-no" style="min-height:54px">Abbrechen</button></div>';
  else h += '<button type="button" class="btn primary full" style="min-height:56px;font-size:16px" data-do="end">' + (S.manual ? 'Nachtrag abschließen' : 'Spiel beenden') + '</button>';
  h += '<div class="duo">';
  if (confirm.reset) h += '<button type="button" class="btn danger" data-do="reset-yes">' + (S.ended && !allSaved() ? 'Ohne Speichern weg' : 'Ja, neues Spiel') + '</button><button type="button" class="btn" data-do="reset-no">Abbrechen</button>';
  else h += '<button type="button" class="btn danger"' + (started() ? ' style="grid-column:1/-1"' : '') + ' data-do="reset">Neues Spiel</button>' + (!started() ? '<button type="button" class="btn" data-do="change">' + (isMulti() ? 'Spieler/Gegner ändern' : 'Spieler ändern') + '</button>' : '');
  return h + '</div>';
}

/* ---------- Reiter "Spiel" (live) ---------- */
function liveGameHtml() {
  const S = store.S, running = !!S.clock.startedAt, sc = score(), d = S.ended ? ' disabled' : '';
  return '<h2>Spieluhr</h2>' +
    '<div class="card"><div class="big-clk"><span id="clk">' + clock(elapsed()) + '</span></div>' +
      '<button type="button" class="btn primary big" data-do="clock"' + d + '>' + (running ? 'Pause' : (!S.h2 && elapsed() > 2700 ? '2. Halbzeit starten' : 'Start')) + '</button>' +
      '<div class="trio"><button type="button" class="btn" data-do="m-1"' + d + '>-1 Min</button><button type="button" class="btn" data-do="m+1"' + d + '>+1 Min</button>' +
      '<button type="button" class="btn" data-do="half2"' + d + '>2. HZ ab 45:00</button></div></div>' +
    '<h2>Spielstand</h2>' +
    '<div class="scorebox">' + scoreText(sc, isHome()) + '</div>' +
    '<div class="grid">' + (isHome() ? actBtn('tg') + actBtn('cg') : actBtn('cg') + actBtn('tg')) + '</div>' +
    (isMulti() ? '<p class="muted small hint">Tore zählen für alle auf dem Platz.</p>' + lineupHtml(d) +
      '<h2>Einstellungen · ' + esc(names.player) + '</h2><div class="card">' + settingsHtml() + '</div>'
    : '<h2>Einsatz</h2><div class="card">' +
      seg('Start', [['start1', 'Startelf'], ['start0', 'Bank']], S.startelf ? 'start1' : 'start0') +
      '<button type="button" class="btn full" style="margin-top:10px" data-do="field"' + d + '>' + (onField() ? 'Auswechseln' : 'Einwechseln') + '</button>' +
      settingsHtml() +
    '</div>') +
    '<h2>Automatische Punkte</h2><div class="card" id="autoBox">' + autoHtml() + '</div>' + endHtml();
}

/* Aufstellung bei mehreren Spielern: Startelf/Bank vor dem Anpfiff, danach Ein-/Auswechseln – ohne Spielerwechsel */
function lineupHtml(d) {
  const pre = !started();
  const rows = eachPlayer(i => {
    const S = store.S, on = onField(), p = PL[S.match.p];
    const state = pre ? (S.startelf ? 'Startelf' : 'Bank') : on ? 'Auf dem Platz' : S.stints.length ? 'Ausgewechselt' : 'Bank';
    const btns = pre
      ? '<span class="seg lseg"><button type="button" data-do="sb1:' + i + '" aria-pressed="' + S.startelf + '">Startelf</button><button type="button" data-do="sb0:' + i + '" aria-pressed="' + !S.startelf + '">Bank</button></span>'
      : '<button type="button" class="btn sm' + (on ? '' : ' primary') + '" data-do="fld:' + i + '"' + d + '>' + (on ? 'Raus' : 'Rein') + '</button>';
    return '<li class="lup' + (on ? ' on' : '') + '">' + avatar(S.match.p) + '<span><b>' + esc(p.n) + '</b><small>' + state + '</small></span>' + btns + '</li>';
  });
  return '<h2>Aufstellung</h2><ul class="lups">' + rows.join('') + '</ul>';
}

/* ---------- Reiter "Spiel" (Nachtrag) ---------- */
const MF_DEFAULT = { dur: 92, inMin: '', outMin: '', us: 0, them: 0, usOn: 0, themOn: 0 };
function numField(id, label, value, opts = '') {
  return '<label class="nf"><span>' + label + '</span><input class="fi" type="number" inputmode="numeric" min="0" max="150" data-mf="' + id + '" value="' + esc(value) + '" ' + opts + '></label>';
}
function manualGameHtml() {
  const S = store.S, mf = S.mf || MF_DEFAULT, d = S.ended ? ' disabled' : '';
  const day = (S.playedAt || new Date().toISOString()).slice(0, 10);
  return '<div class="note-badge">Nachtrag · wird mit Spieldatum gespeichert</div>' +
    '<h2>Spieltag</h2><div class="card"><label class="nf"><span>Datum</span><input class="fi" type="date" data-mf="date" value="' + day + '"' + d + '></label>' +
      numField('dur', 'Spieldauer inkl. Nachspielzeit (Min.)', mf.dur, d) + '</div>' +
    '<h2>Einsatz</h2><div class="card">' +
      seg('Start', [['start1', 'Startelf'], ['start0', 'Bank']], S.startelf ? 'start1' : 'start0') +
      '<div class="nf2">' + (S.startelf ? '' : numField('inMin', 'Eingewechselt (Minute)', mf.inMin, d)) +
      numField('outMin', 'Ausgewechselt (Minute, leer = bis Schluss)', mf.outMin, d) + '</div>' +
      settingsHtml() + '</div>' +
    '<h2>Spielstand</h2><div class="card"><div class="nf2">' +
      numField('us', 'Tore ' + esc(names.team), mf.us, d) + numField('usOn', 'davon mit ihm auf dem Platz', mf.usOn, d) +
      numField('them', 'Tore ' + esc(names.opp), mf.them, d) + numField('themOn', 'davon mit ihm auf dem Platz', mf.themOn, d) +
    '</div><div class="scorebox" style="margin:14px 0 0">' + scoreText(score(), isHome()) + '</div></div>' +
    '<h2>Automatische Punkte</h2><div class="card" id="autoBox">' + autoHtml() + '</div>' + endHtml();
}
/* Eingaben des Nachtrags in Einsatzzeiten, Wechsel-Marken und Tor-Ereignisse übersetzen */
function applyManual() {
  const S = store.S, mf = S.mf;
  const n = (v, def) => (v === '' || v == null || isNaN(+v) ? def : Math.max(0, Math.min(150, Math.round(+v))));
  const dur = n(mf.dur, 90), inMin = n(mf.inMin, null), outMin = n(mf.outMin, null);
  const from = S.startelf ? 0 : inMin, to = Math.min(outMin != null ? outMin : dur, dur);
  S.stints = from == null ? [] : [{ from: from * 60, to: Math.max(from, to) * 60 }];
  S.clock = { offset: dur * 60, startedAt: null };
  S.subs = [];
  /* Marken zeigen die eingegebene Minute (Minute 70 = Sekunde 69:xx) */
  if (!S.startelf && from != null) S.subs.push({ o: 'in', at: 0, t: Math.max(0, from - 1) * 60 });
  if (outMin != null && from != null && outMin < dur) S.subs.push({ o: 'out', at: 1e9, t: Math.max(0, outMin - 1) * 60 });
  const us = n(mf.us, 0), them = n(mf.them, 0), usOn = Math.min(n(mf.usOn, 0), us), themOn = Math.min(n(mf.themOn, 0), them);
  S.events = S.events.filter(e => e.key !== 'tg' && e.key !== 'cg');
  const add = (key, pts) => S.events.push({ id: S.nextId++, key, label: ACT[key].s, pts, t: -1 });
  for (let i = 0; i < us; i++) add('tg', i < usOn ? 5 : 0);
  for (let i = 0; i < them; i++) add('cg', i < themOn ? -5 : 0);
}

/* ---------- Reiter "Verlauf" ---------- */
function logHtml() {
  const S = store.S;
  const items = withMarkers(S.events.slice().reverse()).map(it => {
    if (it.ht) return halftimeLi();
    if (it.sub) return subLi(it.sub);
    const e = it.e;
    return '<li><span class="mn">' + minStamp(e.t) + '</span><span>' + esc(e.label) + '</span><span class="p ' + cls(e.pts) + '">' + fmt(e.pts) + '</span>' +
      '<button type="button" class="x" data-del="' + e.id + '" aria-label="' + esc(e.label) + ' löschen">×</button></li>';
  }).join('');
  return '<h2>Alle Aktionen (' + S.events.length + ')</h2>' +
    (items ? '<ul class="log">' + items + '</ul>' : '<ul class="log"><li><span class="none">Noch nichts gebucht.</span></li></ul>') +
    '<h2>Zusammenfassung</h2><textarea id="sum" readonly aria-label="Zusammenfassung">' + esc(summaryText()) + '</textarea>' +
    '<div class="row2"><button type="button" class="btn primary" data-do="copy" id="copyBtn">Kopieren</button></div>';
}

/* ---------- Schnellleiste und Rückgängig ---------- */
function updateQuick() {
  const S = store.S, q = $('quick'), visible = tab === 'att' || tab === 'def' || tab === 'err';
  q.hidden = !visible;
  if (!visible) return;
  const seen = new Set(), keys = [];
  for (const e of S.events.slice().reverse()) {
    const a = ACT[e.key];
    if (!seen.has(e.key) && a && e.key !== 'tg' && e.key !== 'cg' && !(a.only && a.only !== S.pos)) { seen.add(e.key); keys.push(e.key); }
  }
  for (const k of QUICK_DEFAULTS[S.pos] || QUICK_DEFAULTS.ABW) if (keys.length < 8 && !seen.has(k) && ACT[k]) { seen.add(k); keys.push(k); }
  $('qrow').innerHTML = keys.slice(0, 8).map(k => {
    const a = ACT[k], p = val(a);
    return '<button type="button" class="qc" data-k="' + k + '"><span>' + esc(a.l) + '</span><b class="' + cls(p) + '">' + fmt(p) + '</b></button>';
  }).join('');
}
function refresh() {
  const S = store.S, t = total();
  updateQuick();
  applyTier(t);
  setNum($('eTot'), t);
  const lu = lastUndo();
  $('undo').hidden = !lu;
  if (lu) {
    const last = lu.e, who = isMulti() ? (lu.grp ? 'Alle · ' : PL[lu.p].n + ' · ') : '';
    $('undoTx').innerHTML = esc(who + (minStamp(last.t) ? minStamp(last.t) + ' ' : '') + last.label) + '<b class="' + cls(last.pts) + '">' + fmt(last.pts) + '</b>';
  }
  document.body.classList.toggle('multi', isMulti());
  renderSquadBar($('squadE'));
  if (isMulti()) document.body.style.setProperty('--sqh', $('squadE').offsetHeight + 'px');
}
/* Letzte rückgängig machbare Aktion (bei mehreren Spielern: die jüngste über alle Spieler) */
function lastUndo() {
  const S = store.S, ok = e => !(S.manual && (e.key === 'tg' || e.key === 'cg'));
  if (!isMulti()) { const e = [...S.events].reverse().find(ok); return e ? { e, i: S.cur } : null; }
  let best = null;
  eachPlayer(i => { for (const e of store.S.events) if ((e.ts || 0) >= (best ? best.e.ts || 0 : -1)) best = { e, i, p: store.S.match.p, grp: e.grp }; });
  return best;
}
export function render() {
  const S = store.S;
  document.querySelector('[data-tab="def"] .tl').textContent = S.pos === 'TW' ? 'Torwart' : 'Abwehr';
  $('etitle').textContent = S.manual ? 'Spiel nachtragen' : 'Punkte vergeben';
  const m = main();
  if (tab === 'spiel') m.innerHTML = S.manual ? manualGameHtml() : liveGameHtml();
  else if (tab === 'log') m.innerHTML = logHtml();
  else m.innerHTML = groupsHtml(tab);
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab)));
  refresh();
}

/* ---------- Aktionen ---------- */
function addEvent(key) {
  const S = store.S, a = ACT[key];
  if (!a) return;
  const live = !S.manual && (S.clock.startedAt !== null || S.clock.offset > 0), t = live ? Math.floor(elapsed()) : -1, ts = Date.now();
  if (isMulti() && (key === 'tg' || key === 'cg')) {
    /* Tore betreffen alle: jeder Spieler bekommt den Eintrag, Punkte nur wer auf dem Platz steht */
    const grp = 'g' + ts;
    eachPlayer(() => { const P = store.S; P.events.push({ id: P.nextId++, key, label: a.s || a.l, pts: val(a), t, ts, grp }); });
  } else S.events.push({ id: S.nextId++, key, label: a.s || a.l, pts: val(a), t, ts });
  saveGame(); buzz(12);
  if (tab === 'spiel') { render(); return; }
  main().querySelectorAll('[data-k="' + key + '"]').forEach(el => { el.outerHTML = actBtn(key); });
  main().querySelectorAll('[data-k="' + key + '"]').forEach(el => el.classList.add('hit'));
  refresh();
}
function setField(on) {
  const S = store.S, el = elapsed(), l = S.stints[S.stints.length - 1];
  if (on) { if (!l || l.to !== null) S.stints.push({ from: el, to: null }); }
  else if (l && l.to === null) l.to = el;
}
function toggleField(S, el) {
  const goOn = !onField();
  setField(goOn);
  const last = S.subs[S.subs.length - 1];
  if (last && last.at === S.nextId && last.o !== (goOn ? 'in' : 'out')) S.subs.pop(); // Doppel-Tipp hebt sich auf
  else S.subs.push({ o: goOn ? 'in' : 'out', at: S.nextId, t: Math.floor(el) });
}
function setClock(sec, run) { store.S.clock.offset = Math.max(0, sec); store.S.clock.startedAt = run ? Date.now() : null; }
/* 2. Halbzeit: Uhr springt auf 45:00 zurück; die Nachspielzeit der 1. Halbzeit bleibt Einsatzzeit */
function startHalf2() {
  const S = store.S, el = elapsed(), first = !S.h2;
  eachPlayer(() => {
    const P = store.S, l = P.stints[P.stints.length - 1];
    if (el > 2700 && l && l.to === null) { l.to = el; P.stints.push({ from: 2700, to: null }); }
    if (first) P.h2Id = P.nextId;
  });
  S.h2 = true;
  setClock(2700, true);
}
function doAct(what) {
  const S = store.S, el = elapsed(), running = !!S.clock.startedAt;
  switch (what) {
    case 'clock': if (S.ended) return; if (!running && !S.h2 && el > 2700) startHalf2(); else setClock(el, !running); break;
    case 'm-1': setClock(el - 60, running); break;
    case 'm+1': setClock(el + 60, running); break;
    case 'half2': if (S.ended) return; startHalf2(); break;
    case 'start1': S.startelf = true; if (S.manual) applyManual(); else if (!started()) S.stints = [{ from: 0, to: null }]; break;
    case 'start0': S.startelf = false; if (S.manual) applyManual(); else if (!started()) S.stints = []; break;
    case 'field': toggleField(S, el); break;
    case 'end': confirm.end = true; render(); return;
    case 'end-no': confirm.end = false; render(); return;
    case 'end-yes':
      if (!S.manual) { setClock(el, false); eachPlayer(() => setField(false)); }
      S.ended = true; confirm.end = false; saveGame(); show('home'); return;
    case 'reopen': if (allSaved()) return; S.ended = false; break;
    case 'reset': confirm.reset = true; render(); return;
    case 'reset-no': confirm.reset = false; render(); return;
    case 'reset-yes': replaceGame(freshGame({ pos: S.pos })); confirm.reset = false; openSetup(); return;
    case 'pTW': case 'pABW': case 'pMIT': case 'pANG': S.pos = what.slice(1); break;
    case 'homeY': S.match.home = true; break;
    case 'homeN': S.match.home = false; break;
    case 'change': openSetup(S.match, { manual: S.manual, squad: isMulti() }); return;
    case 'undo': {
      const lu = lastUndo();
      if (!lu) break;
      if (lu.grp) eachPlayer(() => { store.S.events = store.S.events.filter(e => e.grp !== lu.grp); });
      else withPlayer(lu.i, () => { store.S.events = store.S.events.filter(e => e !== lu.e); });
      break;
    }
    case 'copy': copySummary(); return;
    default: {
      /* Aufstellung bei mehreren Spielern: sb1:i / sb0:i (Startelf/Bank), fld:i (rein/raus) */
      const m = /^(sb1|sb0|fld):(\d+)$/.exec(what);
      if (!m) return;
      withPlayer(+m[2], () => {
        const P = store.S;
        if (m[1] === 'fld') toggleField(P, el);
        else if (!started()) { P.startelf = m[1] === 'sb1'; P.stints = P.startelf ? [{ from: 0, to: null }] : []; }
      });
    }
  }
  saveGame(); render();
}
function copySummary() {
  const ta = $('sum'), btn = $('copyBtn');
  const done = msg => { btn.textContent = msg; setTimeout(() => { btn.textContent = 'Kopieren'; }, 2000); };
  const fallback = () => { ta.focus(); ta.select(); try { done(document.execCommand('copy') ? 'Kopiert' : 'Markiert, bitte kopieren'); } catch (e) { done('Markiert, bitte kopieren'); } };
  try { navigator.clipboard.writeText(ta.value).then(() => done('Kopiert'), fallback); } catch (e) { fallback(); }
}

/* Sekundentakt: Uhr und Automatik-Punkte aktualisieren */
export function tick() {
  const c = $('clk'); if (c) c.textContent = clock(elapsed());
  const ab = $('autoBox'); if (ab) ab.innerHTML = autoHtml();
  setNum($('eTot'), total());
}

export function initBooking() {
  registerView('edit', {
    elements: ['edit'],
    guard: () => (store.S.match ? null : 'start'),
    enter: () => { confirm.end = false; confirm.reset = false; },
    render
  });
  main().addEventListener('click', e => {
    const b = e.target.closest('[data-k],[data-do],[data-del]');
    if (!b) return;
    if (b.hasAttribute('data-k')) addEvent(b.getAttribute('data-k'));
    else if (b.hasAttribute('data-do')) doAct(b.getAttribute('data-do'));
    else { const id = +b.getAttribute('data-del'); store.S.events = store.S.events.filter(x => x.id !== id); saveGame(); render(); }
  });
  /* Nachtrag: Eingabefelder */
  main().addEventListener('change', e => {
    const f = e.target.closest('[data-mf]'), S = store.S;
    if (!f || !S.manual) return;
    const k = f.getAttribute('data-mf');
    if (k === 'date') { if (f.value) S.playedAt = new Date(f.value + 'T15:00:00').toISOString(); }
    else { S.mf = Object.assign({}, MF_DEFAULT, S.mf); S.mf[k] = f.value; applyManual(); }
    saveGame(); render();
  });
  $('quick').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) addEvent(b.getAttribute('data-k')); });
  /* Spielerleiste: Tipp wechselt den Spieler, Wischen über die Aktionen springt zum nächsten */
  bindSquad($('squadE'), main(), () => { buzz(8); render(); });
  $('undo').addEventListener('click', e => { if (e.target.closest('[data-do="undo"]')) doAct('undo'); });
  document.querySelector('.tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.getAttribute('data-tab'); confirm.end = false; confirm.reset = false;
    render(); window.scrollTo(0, 0);
  });
}

/* Startet den Nachtrag-Modus für ein neues Spiel */
export function prepareManual(S) {
  S.manual = true;
  S.mf = Object.assign({}, MF_DEFAULT);
  S.playedAt = S.playedAt || new Date().toISOString();
  replaceGame(S);
  applyManual();
  saveGame();
  tab = 'spiel';
}
export function resetTab() { tab = 'spiel'; }
export { nav };
