/* Menü unten wie in der Kickbase-App: Liga, Kader, Spiel, Ranking (Hall of Fame), Ich.
   Sichtbar nur in den Hauptbereichen; der aktive Punkt zeigt seine Beschriftung.
   „Spiel“ öffnet das laufende Spiel oder legt ein neues an, „Ich“ führt zu Mein Bereich bzw. zum Konto. */
import { $ } from '../core/util.js';
import { show, nav, onShow } from '../router.js';
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

export function initTabbar() {
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
