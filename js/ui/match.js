/* Spiel-Detail wie bei Kickbase (Balken im Profil antippen): großes Foto, Punktzahl, Endstand,
   darunter alle Aktionen mit Minute; beim Scrollen schrumpft der Kopf auf Name, Punkte und Ergebnis.
   Admins können hier korrigieren: Aktionen entfernen (bleiben ausgegraut stehen) oder nachtragen. */
import { $, esc, fmt, cls, toast, buzz } from '../core/util.js';
import { PL, photoUrl } from '../data/players.js';
import { crestUrl } from '../data/clubs.js';
import { ICON } from '../core/icons.js';
import { recordTeam, scoreText } from '../core/game.js';
import { pickerGroups, pointsFor, wasSubbedIn, insertAction, recount, corrections, hasCorrections } from '../core/correct.js';
import { games, loadEvents, cachedEvents, updateGame, rememberEvents } from '../services/api.js';
import { canManage, isAdmin } from '../services/auth.js';
import { registerView, show, back, nav } from '../router.js';
import { bindSheet } from './sheet.js';
import { rowsFromRecord, rowLi, whistleLi } from './components.js';
import { openHofGame } from './hof.js';

const state = { uid: null, open: false };
/* Korrektur-Modus: Entwurf der Aktionen, Auswahl zum Nachtragen */
const fix = { on: false, ev: null, pick: false, grp: 0, min: '', busy: false };
const rec = () => (games.list || []).find(g => g.uid === state.uid);

export function openMatch(uid) {
  state.uid = uid; state.open = false;
  fix.on = false; fix.ev = null; fix.pick = false;
  show('match');
  if (!cachedEvents(uid)) loadEvents(uid).then(() => { if (nav.current === 'match' && state.uid === uid) render(); }).catch(() => {});
}

/* Zeilen genau wie beim Punkte vergeben: Schluss-Boni oben, dann Aktionen (neueste zuerst), Startelf, Anpfiff */
function rowsHtml(ev, g) {
  const rows = rowsFromRecord(ev).map(r => (r.r == null && !r.ht && !r.sub && r.label !== 'Startelf' ? { ...r, r: g.minutes + '’' } : r));
  return rows.map(rowLi).join('') + whistleLi();
}

/* „Korrekturen (n)“ wie bei Kickbase: Summe, aufklappbar */
function corrHtml(ev) {
  const list = corrections(ev);
  if (!list.length) return '';
  const sum = list.reduce((s, x) => s + x.p, 0);
  return '<li class="row corr" data-mt="corr" aria-expanded="' + state.open + '"><span class="rp ' + cls(sum) + '">' + fmt(sum) + '</span><span class="rl">Korrekturen <em>(' + list.length + ')</em></span><span class="rt chev">›</span></li>' +
    (state.open ? list.map(x => rowLi({ p: x.p, label: x.label, r: x.t >= 0 ? Math.floor(x.t / 60) + 1 + '’' : '' })).join('') + '<li class="corr-end"></li>' : '');
}

/* Admin: Leiste mit neuem Stand + Nachtragen */
function fixHtml(g) {
  const now = recount(fix.ev), diff = now.points - g.points;
  let h = '<div class="fixbar"><div><b>' + now.points + '</b><span>' + (diff ? '<em class="' + cls(diff) + '">' + fmt(diff) + '</em> ' : '') + 'Aktion antippen = entfernen</span></div>' +
    '<button type="button" class="btn primary" data-mt="fsave"' + (fix.busy ? ' disabled' : '') + '>' + (fix.busy ? 'Speichert …' : 'Speichern') + '</button></div>';
  if (!fix.pick) return h + '<button type="button" class="add-row" data-mt="fpick"><span class="plus">+</span><span>Aktion nachtragen<small>Vergessen oder falsch gebucht</small></span></button>';
  const groups = pickerGroups(g.pos), gr = groups[fix.grp] || groups[0], sub = wasSubbedIn(fix.ev);
  h += '<div class="card fixpick"><label class="nf"><span>Minute</span><input class="fi" id="fixMin" type="number" inputmode="numeric" min="1" max="130" placeholder="z. B. 63" value="' + esc(fix.min) + '"></label>' +
    '<div class="fxg">' + groups.map((x, i) => '<button type="button" data-mt="fg:' + i + '" aria-pressed="' + (x === gr) + '">' + esc(x.t) + '</button>').join('') + '</div>' +
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
  const score = scoreText(g, g.home), ev = fix.on ? fix.ev : cachedEvents(g.uid);
  const pts = fix.on ? recount(fix.ev).points : g.points;
  let tools = '';
  if (ev && !fix.on && (isAdmin() || canManage(g.player)))
    tools = '<div class="duo mtools">' + (isAdmin() ? '<button type="button" class="btn" data-mt="fix">' + ICON.edit + ' Korrigieren</button>' : '') +
      '<button type="button" class="btn" data-mt="edit">Spieldaten</button></div>';
  return '<section class="mhero"><div class="pphoto"><img src="' + esc(photoUrl(g.player)) + '" alt=""></div>' +
    '<div class="mh-t"><span>' + esc(p.n) + '</span><b>' + pts + '</b><div class="mh-s"><img src="' + esc(crestUrl(l)) + '" alt=""><div><strong>' + score + '</strong><small>Endstand</small></div><img src="' + esc(crestUrl(r)) + '" alt=""></div></div></section>' +
    '<div class="pbody">' + (fix.on ? fixHtml(g) : '') +
    '<ul class="rows mrows' + (fix.on ? ' fixing' : '') + '">' + (ev ? (fix.on ? '' : corrHtml(ev)) + rowsHtml(ev, g) : '<li class="empty">Lädt …</li>') + '</ul>' + tools + '</div>';
}

export function render(keep) {
  const g = rec(), sc = $('matchScroll'), top = sc.scrollTop;
  $('matchBody').innerHTML = html();
  $('matchMini').innerHTML = g && PL[g.player] ? '<span>' + esc(PL[g.player].n) + '</span><b>' + (fix.on ? recount(fix.ev).points : g.points) + '</b><div class="mh-s sm"><img src="' + esc(crestUrl(g.home ? recordTeam(g) : g.opp)) + '" alt=""><strong>' + scoreText(g, g.home) + '</strong><img src="' + esc(crestUrl(g.home ? g.opp : recordTeam(g))) + '" alt=""></div>' : '';
  if (keep === true) { sc.scrollTop = top; return; }
  sc.scrollTop = 0;
  $('matchMini').classList.remove('on');
}

function addAction(item) {
  const m = parseInt(fix.min, 10);
  item.t = m > 0 ? (m - 1) * 60 : (rec().minutes > 0 ? (rec().minutes - 1) * 60 : 0);
  item.c = 1;
  fix.ev = insertAction(fix.ev, item);
  buzz(8); toast(fmt(item.p) + ' ' + item.l + ' nachgetragen');
}

async function saveFix() {
  const g = rec(), ev = fix.ev, n = recount(ev);
  fix.busy = true; render(true);
  try {
    const row = await updateGame(g.uid, { events: ev, points: n.points, goals: n.goals, assists: n.assists });
    for (const f of ['points', 'goals', 'assists', 'updated_at']) if (row[f] != null) g[f] = row[f];
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
  const sc = $('matchScroll');
  bindSheet($('match'), sc, () => back());
  sc.addEventListener('scroll', () => { const h = sc.querySelector('.mhero'); $('matchMini').classList.toggle('on', !!h && sc.scrollTop > h.offsetHeight - 150); }, { passive: true });
  $('match').addEventListener('input', e => { if (e.target.id === 'fixMin') fix.min = e.target.value; });
  $('match').addEventListener('click', e => {
    /* Korrektur-Modus: Zeile antippen = entfernen / wiederherstellen, Nachgetragenes wird gelöscht */
    const row = fix.on && e.target.closest('.fixing [data-ci]');
    if (row) {
      const i = +row.dataset.ci, x = fix.ev[i];
      fix.ev = fix.ev.slice();
      if (x.c) fix.ev.splice(i, 1);
      else { const y = Object.assign({}, x); if (y.x) delete y.x; else y.x = 1; fix.ev[i] = y; }
      buzz(6); render(true); return;
    }
    const b = e.target.closest('[data-mt]');
    if (!b) return;
    const k = b.dataset.mt, g = rec();
    if (k === 'edit') { openHofGame(state.uid); return; }
    if (k === 'corr') { state.open = !state.open; render(true); return; }
    if (k === 'fix') { fix.on = true; fix.ev = (cachedEvents(state.uid) || []).slice(); fix.pick = false; fix.min = ''; render(true); return; }
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
