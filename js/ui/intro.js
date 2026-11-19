/* Rundgänge mit Bildern aus der App:
   - Einführung beim ersten Öffnen (und über „Konto → Einführung ansehen“)
   - Punktevergabe erklärt: beim ersten Öffnen von „Punkte vergeben“ nach dem Spielstart
   Jeder Rundgang erscheint pro Gerät genau einmal (Schlüssel in KEYS). Neue Version eines Rundgangs = neuer Schlüssel,
   dann sieht ihn jeder noch einmal. Bilder liegen im Repo (assets/img/tut, WebP) – kein Supabase-Traffic. */
import { readJson, writeJson, esc } from '../core/util.js';
import { KEYS } from '../config.js';

const IMG = 'assets/img/tut/';
/* [Bild (ohne Endung) oder null = Logo, Überschrift, Text] */
const APP = [
  [null, 'Willkommen bei Kickbase KL', 'Kickbase-Punkte für eure Kreisliga-Spiele: live gebucht, mit Profil, Marktwert und Hall of Fame.'],
  ['a-liga', 'Liga', 'Live-Spiele, nächste Spiele und der Spieler der Woche. Unten das Menü – oder einfach nach links und rechts wischen.'],
  ['a-profil', 'Jeder Spieler hat ein Profil', 'Spieler antippen: Punkte pro Spiel, Marktwert und Form. Ein Balken öffnet das Spiel mit allen Aktionen.'],
  ['a-live', 'Live mitfiebern', 'Läuft ein Spiel, siehst du jede Aktion sofort. Den Live-Link kannst du an alle schicken.'],
  ['a-neu', 'Selbst Punkte vergeben', 'Über den Blitz unten: Spieler wählen, Spiel starten. Die App erklärt dir dann alles Schritt für Schritt.'],
  ['a-ranking', 'Ranking', 'Nach dem Abpfiff speichern – dann landet das Spiel in der Hall of Fame und zählt für den Marktwert.']
];
const BOOK = [
  ['b-start', 'So vergibst du Punkte', 'Oben wählst du den Spieler, unten den Bereich. Aktion antippen – fertig. Kleine Sachen stehen oben, große unten.'],
  ['b-tor', 'Tor? Erst „Tor“ fürs Team', 'Fällt ein Tor, tippe im Reiter Spiel auf „Tor“ für dein Team – nicht beim Spieler. So stimmt der Spielstand für alle.'],
  ['b-schuetze', 'Dann fragt die App nach', 'Wer hat getroffen? Fernschuss oder Schuss aufs Tor einfach dazu ankreuzen.'],
  ['b-vorlage', 'Vorlage und Extras', 'Wer hat vorgelegt, und was war besonders? Alles ist freiwillig – „Fertig“ unten geht immer.'],
  ['b-gegentor', 'Gegentor', 'Auch hier zuerst „Tor“ für den Gegner. Danach kannst du einen Schuldigen wählen – nur, wenn es eindeutig war.'],
  ['b-suche', 'Suchen statt Scrollen', 'Du findest eine Aktion nicht? Einfach suchen, z. B. „Flanke“ oder „Karte“.'],
  ['b-zuletzt', 'Vertippt? Kein Problem', 'Unten stehen die letzten Buchungen. Antippen: löschen oder einem anderen Spieler geben.']
];

export const introSeen = () => !!readJson(KEYS.intro2, false);
export const bookingTourSeen = () => !!readJson(KEYS.tourBook, false);
export const showIntro = () => tour(APP, KEYS.intro2, 'Einführung', 'Los geht’s');
export const showBookingTour = () => tour(BOOK, KEYS.tourBook, 'Punktevergabe erklärt', 'Verstanden');

const logo = '<div class="tour-logo"><img src="assets/icons/logo.svg" alt="Kickbase KL" width="150" height="66"></div>';

function tour(slides, key, label, doneLabel) {
  if (document.getElementById('tour')) return;
  let i = 0;
  const el = document.createElement('div');
  el.id = 'tour'; el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
  el.innerHTML = '<div class="tour-in"><div class="tour-top"><span>' + esc(label) + '</span><button type="button" class="tour-skip" data-tr="skip">Überspringen</button></div>' +
    '<div class="tour-stage" id="tourStage"></div>' +
    '<div class="tour-dots">' + slides.map((_, j) => '<i data-tr="go:' + j + '"></i>').join('') + '</div>' +
    '<div class="tour-nav"><button type="button" class="btn" data-tr="prev">Zurück</button><button type="button" class="btn primary" data-tr="next"></button></div></div>';
  /* Bilder schon mal laden, damit beim Weiterblättern nichts aufpoppt */
  for (const [img] of slides) if (img) { const im = new Image(); im.src = IMG + img + '.webp'; }
  const draw = dir => {
    const [img, t, x] = slides[i], last = i === slides.length - 1, st = el.querySelector('#tourStage');
    st.innerHTML = (img ? '<div class="tour-shot"><img src="' + IMG + img + '.webp" alt="" width="600" height="676"></div>' : logo) +
      '<h2>' + esc(t) + '</h2><p>' + esc(x) + '</p>';
    if (dir && st.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      st.animate([{ opacity: 0, transform: 'translateX(' + 30 * dir + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    el.querySelectorAll('.tour-dots i').forEach((d, j) => d.classList.toggle('on', j === i));
    const prev = el.querySelector('[data-tr="prev"]'), next = el.querySelector('[data-tr="next"]');
    prev.style.visibility = i ? '' : 'hidden';
    next.textContent = last ? doneLabel : 'Weiter';
    next.dataset.tr = last ? 'done' : 'next';
  };
  const close = () => { writeJson(key, true); el.classList.add('gone'); setTimeout(() => el.remove(), 250); };
  const go = n => { if (n < 0 || n >= slides.length || n === i) return; const d = n > i ? 1 : -1; i = n; draw(d); };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-tr]');
    if (!b) return;
    const k = b.dataset.tr;
    if (k === 'next') go(i + 1); else if (k === 'prev') go(i - 1); else if (k.startsWith('go:')) go(+k.slice(3)); else close();
  });
  let x0 = null, y0 = 0;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    go(dx < 0 ? i + 1 : i - 1);
  }, { passive: true });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); });
  document.body.appendChild(el);
  draw(0);
  /* Fokus aufs Fenster (Tastatur/VoiceOver), ohne dass ein Knopf einen Fokusrahmen bekommt */
  el.tabIndex = -1; el.focus();
}
