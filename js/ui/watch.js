/* Live zuschauen: Kacheln auf der Startseite und die Live-Ansicht als Blatt.
   Die Daten kommen über services/live.js (Realtime); hier wird nur gezeichnet. */
import { $, esc, fmt, cls, tierOf } from '../core/util.js';
import { PL, photoUrl } from '../data/players.js';
import { CL, crestUrl, storageUrl } from '../data/clubs.js';
import { live, onLive, ownLive, liveStatus } from '../services/live.js';
import { games, loadGames } from '../services/api.js';
import { registerView, show, back, nav, rerender } from '../router.js';
import { bindSheet } from './sheet.js';
import { rowLi, whistleLi } from './components.js';
import { openMatch } from './match.js';

const state = { uid: null, seen: new Set(), ended: null };

const photo = (d, small) => (PL[d.p] ? photoUrl(d.p, small) : d.pf ? storageUrl(d.pf) : photoUrl(''));
const crest = (id, f) => (CL[id] ? crestUrl(id) : f ? storageUrl(f) : crestUrl(id));
const sides = d => {
  const l = d.home ? [d.team] : [d.opp, d.of], r = d.home ? [d.opp, d.of] : [d.team];
  return { l: crest(l[0], l[1]), r: crest(r[0], r[1]), score: d.home ? d.us + ' : ' + d.them : d.them + ' : ' + d.us };
};
/* Andere Geräte: sortiert nach Spiel, dann Reihenfolge der Spieler */
export const liveList = () => [...live.map.entries()].filter(([uid]) => !ownLive(uid))
  .map(([uid, x]) => ({ uid, d: x.data })).sort((a, b) => (a.d.gid < b.d.gid ? -1 : a.d.gid > b.d.gid ? 1 : a.d.i - b.d.i));
const lastAction = d => (d.rows || []).find(r => r.p != null && typeof r.id === 'number');

/* ---------- Startseite ---------- */
function tile(x, wide) {
  const d = x.d, s = sides(d), last = lastAction(d);
  return '<button type="button" class="lvc tc' + (wide ? ' wide' : '') + '" data-tier="' + tierOf(d.t) + '" data-lv="' + esc(x.uid) + '">' +
    '<span class="lv-top"><span class="lv-live"><i></i>Live</span><b data-lmin="' + esc(x.uid) + '">' + esc(liveStatus(d)) + '</b>' +
    '<span class="lv-sc"><img src="' + esc(s.l) + '" alt=""><span>' + s.score + '</span><img src="' + esc(s.r) + '" alt=""></span></span>' +
    '<span class="lv-main"><span class="lv-ph"><img src="' + esc(photo(d, true)) + '" alt="" loading="lazy"></span>' +
    '<span class="lv-n">' + (d.vn ? '<small>' + esc(d.vn) + '</small>' : '') + '<b>' + esc(d.nm) + '</b>' +
    (last ? '<em><i class="' + cls(last.p) + '">' + fmt(last.p) + '</i> ' + esc(last.l) + ' · ' + esc(last.r) + '</em>' : '<em>Noch keine Aktion</em>') + '</span>' +
    '<span class="lv-p"><b>' + d.t + '</b><small>Punkte</small></span></span></button>';
}
export function liveTilesHtml() {
  const list = liveList();
  if (!list.length) return '';
  return '<h2 class="lvh"><span class="lv-live"><i></i>Jetzt live</span>' + (list.length > 1 ? '<em>' + list.length + ' Spieler</em>' : '') + '</h2>' +
    (list.length === 1 ? tile(list[0], true) : '<div class="lvs">' + list.map(x => tile(x, false)).join('') + '</div>');
}

/* ---------- Live-Ansicht ---------- */
function html() {
  const x = live.map.get(state.uid);
  if (!x) {
    const done = state.ended && (games.list || []).some(g => g.uid === state.uid);
    return '<div class="lv-gone"><b>Abgepfiffen</b><p>' + (done ? 'Das Spiel ist gespeichert.' : 'Das Live-Spiel ist vorbei.') + '</p>' +
      (done ? '<button type="button" class="btn primary full" data-lw="saved">Spiel ansehen</button>' : '<button type="button" class="btn full" data-nav="back">Zurück</button>') + '</div>';
  }
  const d = x.data, s = sides(d);
  const mates = liveList().filter(y => y.d.gid === d.gid);
  const sw = mates.length > 1 ? '<div class="wsq">' + mates.map(y => '<button type="button" data-lw="u:' + esc(y.uid) + '" aria-pressed="' + (y.uid === state.uid) + '"><img src="' + esc(photo(y.d, true)) + '" alt=""><span>' + esc(y.d.nm) + '</span><b>' + y.d.t + '</b></button>').join('') + '</div>' : '';
  const rows = (d.rows || []).map(r => {
    const isNew = r.id != null && !state.seen.has(r.id + '');
    return r.ht ? { ht: 1 } : r.sub ? { sub: r.sub } : { p: r.p, label: r.l, r: r.r, fresh: isNew && state.seen.size > 0 };
  });
  for (const r of d.rows || []) if (r.id != null) state.seen.add(r.id + '');
  return '<section class="mhero"><div class="pphoto"><img src="' + esc(photo(d)) + '" alt=""></div>' +
    '<div class="mh-t"><span>' + esc(d.nm) + '</span><b>' + d.t + '</b><div class="mh-s"><img src="' + esc(s.l) + '" alt=""><div><strong>' + s.score + '</strong>' +
    '<small class="lv-st' + (d.ended ? '' : ' on') + '" data-lmin="' + esc(state.uid) + '">' + esc(liveStatus(d)) + '</small></div><img src="' + esc(s.r) + '" alt=""></div></div></section>' +
    '<div class="pbody">' + sw + '<ul class="rows mrows">' + rows.map(rowLi).join('') + whistleLi() + '</ul></div>';
}
function render(keep) {
  const sc = $('watchScroll'), top = sc.scrollTop, x = live.map.get(state.uid);
  $('watchBody').innerHTML = html();
  $('watchMini').innerHTML = x ? '<span>' + esc(x.data.nm) + '</span><b>' + x.data.t + '</b><div class="mh-s sm"><img src="' + esc(sides(x.data).l) + '" alt=""><strong>' + sides(x.data).score + '</strong><img src="' + esc(sides(x.data).r) + '" alt=""></div>' : '';
  if (keep === true) { sc.scrollTop = top; return; }
  sc.scrollTop = 0; $('watchMini').classList.remove('on');
}
export function openWatch(uid) { state.uid = uid; state.seen = new Set(); state.ended = null; show('watch'); }

/* Sekundentakt: Spielminuten in Kacheln und Ansicht weiterzählen */
export function tickLive() {
  for (const el of document.querySelectorAll('[data-lmin]')) {
    const x = live.map.get(el.getAttribute('data-lmin'));
    if (x) { const t = liveStatus(x.data); if (el.textContent !== t) el.textContent = t; }
  }
}

export function initWatch() {
  registerView('watch', { elements: ['watch'], render, overlay: true });
  const sc = $('watchScroll');
  bindSheet($('watch'), sc, () => back());
  sc.addEventListener('scroll', () => { const h = sc.querySelector('.mhero'); $('watchMini').classList.toggle('on', !!h && sc.scrollTop > h.offsetHeight - 150); }, { passive: true });
  $('watch').addEventListener('click', e => {
    const b = e.target.closest('[data-lw]');
    if (!b) return;
    const k = b.dataset.lw;
    if (k === 'saved') { const uid = state.uid; back(); openMatch(uid); }
    else if (k.startsWith('u:')) { state.uid = k.slice(2); state.seen = new Set(); render(); }
  });
  document.addEventListener('click', e => { const t = e.target.closest('[data-lv]'); if (t) openWatch(t.getAttribute('data-lv')); });
  onLive(ev => {
    if (nav.current === 'start') rerender('start');
    if (nav.current !== 'watch') return;
    if (ev.type === 'end' && ev.uid === state.uid) {
      state.ended = true;
      loadGames(true).then(() => { if (nav.current === 'watch') render(true); }).catch(() => {});
    }
    if (ev.type === 'all' || ev.uid === state.uid || ev.type === 'end') render(true);
  });
}
