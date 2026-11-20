/* Ein-Hand-Modus (Punktevergabe): sechs große Kacheln unten im Daumenbereich.
   Zuschalten über das Hand-Symbol neben der Suche (gemerkt pro Gerät). Die Kacheln behalten ihren Platz:
   Start mit Vorschlägen je Position, eine Aktion, die öfter gebucht wird als die schwächste Kachel, ersetzt diese.
   Wischen über die Kacheln wechselt bei mehreren Spielern den Spieler.
   Entfernen: diese Datei, den Block „Ein-Hand-Modus“ in css/brand.css, die Einträge in index.html/sw.js und die drei
   Aufrufe in booking.js (initOneHand, renderPad, oneHandBtn). */
import { esc, fmt, cls, buzz, readJson, writeJson } from '../core/util.js';
import { KEYS } from '../config.js';
import { QUICK_DEFAULTS } from '../data/actions.js';
import { PL } from '../data/players.js';
import { store, ACT, val, count, isMulti, switchPlayer } from '../core/game.js';

const N = 6, SKIP = new Set(['tg', 'cg', 'goal', 'pen']);
let on = !!readJson(KEYS.oneHand, false), book = () => {}, getTab = () => '', switched = () => {};
const slots = new Map(); // Spieler-uid → Liste der Kachel-Aktionen (feste Plätze)
const pad = () => document.getElementById('ohPad');

function keysFor() {
  const S = store.S, id = S.uid || S.match.p;
  let ks = slots.get(id);
  if (!ks) {
    ks = (QUICK_DEFAULTS[S.pos] || QUICK_DEFAULTS.MIT).filter(k => ACT[k] && !(ACT[k].only && ACT[k].only !== S.pos)).slice(0, N);
    slots.set(id, ks);
  }
  /* Häufig gebuchte Aktion ersetzt die am wenigsten genutzte Kachel – an derselben Stelle */
  const used = new Map();
  for (const e of S.events) if (ACT[e.key] && !SKIP.has(e.key) && Math.abs(e.pts) < 25) used.set(e.key, (used.get(e.key) || 0) + 1);
  for (const [k, n] of [...used].sort((a, b) => b[1] - a[1])) {
    if (ks.includes(k) || n < 2) continue;
    let weak = -1, wn = Infinity;
    ks.forEach((x, i) => { const c = used.get(x) || 0; if (c < wn) { wn = c; weak = i; } });
    if (weak >= 0 && n > wn) ks[weak] = k;
  }
  return ks;
}

export function oneHandBtn() {
  return '<button type="button" class="oh-tg" data-oh="toggle" aria-pressed="' + on + '" aria-label="Ein-Hand-Modus">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5"/><path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 16a1.5 1.5 0 0 1 2.4-1.8L8 16.5"/></svg></button>';
}

export function renderPad() {
  let el = pad();
  const show = on && ['att', 'def', 'err'].includes(getTab()) && !!store.S.match;
  document.body.classList.toggle('onehand', show);
  if (!show) { if (el) el.hidden = true; return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'ohPad'; el.className = 'oh-pad';
    const undo = document.getElementById('undo');
    undo.parentNode.insertBefore(el, undo);
    el.addEventListener('click', onTap);
    bindSwipe(el);
  }
  el.hidden = false;
  const S = store.S;
  el.innerHTML = '<div class="wrap">' + (isMulti() ? '<div class="oh-who"><span>' + esc(PL[S.match.p] ? PL[S.match.p].n : '') + '</span><i>' + S.squad.map((_, i) => '<b' + (i === S.cur ? ' class="on"' : '') + '></b>').join('') + '</i></div>' : '') +
    '<div class="oh-grid">' + keysFor().map(k => {
      const a = ACT[k], p = val(a), c = count(k);
      return '<button type="button" class="oh-k" data-ohk="' + k + '"><span>' + esc(a.s || a.l) + '</span><b class="' + cls(p) + '">' + fmt(p) + '</b>' + (c ? '<i>' + c + '</i>' : '') + '</button>';
    }).join('') + '</div></div>';
}

function onTap(e) {
  const b = e.target.closest('[data-ohk]');
  if (!b) return;
  const k = b.dataset.ohk, r = b.getBoundingClientRect(), p = val(ACT[k]);
  book(k);
  /* Rückmeldung ohne Hinschauen: Vibration (in book) + „+5“ fliegt hoch */
  const f = document.createElement('i');
  f.className = 'oh-fly ' + cls(p); f.textContent = fmt(p);
  f.style.left = r.left + r.width / 2 + 'px'; f.style.top = r.top + 'px';
  document.body.appendChild(f);
  if (f.animate) f.animate([{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(-50%, -56px)', opacity: 0 }], { duration: 650, easing: 'ease-out' }).finished.then(() => f.remove(), () => f.remove());
  else setTimeout(() => f.remove(), 600);
}

function bindSwipe(el) {
  let x0 = null, y0 = 0;
  el.addEventListener('touchstart', e => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null || !isMulti()) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    const n = store.S.squad.length;
    switchPlayer((store.S.cur + (dx < 0 ? 1 : n - 1)) % n);
    buzz(8); switched();
  }, { passive: true });
}

/* book(key) = Buchung wie ein Tipp auf die Aktion; tab() = aktueller Reiter; onSwitch = nach Spielerwechsel neu zeichnen */
export function initOneHand({ book: b, tab, onSwitch }) {
  book = b; getTab = tab; switched = onSwitch;
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-oh="toggle"]')) return;
    on = !on; writeJson(KEYS.oneHand, on); buzz(8);
    document.querySelectorAll('[data-oh="toggle"]').forEach(x => x.setAttribute('aria-pressed', String(on)));
    renderPad();
  });
}
