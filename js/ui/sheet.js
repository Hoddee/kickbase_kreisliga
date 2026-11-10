/* Blatt-Verhalten wie bei Kickbase: von oben am Griff (oder ganz oben im Inhalt) nach unten ziehen schließt das Blatt. */
export function bindSheet(sheet, scroller, onClose) {
  const panel = sheet.querySelector('.sh-panel');
  let y0 = null, dy = 0, drag = false;
  sheet.addEventListener('click', e => { if (e.target === sheet) onClose(); });
  panel.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const onGrab = !!e.target.closest('.sh-grab');
    if (!onGrab && scroller.scrollTop > 0) return;
    y0 = e.touches[0].clientY; dy = 0; drag = false;
  }, { passive: true });
  panel.addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 8) drag = true;
    if (drag) { panel.style.transition = 'none'; panel.style.transform = 'translateY(' + Math.max(0, dy) + 'px)'; }
  }, { passive: true });
  panel.addEventListener('touchend', () => {
    if (y0 == null) return;
    panel.style.transition = '';
    if (drag && dy > 110) {
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => { panel.style.transform = ''; onClose(); }, 180);
    } else panel.style.transform = '';
    y0 = null; drag = false;
  }, { passive: true });
}
