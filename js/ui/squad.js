/* Spielerleiste für Spiele mit mehreren Spielern: ein Tipp wechselt den Spieler, Wischen geht zum nächsten. */
import { esc, tierOf } from '../core/util.js';
import { PL, photoUrl } from '../data/players.js';
import { store, isMulti, squadInfo, switchPlayer, stepPlayer, mineAt, uidAt, hooks } from '../core/game.js';

export function squadBarHtml() {
  if (!isMulti()) return '';
  const cur = store.S.cur;
  /* Mitbucher sehen nur ihre Spieler; beim Gastgeber steht bei gesperrten Spielern, wer sie bucht */
  return squadInfo().filter(x => mineAt(x.i)).map(x => {
    const p = PL[x.p], by = hooks.lockOf ? hooks.lockOf(uidAt(x.i)) : null;
    return '<button type="button" class="sqb tc" data-sq="' + x.i + '" data-tier="' + tierOf(x.t) + '" aria-pressed="' + (x.i === cur) + '" aria-label="' + esc(p.n) + ': ' + x.t + ' Punkte">' +
      '<span class="sqa"><img src="' + esc(photoUrl(x.p, true)) + '" alt="">' + (x.started && !store.S.ended ? '<i class="sqd' + (x.on ? ' on' : '') + '" title="' + (x.on ? 'auf dem Platz' : 'nicht auf dem Platz') + '"></i>' : '') +
      '</span>' + (by ? '<i class="sqlk">' + esc(by.slice(0, 1).toUpperCase()) + '</i>' : '') +
      '<span class="sqn">' + esc(p.n) + '</span><b class="sqv">' + x.t + '</b></button>';
  }).join('');
}

/* Leiste in ein Element zeichnen und ein-/ausblenden */
export function renderSquadBar(el) {
  const h = squadBarHtml();
  el.hidden = !h;
  const n = isMulti() ? store.S.squad.filter((_, i) => mineAt(i)).length : 1;
  el.innerHTML = h ? '<div class="wrap sqrow' + (n > 7 ? ' many' : '') + '" data-n="' + n + '" data-noswipe>' + h + '</div>' : '';
  /* Bei vielen Spielern scrollt die Leiste – den aktiven ins Bild holen */
  const on = n > 5 && el.querySelector('[aria-pressed="true"]');
  if (on) requestAnimationFrame(() => on.scrollIntoView({ inline: 'center', block: 'nearest' }));
}

/* Klicks auf die Leiste und Wischgesten (links/rechts) auf einem Bereich */
export function bindSquad(bar, swipeArea, onSwitch) {
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-sq]');
    if (!b) return;
    const i = +b.dataset.sq;
    if (i !== store.S.cur) { switchPlayer(i); onSwitch(); }
  });
  if (!swipeArea) return;
  let x0 = null, y0 = 0;
  swipeArea.addEventListener('touchstart', e => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
  swipeArea.addEventListener('touchend', e => {
    if (x0 == null || !isMulti()) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (stepPlayer(dx < 0 ? 1 : -1)) onSwitch();
  }, { passive: true });
}
