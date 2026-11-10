/* Spiel-Detail wie bei Kickbase (Balken im Profil antippen): großes Foto, Punktzahl, Endstand,
   darunter alle Aktionen mit Minute; beim Scrollen schrumpft der Kopf auf Name, Punkte und Ergebnis. */
import { $, esc, fmt, cls, minStamp } from '../core/util.js';
import { PL, photoUrl } from '../data/players.js';
import { crestUrl } from '../data/clubs.js';
import { ICON } from '../core/icons.js';
import { recordTeam, scoreText } from '../core/game.js';
import { games, loadEvents, cachedEvents } from '../services/api.js';
import { canManage } from '../services/auth.js';
import { registerView, show, back, nav } from '../router.js';
import { bindSheet } from './sheet.js';
import { openHofGame } from './hof.js';

const state = { uid: null };
const rec = () => (games.list || []).find(g => g.uid === state.uid);

export function openMatch(uid) {
  state.uid = uid;
  show('match');
  if (!cachedEvents(uid)) loadEvents(uid).then(() => { if (nav.current === 'match' && state.uid === uid) render(); }).catch(() => {});
}

/* Zeilen in Kickbase-Reihenfolge: Schluss-Boni, Abpfiff, Aktionen (neueste zuerst) mit Halbzeit/Wechseln, Startelf, Anpfiff */
function rowsHtml(ev, g) {
  const ends = [], mids = [];
  let start = null;
  for (const x of ev) { if (x.k === 'auto') { if (x.a === 's') start = x; else ends.push(x); } else mids.push(x); }
  const row = (p, l, t) => '<li class="mr"><b class="' + cls(p) + '">' + fmt(p) + '</b><span>' + esc(l) + '</span><em>' + (t || '') + '</em></li>';
  const mark = (icon, label) => '<li class="mk" aria-label="' + label + '">' + icon + '</li>';
  let h = ends.map(x => row(x.p, x.l, g.minutes + '’')).join('') + mark(ICON.whistle, 'Abpfiff');
  for (const x of mids.slice().reverse()) {
    if (x.k === 'ht') h += mark(ICON.halftime, 'Halbzeit');
    else if (x.k === 'sub') h += '<li class="mk sub">' + (x.o === 'in' ? ICON.subIn : ICON.subOut) + '<span>' + (x.o === 'in' ? 'Eingewechselt' : 'Ausgewechselt') + (x.t >= 0 ? ' ' + minStamp(x.t) : '') + '</span></li>';
    else h += row(x.p, x.l, minStamp(x.t));
  }
  if (start) h += row(start.p, start.l, '');
  return h + mark(ICON.whistle, 'Anpfiff');
}

function html() {
  const g = rec();
  if (!g || !PL[g.player]) return '<p class="hmsg">Spiel nicht gefunden.</p>';
  const p = PL[g.player], mine = recordTeam(g), l = g.home ? mine : g.opp, r = g.home ? g.opp : mine;
  const score = scoreText(g, g.home), ev = cachedEvents(g.uid);
  return '<section class="mhero"><div class="pphoto"><img src="' + esc(photoUrl(g.player)) + '" alt=""></div>' +
    '<div class="mh-t"><span>' + esc(p.n) + '</span><b>' + g.points + '</b><div class="mh-s"><img src="' + esc(crestUrl(l)) + '" alt=""><div><strong>' + score + '</strong><small>Endstand</small></div><img src="' + esc(crestUrl(r)) + '" alt=""></div></div></section>' +
    '<div class="pbody"><ul class="mrows">' + (ev ? rowsHtml(ev, g) : '<li class="hmsg">Lädt …</li>') + '</ul>' +
    (canManage(g.player) ? '<button type="button" class="btn full" style="margin-top:16px" data-mt="edit">' + ICON.edit + ' Bearbeiten</button>' : '') + '</div>';
}

export function render() {
  const g = rec();
  $('matchBody').innerHTML = html();
  $('matchMini').innerHTML = g && PL[g.player] ? '<span>' + esc(PL[g.player].n) + '</span><b>' + g.points + '</b><div class="mh-s sm"><img src="' + esc(crestUrl(g.home ? recordTeam(g) : g.opp)) + '" alt=""><strong>' + scoreText(g, g.home) + '</strong><img src="' + esc(crestUrl(g.home ? g.opp : recordTeam(g))) + '" alt=""></div>' : '';
  $('matchScroll').scrollTop = 0;
  $('matchMini').classList.remove('on');
}

export function initMatch() {
  registerView('match', { elements: ['match'], render, overlay: true });
  const sc = $('matchScroll');
  bindSheet($('match'), sc, () => back());
  sc.addEventListener('scroll', () => { const h = sc.querySelector('.mhero'); $('matchMini').classList.toggle('on', !!h && sc.scrollTop > h.offsetHeight - 150); }, { passive: true });
  $('match').addEventListener('click', e => {
    const b = e.target.closest('[data-mt]');
    if (b && b.dataset.mt === 'edit') openHofGame(state.uid);
  });
}
