/* Menü unten wie in der Kickbase-App: Liga, Kader, Spiel, Ranking (Hall of Fame), Ich.
   Sichtbar nur in den Hauptbereichen; der aktive Punkt zeigt seine Beschriftung.
   „Spiel“ öffnet das laufende Spiel oder legt ein neues an, „Ich“ führt zu Mein Bereich bzw. zum Konto. */
import { $ } from '../core/util.js';
import { show, nav, onShow, currentEls } from '../router.js';
import { store, allSaved } from '../core/game.js';
import { isAdmin, isLoggedIn, pendingRequests, myPlayer, onAuthChange } from '../services/auth.js';
import { requestNewGame } from './start.js';
import { resetHof } from './hof.js';

/* Ansicht → Menüpunkt */
const TAB_OF = { start: 'start', kader: 'kader', hof: 'hof', me: 'me', admin: 'me' };
const running = () => { const S = store.S; return !!(S.match && !(S.ended && allSaved())); };
const meTarget = () => (myPlayer() && !isAdmin() ? 'me' : 'admin');

export function updateTabbar(view = nav.current) {
  const bar = $('tabbar'), tab = TAB_OF[view];
  const on = !!tab && !document.body.classList.contains('sheet-open');
  bar.hidden = !tab;
  document.body.classList.toggle('has-tabbar', !!tab);
  /* Ohne Zwischenschritt braucht der Kopf keinen Zurück-Knopf (das Menü ersetzt ihn) */
  document.body.classList.toggle('tab-root', !!tab && nav.stack.length <= 2 && (nav.previous === 'start' || view === 'start'));
  if (!on && !tab) return;
  for (const b of bar.querySelectorAll('[data-tb]')) {
    const act = b.dataset.tb === tab;
    b.classList.toggle('on', act);
    if (act) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  $('tbDot').hidden = !running();
  $('tbGameL').textContent = running() ? 'Live' : 'Spiel';
  $('tbMeL').textContent = isLoggedIn() ? 'Ich' : 'Konto';
  const n = isAdmin() ? pendingRequests() : 0, badge = $('tbBadge');
  badge.hidden = !n; badge.textContent = n > 9 ? '9+' : String(n || '');
}

/* ---------- Wischen zwischen den Bereichen ----------
   Waagerecht wischen wechselt zum Nachbarbereich (Liga ⇄ Kader ⇄ Ranking ⇄ Ich, „Spiel“ ist eine Aktion und fehlt).
   Die Ansicht folgt dem Finger; waagerecht scrollende Leisten und Formularfelder behalten ihr eigenes Wischen. */
const ORDER = ['start', 'kader', 'hof', 'me'];
const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollsX = el => {
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.matches('input, textarea, select, [data-noswipe]')) return true;
    if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
};
function initSwipe() {
  let x0 = null, y0 = 0, t0 = 0, dx = 0, mode = null, els = [], idx = -1;
  const parts = () => currentEls().flatMap(v => [...v.children]).filter(el => getComputedStyle(el).position !== 'fixed');
  const move = v => els.forEach(el => { el.style.transform = v ? 'translateX(' + v + 'px)' : ''; });
  const reset = () => els.forEach(el => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; });
  document.addEventListener('touchstart', e => {
    x0 = null; mode = null;
    const b = document.body;
    if (e.touches.length !== 1 || !b.classList.contains('tab-root') || b.classList.contains('sheet-open') || document.querySelector('.sheet-bg')) return;
    idx = ORDER.indexOf(TAB_OF[nav.current]);
    const t = e.touches[0];
    /* Im Browser die Ränder frei lassen: dort liegt die Zurück-Geste von Safari */
    const m = standalone ? 0 : 24;
    if (idx < 0 || t.clientX < m || t.clientX > window.innerWidth - m || scrollsX(e.target)) return;
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); dx = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (x0 == null) return;
    const t = e.touches[0], ddx = t.clientX - x0, ddy = t.clientY - y0;
    if (!mode) {
      if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return;
      /* Richtung festlegen: deutlich waagerecht = wischen, sonst normal scrollen */
      if (Math.abs(ddx) > Math.abs(ddy) * 1.4) { mode = 'x'; els = parts(); els.forEach(el => { el.style.transition = 'none'; }); }
      else { x0 = null; return; }
    }
    dx = ddx;
    /* Am ersten/letzten Bereich nur leicht nachgeben */
    const edge = (dx > 0 && idx === 0) || (dx < 0 && idx === ORDER.length - 1);
    move(edge ? dx * 0.25 : dx * 0.85);
  }, { passive: true });
  const end = () => {
    if (x0 == null || mode !== 'x') { x0 = null; return; }
    x0 = null;
    const v = Math.abs(dx) / Math.max(1, Date.now() - t0), dir = dx < 0 ? 1 : -1, next = idx + dir;
    const go = next >= 0 && next < ORDER.length && (Math.abs(dx) > window.innerWidth * 0.28 || (v > 0.45 && Math.abs(dx) > 40));
    if (!go || reduced() || !Element.prototype.animate) {
      els.forEach(el => { el.style.transition = 'transform .22s cubic-bezier(.2, .8, .2, 1)'; });
      move(0);
      setTimeout(reset, 240);
      if (go) switchTab(ORDER[next]);
      return;
    }
    /* Alte Ansicht gleitet raus, neue kommt von der anderen Seite */
    const w = window.innerWidth, from = dx * 0.85;
    Promise.all(els.map(el => el.animate([{ transform: 'translateX(' + from + 'px)' }, { transform: 'translateX(' + (-dir * w * 0.5) + 'px)', opacity: 0 }],
      { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {}))).then(() => {
      els.forEach(el => el.getAnimations().forEach(a => a.cancel()));
      reset();
      switchTab(ORDER[next], true);
      parts().forEach(el => el.animate([{ transform: 'translateX(' + (dir * w * 0.35) + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 260, easing: 'cubic-bezier(.2, .8, .2, 1)' }));
    });
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}
function switchTab(k, noAnim) {
  const target = k === 'me' ? meTarget() : k;
  if (target === 'hof') resetHof();
  if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {}
  show(target, { tab: true, noAnim: !!noAnim });
}

export function initTabbar() {
  initSwipe();
  onShow(v => updateTabbar(v));
  onAuthChange(() => updateTabbar());
  $('tabbar').addEventListener('click', e => {
    const b = e.target.closest('[data-tb]');
    if (!b) return;
    const k = b.dataset.tb;
    if (k === 'game') {
      const S = store.S;
      if (running()) show(S.manual && !S.ended ? 'edit' : 'home');
      else requestNewGame();
      return;
    }
    const target = k === 'me' ? meTarget() : k;
    /* Nochmal auf den aktiven Punkt: nach oben scrollen */
    if (TAB_OF[nav.current] === k && nav.current === target) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (target === 'hof') resetHof();
    show(target, { tab: true });
  });
}
