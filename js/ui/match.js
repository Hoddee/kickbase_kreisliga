/* Spiel-Detail wie bei Kickbase (Balken im Profil antippen): großes Foto, Punktzahl, Endstand,
   darunter alle Aktionen mit Minute; beim Scrollen schrumpft der Kopf auf Name, Punkte und Ergebnis.
   Admins können hier korrigieren: Aktionen entfernen (bleiben ausgegraut stehen) oder nachtragen. */
import { $, esc, fmt, cls, toast, buzz } from '../core/util.js';
import { PL, photoUrl } from '../data/players.js';
import { crestUrl } from '../data/clubs.js';
import { ICON } from '../core/icons.js';
import { recordTeam, scoreText } from '../core/game.js';
import { pickerGroups, pointsFor, wasSubbedIn, insertAction, recount, corrections, hasCorrections, settle, scoreBase, scoreOrig, onField, didPlay } from '../core/correct.js';
import { games, loadEvents, cachedEvents, updateGame, rememberEvents } from '../services/api.js';
import { canManage, isAdmin } from '../services/auth.js';
import { registerView, show, back, nav } from '../router.js';
import { bindSheet } from './sheet.js';
import { rowsFromRecord, rowLi, whistleLi, skeleton } from './components.js';
import { openHofGame } from './hof.js';
import { openProfile } from './profile.js';

const state = { uid: null };
/* Korrektur-Modus: Entwurf der Aktionen, Auswahl zum Nachtragen */
const fix = { on: false, ev: null, pick: false, grp: 0, min: '', busy: false, base: null, orig: null, us: 0, them: 0 };
/* Nach jeder Änderung: Ergebnis aus den Tor-Aktionen zählen und abhängige Boni nachziehen */
function resettle() { const r = settle(fix.ev, rec(), fix.base, fix.orig); fix.ev = r.ev; fix.us = r.us; fix.them = r.them; }
const rec = () => (games.list || []).find(g => g.uid === state.uid);

export function openMatch(uid) {
  state.uid = uid;
  fix.on = false; fix.ev = null; fix.pick = false;
  show('match');
  if (!cachedEvents(uid)) loadEvents(uid).then(() => { if (nav.current === 'match' && state.uid === uid) render(); }).catch(() => {});
}

/* Zeilen genau wie beim Punkte vergeben: Schluss-Boni oben, dann Aktionen (neueste zuerst), Startelf, Anpfiff */
function rowsHtml(ev, g) {
  const rows = rowsFromRecord(ev).map(r => (r.r == null && !r.ht && !r.sub && r.label !== 'Startelf' ? { ...r, r: g.minutes + '’' } : r));
  return rows.map(rowLi).join('') + whistleLi();
}

/* „Korrekturen (n)“ wie bei Kickbase: Summe; Antippen öffnet ein eigenes Blatt mit allen Korrekturen */
function corrHtml(ev) {
  const list = corrections(ev);
  if (!list.length) return '';
  const sum = list.reduce((s, x) => s + x.p, 0);
  return '<li class="row corr" data-mt="corr" role="button" tabindex="0" aria-label="Korrekturen ansehen"><span class="rp ' + cls(sum) + '">' + fmt(sum) + '</span><span class="rl">Korrekturen <em>(' + list.length + ')</em></span><span class="rt chev">›</span></li>';
}
function renderCorr() {
  const list = corrections(cachedEvents(state.uid) || []);
  $('corrBody').innerHTML = '<h2 class="corr-h">Korrekturen</h2><ul class="rows mrows">' +
    (list.length ? list.map(x => rowLi({ p: x.p, label: x.label, r: x.t >= 0 ? Math.floor(x.t / 60) + 1 + '’' : '' })).join('') : '<li class="hmsg">Keine Korrekturen.</li>') + '</ul>';
  $('corrScroll').scrollTop = 0;
}

/* Admin: Leiste mit neuem Stand + Nachtragen */
function fixHtml(g) {
  const now = recount(fix.ev), diff = now.points - g.points;
  let h = '<div class="fixbar"><div><b>' + now.points + '</b><span>' + (diff ? '<em class="' + cls(diff) + '">' + fmt(diff) + '</em> ' : '') + 'Aktion antippen = entfernen</span></div>' +
    '<button type="button" class="btn primary" data-mt="fsave"' + (fix.busy ? ' disabled' : '') + '>' + (fix.busy ? 'Speichert …' : 'Speichern') + '</button></div>';
  const mine = recordTeam(g), step = (k, n) => '<span class="scst"><button type="button" data-mt="sc:' + k + ':-" aria-label="Tor weniger"' + (n ? '' : ' disabled') + '>−</button><b>' + n + '</b><button type="button" data-mt="sc:' + k + ':+" aria-label="Tor mehr">+</button></span>';
  h += '<div class="card fixscore"><div class="scrow"><img src="' + esc(crestUrl(mine)) + '" alt="">' + step('tg', fix.us) + '<i>:</i>' + step('cg', fix.them) + '<img src="' + esc(crestUrl(g.opp)) + '" alt=""></div>' +
    '<label class="nf"><span>Minute für Nachträge</span><input class="fi" id="fixMin" type="number" inputmode="numeric" min="1" max="130" placeholder="leer = ohne Minute" value="' + esc(fix.min) + '"></label>' +
    '<p class="muted small">Zu null und Sieg/Niederlage passen sich dem Ergebnis an.</p></div>';
  if (!fix.pick) return h + '<button type="button" class="add-row" data-mt="fpick"><span class="plus">+</span><span>Aktion nachtragen<small>Vergessen oder falsch gebucht</small></span></button>';
  const groups = pickerGroups(g.pos), gr = groups[fix.grp] || groups[0], sub = wasSubbedIn(fix.ev);
  h += '<div class="card fixpick"><div class="fxg">' + groups.map((x, i) => '<button type="button" data-mt="fg:' + i + '" aria-pressed="' + (x === gr) + '">' + esc(x.t) + '</button>').join('') + '</div>' +
    '<div class="fxa">' + gr.a.map(([k, l, v]) => { const p = pointsFor(v, g.pos, sub);
      return '<button type="button" data-mt="fa:' + esc(k) + '"><span>' + esc(l) + '</span><b class="' + cls(p) + '">' + fmt(p) + '</b></button>'; }).join('') + '</div>' +
    '<div class="fl">Freie Korrektur</div><div class="fxf"><input class="fi" id="fixLbl" type="text" maxlength="40" placeholder="Grund"><input class="fi" id="fixPts" type="number" inputmode="numeric" placeholder="±"><button type="button" class="btn" data-mt="ffree">Dazu</button></div>' +
    '<button type="button" class="btn full ghost" data-mt="fpick-x">Fertig</button></div>';
  return h;
}

function html() {
  const g = rec();
  if (!g || !PL[g.player]) return '<p class="hmsg">Spiel nicht gefunden.</p>';
  const p = PL[g.player], mine = recordTeam(g), l = g.home ? mine : g.opp, r = g.home ? g.opp : mine;
  const gs = fix.on ? Object.assign({}, g, { us: fix.us, them: fix.them }) : g;
  const score = scoreText(gs, g.home), ev = fix.on ? fix.ev : cachedEvents(g.uid);
  const pts = fix.on ? recount(fix.ev).points : g.points;
  let tools = '';
  if (ev && !fix.on && (isAdmin() || canManage(g.player)))
    tools = '<div class="duo mtools">' + (isAdmin() ? '<button type="button" class="btn" data-mt="fix">' + ICON.edit + ' Korrigieren</button>' : '') +
      '<button type="button" class="btn" data-mt="edit">Spieldaten</button></div>';
  /* Foto und Name führen ins Profil (nicht im Korrektur-Modus) */
  const go = fix.on ? '' : ' data-mt="prof" role="link" tabindex="0" aria-label="Profil von ' + esc(p.n) + '"';
  return '<section class="mhero"><div class="pphoto"' + go + '><img src="' + esc(photoUrl(g.player)) + '" alt=""></div>' +
    '<div class="mh-t"><span' + go + '>' + esc(p.n) + '</span><b>' + pts + '</b><div class="mh-s"><img src="' + esc(crestUrl(l)) + '" alt=""><div><strong>' + score + '</strong><small>Endstand</small></div><img src="' + esc(crestUrl(r)) + '" alt=""></div></div></section>' +
    '<div class="pbody">' + (fix.on ? fixHtml(g) : '') +
    '<ul class="rows mrows' + (fix.on ? ' fixing' : '') + '">' + (ev ? (fix.on ? '' : corrHtml(ev)) + rowsHtml(ev, g) : '<li class="sk-wrap">' + skeleton(5, true) + '</li>') + '</ul>' + tools + '</div>';
}

export function render(keep) {
  const g = rec(), sc = $('matchScroll'), top = sc.scrollTop;
  $('matchBody').innerHTML = html();
  $('matchMini').innerHTML = g && PL[g.player] ? '<span>' + esc(PL[g.player].n) + '</span><b>' + (fix.on ? recount(fix.ev).points : g.points) + '</b><div class="mh-s sm"><img src="' + esc(crestUrl(g.home ? recordTeam(g) : g.opp)) + '" alt=""><strong>' + scoreText(fix.on ? Object.assign({}, g, { us: fix.us, them: fix.them }) : g, g.home) + '</strong><img src="' + esc(crestUrl(g.home ? g.opp : recordTeam(g))) + '" alt=""></div>' : '';
  if (keep === true) { sc.scrollTop = top; return; }
  sc.scrollTop = 0;
  $('matchMini').classList.remove('on');
}

/* Ohne Minute: -1 (die Zeile zeigt dann keine Minute und steht als neueste Aktion oben) */
const fixTime = () => { const m = parseInt(fix.min, 10); return m > 0 ? (m - 1) * 60 : -1; };
function addAction(item) {
  item.t = fixTime();
  item.c = 1;
  /* Team-Tor und Gegentor zählen nur für den, der auf dem Platz stand.
     Ohne Minute reicht es, dass er im Spiel war – mit Minute wird genau geprüft. */
  let bench = false;
  if (item.k === 'tg' || item.k === 'cg') {
    const on = item.t < 0 ? didPlay(fix.ev) : onField(fix.ev, item.t);
    bench = !on;
    item.p = on ? (item.k === 'tg' ? 5 : -5) : 0;
  }
  fix.ev = insertAction(fix.ev, item);
  resettle();
  buzz(8);
  toast(bench ? item.l + ' zählt fürs Ergebnis – ohne Punkte, er war nicht auf dem Platz' : fmt(item.p) + ' ' + item.l + ' nachgetragen');
}

async function saveFix() {
  const g = rec(), ev = fix.ev, n = recount(ev);
  fix.busy = true; render(true);
  try {
    const row = await updateGame(g.uid, { events: ev, points: n.points, goals: n.goals, assists: n.assists, us: fix.us, them: fix.them });
    for (const f of ['points', 'goals', 'assists', 'us', 'them', 'updated_at']) if (row[f] != null) g[f] = row[f];
    rememberEvents(g.uid, ev);
    fix.on = false; fix.ev = null; fix.pick = false;
    toast(hasCorrections(ev) ? 'Korrektur gespeichert' : 'Gespeichert');
  } catch (e) { toast('Speichern fehlgeschlagen: ' + e.message, 'bad'); }
  fix.busy = false;
  render(true);
}

export function initMatch() {
  registerView('match', { elements: ['match'], render, overlay: true,
    leave: () => { fix.on = false; fix.ev = null; fix.pick = false; } });
  registerView('corr', { elements: ['corr'], render: renderCorr, overlay: true });
  bindSheet($('corr'), $('corrScroll'), () => back());
  const sc = $('matchScroll');
  bindSheet($('match'), sc, () => back());
  sc.addEventListener('scroll', () => { const h = sc.querySelector('.mhero'); $('matchMini').classList.toggle('on', !!h && sc.scrollTop > h.offsetHeight - 150); }, { passive: true });
  $('match').addEventListener('input', e => { if (e.target.id === 'fixMin') fix.min = e.target.value; });
  $('match').addEventListener('click', e => {
    /* Korrektur-Modus: Zeile antippen = entfernen / wiederherstellen, Nachgetragenes wird gelöscht */
    const row = fix.on && e.target.closest('.fixing [data-ci]');
    if (row) {
      const i = +row.dataset.ci, x = fix.ev[i];
      if (x.ac || x.ax) { toast('Hängt am Ergebnis – oben das Ergebnis ändern'); return; }
      fix.ev = fix.ev.slice();
      if (x.c) fix.ev.splice(i, 1);
      else { const y = Object.assign({}, x); if (y.x) delete y.x; else y.x = 1; fix.ev[i] = y; }
      resettle(); buzz(6); render(true); return;
    }
    const b = e.target.closest('[data-mt]');
    if (!b) return;
    const k = b.dataset.mt, g = rec();
    if (k === 'edit') { openHofGame(state.uid); return; }
    /* Profil legt sich über das Spiel-Blatt; „Zurück“ dort führt wieder hierher */
    if (k === 'prof') { if (g) openProfile(g.player); return; }
    if (k === 'corr') { show('corr'); return; }
    if (k === 'fix') { fix.on = true; fix.ev = (cachedEvents(state.uid) || []).slice(); fix.base = scoreBase(g, fix.ev); fix.orig = scoreOrig(fix.base, fix.ev); fix.pick = false; fix.min = ''; resettle(); render(true); return; }
    /* Ergebnis: + bucht ein Tor nach, − nimmt das letzte Tor dieser Seite heraus */
    if (k.startsWith('sc:')) {
      const [, key, dir] = k.split(':');
      if (dir === '+') addAction({ k: key, l: key === 'tg' ? 'Team-Tor' : 'Gegentor', p: 0 });
      else {
        let i = -1; fix.ev.forEach((e, j) => { if (e.k === key && !e.x) i = j; });
        if (i < 0) { fix.base[key === 'tg' ? 'us' : 'them']--; }
        else { fix.ev = fix.ev.slice(); if (fix.ev[i].c) fix.ev.splice(i, 1); else fix.ev[i] = Object.assign({}, fix.ev[i], { x: 1 }); }
        resettle(); buzz(6);
      }
      render(true); return;
    }
    if (k === 'fpick') { fix.pick = true; render(true); return; }
    if (k === 'fpick-x') { fix.pick = false; render(true); return; }
    if (k === 'fsave') { if (!fix.busy) saveFix(); return; }
    if (k.startsWith('fg:')) { fix.grp = +k.slice(3); render(true); return; }
    if (k.startsWith('fa:')) {
      const key = k.slice(3), gr = pickerGroups(g.pos).find(x => x.a.some(a => a[0] === key)), a = gr.a.find(a => a[0] === key);
      addAction({ k: key, l: a[1], p: pointsFor(a[2], g.pos, wasSubbedIn(fix.ev)) });
      render(true); return;
    }
    if (k === 'ffree') {
      const l = ($('fixLbl').value || '').trim() || 'Punktekorrektur', p = parseInt($('fixPts').value, 10);
      if (!p) { toast('Punkte eintragen', 'bad'); return; }
      addAction({ k: 'corr', l, p });
      render(true); return;
    }
  });
}
