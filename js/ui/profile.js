/* Spielerprofil im Kickbase-Stil: großes Foto, Name, Saisonverlauf mit kommenden Spielen, Kennzahlen */
import { $, esc, eur, signedEur, trendClass, applyTier } from '../core/util.js';
import { PL, POS_NAME, POS_SHORT, STATUS_NAME, photoUrl } from '../data/players.js';
import { CL, crestUrl } from '../data/clubs.js';
import { upcomingFixtures } from '../data/schedule.js';
import { marketOf, byDate } from '../core/market.js';
import { statusIcon } from '../core/icons.js';
import { games, loadGames } from '../services/api.js';
import { gameRow, profileChart, scrollToCurrent, sparkline, playerStats } from './components.js';
import { registerView, show, back, nav } from '../router.js';
import { SEASON } from '../config.js';
import { requestNewGame } from './start.js';

const state = { id: null };

/* Profil öffnen („Zurück“ führt über den Verlauf zur vorherigen Ansicht) */
export function openProfile(id) {
  if (!PL[id]) return;
  state.id = id;
  show('profile');
  if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'profile') render(); });
}

function badges(l) {
  const B = [
    ['Gold-Spiel 400+', l.filter(g => g.points >= 400).length, '#E1BE38'],
    ['Über 200 Punkte', l.filter(g => g.points >= 200).length, '#28DE86'],
    ['Tore', l.reduce((a, g) => a + (g.goals || 0), 0), '#9CE04A'],
    ['Vorlagen', l.reduce((a, g) => a + (g.assists || 0), 0), '#9CE04A'],
    ['Weiße Weste', l.filter(g => g.them === 0 && g.minutes >= 45).length, '#dee4ec'],
    ['Siege', l.filter(g => g.us > g.them).length, '#ff4600'],
    ['Durchgespielt', l.filter(g => g.minutes >= 90).length, '#7e8187']
  ].filter(b => b[1] > 0);
  return B.length ? '<h2>Erfolge</h2><div class="badges">' + B.map(b => '<span class="bdg" style="--c:' + b[2] + '"><i></i>' + b[0] + '<em>×' + b[1] + '</em></span>').join('') + '</div>' : '';
}

function html() {
  const id = state.id, p = PL[id];
  if (!p) return '';
  const c = CL[p.c], played = byDate((games.list || []).filter(g => g.player === id));
  const st = playerStats(id), mw = marketOf(id, games.list || []);
  const upcoming = upcomingFixtures(p.c);
  const status = p.status && p.status !== 'fit'
    ? '<span class="pchip st ' + p.status + '">' + statusIcon(id) + STATUS_NAME[p.status] + '</span>' : '';

  let h = '<section class="phero">' +
    '<button type="button" class="pback" data-pf="back" aria-label="Zurück"><b aria-hidden="true">‹</b></button>' +
    '<div class="pphoto"><img src="' + esc(photoUrl(id)) + '" alt=""></div>' +
    '<div class="pnames">' + (p.vn ? '<div class="pvn">' + esc(p.vn) + '</div>' : '') + '<h1 class="pnn">' + esc(p.n) + '</h1>' +
    '<div class="pchips"><span class="pchip">' + POS_SHORT[p.pos || 'ABW'] + '</span><span class="pchip">' + eur(mw.v) + '</span>' + status + '</div></div></section>';

  h += '<div class="wrap pbody">' +
    '<div class="pclub"><img src="' + esc(crestUrl(c.id)) + '" alt="' + esc(c.n) + '"><span class="psep"></span><span class="pcl"><b>' + esc(c.n) + '</b><small>' + (c.lg ? 'Kreisliga ' + c.lg + ' · ' : '') + POS_NAME[p.pos || 'ABW'] + '</small></span>' +
    '<button type="button" class="pplay" data-pf="play"><span aria-hidden="true">+</span>Spiel</button></div>' +
    (p.status !== 'fit' && p.info ? '<p class="st-info">' + esc(p.info) + '</p>' : '') +
    '<div class="pseason">' + SEASON + '</div>' + profileChart(played, upcoming) +
    '<div class="pstats"><div><b>' + (st.avg != null ? st.avg : '–') + '</b><span>Ø Punkte</span></div><div><b>' + st.sum + '</b><span>Gesamtpunkte</span></div><div><b>' + (st.min != null ? st.min : '–') + '</b><span>Ø Minuten</span></div></div>' +
    '<div class="mwc"><div class="mw-k">Marktwert</div><div class="mw-row"><span class="mw-v">' + eur(mw.v) + '</span><span class="mw-d ' + trendClass(mw.last) + '">' +
    (mw.last > 0 ? '▲ ' : mw.last < 0 ? '▼ ' : '') + signedEur(mw.last) + '</span></div>' + sparkline(mw.series) + '</div>' +
    badges(played);
  if (games.busy && !games.list) h += '<p class="hmsg">Lädt …</p>';
  else if (played.length) h += '<h2>Alle Spiele</h2><ul class="glist">' + played.slice().reverse().map(g => gameRow(g, 0, true)).join('') + '</ul>';
  else h += '<p class="hmsg">Noch kein Spiel gespeichert.</p>';
  return h + '</div>';
}

export function render() {
  $('profileBody').innerHTML = html();
  scrollToCurrent($('profileBody'));
  applyTier(0);
}

export function initProfile() {
  registerView('profile', { elements: ['profile'], render });
  $('profile').addEventListener('click', e => {
    const b = e.target.closest('[data-pf]');
    if (!b) return;
    const k = b.getAttribute('data-pf');
    if (k === 'back') back();
    else if (k === 'play') requestNewGame({ player: state.id });
  });
}
