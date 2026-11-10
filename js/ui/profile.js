/* Spielerprofil wie bei Kickbase: Blatt von unten mit den Reitern Übersicht · Leistung · Marktwert.
   Übersicht: Foto, Name, Formkurve, Zahlenraster, Einsätze, nächste Spieltage, Status.
   Leistung: Balken je Spiel (gespielt + kommend), Antippen öffnet das Spiel-Detail.
   Marktwert: große Kurve (3M/1J), Antippen zeigt den Wert an einem Tag. */
import { $, esc, eur, cleanSheet, trendClass, applyTier, tierOf, pad2 } from '../core/util.js';
import { PL, POS_NAME, POS_SHORT, STATUS_NAME, photoUrl } from '../data/players.js';
import { CL, crestUrl } from '../data/clubs.js';
import { upcomingFixtures, pastFixtures } from '../data/schedule.js';
import { recordTeam, scoreText } from '../core/game.js';
import { marketOf, byDate } from '../core/market.js';
import { statusIcon } from '../core/icons.js';
import { games, loadGames, loadPlayerEvents } from '../services/api.js';
import { profileChart, scrollToCurrent, playerStats } from './components.js';
import { registerView, show, back, nav } from '../router.js';
import { SEASON } from '../config.js';
import { requestNewGame } from './start.js';
import { bindSheet } from './sheet.js';

const state = { id: null, tab: 'ov', range: '3M', pick: null, ev: null };
const TABS = [['ov', 'Übersicht'], ['perf', 'Leistung'], ['mw', 'Marktwert']];
const TAB_ICON = {
  ov: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
  perf: '<svg viewBox="0 0 24 24"><path d="M5 20V9M10 20V4M15 20v-8M20 20V7"/></svg>',
  mw: '<svg viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 4-7 5 5"/></svg>'
};

/* Profil öffnen (als Blatt über der aktuellen Ansicht) */
export function openProfile(id, tab = 'ov') {
  if (!PL[id]) return;
  if (state.id !== id) { state.ev = null; state.pick = null; }
  state.id = id; state.tab = tab;
  show('profile');
  if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'profile') render(); });
  loadPlayerEvents(id).then(m => { if (state.id === id) { state.ev = m; if (nav.current === 'profile') render(); } }).catch(() => {});
}

const count = (evs, keys) => { let n = 0; for (const ev of evs) for (const e of ev) if (keys.includes(e.k) || (e.k === 'auto' && keys.includes(e.a))) n++; return n; };
/* Kurzform wie bei Kickbase: +41K, -1,2M */
export const shortEur = n => { const a = Math.abs(n), s = n > 0 ? '+' : n < 0 ? '−' : '±';
  return s + (a >= 1e6 ? (a / 1e6).toFixed(1).replace('.', ',') + 'M' : a >= 1e3 ? Math.round(a / 1e3) + 'K' : a); };

/* ---------- Kopfbereich ---------- */
function hero(p, id, mw) {
  const status = p.status && p.status !== 'fit' ? '<span class="pchip st ' + p.status + '">' + statusIcon(id) + STATUS_NAME[p.status] + '</span>' : '';
  return '<section class="phero"><div class="pphoto"><img src="' + esc(photoUrl(id)) + '" alt=""></div>' +
    '<div class="pnames">' + (p.vn ? '<div class="pvn">' + esc(p.vn) + '</div>' : '') + '<h1 class="pnn">' + esc(p.n) + '</h1>' +
    '<div class="pchips"><span class="pchip">' + POS_SHORT[p.pos || 'ABW'] + '</span>' + status + '</div></div></section>';
}
const clubRow = c => '<div class="pclub"><img src="' + esc(crestUrl(c.id)) + '" alt="' + esc(c.n) + '"><span class="psep"></span><span class="pcl"><b>' + esc(c.n) + '</b>' +
  (c.lg ? '<small>Kreisliga ' + c.lg + '</small>' : '') + '</span><button type="button" class="pplay" data-pf="play"><span aria-hidden="true">+</span>Spiel</button></div>';
/* Kompakter Kopf für Leistung/Marktwert und beim Scrollen */
const miniHead = p => '<div class="pmini"><b>' + esc(p.n) + '</b><button type="button" class="pplay sm" data-pf="play"><span aria-hidden="true">+</span>Spiel</button></div>';

/* ---------- Übersicht ---------- */
function overview(p, id, played, mw) {
  const st = playerStats(id), keeper = p.pos === 'TW', evs = state.ev ? [...state.ev.values()] : null;
  const form = played.slice(-5);
  const dashes = '<div class="fdash">' + [0, 1, 2, 3, 4].map(i => { const g = form[form.length - 5 + i]; return '<i' + (g ? ' data-tier="' + tierOf(g.points) + '"' : '') + '></i>'; }).join('') + '</div>';
  const goals = played.reduce((s, g) => s + (g.goals || 0), 0), ast = played.reduce((s, g) => s + (g.assists || 0), 0);
  const clean = played.filter(cleanSheet).length;
  const cell = (v, l) => '<div><b>' + v + '</b><span>' + l + '</span></div>';
  let h = '<div class="kbx"><div class="kb-box">' + dashes + '<div class="kb-g">' +
    cell(st.sum.toLocaleString('de-DE'), 'Punkte') + cell('×' + (keeper ? clean : goals), keeper ? 'Zu Null' : 'Tore') +
    cell(st.avg != null ? st.avg : '–', 'Ø Punkte') + cell('×' + (keeper ? (evs ? count(evs, ['pgt']) : '–') : ast), keeper ? '11m gehalten' : 'Vorlagen') + '</div></div>' +
    '<div class="kb-box"><i class="kb-arr ' + trendClass(mw.last) + '" aria-hidden="true">' + (mw.last < 0 ? '↘' : '↗') + '</i><div class="kb-g one">' +
    cell(eur(mw.v), 'Marktwert') + cell('<em class="' + trendClass(mw.last) + '">' + shortEur(mw.last) + '</em>', 'letztes Spiel') + '</div></div></div>';

  /* Einsätze / Startelf / Minuten */
  const teamPlayed = pastFixtures(p.c, 99).length || played.length;
  const s11 = evs ? Math.min(played.length, count(evs, ['s'])) : null;
  h += '<div class="kb3">' + cell(played.length + '<small>/' + Math.max(teamPlayed, played.length) + '</small>', 'Einsätze') + cell((s11 != null ? s11 : '–') + '×', 'S11') +
    cell((st.min != null ? st.min : '–') + '’', 'Ø Minuten') + '</div>';

  /* Letztes Spiel + nächste zwei Spieltage */
  const last = played[played.length - 1], next = upcomingFixtures(p.c).slice(0, last ? 2 : 3);
  const md = [];
  if (last) { const mine = recordTeam(last), l = last.home ? mine : last.opp, r = last.home ? last.opp : mine; md.push(['Spieltag ' + played.length, l, r, scoreText(last, last.home), 'g:' + last.uid]); }
  next.forEach((f, i) => md.push(['Spieltag ' + (played.length + i + 1), f.home ? f.team : f.o, f.home ? f.o : f.team, pad2(f.at.getDate()) + '.' + pad2(f.at.getMonth() + 1) + '.' + f.at.getFullYear(), null]));
  if (md.length) h += '<div class="kbmd">' + md.map(([t, l, r, sub, link]) => '<button type="button" class="md"' + (link ? ' data-match="' + esc(link.slice(2)) + '"' : ' disabled') + '><span>' + t + '</span>' +
    '<span class="md-c"><img src="' + esc(crestUrl(l)) + '" alt=""><img src="' + esc(crestUrl(r)) + '" alt=""></span><b>' + sub + '</b></button>').join('') + '</div>';

  /* Status + Karten */
  const fit = !p.status || p.status === 'fit';
  const yel = evs ? count(evs, ['yel']) : 0, red = evs ? count(evs, ['yel2', 'red']) : 0;
  h += '<div class="kbst"><div><i class="kb-ok ' + (fit ? 'fit' : p.status) + '" aria-hidden="true">' + (fit ? '✓' : '+') + '</i><b>' + (fit ? 'Fit' : STATUS_NAME[p.status]) + '</b>' +
    (p.info ? '<small>' + esc(p.info) + '</small>' : '') + '</div><div class="kb-cards"><span><i class="cy"></i>×' + yel + '</span><span><i class="cr"></i>×' + red + '</span></div></div>';
  return h;
}

/* ---------- Leistung ---------- */
function performance(id, played, p) {
  const st = playerStats(id);
  return '<div class="pseason">' + SEASON + '</div>' + profileChart(played, upcomingFixtures(p.c)) +
    '<div class="pstats"><div><b>' + (st.avg != null ? st.avg : '–') + '</b><span>Ø Punkte</span></div><div><b>' + st.sum.toLocaleString('de-DE') + '</b><span>Gesamtpunkte</span></div><div><b>' + (st.min != null ? st.min : '–') + '</b><span>Ø Minuten</span></div></div>';
}

/* ---------- Marktwert ---------- */
function mwSeries(mw, played) {
  const pts = mw.series.map((x, i) => ({ v: x.v, t: x.g ? new Date(x.g.played_at).getTime() : (played[0] ? new Date(played[0].played_at).getTime() - 7 * 864e5 : Date.now() - 30 * 864e5) }));
  pts.push({ v: mw.v, t: Date.now() });
  const from = Date.now() - (state.range === '3M' ? 91 : 365) * 864e5;
  const inside = pts.filter(x => x.t >= from), before = pts.filter(x => x.t < from).pop();
  return (before ? [{ v: before.v, t: from }] : []).concat(inside);
}
function mwChart(s) {
  const W = 360, H = 260;
  if (s.length < 2) return '<p class="hmsg">Noch kein Verlauf.</p>';
  const t0 = s[0].t, t1 = s[s.length - 1].t, vs = s.map(x => x.v);
  let lo = Math.min(...vs), hi = Math.max(...vs); if (hi === lo) { hi += 1; lo -= 1; }
  const X = t => ((t - t0) / Math.max(1, t1 - t0)) * W, Y = v => H - 10 - ((v - lo) / (hi - lo)) * (H - 20);
  const d = s.map((x, i) => (i ? 'L' : 'M') + X(x.t).toFixed(1) + ' ' + Y(x.v).toFixed(1)).join('');
  const up = s[s.length - 1].v >= s[0].v, c = up ? '#2FD673' : '#FF5A2A';
  const pick = state.pick != null && s[state.pick] ? s[state.pick] : null;
  return '<svg class="mwc" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" data-pf="mwchart"><path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
    (pick ? '<line x1="' + X(pick.t).toFixed(1) + '" x2="' + X(pick.t).toFixed(1) + '" y1="0" y2="' + H + '" stroke="#dee4ec" stroke-width="1" vector-effect="non-scaling-stroke"/>' : '') + '</svg>';
}
function marketTab(id, played, mw) {
  const s = mwSeries(mw, played), pick = state.pick != null && s[state.pick] ? s[state.pick] : null;
  const shown = pick || s[s.length - 1] || { v: mw.v, t: Date.now() };
  const prev = pick ? s[state.pick - 1] : null, diff = pick ? (prev ? pick.v - prev.v : 0) : mw.last;
  const when = pick ? new Date(pick.t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'letztes Spiel';
  const start = mw.series[0].v, pct = ((mw.v - start) / start) * 100;
  return '<div class="mwh"><div><b>' + eur(shown.v) + '</b><span class="mwd ' + trendClass(diff) + '"><i>' + (diff < 0 ? '↘' : '↗') + '</i>' + shortEur(diff) + '</span><small>' + when + '</small></div>' +
    '<div class="seg mwr">' + ['3M', '1J'].map(r => '<button type="button" data-pf="r:' + r + '" aria-pressed="' + (state.range === r) + '">' + r + '</button>').join('') + '</div></div>' +
    mwChart(s) + '<div class="kb2"><div><b>' + eur(start) + '</b><span>Startwert</span></div><div><b class="' + trendClass(pct) + '">' + (pct >= 0 ? '+' : '') + pct.toFixed(1).replace('.', ',') + ' %</b><span>seit Saisonstart</span></div></div>';
}

function html() {
  const id = state.id, p = PL[id];
  if (!p) return '';
  const c = CL[p.c], played = byDate((games.list || []).filter(g => g.player === id)), mw = marketOf(id, games.list || []);
  let h = '';
  if (state.tab === 'ov') h += hero(p, id, mw) + '<div class="pbody">' + clubRow(c) + overview(p, id, played, mw) + '</div>';
  else h += '<div class="pbody">' + miniHead(p) + (state.tab === 'perf' ? performance(id, played, p) : marketTab(id, played, mw)) + '</div>';
  if (games.busy && !games.list) h += '<p class="hmsg">Lädt …</p>';
  return h;
}

export function render() {
  const body = $('profileBody');
  body.innerHTML = html();
  $('profileTabs').innerHTML = TABS.map(([k, l]) => '<button type="button" data-pf="t:' + k + '" aria-pressed="' + (state.tab === k) + '">' + TAB_ICON[k] + '<span>' + l + '</span></button>').join('');
  $('profileMini').innerHTML = PL[state.id] ? miniHead(PL[state.id]) : '';
  if (state.tab === 'perf') scrollToCurrent(body);
  applyTier(0);
}

export function initProfile() {
  registerView('profile', { elements: ['profile'], render, overlay: true });
  const scroller = $('profileScroll');
  bindSheet($('profile'), scroller, () => back());
  /* Kompakter Kopf erscheint, sobald das Foto aus dem Bild gescrollt ist */
  scroller.addEventListener('scroll', () => {
    const h = scroller.querySelector('.phero');
    $('profileMini').classList.toggle('on', state.tab === 'ov' && !!h && scroller.scrollTop > h.offsetHeight - 110);
  }, { passive: true });
  $('profile').addEventListener('click', e => {
    const b = e.target.closest('[data-pf]');
    if (!b) return;
    const k = b.getAttribute('data-pf');
    if (k === 'play') requestNewGame({ player: state.id });
    else if (k.startsWith('t:')) { state.tab = k.slice(2); state.pick = null; scroller.scrollTop = 0; render(); }
    else if (k.startsWith('r:')) { state.range = k.slice(2); state.pick = null; render(); }
    else if (k === 'mwchart') {
      const r = b.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
      const s = mwSeries(marketOf(state.id, games.list || []), byDate((games.list || []).filter(g => g.player === state.id)));
      const t = s[0].t + x * (s[s.length - 1].t - s[0].t);
      let best = 0; s.forEach((p, i) => { if (Math.abs(p.t - t) < Math.abs(s[best].t - t)) best = i; });
      state.pick = best; render();
    }
  });
}
