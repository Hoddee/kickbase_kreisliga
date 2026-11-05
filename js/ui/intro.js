/* Einführung beim ersten Öffnen (und jederzeit über „Konto → Einführung ansehen“) */
import { readJson, writeJson, esc } from '../core/util.js';
import { KEYS } from '../config.js';

const I = {
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M9 20v-6h6v6"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  tap: '<path d="M9 11V5a2 2 0 0 1 4 0v6"/><path d="M13 10a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-3-5a2 2 0 0 1 3-2l2 2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
};
const SLIDES = [
  ['home', 'Willkommen!', 'Die Kreisliga Edition vergibt Kickbase-Punkte für eure Spiele. Auf der Übersicht siehst du die nächsten Spiele und den Kader – tipp einen Spieler an, um sein Profil zu öffnen.'],
  ['plus', 'Neues Spiel', 'Unten auf „+ Neues Spiel“. Gegner, Heim oder Auswärts kommen automatisch aus dem Spielplan. Mit „Mehrere Spieler“ bewertest du bis zu 5 Spieler gleichzeitig.'],
  ['tap', 'Punkte vergeben', 'Uhr starten, dann Aktionen antippen. Bei mehreren Spielern wechselst du oben mit einem Tipp (oder Wischen) den Spieler. Tore zählen automatisch für alle auf dem Platz. Vertippt? Unten auf „Rückgängig“.'],
  ['trophy', 'Speichern & Hall of Fame', 'Nach dem Abpfiff speichern: Punkte, Marktwert, Rekorde und der Saisonverlauf landen in der Hall of Fame.'],
  ['user', 'Dein Konto', 'Oben rechts kannst du dich registrieren. Nach der Freischaltung trägst du deine Spiele auch selbst nach.']
];

export const introSeen = () => !!readJson(KEYS.intro, false);

export function showIntro() {
  if (document.getElementById('intro')) return;
  let i = 0;
  const el = document.createElement('div');
  el.id = 'intro'; el.className = 'intro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Einführung');
  const draw = () => {
    const [ic, t, x] = SLIDES[i], last = i === SLIDES.length - 1;
    el.innerHTML = '<div class="intro-in"><button type="button" class="intro-skip" data-in="skip">Überspringen</button>' +
      '<div class="intro-ic"><svg viewBox="0 0 24 24" aria-hidden="true">' + I[ic] + '</svg></div>' +
      '<h2>' + esc(t) + '</h2><p>' + esc(x) + '</p>' +
      '<div class="intro-dots">' + SLIDES.map((_, j) => '<i' + (j === i ? ' class="on"' : '') + '></i>').join('') + '</div>' +
      '<div class="intro-nav">' + (i ? '<button type="button" class="btn" data-in="prev">Zurück</button>' : '<span></span>') +
      '<button type="button" class="btn primary" data-in="' + (last ? 'done' : 'next') + '">' + (last ? 'Los geht’s' : 'Weiter') + '</button></div></div>';
    const f = el.querySelector('[data-in="next"],[data-in="done"]'); if (f) f.focus();
  };
  const close = () => { writeJson(KEYS.intro, true); el.classList.add('gone'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-in]');
    if (!b) return;
    const k = b.dataset.in;
    if (k === 'next') i++; else if (k === 'prev') i--; else return close();
    draw();
  });
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -60 && i < SLIDES.length - 1) { i++; draw(); } else if (dx > 60 && i > 0) { i--; draw(); }
  }, { passive: true });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  draw();
  document.body.appendChild(el);
}
