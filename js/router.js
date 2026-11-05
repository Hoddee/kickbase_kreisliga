/* Einfache Ansichtssteuerung: genau eine Ansicht ist sichtbar.
   Ansichten registrieren sich mit render() und optional enter()/leave(). */
const views = new Map();
export const nav = { current: null, previous: null };

export function registerView(name, def) { views.set(name, def); }

export function show(name, opts = {}) {
  const def = views.get(name);
  if (!def) return;
  if (def.guard) { const redirect = def.guard(); if (redirect && redirect !== name) return show(redirect, opts); }
  if (nav.current && nav.current !== name) { const old = views.get(nav.current); if (old && old.leave) old.leave(); }
  if (nav.current !== name) nav.previous = nav.current;
  nav.current = name;
  for (const [n, v] of views) {
    for (const id of v.elements) document.getElementById(id).hidden = n !== name;
  }
  if (def.enter) def.enter(opts);
  def.render();
  if (!opts.keepScroll) window.scrollTo(0, 0);
}

export function rerender(name) {
  if (!name || nav.current === name) { const v = views.get(nav.current); if (v) v.render(); }
}
