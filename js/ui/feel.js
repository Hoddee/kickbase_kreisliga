/* App-Gefühl: Rückmeldung beim Antippen, Wischen vom linken Rand = Zurück (iPhone-App), Ziehen zum Aktualisieren,
   und Updates für die App vom Home-Bildschirm (die wird von iOS nur „aufgeweckt“, nicht neu gestartet). */
import { nav, back, rerender, currentEls } from '../router.js';
import { games, loadGames, loadRoster, loadSchedule, forgetEvents } from '../services/api.js';
import { buzz } from '../core/util.js';

const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Antippen: iOS zeigt :active nur, wenn ein touchstart-Listener existiert ---------- */
function initPress() { document.addEventListener('touchstart', () => {}, { passive: true }); }

/* ---------- Vom linken Rand wischen = Zurück ----------
   Nur in der installierten iPhone-App: Safari und Android haben dafür schon eine eigene Geste.
   Nicht beim Punktevergeben – dort wechselt Wischen den Spieler. */
function initEdgeSwipe() {
  if (!(isIOS && standalone)) return;
  let x0 = null, y0 = 0, dx = 0, on = false, els = [];
  const move = v => els.forEach(el => { el.style.transform = v ? 'translateX(' + v + 'px)' : ''; });
  document.addEventListener('touchstart', e => {
    x0 = null;
    if (e.touches.length !== 1 || nav.current === 'start' || nav.current === 'edit' || document.body.classList.contains('sheet-open')) return;
    const t = e.touches[0];
    if (t.clientX > 22) return;
    x0 = t.clientX; y0 = t.clientY; dx = 0; on = false;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (x0 == null) return;
    const t = e.touches[0], ddx = t.clientX - x0, ddy = Math.abs(t.clientY - y0);
    if (!on) {
      if (ddy > 12 && ddy > ddx) { x0 = null; return; }
      if (ddx < 12) return;
      on = true;
      /* Nur normal positionierte Teile verschieben (fest positionierte Knöpfe würden springen) */
      els = currentEls().flatMap(v => [...v.children]).filter(el => getComputedStyle(el).position !== 'fixed');
      els.forEach(el => { el.style.transition = 'none'; });
    }
    dx = Math.max(0, ddx);
    move(dx * 0.6);
  }, { passive: true });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    if (!on) return;
    const go = dx > 90;
    els.forEach(el => { el.style.transition = 'transform .18s ease-out'; });
    move(0);
    setTimeout(() => els.forEach(el => { el.style.transition = ''; el.style.transform = ''; }), 200);
    if (go) { buzz(8); back(); }
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}

/* ---------- Ziehen zum Aktualisieren (Übersicht, Hall of Fame, Mein Bereich) ----------
   Safari im Browser hat das schon selbst, dort bleibt es aus. */
const REFRESH = {
  start: () => Promise.all([loadGames(true), loadRoster(), loadSchedule()]),
  hof: () => { forgetEvents(); return loadGames(true); },
  me: () => loadGames(true)
};
function initPull() {
  if (isIOS && !standalone) return;
  const ind = document.createElement('div');
  ind.className = 'ptr-ind'; ind.setAttribute('aria-hidden', 'true');
  ind.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/></svg>';
  document.body.appendChild(ind);
  const LIMIT = 72;
  let y0 = null, dy = 0, busy = false;
  const set = (d, anim) => {
    ind.style.transition = anim ? 'transform .2s ease-out, opacity .2s' : 'none';
    ind.style.opacity = d > 4 ? Math.min(1, d / LIMIT) : 0;
    ind.style.transform = 'translate(-50%, ' + Math.min(d, LIMIT + 20) + 'px) rotate(' + d * 3 + 'deg)';
    ind.classList.toggle('ready', d >= LIMIT);
  };
  document.addEventListener('touchstart', e => {
    y0 = null;
    if (busy || e.touches.length !== 1 || !REFRESH[nav.current] || document.body.classList.contains('sheet-open') || window.scrollY > 0) return;
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (y0 == null) return;
    if (window.scrollY > 0) { y0 = null; set(0, true); return; }
    const d = e.touches[0].clientY - y0;
    const was = dy >= LIMIT;
    dy = Math.max(0, d * 0.5);
    if (!was && dy >= LIMIT) buzz(8);
    set(dy, false);
  }, { passive: true });
  document.addEventListener('touchend', async () => {
    if (y0 == null) return;
    y0 = null;
    if (dy < LIMIT) { set(0, true); return; }
    const view = nav.current;
    busy = true; set(LIMIT * 0.8, true); ind.classList.add('spin');
    try { await REFRESH[view](); } catch (e) {}
    if (games.list) rerender(view);
    ind.classList.remove('spin'); set(0, true); busy = false;
  }, { passive: true });
}

/* ---------- Updates ----------
   Beim Zurückholen der App nach neuer Version fragen; ist eine da, wird neu geladen, sobald gerade
   keine Punkte vergeben werden (der Spielstand liegt im Gerät und übersteht das Neuladen). */
function initUpdates() {
  if (!('serviceWorker' in navigator) || (location.protocol !== 'https:' && location.hostname !== 'localhost')) return;
  const hadController = !!navigator.serviceWorker.controller;
  let pending = false;
  const safe = () => nav.current !== 'edit' && !document.querySelector('input:focus, textarea:focus, select:focus');
  const reload = () => { if (pending && (document.visibilityState === 'hidden' || safe())) location.reload(); };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController) return; pending = true; reload(); });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
      else reload();
    });
  }).catch(() => {});
}

export function initFeel() {
  initPress();
  initEdgeSwipe();
  initPull();
  initUpdates();
  if (standalone) document.documentElement.classList.add('standalone');
  if (reduced()) document.documentElement.classList.add('rm');
}
