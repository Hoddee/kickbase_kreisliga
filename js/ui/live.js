/* Spielerkarte (Live-Ansicht) mit Punkteliste; nach Spielende zusätzlich die Endübersicht */
import { $, esc, setNum, setSrc, applyTier, signedEur, eur, trendClass } from '../core/util.js';
import { store, saveGame, names, teamOf, isHome, scoreText, score, total, started, elapsed, startLine, endLines, withMarkers, breakdown, matchEntry, gameRecord, isMulti, eachPlayer, withPlayer, allSaved } from '../core/game.js';
import { renderSquadBar, bindSquad } from './squad.js';
import { buzz } from '../core/util.js';
import { PL, photoUrl } from '../data/players.js';
import { CL, crestUrl } from '../data/clubs.js';
import { statusIcon, ICON } from '../core/icons.js';
import { marketOf, nextValue, rating } from '../core/market.js';
import { games, loadGames, insertGame } from '../services/api.js';
import { rowLi, whistleLi, areaBars, seasonChart, toChartEntry, scrollChartsToEnd } from './components.js';
import { preloadShare, shareCard } from './share.js';
import { SEASON } from '../config.js';
import { registerView, nav } from '../router.js';

let seenId = -1, signature = '';
const save = { busy: false, error: '', confirm: false };

function stateText() {
  const S = store.S;
  if (S.ended) return 'Endstand';
  if (!started()) return 'Anstoß';
  return (S.clock.startedAt ? 'Live ' : 'Pause ') + (Math.floor(elapsed() / 60) + 1) + '’';
}
export function updateLiveState() {
  const el = $('hState'), S = store.S;
  el.textContent = stateText();
  el.className = 'state' + (!S.ended && S.clock.startedAt ? ' live' : '');
}

function rowsData() {
  const out = endLines().map(l => ({ p: l.p, label: l.l, r: l.r }));
  for (const it of withMarkers(store.S.events.slice().reverse())) {
    out.push(it.ht ? { ht: 1 } : it.sub ? { sub: it.sub } : { p: it.e.pts, label: it.e.label, r: it.e.t >= 0 ? (Math.floor(it.e.t / 60) + 1) + '’' : '', fresh: seenId >= 0 && it.e.id > seenId });
  }
  const s = startLine(); if (s) out.push({ p: s.p, label: s.l, r: s.r });
  return out;
}

/* ---------- Endübersicht ---------- */
function chartHtml() {
  const S = store.S;
  const list = (games.list || []).filter(g => g.player === S.match.p).sort((a, b) => (a.played_at < b.played_at ? -1 : 1)).map(toChartEntry);
  if (!S.saved) list.push(matchEntry());
  return seasonChart(list, names.player, { button: '<button type="button" class="obtn" data-sv="share">' + ICON.share + 'Teilen</button>' });
}
function marketHtml() {
  const S = store.S, m = marketOf(S.match.p, games.list || []), e = matchEntry();
  const g = { points: e.t, minutes: e.m, us: e.us, them: e.them }, r = rating(g);
  let v, d;
  if (S.saved) { v = m.v; d = m.last; } else { v = nextValue(m.v, g, S.uid || 'x'); d = v - m.v; }
  const sign = n => (n > 0 ? '+' : '') + n;
  const parts = '<div class="mw-r"><b>Bewertung ' + sign(r.total) + '</b>' + r.parts.map(([l, n]) => '<span class="' + (n > 0 ? 'up' : n < 0 ? 'down' : '') + '">' + l + ' ' + sign(n) + '</span>').join('') + '</div>';
  return '<div class="mwc"><div class="mw-k">' + (S.saved ? 'Marktwert' : 'Marktwert nach diesem Spiel') + '</div><div class="mw-row"><span class="mw-v">' + eur(v) +
    '</span><span class="mw-d ' + trendClass(d) + '">' + (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + signedEur(d) + '</span></div>' + parts + '</div>';
}
function saveHtml() {
  const S = store.S;
  let b;
  const multi = isMulti(), open = multi ? eachPlayer(() => !store.S.saved).filter(Boolean).length : 0;
  if (multi ? allSaved() : S.saved) b = '<div class="ok">✓ ' + (multi ? 'Alle Spieler in der Hall of Fame gespeichert' : 'In der Hall of Fame gespeichert') + '</div><button type="button" class="btn full" style="margin-top:10px" data-nav="hof">Hall of Fame ansehen</button>';
  else if (save.busy) b = '<button type="button" class="btn primary" disabled>Speichere …</button>';
  else if (save.confirm) b = '<p>' + (multi ? open + ' Spieler für alle sichtbar speichern?' : 'Für alle sichtbar speichern?') + '</p><div class="duo" style="margin-top:0"><button type="button" class="btn primary" data-sv="yes">Ja, speichern</button><button type="button" class="btn" data-sv="no">Abbrechen</button></div>';
  else b = '<button type="button" class="btn primary" data-sv="ask">' + (S.manual ? 'Nachtrag speichern' : multi ? (open === S.squad.length ? 'Alle ' + open + ' Spieler speichern' : open + ' Spieler speichern') : 'In Hall of Fame speichern') + '</button>';
  return '<div class="svc">' + b + (save.error ? '<div class="err">' + esc(save.error) + '</div>' : '') + '</div>';
}
function summaryHtml() {
  return chartHtml() + marketHtml() + saveHtml() + '<h2 class="sec">Punkte nach Bereich</h2>' + areaBars(breakdown());
}
function renderSummary() {
  $('summary').innerHTML = summaryHtml();
  scrollChartsToEnd($('summary'));
}

async function saveToCloud() {
  const S = store.S;
  if (!S.ended || allSaved() || save.busy) return;
  save.busy = true; save.error = ''; save.confirm = false; render();
  try {
    /* Bei mehreren Spielern: jeden noch nicht gespeicherten einzeln speichern */
    const recs = eachPlayer(i => (store.S.saved ? null : { i, row: gameRecord(SEASON) })).filter(Boolean);
    for (const r of recs) {
      await insertGame(r.row);
      withPlayer(r.i, () => { store.S.saved = true; });
      saveGame();
    }
    await loadGames(true);
  } catch (e) {
    save.error = e.status === 401 || e.status === 403 ? 'Keine Berechtigung (Nachträge nur als Admin).' : 'Speichern hat nicht geklappt. Netz prüfen und nochmal tippen.';
  }
  save.busy = false;
  if (nav.current === 'home') render();
}

/* ---------- Ansicht ---------- */
export function render() {
  const S = store.S, t = total(), sc = score();
  applyTier(t);
  document.body.classList.toggle('ended', !!S.ended);
  setNum($('hNum'), t);
  const mine = teamOf(S.match), left = isHome() ? mine : S.match.o, right = isHome() ? S.match.o : mine;
  setSrc($('hPhoto'), photoUrl(S.match.p), names.player);
  setSrc($('hBL'), crestUrl(left), CL[left].n);
  setSrc($('hBR'), crestUrl(right), CL[right].n);
  $('hName').innerHTML = esc(names.player) + statusIcon(S.match.p);
  $('hScore').textContent = scoreText(sc, isHome());
  $('hBadge').hidden = !S.manual;
  $('ctaL').textContent = S.ended ? 'Bearbeiten' : 'Punkte vergeben';
  $('ctaI').textContent = S.ended ? '✎' : '+';
  $('listH').hidden = !S.ended;
  if (S.ended) {
    renderSummary(); preloadShare();
    if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'home' && store.S.ended) renderSummary(); });
  } else $('summary').innerHTML = '';
  $('rows').innerHTML = rowsData().map(rowLi).join('') + (started() ? whistleLi() : '');
  renderSquadBar($('squadH'));
  seenId = S.nextId - 1;
  signature = t + '|' + S.events.length + '|' + S.ended + '|' + (S.cur || 0);
  updateLiveState();
}

/* Sekundentakt: Status aktualisieren, bei Änderungen neu zeichnen */
export function tick() {
  updateLiveState();
  const S = store.S, sig = total() + '|' + S.events.length + '|' + S.ended + '|' + (S.cur || 0);
  if (sig !== signature) render();
}

export function initLive() {
  registerView('home', {
    elements: ['home', 'cta'],
    guard: () => (store.S.match ? null : 'start'),
    enter: () => { save.confirm = false; },
    render
  });
  bindSquad($('squadH'), document.querySelector('#home .hero'), () => { buzz(8); render(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-sv]');
    if (!b) return;
    const v = b.getAttribute('data-sv');
    if (v === 'ask') { save.confirm = true; save.error = ''; render(); }
    else if (v === 'no') { save.confirm = false; render(); }
    else if (v === 'yes') saveToCloud();
    else if (v === 'share') shareCard();
  });
}
