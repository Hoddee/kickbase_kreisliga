/* Punktevergabe: Reiter Spiel / Angriff / Abwehr / Fehler / Verlauf.
   Im Nachtrag-Modus (Admin) ersetzt eine Minuten- und Spielstand-Eingabe die Spieluhr. */
import { $, esc, fmt, cls, clock, minStamp, setNum, applyTier, buzz, toast } from '../core/util.js';
import { GROUPS, QUICK_DEFAULTS } from '../data/actions.js';
import { POS_NAME, POS_ORDER } from '../data/players.js';
import {
  store, saveGame, replaceGame, freshGame, names, isHome, scoreText, ACT, val, count, score, elapsed, onField, started,
  startLine, endLines, total, withMarkers, silentGoal, summaryText, isMulti, withPlayer, eachPlayer, allSaved,
  addToSquad, squadIds, teamOf, MAX_SQUAD
} from '../core/game.js';
import { PL, PLAYER_LIST } from '../data/players.js';
import { halftimeLi, subLi, avatar } from './components.js';
import { renderSquadBar, bindSquad } from './squad.js';
import { registerView, show, nav } from '../router.js';
import { openSetup } from './setup.js';
import { openGoal, closeGoal, initGoal } from './goal.js';
import { shareLiveGame } from './watch.js';
import { bookingTourSeen, showBookingTour } from './intro.js';
import { initOneHand, renderPad, oneHandBtn } from './onehand.js';

let tab = 'spiel';
const confirm = { end: false, reset: false };
/* Spieler nachträglich dazuholen: Auswahl offen, gewählter Spieler, auch andere Vereine zeigen */
const add = { open: false, p: null, all: false };
const main = () => $('editBody');

/* ---------- Bausteine ---------- */
function actBtn(key) {
  const a = ACT[key], p = val(a), c = count(key);
  return '<button type="button" class="act' + (c ? ' on' : '') + '" data-k="' + key + '"><span class="lb">' + esc(a.l) +
    '</span><span class="pt ' + cls(p) + '">' + fmt(p) + '</span>' + (c ? '<span class="cnt">' + c + '</span>' : '') + '</button>';
}
/* Aktionen nach Bedeutung gruppiert (Schüsse, Pässe, Zweikämpfe …) – so findet man sie, ohne die Punkte zu kennen */
/* Kleine, häufige Aktionen oben (schnell erreichbar), große wie Tor oder Karte unten:
   Gruppen nach durchschnittlichen Punkten sortiert, in der Gruppe ebenfalls aufsteigend (Minuspunkte nach Betrag) */
function groupsHtml(k) {
  const S = store.S, size = key => Math.abs(val(ACT[key]));
  return GROUPS[k].filter(g => !g.only || g.only === S.pos)
    .map(g => ({ g, keys: g.a.map(x => x[0]).sort((a, b) => size(a) - size(b)) }))
    .map(x => Object.assign(x, { avg: x.keys.reduce((s, key) => s + size(key), 0) / x.keys.length }))
    .sort((a, b) => a.avg - b.avg)
    .map(({ g, keys }) => '<h2>' + esc(g.t) + '</h2><div class="grid">' + keys.map(actBtn).join('') + '</div>').join('');
}
/* Suche über alle Reiter: „flanke“, „elfmeter“, „pass“ … */
let query = '';
const norm = t => t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
function searchHtml(q) {
  const S = store.S, words = norm(q).split(/\s+/).filter(Boolean), hits = [];
  for (const k of ['att', 'def', 'err']) for (const g of GROUPS[k]) {
    if (g.only && g.only !== S.pos) continue;
    for (const x of g.a) { const l = norm(x[1] + ' ' + g.t); if (words.every(w => l.includes(w)) && !hits.includes(x[0])) hits.push(x[0]); }
  }
  return hits.length ? '<h2>' + hits.length + ' Treffer</h2><div class="grid">' + hits.map(actBtn).join('') + '</div>'
    : '<p class="ahint">Nichts gefunden.</p>';
}
const actListHtml = () => (query.trim() ? searchHtml(query) : groupsHtml(tab));
const searchBox = () => '<div class="asearch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
  '<input id="aq" type="search" enterkeyhint="search" autocomplete="off" placeholder="' + (isMulti() ? 'Aktion für ' + esc(names.player) + ' suchen …' : 'Aktion suchen …') + '" aria-label="Aktion suchen" value="' + esc(query) + '">' +
  (query ? '<button type="button" class="aqx" data-do="q-x" aria-label="Suche löschen">×</button>' : '') + '</div>';
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
  /* Halbzeit: „Halbzeitpfiff“ hält die Uhr an, danach ist der große Knopf „2. Halbzeit anpfeifen“ (Uhr springt auf 45:00) */
  const big = S.ht ? '2. Halbzeit anpfeifen' : running ? 'Pause' : (!S.h2 && elapsed() > 2700 ? '2. Halbzeit anpfeifen' : started() ? 'Weiter' : 'Anpfiff');
  const third = S.ht ? '<button type="button" class="btn" data-do="ht-x"' + d + '>Doch weiter</button>'
    : S.h2 ? '<button type="button" class="btn" data-do="endq"' + d + '>Abpfiff</button>'
    : '<button type="button" class="btn" data-do="ht"' + (d || (!started() ? ' disabled' : '')) + '>Halbzeitpfiff</button>';
  return '<h2>Spieluhr</h2>' +
    '<div class="card"><div class="big-clk"><span id="clk">' + clock(elapsed()) + '</span></div>' +
      (S.ht ? '<div class="htlabel">Halbzeit</div>' : '') +
      '<button type="button" class="btn primary big" data-do="' + (S.ht ? 'half2' : 'clock') + '"' + d + '>' + big + '</button>' +
      '<div class="trio"><button type="button" class="btn" data-do="m-1"' + d + '>-1 Min</button><button type="button" class="btn" data-do="m+1"' + d + '>+1 Min</button>' +
      third + '</div></div>' +
    '<h2>Spielstand</h2>' +
    '<div class="scorebox">' + scoreText(sc, isHome()) + '</div>' +
    '<div class="grid">' + (isHome() ? actBtn('tg') + actBtn('cg') : actBtn('cg') + actBtn('tg')) + '</div>' +
    '<div class="grid ungoal">' + (isHome() ? unBtn('tg', sc.us) + unBtn('cg', sc.them) : unBtn('cg', sc.them) + unBtn('tg', sc.us)) + '</div>' +
    (isMulti() ? lineupHtml(d) + addHtml() +
      '<h2>Einstellungen · ' + esc(names.player) + '</h2><div class="card">' + settingsHtml() + '</div>'
    : '<h2>Einsatz</h2><div class="card">' +
      seg('Start', [['start1', 'Startelf'], ['start0', 'Bank']], S.startelf ? 'start1' : 'start0') +
      '<button type="button" class="btn full" style="margin-top:10px" data-do="field"' + d + '>' + (onField() ? 'Auswechseln' : 'Einwechseln') + '</button>' +
      settingsHtml() +
    '</div>' + addHtml()) +
    '<h2>Automatische Punkte</h2><div class="card" id="autoBox">' + autoHtml() + '</div>' +
    (S.ended ? '' : '<h2>Zuschauer</h2><button type="button" class="btn full lvshare" data-do="lshare">Live-Link teilen</button>') +
    endHtml();
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

/* Falsch gebuchtes Tor zurücknehmen – bei mehreren Spielern für alle auf einmal */
const unBtn = (key, n) => '<button type="button" class="unb" data-do="ungoal:' + key + '"' + (n && !store.S.ended ? '' : ' disabled') + '>− Tor zurück</button>';
function removeGoal(key) {
  let last = null;
  for (const e of store.S.events) if (e.key === key && (!last || e.id > last.id)) last = e;
  if (!last) return;
  dropEvent(last);
}
/* Ein Tor gehört allen: mit dem Eintrag verschwindet es bei jedem Spieler */
function dropEvent(ev) {
  const g = ev.grp;
  /* mit dem Tor gehen auch Torschütze, Vorlage usw. aus dem Tor-Assistenten (gg = Tor-Gruppe) */
  if (g) eachPlayer(() => { store.S.events = store.S.events.filter(e => e.grp !== g && e.gg !== g); });
  else store.S.events = store.S.events.filter(e => e !== ev);
}

/* Spieler dazuholen: erst wählen, dann sagen, seit wann er dabei ist */
function addHtml() {
  const S = store.S, ids = squadIds();
  if (S.manual || ids.length >= MAX_SQUAD) return '';
  if (!add.open) return '<button type="button" class="add-row" data-do="add"><span class="plus">+</span><span>Spieler dazu<small>Vergessen oder spontan dabei · ' + ids.length + '/' + MAX_SQUAD + '</small></span></button>';
  const team = teamOf(S.match), free = PLAYER_LIST.filter(p => p.active !== false && !p.guest && !ids.includes(p.id));
  const mine = free.filter(p => p.c === team), rest = free.filter(p => p.c !== team);
  const chip = p => '<button type="button" class="apk" data-do="ap:' + esc(p.id) + '" aria-pressed="' + (add.p === p.id) + '">' + avatar(p.id) + '<span>' + esc(p.n) + '</span></button>';
  let h = '<h2>Spieler dazu</h2><div class="card addc"><div class="apks">' + (mine.length ? mine : rest).map(chip).join('') +
    (mine.length && add.all ? rest.map(chip).join('') : '') + '</div>' +
    (mine.length && rest.length && !add.all ? '<button type="button" class="lnk inline" data-do="add-all">Andere Vereine zeigen</button>' : '');
  if (add.p && PL[add.p]) {
    const n = esc(PL[add.p].n), modes = !started() ? [['start', 'Hinzufügen']] : S.ended ? [['start', 'War von Anfang an dabei']]
      : [['start', 'Seit Anpfiff'], ['bench', 'Auf der Bank'], ['in', 'Jetzt rein']];
    h += '<div class="fl">' + n + (started() ? ' ist dabei …' : '') + '</div><div class="amodes">' + modes.map(([k, t], i) =>
      '<button type="button" class="btn' + (i === 0 ? ' primary' : '') + '" data-do="am:' + k + '">' + t + '</button>').join('') + '</div>';
  }
  return h + '<button type="button" class="btn full ghost" data-do="add-x">Abbrechen</button></div>';
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
    if (silentGoal(e)) return '';
    return '<li><span class="mn">' + minStamp(e.t) + '</span><span>' + esc(e.label) + '</span><span class="p ' + cls(e.pts) + '">' + fmt(e.pts) + '</span>' +
      '<button type="button" class="x" data-del="' + e.id + '" aria-label="' + esc(e.label) + ' löschen">×</button></li>';
  }).join('');
  return '<h2>Alle Aktionen (' + S.events.filter(e => !silentGoal(e)).length + ')</h2>' +
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
  const rec = recentBookings();
  $('undo').hidden = !rec.length;
  if (rb.sel && !rec.some(x => x.k === rb.sel)) rb.sel = null;
  $('undoTx').innerHTML = rec.map(x => '<button type="button" class="rbc' + (rb.sel === x.k ? ' on' : '') + '" data-rb="' + x.k + '">' +
    (isMulti() ? '<i>' + esc(x.grp ? 'Alle' : PL[x.p].n) + '</i>' : '') + '<span>' + esc(x.e.label) + '</span><b class="' + cls(x.e.pts) + '">' + fmt(x.e.pts) + '</b></button>').join('');
  const sel = rec.find(x => x.k === rb.sel), menu = $('rbMenu');
  menu.hidden = !sel;
  if (sel) {
    const others = isMulti() && !sel.grp ? eachPlayer(i => (i === sel.i ? null : { i, p: store.S.match.p })).filter(Boolean) : [];
    menu.innerHTML = '<div class="wrap"><div class="rbm-t">' + esc((minStamp(sel.e.t) ? minStamp(sel.e.t) + ' · ' : '') + sel.e.label + (isMulti() ? ' · ' + (sel.grp ? 'alle Spieler' : PL[sel.p].n) : '')) + '</div>' +
      (others.length ? '<div class="rbm-l">Gehört zu</div><div class="rbm-ps">' + others.map(o => '<button type="button" class="rbm-p" data-rb-to="' + o.i + '">' + avatar(o.p) + '<span>' + esc(PL[o.p].n) + '</span></button>').join('') + '</div>' : '') +
      '<div class="rbm-a"><button type="button" class="btn danger" data-rb-del>Löschen</button><button type="button" class="btn" data-rb-x>Schließen</button></div></div>';
  }
  document.body.classList.toggle('multi', isMulti());
  renderPad();
  renderSquadBar($('squadE'));
  if (isMulti()) document.body.style.setProperty('--sqh', $('squadE').offsetHeight + 'px');
}
/* Die letzten Buchungen über alle Spieler (Tore einmal für alle) – für die Leiste unten */
const rb = { sel: null };
function recentBookings(n = 3) {
  const S = store.S, all = [], seen = new Set();
  eachPlayer(i => { for (const e of store.S.events) all.push({ e, i, p: store.S.match.p }); });
  all.sort((a, b) => (b.e.ts || 0) - (a.e.ts || 0) || b.e.id - a.e.id);
  const out = [];
  for (const x of all) {
    if (S.manual && (x.e.key === 'tg' || x.e.key === 'cg')) continue;
    if (x.e.grp) { if (seen.has(x.e.grp)) continue; seen.add(x.e.grp); x.grp = x.e.grp; }
    else if (silentGoal(x.e)) continue;
    x.k = x.i + ':' + x.e.id; out.push(x);
    if (out.length >= n) break;
  }
  return out;
}
function rbAction(kind, to) {
  const x = recentBookings().find(r => r.k === rb.sel);
  rb.sel = null;
  if (!x) return;
  if (kind === 'del') { if (x.grp) dropEvent(x.e); else withPlayer(x.i, () => { store.S.events = store.S.events.filter(e => e.id !== x.e.id); }); }
  else if (kind === 'to' && !x.grp) {
    /* Aktion einem anderen Spieler geben: Punkte nach dessen Position neu */
    withPlayer(x.i, () => { store.S.events = store.S.events.filter(e => e.id !== x.e.id); });
    withPlayer(to, () => { const P = store.S, a = ACT[x.e.key]; P.events.push(Object.assign({}, x.e, { id: P.nextId++, pts: a ? val(a) : x.e.pts, ga: undefined })); });
    toast(x.e.label + ' → ' + withPlayer(to, () => PL[store.S.match.p].n));
  }
  saveGame(); buzz(10); render();
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
  else m.innerHTML = '<div id="htBar">' + htBarHtml() + '</div><div class="asrow">' + searchBox() + oneHandBtn() + '</div><div id="actList">' + actListHtml() + '</div>';
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab)));
  refresh();
}

/* ---------- Aktionen ---------- */
function addEvent(key) {
  const S = store.S, a = ACT[key];
  if (!a) return;
  const live = !S.manual && (S.clock.startedAt !== null || S.clock.offset > 0), t = live ? Math.floor(elapsed()) : -1, ts = Date.now();
  /* „Tor“/„Elfmeter verwandelt“ beim Spieler: über den Tor-Assistenten, damit auch der Spielstand stimmt.
     Ein eben gebuchtes Team-Tor ohne Torschützen (letzte 3 Min.) wird übernommen statt ein zweites zu buchen. */
  if (!S.manual && (key === 'goal' || key === 'pen')) {
    const cur = isMulti() ? S.cur : 0, recent = [...S.events].reverse().find(e => e.key === 'tg' && !e.sc && ts - (e.ts || 0) < 180000);
    let grp = recent && recent.grp, gt = recent ? recent.t : t;
    if (recent && !grp) { grp = recent.grp = 'g' + (recent.ts || ts); }
    if (!grp) { grp = bookGoal('tg', t, ts); }
    buzz(12);
    openGoal('us', grp, gt, { scorer: cur, kind: key });
    return;
  }
  if (key === 'tg' || key === 'cg') {
    /* Tore betreffen alle: jeder Spieler bekommt den Eintrag, Punkte nur wer auf dem Platz steht */
    const grp = bookGoal(key, t, ts);
    if (!S.manual) { buzz(12); render(); openGoal(key === 'tg' ? 'us' : 'them', grp, t); return; }
  } else S.events.push({ id: S.nextId++, key, label: a.s || a.l, pts: val(a), t, ts });
  saveGame(); buzz(12);
  if (tab === 'spiel') { render(); return; }
  main().querySelectorAll('[data-k="' + key + '"]').forEach(el => { el.outerHTML = actBtn(key); });
  main().querySelectorAll('[data-k="' + key + '"]').forEach(el => el.classList.add('hit'));
  refresh();
}
/* Team-Tor/Gegentor für alle Spieler buchen; gibt die Gruppen-ID zurück */
function bookGoal(key, t, ts) {
  const a = ACT[key], grp = 'g' + ts;
  eachPlayer(() => { const P = store.S; P.events.push({ id: P.nextId++, key, label: a.s || a.l, pts: val(a), t, ts, grp }); });
  saveGame();
  return grp;
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
  S.h2 = true; S.ht = false;
  setClock(2700, true);
}
/* Hinweis oben in Angriff/Abwehr/Fehler, wenn die Halbzeit bzw. das Spielende ansteht */
function htState() {
  const S = store.S, el = elapsed(), run = !!S.clock.startedAt;
  if (S.manual || S.ended) return '';
  if (S.ht) return 'ht';
  if (run && !S.h2 && el >= 2700) return 'h1end';
  if (run && S.h2 && el >= 5400) return 'h2end';
  return '';
}
let htShown = '';
function htBarHtml() {
  const s = htShown = htState();
  if (s === 'ht') return '<div class="htbar"><span><b>Halbzeit</b></span><button type="button" class="btn primary" data-do="half2">2. HZ anpfeifen</button></div>';
  if (s === 'h1end') return '<div class="htbar"><span><b>45’+</b> 1. Halbzeit</span><button type="button" class="btn" data-do="ht">Halbzeitpfiff</button></div>';
  if (s === 'h2end') return '<div class="htbar"><span><b>90’+</b> 2. Halbzeit</span><button type="button" class="btn" data-do="endq">Abpfiff</button></div>';
  return '';
}
function doAct(what) {
  const S = store.S, el = elapsed(), running = !!S.clock.startedAt;
  switch (what) {
    case 'clock': if (S.ended) return; if (S.ht || (!running && !S.h2 && el > 2700)) startHalf2(); else setClock(el, !running); break;
    case 'm-1': setClock(el - 60, running); break;
    case 'm+1': setClock(el + 60, running); break;
    case 'half2': if (S.ended) return; startHalf2(); buzz(15); break;
    case 'ht': if (S.ended || S.h2) return; setClock(el, false); S.ht = true; buzz(15); break;
    case 'ht-x': S.ht = false; setClock(el, true); break;
    case 'endq': tab = 'spiel'; confirm.end = true; render(); { const b = main().querySelector('[data-do="end-yes"]'); if (b) b.scrollIntoView({ block: 'center' }); } return;
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
      const g = lu.grp || lu.e.grp;
      if (g) eachPlayer(() => { store.S.events = store.S.events.filter(e => e.grp !== g && e.gg !== g); });
      else withPlayer(lu.i, () => { store.S.events = store.S.events.filter(e => e !== lu.e); });
      break;
    }
    case 'copy': copySummary(); return;
    case 'q-x': query = ''; render(); { const q = $('aq'); if (q) q.focus(); } return;
    case 'lshare': shareLiveGame(isMulti() ? S.squad[0].uid : S.uid, { nm: isMulti() ? S.squad.length + ' Spieler' : names.player, team: teamOf(S.match), home: isHome(), us: score().us, them: score().them, opp: S.match.o }); return;
    case 'add': add.open = true; add.p = null; add.all = false; render(); return;
    case 'add-x': add.open = false; render(); return;
    case 'add-all': add.all = true; render(); return;
    default: {
      if (what.startsWith('ungoal:')) { removeGoal(what.slice(7)); buzz(10); break; }
      if (what.startsWith('ap:')) { add.p = what.slice(3); render(); return; }
      if (what.startsWith('am:')) {
        const p = add.p;
        if (p && addToSquad(p, what.slice(3))) { add.open = false; add.p = null; buzz(10); toast(PL[p].n + ' ist dabei'); }
        render(); return;
      }
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
  const hb = $('htBar'); if (hb && htState() !== htShown) hb.innerHTML = htBarHtml();
  const ab = $('autoBox'); if (ab) ab.innerHTML = autoHtml();
  setNum($('eTot'), total());
}

export function initBooking() {
  registerView('edit', {
    elements: ['edit'],
    guard: () => (store.S.match ? null : 'start'),
    enter: () => {
      confirm.end = false; confirm.reset = false; add.open = false;
      /* Beim ersten Mal erklären, wie die Punktevergabe funktioniert (nicht beim Nachtrag) */
      if (!store.S.manual && !bookingTourSeen()) setTimeout(() => { if (nav.current === 'edit') showBookingTour(); }, 350);
    },
    leave: () => closeGoal(),
    render
  });
  initGoal(() => { if (nav.current === 'edit') render(); });
  initOneHand({ book: addEvent, tab: () => (nav.current === 'edit' ? tab : ''), onSwitch: () => render() });
  main().addEventListener('click', e => {
    const b = e.target.closest('[data-k],[data-do],[data-del]');
    if (!b) return;
    if (b.hasAttribute('data-k')) addEvent(b.getAttribute('data-k'));
    else if (b.hasAttribute('data-do')) doAct(b.getAttribute('data-do'));
    else { const id = +b.getAttribute('data-del'), ev = store.S.events.find(x => x.id === id); if (ev) dropEvent(ev); saveGame(); render(); }
  });
  main().addEventListener('input', e => {
    if (e.target.id !== 'aq') return;
    query = e.target.value;
    $('actList').innerHTML = actListHtml();
    const box = e.target.parentElement, x = box.querySelector('.aqx');
    if (query && !x) box.insertAdjacentHTML('beforeend', '<button type="button" class="aqx" data-do="q-x" aria-label="Suche löschen">×</button>');
    else if (!query && x) x.remove();
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
  $('undo').addEventListener('click', e => {
    if (e.target.closest('[data-do="undo"]')) { rb.sel = null; doAct('undo'); return; }
    const c = e.target.closest('[data-rb]');
    if (c) { const k = c.getAttribute('data-rb'); rb.sel = rb.sel === k ? null : k; refresh(); return; }
    if (e.target.closest('[data-rb-x]')) { rb.sel = null; refresh(); return; }
    if (e.target.closest('[data-rb-del]')) { rbAction('del'); return; }
    const t = e.target.closest('[data-rb-to]');
    if (t) rbAction('to', +t.getAttribute('data-rb-to'));
  });
  document.querySelector('.tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.getAttribute('data-tab'); confirm.end = false; confirm.reset = false; query = '';
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
