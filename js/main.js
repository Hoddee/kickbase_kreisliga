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
import { initMe } from './ui/me.js';
import { initMatch, openMatch } from './ui/match.js';
import { initWatch, tickLive, openLiveLink } from './ui/watch.js';
import { startPublisher, startViewer } from './services/live.js';
import { initAdmin, startPasswordFlow } from './ui/admin.js';
import { initFeel } from './ui/feel.js';
import { initTabbar } from './ui/tabbar.js';
import { initMvp } from './ui/mvp.js';
import { loadRoster, loadSchedule } from './services/api.js';
import { consumeRedirect, isLoggedIn, refreshAdminFlag, onAuthChange } from './services/auth.js';

applyMatchNames();
initLive();
initBooking();
initSetup();
initHof();
initStart();
initProfile();
initMe();
initMatch();
initWatch();
initAdmin();
initTabbar();
initMvp();

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
  else if (v.startsWith('g:')) openMatch(v.slice(2));
});
/* Balken im Profil / Spieltags-Kacheln: Spiel-Detail als Blatt */
document.addEventListener('click', e => {
  const m = e.target.closest('[data-match]');
  if (m) openMatch(m.getAttribute('data-match'));
});

/* Admin-Symbol oben rechts in der Auswahl leuchtet, wenn angemeldet */
onAuthChange(() => { if (nav.current === 'start') rerender('start'); });

/* Rücksprung aus einer Passwort-E-Mail */
const redirect = consumeRedirect();
if (redirect && redirect.error) toast('Link ungültig oder abgelaufen: ' + redirect.error, 'bad');

show(store.S.match && !store.S.ended ? (store.S.manual ? 'edit' : 'home') : 'start');
if (redirect && !redirect.error && (redirect.type === 'recovery' || redirect.type === 'invite')) startPasswordFlow();

/* Live-Link aus WhatsApp & Co.: ?live=<Spiel-ID> */
const liveParam = new URLSearchParams(location.search).get('live');
if (liveParam) {
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  if (/^[A-Za-z0-9_-]{6,64}$/.test(liveParam)) openLiveLink(liveParam);
}

/* Startbildschirm ausblenden (mindestens kurz sichtbar, damit er nicht flackert); beim ersten Mal die Einführung */
const splash = document.getElementById('splash');
/* Stylesheets laden ohne zu blockieren (siehe index.html) – Startbildschirm bleibt, bis alle da sind */
const cssReady = () => Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(l =>
  l.sheet && l.media !== 'print' ? 0 : new Promise(r => { l.addEventListener('load', r, { once: true }); l.addEventListener('error', r, { once: true }); setTimeout(r, 8000); })));
Promise.all([cssReady(), new Promise(r => setTimeout(r, Math.max(0, 500 - performance.now())))]).then(() => {
  if (splash) { splash.classList.add('gone'); setTimeout(() => splash.remove(), 400); }
  if (!introSeen() && !(redirect && !redirect.error)) setTimeout(showIntro, 250);
});

/* Kader (Status, Positionen, Marktwerte) aus der Datenbank holen */
loadRoster().then(ok => { if (ok) rerender(); });
loadSchedule().then(ok => { if (ok && (nav.current === 'start' || nav.current === 'profile')) rerender(); });
if (isLoggedIn()) refreshAdminFlag();

/* Live: eigenes Spiel senden, Spiele der anderen empfangen */
startPublisher();
startViewer();

/* Sekundentakt für Uhr und Live-Status */
setInterval(() => {
  tickLive();
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

/* App-Gefühl (Gesten, Antippen) und Service Worker mit Update-Prüfung */
initFeel();
