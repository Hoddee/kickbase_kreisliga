/* Spieltag: MVP-Stage mit den Top 3.
   Ein Spieltag ist eine Woche (Montag 0:00 bis Sonntag 24:00, Uhrzeit des Geräts). Sonntag ab 19:00 wird er „gelauncht“:
   Die MVP-Stage (Top 3 mit Animation) öffnet sich einmal von selbst, danach über die Karte auf der Liga-Seite.
   Gezählt wird je Spieler sein bestes Spiel der Woche. Bis Sonntag 19:00 bleibt der vorige Spieltag sichtbar. */
import { $, esc, tierOf, buzz, readJson, writeJson, pad2 } from '../core/util.js';
import { KEYS } from '../config.js';
import { PL, POS_SHORT, photoUrl } from '../data/players.js';
import { games } from '../services/api.js';
import { TEAMS, allFixtures } from '../data/schedule.js';
import { registerView, show, back, nav } from '../router.js';
import { avatar } from './components.js';
import { introSeen } from './intro.js';
import { TIER_COLOR, loadImg, fontsReady, shareCanvas, roundRect, narrow } from './share.js';

const DAY = 864e5, REVEAL_H = 19;
const weekStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const revealAt = ws => { const r = new Date(ws); r.setDate(r.getDate() + 6); r.setHours(REVEAL_H, 0, 0, 0); return r; };
const idOf = ws => ws.getFullYear() + '-' + pad2(ws.getMonth() + 1) + '-' + pad2(ws.getDate());
const range = ws => { const e = new Date(ws.getTime() + 6 * DAY); return pad2(ws.getDate()) + '.' + (ws.getMonth() === e.getMonth() ? '' : pad2(ws.getMonth() + 1) + '.') + '–' + pad2(e.getDate()) + '.' + pad2(e.getMonth() + 1) + '.'; };

/* Spieltag-Nummer: Woche 09.–15.11.2026 war der 13. Spieltag. Danach zählt jede Woche mit Spielen im Spielplan
   (Winterpause wird übersprungen), davor wird wochenweise zurückgerechnet. Zum Saisonwechsel den Anker anpassen. */
const ANCHOR = { ws: new Date(2026, 10, 9), n: 13 };
function matchdayNo(ws) {
  const a = ANCHOR.ws.getTime(), t = ws.getTime();
  if (t <= a) { const n = ANCHOR.n - Math.round((a - t) / (7 * DAY)); return n > 0 ? n : null; }
  const weeks = new Set();
  for (const tm of TEAMS) for (const f of allFixtures(tm)) weeks.add(weekStart(f.at).getTime());
  if (!weeks.has(t)) return null;
  return ANCHOR.n + [...weeks].filter(w => w > a && w <= t).length;
}
const mdTitle = ws => { const n = matchdayNo(ws); return n ? n + '. Spieltag' : 'Spieltag'; };

/* Bestes Spiel je Spieler im Zeitraum, absteigend nach Punkten */
function bestOf(ws) {
  const from = ws.getTime(), to = from + 7 * DAY, best = new Map();
  for (const g of games.list || []) {
    const t = new Date(g.played_at).getTime();
    if (t < from || t >= to || !PL[g.player]) continue;
    const b = best.get(g.player);
    if (!b || g.points > b.points) best.set(g.player, g);
  }
  return [...best.values()].sort((a, b) => b.points - a.points || (b.goals || 0) - (a.goals || 0));
}
/* Welcher Spieltag ist gerade dran? Vor Sonntag 19:00 der vorige; dazu ein Hinweis, wann der nächste startet */
export function current(now = new Date()) {
  const ws = weekStart(now), rv = revealAt(ws), live = now >= rv;
  const shown = live ? ws : new Date(ws.getTime() - 7 * DAY);
  const list = bestOf(shown), next = live ? null : { at: rv, count: bestOf(ws).length };
  return { id: idOf(shown), ws: shown, label: range(shown), title: mdTitle(shown), list, next };
}

/* ---------- Karte auf der Liga-Seite ---------- */
function until(at) {
  const m = Math.max(0, Math.round((at - Date.now()) / 6e4));
  if (m < 60) return 'in ' + m + ' Min';
  if (m < 24 * 60) return 'in ' + Math.floor(m / 60) + ' Std ' + (m % 60) + ' Min';
  return 'Sonntag ' + REVEAL_H + ':00';
}
export function spieltagCardHtml() {
  if (!games.list) return '';
  const md = current(), top = md.list.slice(0, 3);
  const teaser = md.next && md.next.count ? '<div class="md-next"><i></i><span><b>MVP-Stage</b> ' + esc(until(md.next.at)) + '</span><small>' + md.next.count + ' Spieler</small></div>' : '';
  if (!top.length) return teaser ? '<h2>' + esc(mdTitle(weekStart(new Date()))) + '</h2>' + teaser : '';
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return '<h2 class="lh2">' + esc(md.title) + '<small>' + esc(md.label) + '</small></h2>' + teaser +
    '<div class="mdc"><div class="mdc-pod">' + order.map(g => {
      const r = top.indexOf(g) + 1;
      return '<button type="button" class="mdc-p r' + r + ' tc" data-tier="' + tierOf(g.points) + '" data-match="' + esc(g.uid) + '">' + avatar(g.player) +
        '<i>' + r + '</i><span>' + esc(PL[g.player].n) + '</span><b>' + g.points + '</b></button>';
    }).join('') + '</div>' +
    '<button type="button" class="btn primary full mdc-go" data-md="stage"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>MVP-Stage</button></div>';
}

/* ---------- MVP-Stage ---------- */
let stage = null;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function stageHtml(md) {
  const top = md.list.slice(0, 3), slots = [[top[1], 2], [top[0], 1], [top[2], 3]].filter(x => x[0]);
  return '<div class="mvp-bg" aria-hidden="true"><i class="mvp-beam b1"></i><i class="mvp-beam b2"></i><i class="mvp-beam b3"></i></div>' +
    '<div class="mvp-in"><button type="button" class="mvp-x" data-md="close" aria-label="Schließen">×</button>' +
    '<div class="mvp-head"><small>' + esc(md.title) + ' · ' + esc(md.label) + '</small><h1>MVP<span>des Spieltags</span></h1></div>' +
    '<div class="mvp-pod">' + slots.map(([g, r]) => {
      const p = PL[g.player];
      return '<button type="button" class="mp r' + r + '" data-r="' + r + '" data-match="' + esc(g.uid) + '" style="--c:' + TIER_COLOR[tierOf(g.points)] + '">' +
        '<span class="mp-ph"><img src="' + esc(photoUrl(g.player)) + '" alt=""></span>' +
        '<span class="mp-n">' + (p.vn ? '<small>' + esc(p.vn) + '</small>' : '') + '<b>' + esc(p.n) + '</b></span>' +
        '<span class="mp-v" data-to="' + g.points + '">0</span>' +
        '<span class="mp-blk"><i>' + r + '</i><small>' + esc(POS_SHORT[g.pos] || '') + '</small></span></button>';
    }).join('') + '</div>' +
    '<div class="mvp-cta"><button type="button" class="btn" data-md="close">Schließen</button><button type="button" class="btn primary" data-md="share-top">Teilen</button></div></div>';
}
/* Zahl hochzählen */
function countUp(el, ms) {
  const to = +el.dataset.to, t0 = performance.now();
  if (reduced() || ms === 0) { el.textContent = to; return; }
  const step = t => { const k = Math.min(1, (t - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
/* Konfetti in Stufenfarben */
function confetti(host, color) {
  if (reduced() || !host.animate) return;
  const cols = [color, '#f4f6f9', '#E1BE38', '#28DE86'];
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('i');
    c.className = 'mvp-cf'; c.style.background = cols[i % cols.length];
    host.appendChild(c);
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 220, x = Math.cos(a) * d, y = Math.sin(a) * d - 120;
    c.animate([{ transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: 'translate(' + x + 'px,' + (y + 260) + 'px) rotate(' + (Math.random() * 720 - 360) + 'deg) scale(.6)', opacity: 0 }],
      { duration: 1400 + Math.random() * 900, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.then(() => c.remove()).catch(() => {});
  }
}
function reveal(r, fast) {
  const el = stage && stage.el.querySelector('.mp[data-r="' + r + '"]');
  if (!el || el.classList.contains('on')) return;
  el.classList.add('on');
  countUp(el.querySelector('.mp-v'), fast ? 0 : r === 1 ? 1500 : 1000);
  if (!fast) buzz(r === 1 ? [20, 60, 30] : 12);
  if (r === 1 && !fast) setTimeout(() => confetti(stage.el.querySelector('.mvp-pod'), getComputedStyle(el).getPropertyValue('--c')), 350);
}
function finish() {
  if (!stage) return;
  stage.timers.forEach(clearTimeout); stage.timers = [];
  [3, 2, 1].forEach(r => reveal(r, true));
  stage.el.classList.add('mvp-done'); stage.el.classList.remove('mvp-drum');
}
function renderStage() {
  const md = current(), el = $('mvp');
  if (stage) stage.timers.forEach(clearTimeout);
  stage = { el, md, timers: [] };
  writeJson(KEYS.mvpSeen, md.id);
  el.className = 'mvp';
  el.innerHTML = stageHtml(md);
  if (reduced()) { finish(); return; }
  const at = (ms, fn) => stage.timers.push(setTimeout(fn, ms));
  requestAnimationFrame(() => el.classList.add('mvp-go'));
  at(1300, () => reveal(3));
  at(2800, () => reveal(2));
  at(4300, () => el.classList.add('mvp-drum'));
  at(5300, () => { el.classList.remove('mvp-drum'); reveal(1); });
  at(6900, () => el.classList.add('mvp-done'));
}

/* Einmal pro Spieltag von selbst öffnen (nicht über der Einführung oder einem anderen Blatt) */
export function maybeLaunch() {
  if (!games.list || nav.current !== 'start' || !introSeen() || document.getElementById('tour') || document.body.classList.contains('sheet-open')) return;
  const md = current();
  if (md.list.length && readJson(KEYS.mvpSeen, '') !== md.id) show('mvp');
}

/* ---------- Teilen ---------- */
async function shareTop() {
  const md = current(), top = md.list.slice(0, 3);
  if (!top.length) return;
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'), photos = await Promise.all(top.map(g => loadImg(photoUrl(g.player)))); await fontsReady();
  x.fillStyle = '#131417'; x.fillRect(0, 0, W, H);
  for (let yy = 30; yy < 700; yy += 54) for (let xx = 27; xx < W; xx += 54) { x.fillStyle = 'rgba(255,255,255,' + (0.16 * (1 - yy / 700)).toFixed(3) + ')'; x.beginPath(); x.arc(xx, yy, 3, 0, 6.2832); x.fill(); }
  x.textAlign = 'center'; x.fillStyle = '#a8adb4'; x.font = '600 30px "Inter Tight", Arial, sans-serif'; x.fillText(md.title.toUpperCase() + ' · ' + md.label, W / 2, 96);
  x.fillStyle = '#f4f6f9'; x.font = '800 120px "KL Pitch", Arial, sans-serif'; narrow(x, true); x.fillText('MVP', W / 2, 220); narrow(x, false);
  /* [Index in top, Mitte x, Platz, Höhe] – Platz 1 zuletzt, damit sein Foto vorne liegt */
  const slot = [[1, W / 2 - 330, 2, 340], [2, W / 2 + 330, 3, 260], [0, W / 2, 1, 470]];
  for (const [i, cx, r, bh] of slot) {
    const g = top[i]; if (!g) continue;
    const col = TIER_COLOR[tierOf(g.points)], base = H - 120, w = r === 1 ? 330 : 290, ph = photos[i];
    x.fillStyle = '#1f2125'; roundRect(x, cx - w / 2, base - bh, w, bh, 18); x.fill();
    x.fillStyle = col; x.fillRect(cx - w / 2, base - bh, w, 8);
    if (ph) { const pw = r === 1 ? 420 : 340, phh = pw * ph.height / ph.width; x.save(); x.beginPath(); x.rect(cx - 260, 240, 520, base - bh - 240 + 2); x.clip(); x.drawImage(ph, cx - pw / 2, base - bh - phh * 0.7, pw, phh); x.restore(); }
    x.fillStyle = col; x.font = '800 ' + (r === 1 ? 96 : 76) + 'px "KL Pitch", Arial, sans-serif'; x.fillText(String(g.points), cx, base - bh + (r === 1 ? 120 : 100));
    x.fillStyle = '#f4f6f9'; x.font = '800 ' + (r === 1 ? 52 : 44) + 'px "KL Pitch", Arial, sans-serif'; narrow(x, true); x.fillText(PL[g.player].n.toUpperCase(), cx, base - bh + (r === 1 ? 190 : 160)); narrow(x, false);
    x.fillStyle = 'rgba(255,255,255,.14)'; x.font = '800 ' + (r === 1 ? 150 : 110) + 'px "KL Pitch", Arial, sans-serif'; x.fillText(String(r), cx, base - 24);
  }
  x.fillStyle = '#7e8187'; x.font = '500 26px "Inter Tight", Arial, sans-serif'; x.fillText('Kickbase KL', W / 2, H - 50);
  shareCanvas(cv, 'mvp-' + md.id + '.png', 'MVP des Spieltags');
}
export function initMvp() {
  registerView('mvp', { elements: ['mvp'], render: renderStage, overlay: true, leave: () => { if (stage) { stage.timers.forEach(clearTimeout); stage = null; } } });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-md]');
    if (b) {
      const k = b.dataset.md;
      if (k === 'stage') show('mvp');
      else if (k === 'close') back();
      else if (k === 'share-top') shareTop();
      return;
    }
    /* Tipp auf die Bühne überspringt die Animation */
    if (stage && e.target.closest('#mvp') && !stage.el.classList.contains('mvp-done')) { e.stopPropagation(); e.preventDefault(); finish(); }
  }, true);
  /* Um 19:00 am Sonntag: Liga neu zeichnen und die Stage starten, falls die App gerade offen ist */
  setInterval(() => { if (nav.current === 'start') { const md = current(); if (readJson(KEYS.mvpSeen, '') !== md.id && md.list.length) maybeLaunch(); } }, 30000);
}
