/* Wiederverwendbare Bausteine: Punktezeilen, Marken, Balkendiagramm, Bereichsbalken, Marktwert-Kurve */
import { esc, fmt, cls, tierOf, minStamp, eur, trendClass, dateShort, pad2, cleanSheet } from '../core/util.js';
import { ICON, statusIcon } from '../core/icons.js';
import { PL, photoUrl, fullName, POS_NAME, POS_SHORT } from '../data/players.js';
import { CL, crestUrl } from '../data/clubs.js';
import { scoreText, recordTeam } from '../core/game.js';
import { marketOf } from '../core/market.js';
import { games } from '../services/api.js';
import { SEASON } from '../config.js';

export const halftimeLi = () => '<li class="ht">' + ICON.halftime + 'Halbzeit</li>';
export const subLi = x => '<li class="ht sub ' + (x.o === 'in' ? 'in' : 'out') + '">' + (x.o === 'in' ? ICON.subIn : ICON.subOut) +
  (x.o === 'in' ? 'Eingewechselt' : 'Ausgewechselt') + (x.t >= 0 ? ' ' + minStamp(x.t) : '') + '</li>';
export const whistleLi = () => '<li class="whistle" aria-label="Anpfiff">' + ICON.whistle + '</li>';

/* Eine Zeile der Punkteliste (oder eine Marke) */
export function rowLi(r) {
  if (r.ht) return halftimeLi();
  if (r.sub) return subLi(r.sub);
  return '<li class="row' + (r.fresh ? ' fresh' : '') + '"><span class="rp ' + cls(r.p) + '">' + fmt(r.p) + '</span><span class="rl">' + esc(r.label) +
    '</span><span class="rt">' + esc(r.r || '') + '</span></li>';
}

/* Gespeicherte Ereignisliste (Hall of Fame) in Anzeigezeilen umwandeln: Automatik oben, Startelf unten */
export function rowsFromRecord(ev) {
  const ends = [], mids = [];
  let start = null;
  for (const x of ev) {
    if (x.k === 'auto') { if (x.a === 's') start = x; else ends.push(x); } else mids.push(x);
  }
  const rows = ends.map(x => ({ p: x.p, label: x.l }));
  for (const x of mids.slice().reverse()) rows.push(x.k === 'ht' ? { ht: 1 } : x.k === 'sub' ? { sub: x } : { p: x.p, label: x.l, r: minStamp(x.t) });
  if (start) rows.push({ p: start.p, label: start.l });
  return rows;
}

/* Horizontale Balken "Punkte nach Bereich" */
export function areaBars(bd) {
  const max = Math.max(1, ...bd.map(b => Math.abs(b.p)));
  return '<div class="card"><ul class="bars">' + bd.map(b =>
    '<li class="' + cls(b.p) + '"><div class="bt"><span>' + esc(b.n) + '</span><b>' + fmt(b.p) + '</b></div>' +
    '<div class="trk"><i style="width:' + Math.max(4, Math.round(Math.abs(b.p) / max * 100)) + '%"></i></div></li>').join('') + '</ul></div>';
}

/* Balkenhöhe in Prozent: nicht linear, damit auch niedrige Werte sichtbar bleiben */
function barHeight(t) {
  const A = [[-100, 4], [0, 8], [100, 50], [200, 78], [400, 94], [500, 100]];
  if (t <= A[0][0]) return A[0][1];
  for (let i = 1; i < A.length; i++) {
    if (t <= A[i][0]) { const f = (t - A[i - 1][0]) / (A[i][0] - A[i - 1][0]); return A[i - 1][1] + f * (A[i][1] - A[i - 1][1]); }
  }
  return 100;
}
export const toChartEntry = g => ({ pos: g.pos, tm: g.team, u: g.uid, t: g.points, m: g.minutes, us: g.us, them: g.them, g: g.goals, a: g.assists, p: g.player, o: g.opp, h: g.home ? 1 : 0 });

/* Senkrechte Balken je Spiel wie im Kickbase-Spielerprofil */
export function seasonChart(list, title, { clickable = false, button = '' } = {}) {
  return '<div class="lh"><div><b>' + esc(title) + '</b><span>' + SEASON + '</span></div>' + button + '</div><div class="chart">' + list.map((x, i) => {
    const icons = ICON.ball.repeat(x.g || 0) + ICON.boot.repeat(x.a || 0) + (x.pos === 'TW' && cleanSheet({ them: x.them, minutes: x.m }) ? ICON.zero : '');
    const mine = x.tm && CL[x.tm] ? x.tm : PL[x.p].c, left = x.h ? mine : x.o, right = x.h ? x.o : mine;
    return '<div class="col' + (i === list.length - 1 ? ' cur' : '') + '" data-tier="' + tierOf(x.t) + '"' + (clickable && x.u ? ' data-hof="g:' + esc(x.u) + '" role="button"' : '') + '>' +
      '<div class="ci">' + (i === 0 ? '#' : '') + (i + 1) + '</div>' +
      '<div class="cc"><img src="' + esc(crestUrl(left)) + '" alt=""><img src="' + esc(crestUrl(right)) + '" alt=""></div>' +
      '<div class="cs">' + scoreText(x, x.h) + '</div>' +
      '<div class="trk2"><div class="fill" style="height:' + barHeight(x.t).toFixed(1) + '%"><div class="ico">' + icons + '</div></div></div>' +
      '<div class="cv">' + x.t + '</div><div class="cm">' + x.m + '’</div></div>';
  }).join('') + '</div>';
}
export function scrollChartsToEnd(root = document) { root.querySelectorAll('.chart').forEach(c => { c.scrollLeft = c.scrollWidth; }); }

/* Marktwert-Kurve */
let sparkId = 0;
export function sparkline(series) {
  if (series.length < 2) return '';
  const W = 320, H = 72, vs = series.map(x => x.v);
  let min = Math.min(...vs), max = Math.max(...vs);
  if (max === min) { max += 1; min -= 1; }
  const pts = series.map((x, i) => [(i / (series.length - 1)) * W, H - 6 - (x.v - min) / (max - min) * (H - 12)]);
  const up = vs[vs.length - 1] >= vs[0], c = up ? '#2FD673' : '#FF5A2A', id = 'sg' + (++sparkId);
  const line = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + c + '" stop-opacity=".28"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></linearGradient></defs>' +
    '<polygon points="0,' + H + ' ' + line + ' ' + W + ',' + H + '" fill="url(#' + id + ')"/><polyline points="' + line + '" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
    '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="4" fill="' + c + '"/></svg>';
}

export const avatar = id => '<span class="hav"><img src="' + esc(photoUrl(id, true)) + '" alt="" loading="lazy" decoding="async"></span>';
export const nameWithStatus = (id, label) => esc(label != null ? label : PL[id].n) + statusIcon(id) + (PL[id] && PL[id].guest ? ' <i class="tag">Gast</i>' : '');

/* ---------- Spielerzeile (Übersicht und Auswahl) ---------- */
export function playerStats(id) {
  const l = (games.list || []).filter(g => g.player === id);
  const sum = l.reduce((s, g) => s + g.points, 0);
  return { n: l.length, sum, avg: l.length ? Math.round(sum / l.length) : null, min: l.length ? Math.round(l.reduce((s, g) => s + g.minutes, 0) / l.length) : null };
}
/* attrs: z. B. 'data-pick="p:ID" aria-pressed="true"'; tail: Haken oder Pfeil rechts */
export function playerRow(p, attrs, tail) {
  const st = playerStats(p.id), mw = marketOf(p.id, games.list || []);
  const trend = mw.last ? ' <span class="mw-d ' + trendClass(mw.last) + '" style="font-size:12px">' + (mw.last > 0 ? '▲' : '▼') + '</span>' : '';
  return '<button type="button" class="prow" ' + attrs + '>' + avatar(p.id) +
    '<span><b>' + nameWithStatus(p.id, fullName(p)) + '</b><span class="ps"><i class="pbadge">' + POS_SHORT[p.pos || 'ABW'] + '</i>' + eur(mw.v) + trend + '</span></span>' +
    '<span class="pv tc"' + (st.avg != null ? ' data-tier="' + tierOf(st.avg) + '"' : '') + '><b>' + (st.avg != null ? st.avg : '–') + '</b><small>Ø Punkte</small></span>' + tail + '</button>';
}

/* ---------- Spielzeile (Hall of Fame, Profil) ---------- */
export function gameRow(g, rank, inProfile) {
  const mine = recordTeam(g), l = g.home ? mine : g.opp, r = g.home ? g.opp : mine;
  return '<li class="gr tc' + (rank ? '' : ' nr') + '" data-tier="' + tierOf(g.points) + '"><button type="button" class="ov" data-open="g:' + esc(g.uid) + '" aria-label="Spiel ansehen"></button>' +
    (rank ? '<span class="rk' + (rank < 4 ? ' r' + rank : '') + '">' + rank + '</span>' : '') +
    (inProfile ? avatar(g.player) : '<button type="button" class="hav hb2" data-open="p:' + esc(g.player) + '" aria-label="Profil von ' + esc(PL[g.player].n) + '"><img src="' + esc(photoUrl(g.player, true)) + '" alt="" loading="lazy"></button>') +
    '<div class="gi"><b>' + nameWithStatus(g.player) + (g.manual ? ' <i class="tag">Nachtrag</i>' : '') + '</b><span class="gs"><img src="' + esc(crestUrl(l)) + '" alt="">' + scoreText(g, g.home) + '<img src="' + esc(crestUrl(r)) + '" alt=""></span></div>' +
    '<div class="gp"><span class="gv">' + g.points + '</span><span class="gd">' + dateShort(g.played_at) + ' · ' + POS_NAME[g.pos] + '</span></div></li>';
}

/* ---------- Saisonverlauf wie im Kickbase-Profil: gespielte Spiele + kommende Spiele laut Spielplan ---------- */
const MONTHS = ['JAN.', 'FEB.', 'MÄRZ', 'APR.', 'MAI', 'JUNI', 'JULI', 'AUG.', 'SEPT.', 'OKT.', 'NOV.', 'DEZ.'];
const dayMonth = d => pad2(d.getDate()) + '. ' + MONTHS[d.getMonth()];
/* played: gespeicherte Spiele (chronologisch), upcoming: [{at, team, o, home}] */
export function profileChart(played, upcoming) {
  const cols = played.map((g, i) => {
    const mine = recordTeam(g), l = g.home ? mine : g.opp, r = g.home ? g.opp : mine;
    const icons = ICON.ball.repeat(g.goals || 0) + ICON.boot.repeat(g.assists || 0) + (g.pos === 'TW' && cleanSheet(g) ? ICON.zero : '');
    return '<button type="button" class="col played" data-tier="' + tierOf(g.points) + '" data-match="' + esc(g.uid) + '" aria-label="Spiel ' + (i + 1) + ': ' + g.points + ' Punkte">' +
      '<div class="ci">' + (i + 1) + '</div><div class="cc"><img src="' + esc(crestUrl(l)) + '" alt=""><img src="' + esc(crestUrl(r)) + '" alt=""></div>' +
      '<div class="cd">' + dayMonth(new Date(g.played_at)) + '</div>' +
      '<div class="trk2"><div class="fill" style="height:' + barHeight(g.points).toFixed(1) + '%"><div class="ico">' + icons + '</div></div></div>' +
      '<div class="cv">' + g.points + '</div><div class="cm">' + g.minutes + '’</div></button>';
  });
  upcoming.forEach((f, j) => {
    const l = f.home ? f.team : f.o, r = f.home ? f.o : f.team;
    cols.push('<div class="col fut' + (j === 0 ? ' next' : '') + '"><div class="ci">' + (played.length + j + 1) + '</div><div class="cc"><img src="' + esc(crestUrl(l)) + '" alt="" loading="lazy"><img src="' + esc(crestUrl(r)) + '" alt="" loading="lazy"></div>' +
      '<div class="cd">' + dayMonth(f.at) + '</div><div class="trk2"></div><div class="cv">-</div><div class="cm">-</div></div>');
  });
  return '<div class="chart kchart">' + cols.join('') + '</div>';
}
/* Profilverlauf so scrollen, dass das letzte gespielte Spiel links im Blick ist */
export function scrollToCurrent(root = document) {
  root.querySelectorAll('.kchart').forEach(c => {
    const last = [...c.querySelectorAll('.col.played')].pop();
    if (!last) { c.scrollLeft = 0; return; }
    /* letztes Spiel als zweite Spalte, davor ein Stück vom vorletzten (wie bei Kickbase) */
    const x = last.getBoundingClientRect().left - c.getBoundingClientRect().left + c.scrollLeft;
    c.scrollLeft = Math.max(0, x - last.offsetWidth - 10);
  });
}
