/* Spielerleiste für Spiele mit mehreren Spielern: ein Tipp wechselt den Spieler, Wischen geht zum nächsten. */
import { esc, tierOf } from '../core/util.js';
import { PL, photoUrl } from '../data/players.js';
import { store, isMulti, squadInfo, switchPlayer } from '../core/game.js';

export function squadBarHtml() {
  if (!isMulti()) return '';
  const cur = store.S.cur;
  return squadInfo().map(x => {
    const p = PL[x.p];
    return '<button type="button" class="sqb tc" data-sq="' + x.i + '" data-tier="' + tierOf(x.t) + '" aria-pressed="' + (x.i === cur) + '" aria-label="' + esc(p.n) + ': ' + x.t + ' Punkte">' +
      '<span class="sqa"><img src="' + esc(photoUrl(x.p)) + '" alt="">' + (x.started && !store.S.ended ? '<i class="sqd' + (x.on ? ' on' : '') + '" title="' + (x.on ? 'auf dem Platz' : 'nicht auf dem Platz') + '"></i>' : '') + '</span>' +
      '<span class="sqn">' + esc(p.n) + '</span><b class="sqv">' + x.t + '</b></button>';
  }).join('');
}

/* Leiste in ein Element zeichnen und ein-/ausblenden */
export function renderSquadBar(el) {
  const h = squadBarHtml();
  el.hidden = !h;
  el.innerHTML = h ? '<div class="wrap sqrow">' + h + '</div>' : '';
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
    const n = store.S.squad.length, i = (store.S.cur + (dx < 0 ? 1 : n - 1)) % n;
    switchPlayer(i); onSwitch();
  }, { passive: true });
}
