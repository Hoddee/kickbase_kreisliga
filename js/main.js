/* Einstiegspunkt: Ansichten verdrahten, Daten laden, Sekundentakt starten */
import { store, applyMatchNames } from './core/game.js';
import { toast } from './core/util.js';
import { show, back, rerender, nav } from './router.js';
import { initLive, tick as liveTick } from './ui/live.js';
import { initBooking, tick as bookingTick } from './ui/booking.js';
import { initSetup } from './ui/setup.js';
import { initHof, resetHof, openHofGame } from './ui/hof.js';
import { initStart } from './ui/start.js';
import { initProfile, openProfile } from './ui/profile.js';
import { showIntro, introSeen } from './ui/intro.js';
import { initAdmin, startPasswordFlow } from './ui/admin.js';
import { loadRoster, loadSchedule } from './services/api.js';
import { consumeRedirect, isLoggedIn, refreshAdminFlag, onAuthChange } from './services/auth.js';

applyMatchNames();
initLive();
initBooking();
initSetup();
initHof();
initStart();
initProfile();
initAdmin();

/* Navigation über data-nav="…" (back = zur vorherigen Ansicht) */
document.addEventListener('click', e => {
  const n = e.target.closest('[data-nav]');
  if (!n) return;
  const target = n.getAttribute('data-nav');
  if (target === 'back') { back(); return; }
  if (target === 'hof') resetHof();
  show(target);
});
/* Profil oder Spiel öffnen: data-open="p:SPIELER" / "g:SPIEL" (überall in der App) */
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]');
  if (!o) return;
  const v = o.getAttribute('data-open');
  if (v.startsWith('p:')) openProfile(v.slice(2));
  else if (v.startsWith('g:')) openHofGame(v.slice(2));
});

/* Admin-Symbol oben rechts in der Auswahl leuchtet, wenn angemeldet */
onAuthChange(() => { if (nav.current === 'start') rerender('start'); });

/* Rücksprung aus einer Passwort-E-Mail */
const redirect = consumeRedirect();
if (redirect && redirect.error) toast('Link ungültig oder abgelaufen: ' + redirect.error, 'bad');

show(store.S.match && !store.S.ended ? (store.S.manual ? 'edit' : 'home') : 'start');
if (redirect && !redirect.error && (redirect.type === 'recovery' || redirect.type === 'invite')) startPasswordFlow();

/* Startbildschirm ausblenden (mindestens kurz sichtbar, damit er nicht flackert); beim ersten Mal die Einführung */
const splash = document.getElementById('splash');
setTimeout(() => {
  if (splash) { splash.classList.add('gone'); setTimeout(() => splash.remove(), 400); }
  if (!introSeen() && !(redirect && !redirect.error)) setTimeout(showIntro, 250);
}, Math.max(0, 700 - performance.now()));

/* Kader (Status, Positionen, Marktwerte) aus der Datenbank holen */
loadRoster().then(ok => { if (ok) rerender(); });
loadSchedule().then(ok => { if (ok && (nav.current === 'start' || nav.current === 'profile')) rerender(); });
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
