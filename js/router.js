/* Ansichtssteuerung mit echtem Verlauf: genau eine Ansicht ist sichtbar.
   - Der Verlauf ist ein Stapel. Öffnet man eine Ansicht, die schon im Stapel liegt, fällt alles danach weg –
     so entstehen keine Endlosschleifen (z. B. Profil ↔ Hall of Fame).
   - „Zurück“ (Knopf in der App, Zurück-Taste/Wischgeste am Handy) geht genau einen Schritt zurück,
     ganz unten liegt immer die Übersicht ("start").
   Ansichten registrieren sich mit render() und optional enter()/leave()/back() (back = interner Schritt zurück).
   overlay: true = Blatt, das von unten über die vorige Ansicht fährt (Spielerprofil, Spiel-Detail). */
const views = new Map();
export const nav = { current: null, previous: null, stack: [] };
const ROOT = 'start';
let wasOverlay = false;

export function registerView(name, def) { views.set(name, def); }

export function show(name, opts = {}) {
  const def = views.get(name);
  if (!def) return;
  if (def.guard) { const redirect = def.guard(); if (redirect && redirect !== name) return show(redirect, opts); }
  if (nav.current && nav.current !== name) { const old = views.get(nav.current); if (old && old.leave) old.leave(); }
  const st = nav.stack;
  if (name === ROOT) st.length = 0;
  else if (!st.length || st[0] !== ROOT) st.unshift(ROOT);
  const i = st.indexOf(name);
  if (i >= 0) st.length = i + 1; else st.push(name);
  nav.previous = st.length > 1 ? st[st.length - 2] : null;
  nav.current = name;
  /* Blätter (overlay) liegen über der Ansicht darunter: die bleibt sichtbar */
  const visible = new Set([name]);
  for (let i = st.length - 1; i > 0 && views.get(st[i]) && views.get(st[i]).overlay; i--) visible.add(st[i - 1]);
  for (const [n, v] of views) {
    for (const id of v.elements) document.getElementById(id).hidden = !visible.has(n);
  }
  document.body.classList.toggle('sheet-open', !!def.overlay);
  if (def.enter) def.enter(opts);
  def.render();
  if (!opts.keepScroll && !def.overlay && !wasOverlay) window.scrollTo(0, 0);
  wasOverlay = !!def.overlay;
  armHistory();
}

/* Einen Schritt zurück: erst darf die Ansicht selbst zurückgehen (z. B. Spieldetail → Liste) */
export function back() {
  const def = views.get(nav.current);
  if (def && def.back && def.back()) { def.render(); window.scrollTo(0, 0); return true; }
  if (nav.current === ROOT) return false;
  show(nav.previous || ROOT);
  return true;
}

export function rerender(name) {
  if (!name || nav.current === name) { const v = views.get(nav.current); if (v) v.render(); }
}

/* Zurück-Taste des Handys/Browsers: ein zusätzlicher Verlaufseintrag fängt sie ab.
   Auf der Übersicht ohne weiteren Schritt verlässt „Zurück“ die App wie gewohnt. */
let armed = false;
function armHistory() {
  if (armed || nav.current === ROOT) return;
  try { history.pushState({ kl: 1 }, ''); armed = true; } catch (e) {}
}
window.addEventListener('popstate', () => {
  armed = false;
  if (back()) armHistory();
  else if (nav.current === ROOT) { try { history.back(); } catch (e) {} }
});
