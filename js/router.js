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
/* Scrollposition je Ansicht: beim Zurückgehen landet man wieder an derselben Stelle */
const scrollMem = new Map();
/* Scrollen stellt die App selbst wieder her – sonst setzt der Browser es bei der Zurück-Taste auf 0 */
try { history.scrollRestoration = 'manual'; } catch (e) {}
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Ansicht gleitet herein (vorwärts von rechts, zurück von links). Fest positionierte Teile (Knöpfe unten)
   werden nur eingeblendet – ein transform würde sie sonst kurz an die falsche Stelle setzen. */
function slideIn(def, dir) {
  if (reduced() || !Element.prototype.animate) return;
  const dx = dir === 'back' ? -28 : dir === 'tab' ? 0 : 28;
  for (const id of def.elements) {
    const root = document.getElementById(id);
    for (const el of root.children) {
      const fixed = getComputedStyle(el).position === 'fixed';
      el.animate(fixed || !dx ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateX(' + dx + 'px)' }, { opacity: 1, transform: 'none' }],
        { duration: dx ? 240 : 180, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    }
  }
}

export function registerView(name, def) { views.set(name, def); }
/* Wird nach jedem Ansichtswechsel aufgerufen (z. B. Menü unten) */
const hooks = new Set();
export const onShow = fn => hooks.add(fn);
/* Elemente der gerade sichtbaren Ansicht */
export const currentEls = () => ((views.get(nav.current) || {}).elements || []).map(id => document.getElementById(id)).filter(Boolean);

export function show(name, opts = {}) {
  const def = views.get(name);
  if (!def) return;
  if (def.guard) { const redirect = def.guard(); if (redirect && redirect !== name) return show(redirect, opts); }
  const from = nav.current, old = from ? views.get(from) : null;
  if (old && from !== name) {
    if (old.leave) old.leave();
    if (!old.overlay) scrollMem.set(from, window.scrollY);
  }
  const st = nav.stack;
  const wasInStack = name === ROOT ? !!from : st.includes(name);
  /* Menü unten: Bereiche ersetzen sich gegenseitig, statt sich zu stapeln */
  if (name === ROOT || opts.tab) st.length = 0;
  if (name !== ROOT && (!st.length || st[0] !== ROOT)) st.unshift(ROOT);
  const i = st.indexOf(name);
  if (i >= 0) st.length = i + 1; else st.push(name);
  /* Ansichten, die man vorwärts neu öffnet, starten oben */
  if (!wasInStack) scrollMem.delete(name);
  nav.previous = st.length > 1 ? st[st.length - 2] : null;
  nav.current = name;
  /* Blätter (overlay) liegen über der Ansicht darunter: die bleibt sichtbar */
  const visible = new Set([name]);
  for (let i = st.length - 1; i > 0 && views.get(st[i]) && views.get(st[i]).overlay; i--) visible.add(st[i - 1]);
  for (const [n, v] of views) {
    for (const id of v.elements) document.getElementById(id).hidden = !visible.has(n);
  }
  /* Später geöffnete Blätter liegen oben (z. B. Profil über dem Spiel-Detail) */
  st.forEach((n, i) => { const v = views.get(n); if (v && v.overlay) for (const id of v.elements) document.getElementById(id).style.zIndex = 60 + i; });
  document.body.classList.toggle('sheet-open', !!def.overlay);
  if (def.enter) def.enter(opts);
  def.render();
  if (!opts.keepScroll && !def.overlay && !wasOverlay) window.scrollTo(0, wasInStack ? scrollMem.get(name) || 0 : 0);
  /* Gleiten nur zwischen normalen Ansichten; Blätter haben ihre eigene Animation */
  if (from && from !== name && !def.overlay && !wasOverlay && !opts.noAnim) slideIn(def, opts.tab ? 'tab' : wasInStack ? 'back' : 'fwd');
  wasOverlay = !!def.overlay;
  for (const fn of hooks) try { fn(name); } catch (e) {}
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
