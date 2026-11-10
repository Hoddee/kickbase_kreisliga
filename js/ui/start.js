/* Startseite: Übersicht mit laufendem Spiel, nächsten Spielen der Mannschaften und dem Kader.
   Ein Tipp auf einen Spieler öffnet sein Profil, ein neues Spiel startet über „+ Neues Spiel“. */
import { $, esc, tierOf, applyTier, pad2 } from '../core/util.js';
import { PL, PLAYER_LIST } from '../data/players.js';
import { CL, OWN_CLUBS, crestUrl } from '../data/clubs.js';
import { TEAMS, nextFixture } from '../data/schedule.js';
import { store, total, score, started, isHome, teamOf, isMulti, allSaved } from '../core/game.js';
import { games, loadGames } from '../services/api.js';
import { isAdmin, isLoggedIn, pendingRequests, myPlayer } from '../services/auth.js';
import { marketOf } from '../core/market.js';
import { eur, signedEur, trendClass } from '../core/util.js';
import { avatar, playerRow, nameWithStatus } from './components.js';
import { registerView, show, nav } from '../router.js';
import { openSetup } from './setup.js';
import { liveTilesHtml } from './watch.js';

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

function html() {
  let h = liveTilesHtml() + meCard() + runningCard() + fixturesStrip() + '<h2>Kader</h2>';
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
  const btn = $('adminBtn'), n = isAdmin() ? pendingRequests() : 0;
  btn.classList.toggle('on', isLoggedIn());
  let badge = btn.querySelector('.nbadge');
  if (n && !badge) { badge = document.createElement('i'); badge.className = 'nbadge'; btn.appendChild(badge); }
  if (badge) { if (n) badge.textContent = n > 9 ? '9+' : String(n); else badge.remove(); }
  btn.setAttribute('aria-label', n ? 'Konto – ' + n + ' offene Anfragen' : 'Konto');
  applyTier(0);
}

export function initStart() {
  registerView('start', { elements: ['start'], render });
  $('start').addEventListener('click', e => {
    const b = e.target.closest('[data-st]');
    if (!b) return;
    const k = b.dataset.st;
    if (k === 'resume') show(store.S.manual && !store.S.ended ? 'edit' : 'home');
    else if (k === 'new') requestNewGame();
    else if (k === 'me') show('me');
  });
}
