/* Einstiegspunkt: Ansichten verdrahten, Daten laden, Sekundentakt starten */
import { store, applyMatchNames } from './core/game.js';
import { toast } from './core/util.js';
import { show, rerender, nav } from './router.js';
import { initLive, tick as liveTick } from './ui/live.js';
import { initBooking, tick as bookingTick } from './ui/booking.js';
import { initSetup } from './ui/setup.js';
import { initHof, resetHof } from './ui/hof.js';
import { initAdmin, startPasswordFlow } from './ui/admin.js';
import { loadRoster } from './services/api.js';
import { consumeRedirect, isLoggedIn, refreshAdminFlag, onAuthChange } from './services/auth.js';

applyMatchNames();
initLive();
initBooking();
initSetup();
initHof();
initAdmin();

/* Navigation über data-nav="…" (back = zur vorherigen Ansicht) */
document.addEventListener('click', e => {
  const n = e.target.closest('[data-nav]');
  if (!n) return;
  let target = n.getAttribute('data-nav');
  if (target === 'hof') resetHof();
  if (target === 'back') target = nav.previous && nav.previous !== nav.current ? nav.previous : 'setup';
  show(target);
});

/* Admin-Symbol oben rechts in der Auswahl leuchtet, wenn angemeldet */
onAuthChange(() => { if (nav.current === 'setup') rerender('setup'); });

/* Rücksprung aus einer Passwort-E-Mail */
const redirect = consumeRedirect();
if (redirect && redirect.error) toast('Link ungültig oder abgelaufen: ' + redirect.error, 'bad');

show(store.S.match ? 'home' : 'setup');
if (redirect && !redirect.error && (redirect.type === 'recovery' || redirect.type === 'invite')) startPasswordFlow();

/* Kader (Status, Positionen, Marktwerte) aus der Datenbank holen */
loadRoster().then(ok => { if (ok) rerender(); });
if (isLoggedIn()) refreshAdminFlag();

/* Sekundentakt für Uhr und Live-Status */
setInterval(() => {
  if (nav.current === 'home') liveTick();
  else if (nav.current === 'edit') bookingTick();
}, 1000);

/* Bildschirm bleibt an, solange die App offen ist (für das Buchen am Spielfeldrand) */
let wakeLock = null;
function keepAwake() {
  try {
    if (navigator.wakeLock && document.visibilityState === 'visible' && !wakeLock) {
      navigator.wakeLock.request('screen').then(l => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
    }
  } catch (e) {}
}
document.addEventListener('visibilitychange', keepAwake);
document.addEventListener('click', keepAwake);

/* Offline-Fähigkeit und "Zum Startbildschirm hinzufügen" */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
