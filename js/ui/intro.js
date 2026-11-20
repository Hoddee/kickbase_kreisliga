/* Rundgänge mit Bildern aus der App:
   - Einführung beim ersten Öffnen (und über „Konto → Einführung ansehen“)
   - Punktevergabe erklärt: beim ersten Öffnen von „Punkte vergeben“ nach dem Spielstart
   Bilder: Screenshots der App und Fotos von uns (f-*), gemischt. Jeder Rundgang erscheint pro Gerät genau einmal (Schlüssel in KEYS). Neue Version eines Rundgangs = neuer Schlüssel,
   dann sieht ihn jeder noch einmal. Bilder liegen im Repo (assets/img/tut, WebP) – kein Supabase-Traffic. */
import { readJson, writeJson, esc, fmt, cls, setNum, reducedMotion } from '../core/util.js';
import { PL, photoUrl } from '../data/players.js';
import { ACT } from '../core/game.js';
import { qrSvg } from '../core/qr.js';
import { KEYS, APP_URL } from '../config.js';

const IMG = 'assets/img/tut/', V = '.webp?v=3'; // neue Bilder: v hochzählen (der Service Worker hält Bilder sonst für immer)
/* Folien: { s: Screenshot der App } oder { f: Foto von uns, chips: [[Aktion, Punkte]], inset: kleiner Screenshot, logo } */
const APP = [
  { f: 'f-duell', logo: 1, t: 'Willkommen bei Kickbase KL', x: 'Kickbase-Punkte für unsere Kreisliga – live vom Spielfeldrand.' },
  { s: 'a-liga', t: 'Liga', x: 'Live-Spiele, nächste Spiele und der Spieler der Woche. Unten das Menü – oder einfach seitlich wischen.' },
  { s: 'a-profil', t: 'Jeder hat ein Profil', x: 'Punkte pro Spiel, Marktwert und Form. Ein Balken öffnet das Spiel mit allen Aktionen.' },
  { s: 'a-live', t: 'Live dabei', x: 'Läuft ein Spiel, siehst du jede Aktion sofort – auch ohne am Platz zu sein.' },
  { f: 'f-zweikampf', tag: { p: 'Barbano', a: ['duel', 'icpt', 'clri'] }, t: 'Live bewerten', x: 'Jede Aktion am Spielfeldrand sofort buchen. Über den Blitz unten: Spieler wählen, Spiel starten.' },
  { s: 'a-ranking', t: 'Ranking', x: 'Nach dem Abpfiff speichern – dann zählt das Spiel für Hall of Fame und Marktwert.' },
  { f: 'f-jubel', chips: [['MVP', 1], ['Top 3', 2]], t: 'Montag, 19 Uhr', x: 'Dann startet die MVP-Stage: die drei Besten des Spieltags.' }
];
const BOOK = [
  { s: 'b-start', t: 'So vergibst du Punkte', x: 'Oben den Spieler wählen, unten den Bereich. Aktion antippen – fertig.' },
  { s: 'b-tor', t: 'Tor? Erst fürs Team', x: 'Fällt ein Tor, tippe im Reiter Spiel auf „Tor“ für dein Team – nicht beim Spieler. So stimmt der Spielstand für alle.' },
  { f: 'f-schuss', top: 1, chips: [['Tor', 'goal'], ['Schuss aufs Tor', 'sot'], ['Fernschuss', 'long']], t: 'Wer war’s?', x: 'Torschütze antippen, Fernschuss oder Schuss aufs Tor gleich mit dazu.' },
  { s: 'b-vorlage', t: 'Vorlage mit Extras', x: 'Wer hat aufgelegt? Großchance, Flanke oder Pass des Todes geben extra Punkte. Alles freiwillig.' },
  { s: 'b-gegentor', t: 'Gegentor', x: 'Zuerst „Tor“ für den Gegner. Danach den Schuldigen wählen – wenn es einen gibt.' },
  { s: 'b-einhand', t: 'Ein-Hand-Modus', x: 'Hand-Symbol neben der Suche: sechs große Kacheln im Daumenbereich. Wischen wechselt den Spieler.' },
  { f: 'f-team', qr: 1, crew: [['Ich', ['Klenk', 'Krauss']], ['Du', ['Reule', 'Sipala']]], t: 'Zusammen buchen', x: 'Bis zu 3 Handys scannen den QR-Code im Reiter Spiel. Jeder wählt seine Spieler – Tore darf jeder melden.' },
  { s: 'b-zuletzt', t: 'Vertippt? Kein Problem', x: 'Unten stehen die letzten Buchungen. Antippen: löschen oder einem anderen Spieler geben.' }
];

export const introSeen = () => !!readJson(KEYS.intro3, false);
export const bookingTourSeen = () => !!readJson(KEYS.tourBook2, false);
export const showIntro = () => tour(APP, KEYS.intro3, 'Einführung', 'Los geht’s');
export const showBookingTour = () => tour(BOOK, KEYS.tourBook2, 'Punktevergabe erklärt', 'Verstanden');

/* Punkte einer Aktion aus der Punktetabelle (Stürmer, sonst Mittelfeld) */
function ptsOf(v) {
  const a = ACT[v];
  if (!a) return null;
  return typeof a.v === 'number' ? a.v : a.v && (a.v.ANG != null ? a.v.ANG : a.v.MIT);
}
/* Punkte-Chips auf den Fotos: Zahl = ohne Punkte, Text = Aktion */
function chipPts(v) {
  const n = typeof v === 'number' ? null : ptsOf(v);
  return n != null ? '<b class="' + cls(n) + '">' + fmt(n) + '</b>' : '';
}
/* Spieler-Marke auf dem Foto: seine Aktionen fliegen nacheinander hoch, die Punkte zählen mit */
let tagTimer = null;
function playTag(st, tag) {
  clearTimeout(tagTimer);
  const box = st.querySelector('.tour-tag'), num = box && box.querySelector('b');
  if (!box) return;
  let i = 0, sum = 0;
  num._v = 0; num.textContent = '0';
  const next = () => {
    if (!box.isConnected || i >= tag.a.length) return;
    const k = tag.a[i++], n = ptsOf(k) || 0, f = document.createElement('i');
    f.className = 'tour-fly'; f.innerHTML = '<b class="' + cls(n) + '">' + fmt(n) + '</b> ' + esc(ACT[k].l);
    box.parentNode.appendChild(f);
    setTimeout(() => f.remove(), 1500);
    sum += n; setNum(num, sum);
    tagTimer = setTimeout(next, reducedMotion ? 0 : 1100);
  };
  tagTimer = setTimeout(next, 500);
}
function visual(sl) {
  if (sl.s) return '<div class="tour-shot"><img src="' + IMG + sl.s + V + '" alt="" width="600" height="676"></div>';
  return '<div class="tour-shot tour-photo"><img src="' + IMG + sl.f + V + '" alt="" width="600" height="676">' +
    (sl.logo ? '<img class="tour-plogo" src="assets/icons/logo.svg" alt="Kickbase KL">' : '') +
    (sl.chips ? '<div class="tour-chips' + (sl.top ? ' top' : '') + '">' + sl.chips.map(([l, v], j) => '<span style="animation-delay:' + (0.25 + j * 0.22) + 's">' + esc(l) + chipPts(v) + '</span>').join('') + '</div>' : '') +
    (sl.tag ? '<div class="tour-tag"><img src="' + esc(photoUrl(sl.tag.p, true)) + '" alt=""><span><small>' + esc(PL[sl.tag.p].n) + '</small><b>0</b></span></div>' : '') +
    (sl.qr ? '<div class="tour-qr">' + qrSvg(APP_URL) + '</div>' : '') +
    (sl.crew ? '<div class="tour-chips">' + sl.crew.map(([n, ps], j) => '<span class="tour-crew" style="animation-delay:' + (0.25 + j * 0.22) + 's"><em>' +
      ps.map(id => '<img src="' + esc(photoUrl(id, true)) + '" alt="">').join('') + '</em>' + esc(n) + '</span>').join('') + '</div>' : '') +
    (sl.inset ? '<div class="tour-inset"><img src="' + IMG + sl.inset + V + '" alt=""></div>' : '') + '</div>';
}


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
  for (const sl of slides) for (const n of [sl.s, sl.f, sl.inset]) if (n) { const im = new Image(); im.src = IMG + n + V; }
  const draw = dir => {
    const sl = slides[i], last = i === slides.length - 1, st = el.querySelector('#tourStage');
    st.innerHTML = visual(sl) + '<h2>' + esc(sl.t) + '</h2><p>' + esc(sl.x) + '</p>';
    if (sl.tag) playTag(st, sl.tag); else clearTimeout(tagTimer);
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
