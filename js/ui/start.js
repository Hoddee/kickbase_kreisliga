/* Startseite: Übersicht mit laufendem Spiel, nächsten Spielen der Mannschaften und dem Kader.
   Ein Tipp auf einen Spieler öffnet sein Profil, ein neues Spiel startet über „+ Neues Spiel“. */
import { $, esc, tierOf, applyTier, pad2 } from '../core/util.js';
import { PL, PLAYER_LIST } from '../data/players.js';
import { CL, OWN_CLUBS, crestUrl } from '../data/clubs.js';
import { TEAMS, nextFixture } from '../data/schedule.js';
import { store, total, score, started, isHome, teamOf, isMulti, allSaved } from '../core/game.js';
import { games, loadGames } from '../services/api.js';
import { myPlayer } from '../services/auth.js';
import { marketOf } from '../core/market.js';
import { eur, signedEur, trendClass } from '../core/util.js';
import { SEASON } from '../config.js';
import { avatar, playerRow, nameWithStatus, gameRow, skeleton } from './components.js';
import { registerView, show, nav } from '../router.js';
import { openSetup } from './setup.js';
import { liveTilesHtml } from './watch.js';
import { resetHof } from './hof.js';
import { spieltagCardHtml, maybeLaunch } from './mvp.js';
import { byDate } from '../core/market.js';

const CHEVRON = '<span class="chev" aria-hidden="true">›</span>';

/* Läuft gerade ein Spiel, das man durch ein neues verlieren würde? */
function liveGameAtRisk() {
  const S = store.S;
  return !!(S.match && !(S.ended && allSaved()) && (started() || S.events.length || S.manual));
}

/* Kleine Rückfrage als Bottom-Sheet */
function confirmSheet(title, text, ok) {
  return new Promise(res => {
    const el = document.createElement('div');
    el.className = 'sheet-bg';
    el.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT"><h3 id="shT">' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
      '<div class="duo"><button type="button" class="btn danger" data-sh="1">' + esc(ok) + '</button><button type="button" class="btn" data-sh="0">Abbrechen</button></div></div>';
    const done = v => { el.remove(); res(v); };
    el.addEventListener('click', e => { const b = e.target.closest('[data-sh]'); if (b) done(b.dataset.sh === '1'); else if (e.target === el) done(false); });
    document.body.appendChild(el);
    el.querySelector('[data-sh="0"]').focus();
  });
}

/* Neues Spiel anlegen (optional mit vorausgewähltem Spieler) */
export async function requestNewGame({ player = null } = {}) {
  if (liveGameAtRisk()) {
    const ok = await confirmSheet('Laufendes Spiel verwerfen?', 'Es gibt noch ein Spiel, das nicht gespeichert ist. Ein neues Spiel ersetzt es.', 'Neues Spiel');
    if (!ok) return;
  }
  openSetup(null, { player });
}

function runningCard() {
  const S = store.S, m = S.match;
  if (!m || !PL[m.p] || !CL[m.o] || (S.ended && allSaved())) return '';
  const t = total(), sc = score(), mine = teamOf(m), l = isHome() ? mine : m.o, r = isHome() ? m.o : mine;
  const label = S.ended ? 'Spiel beendet · noch nicht gespeichert' : S.manual ? 'Nachtrag in Arbeit' : started() ? 'Laufendes Spiel' : 'Spiel bereit';
  return '<button type="button" class="runc tc" data-tier="' + tierOf(t) + '" data-st="resume">' + avatar(m.p) +
    '<span class="runc-t"><small>' + (S.ended ? '' : '<i class="dot"></i>') + label + '</small><b>' + nameWithStatus(m.p) + (isMulti() ? ' <i class="tag">+' + (S.squad.length - 1) + ' weitere</i>' : '') + '</b>' +
    '<span class="gs"><img src="' + esc(crestUrl(l)) + '" alt="">' + (isHome() ? sc.us + ' : ' + sc.them : sc.them + ' : ' + sc.us) + '<img src="' + esc(crestUrl(r)) + '" alt=""></span></span>' +
    '<span class="runc-v">' + t + '</span>' + CHEVRON + '</button>';
}

const dayLabel = d => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today) / 864e5);
  const time = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  if (diff === 0) return 'Heute · ' + time;
  if (diff === 1) return 'Morgen · ' + time;
  return d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ' + pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '. · ' + time;
};
function fixturesStrip() {
  const fx = TEAMS.map(t => nextFixture(t)).filter(Boolean);
  if (!fx.length) return '';
  return '<h2>Nächste Spiele</h2><div class="fxs">' + fx.map(f => {
    const h = f.home ? f.team : f.o, a = f.home ? f.o : f.team;
    return '<div class="fxc"><span class="fxc-d">' + dayLabel(f.at) + '</span><div class="fxc-m"><img src="' + esc(crestUrl(h)) + '" alt="' + esc(CL[h].n) + '"><i>vs</i><img src="' + esc(crestUrl(a)) + '" alt="' + esc(CL[a].n) + '"></div>' +
      '<span class="fxc-n">' + esc(CL[f.o].n) + '</span><span class="fxc-l">' + esc(CL[f.team].n) + ' · ' + CL[f.team].lg + '</span></div>';
  }).join('') + '</div>';
}

/* Freigeschaltete Spieler: Teaser für „Mein Bereich“ ganz oben */
function meCard() {
  const id = myPlayer();
  if (!id || !PL[id] || !games.list) return '';
  const mw = marketOf(id, games.list);
  return '<button type="button" class="mecard" data-st="me">' + avatar(id) + '<span><b>Mein Bereich</b>' +
    '<em>' + eur(mw.v) + (mw.last ? ' <i class="' + trendClass(mw.last) + '">' + (mw.last > 0 ? '▲' : '▼') + ' ' + signedEur(mw.last) + '</i>' : '') + '</em></span>' + CHEVRON + '</button>';
}

/* Kein laufendes Spiel: großer Knopf zum Starten */
const newGameBtn = () => (store.S.match && !(store.S.ended && allSaved()) ? '' :
  '<button type="button" class="newgame kb-new" data-st="new"><span aria-hidden="true">+</span>Neues Spiel</button>');

/* Die letzten gespeicherten Spiele (Top 3 der Woche stehen in der Spieltag-Karte) */
function latest() {
  if (!games.list) return games.busy ? '<h2>Letzte Spiele</h2>' + skeleton(3) : '';
  const list = byDate(games.list.filter(g => PL[g.player])).reverse();
  if (!list.length) return '';
  return '<h2 class="lh2">Letzte Spiele<button type="button" class="lnk inline" data-st="hof">Alle</button></h2>' +
    '<ul class="glist">' + list.slice(0, 5).map(g => gameRow(g, 0)).join('') + '</ul>';
}

function html() {
  return liveTilesHtml() + runningCard() + newGameBtn() + meCard() + spieltagCardHtml() + fixturesStrip() + latest();
}

/* Kader: alle aktiven Spieler, nach Mannschaft */
function kaderHtml() {
  let h = '';
  const active = PLAYER_LIST.filter(p => p.active !== false);
  const clubIds = [...new Set([...OWN_CLUBS, ...active.map(p => p.c)])].filter(id => CL[id]);
  for (const clubId of clubIds) {
    const c = CL[clubId], players = active.filter(p => p.c === clubId);
    if (!players.length) continue;
    h += '<div class="grp"><img src="' + esc(crestUrl(c.id)) + '" alt=""><span>Kreisliga ' + c.lg + ' · ' + esc(c.n) + '</span></div><div class="plist">' +
      players.map(p => playerRow(p, 'data-open="p:' + esc(p.id) + '" aria-label="Profil von ' + esc(p.vn ? p.vn + ' ' + p.n : p.n) + '"', CHEVRON)).join('') + '</div>';
  }
  return h;
}

export function render() {
  if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'start') render(); });
  $('startBody').innerHTML = html();
  /* Sonntag ab 19 Uhr: MVP-Stage einmal von selbst */
  setTimeout(maybeLaunch, 600);
  $('startSeason').textContent = 'Saison ' + SEASON.replace(/^20(\d\d)\/20(\d\d)$/, '$1/$2');
  applyTier(0);
}
function renderKader() {
  if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'kader') renderKader(); });
  $('kaderBody').innerHTML = kaderHtml();
  applyTier(0);
}

export function initStart() {
  registerView('start', { elements: ['start'], render });
  registerView('kader', { elements: ['kader'], render: renderKader });
  $('start').addEventListener('click', e => {
    const b = e.target.closest('[data-st]');
    if (!b) return;
    const k = b.dataset.st;
    if (k === 'resume') show(store.S.manual && !store.S.ended ? 'edit' : 'home');
    else if (k === 'new') requestNewGame();
    else if (k === 'me') show('me');
    else if (k === 'hof') { resetHof(); show('hof', { tab: true }); }
  });
}
