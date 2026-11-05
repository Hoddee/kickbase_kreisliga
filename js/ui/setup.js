/* Spiel einrichten: Spieler (Kickbase-Liste), Gegner, Heim/Auswärts, Position */
import { $, esc, eur, tierOf, trendClass, applyTier, readJson, writeJson, randomId, reducedMotion } from '../core/util.js';
import { KEYS } from '../config.js';
import { PL, PLAYER_LIST, POS_NAME, POS_SHORT, POS_ORDER, fullName, guestId, isGuest } from '../data/players.js';
import { CL, CLUB_LIST, OWN_CLUBS, crestUrl, customClubId, isCustomClub } from '../data/clubs.js';
import { store, replaceGame, freshGame, applyMatchNames } from '../core/game.js';
import { marketOf } from '../core/market.js';
import { games, loadGames } from '../services/api.js';
import { isAdmin } from '../services/auth.js';
import { avatar, nameWithStatus } from './components.js';
import { registerView, show, nav } from '../router.js';
import { prepareManual, resetTab } from './booking.js';

let sel = { p: null, o: null, home: true, pos: 'ABW', manual: false };
/* Offene Eingabeformulare für Gastspieler und eigenen Gegner */
const forms = { guest: false, opp: false, err: '' };

function lastSelection() {
  const l = readJson(KEYS.lastSelection, null);
  if (l && PL[l.p] && CL[l.o] && CL[l.o].lg === CL[PL[l.p].c].lg && l.o !== PL[l.p].c) return { p: l.p, o: l.o, home: !!l.home, pos: PL[l.p].pos || 'ABW' };
  return { p: null, o: null, home: true, pos: 'ABW' };
}

/* Öffnet die Auswahl; mit match = vorhandene Auswahl bearbeiten, manual = Nachtrag (nur Admin) */
export function openSetup(match = null, { manual = false } = {}) {
  sel = match ? { p: match.p, o: match.o, home: !!match.home, pos: store.S.pos } : lastSelection();
  sel.manual = !!manual;
  forms.guest = false; forms.opp = false; forms.err = '';
  show('setup');
}

function statsOf(id) {
  const l = (games.list || []).filter(g => g.player === id);
  const sum = l.reduce((s, g) => s + g.points, 0);
  return { n: l.length, avg: l.length ? Math.round(sum / l.length) : null };
}

function playerRow(p) {
  const st = statsOf(p.id), mw = marketOf(p.id, games.list || []);
  const trend = mw.last ? ' <span class="mw-d ' + trendClass(mw.last) + '" style="font-size:12px">' + (mw.last > 0 ? '▲' : '▼') + '</span>' : '';
  return '<button type="button" class="prow" data-pick="p:' + p.id + '" aria-pressed="' + (sel.p === p.id) + '">' + avatar(p.id) +
    '<span><b>' + nameWithStatus(p.id, fullName(p)) + '</b><span class="ps"><i class="pbadge">' + POS_SHORT[p.pos || 'ABW'] + '</i>' + eur(mw.v) + trend + '</span></span>' +
    '<span class="pv tc"' + (st.avg != null ? ' data-tier="' + tierOf(st.avg) + '"' : '') + '><b>' + (st.avg != null ? st.avg : '–') + '</b><small>Ø Punkte</small></span><span class="ck">✓</span></button>';
}

function html() {
  let h = '';
  if (sel.manual) h += '<div class="note-badge">Nachtrag: Spiel nachträglich eintragen</div>';
  else if (store.S.match) h += '<button type="button" class="back" data-pick="back"><b aria-hidden="true">‹</b>Zurück zum Spiel</button>';
  h += '<h2>Spieler</h2>';
  /* Gruppen: erst die eigenen Vereine, dann Vereine weiterer Stammspieler */
  const active = PLAYER_LIST.filter(p => p.active !== false);
  const clubIds = [...new Set([...OWN_CLUBS, ...active.map(p => p.c)])].filter(id => CL[id]);
  for (const clubId of clubIds) {
    const c = CL[clubId], players = active.filter(p => p.c === clubId);
    if (!players.length) continue;
    h += '<div class="grp"><img src="' + esc(crestUrl(c.id)) + '" alt=""><span>Kreisliga ' + c.lg + ' · ' + esc(c.n) + '</span></div><div class="plist">' + players.map(playerRow).join('') + '</div>';
  }
  h += guestHtml();
  if (sel.p) {
    const own = PL[sel.p].c, lg = CL[own].lg;
    const tiles = CLUB_LIST.filter(c => c.lg === lg && c.id !== own).map(c =>
      '<button type="button" class="otile" data-pick="o:' + c.id + '" aria-pressed="' + (sel.o === c.id) + '"><img src="' + esc(crestUrl(c.id)) + '" alt="" loading="lazy"><span>' + esc(c.n) + '</span></button>');
    if (isCustomClub(sel.o)) tiles.unshift('<button type="button" class="otile" data-pick="o:' + esc(sel.o) + '" aria-pressed="true"><img src="' + esc(crestUrl(sel.o)) + '" alt=""><span>' + esc(CL[sel.o].n) + '</span></button>');
    tiles.push('<button type="button" class="otile add" data-pick="add-opp" aria-expanded="' + forms.opp + '"><span class="plus">+</span><span>Anderer Gegner</span></button>');
    h += '<h2 id="oppH">Gegner</h2><div class="ogrid">' + tiles.join('') + '</div>' +
      (forms.opp ? '<form class="card inline-form" id="oppForm"><label class="nf"><span>Name des Gegners (nur für dieses Spiel, z. B. Pokal)</span><input class="fi" name="name" maxlength="30" required autocomplete="off" placeholder="z. B. TSV Musterstadt"></label>' +
        '<div class="duo"><button type="submit" class="btn primary">Übernehmen</button><button type="button" class="btn" data-pick="close-forms">Abbrechen</button></div></form>' : '') +
      '<h2>Spielort</h2><div class="seg full"><button type="button" data-pick="h:1" aria-pressed="' + sel.home + '">Heim</button><button type="button" data-pick="h:0" aria-pressed="' + !sel.home + '">Auswärts</button></div>' +
      '<h2>Position</h2><div class="seg full">' + POS_ORDER.map(k => '<button type="button" data-pick="s:' + k + '" aria-pressed="' + (sel.pos === k) + '">' + POS_NAME[k] + '</button>').join('') + '</div>';
  }
  return h;
}

/* Gastspieler: nur für dieses Spiel, ohne Foto */
function guestHtml() {
  let h = '';
  if (isGuest(sel.p)) {
    const g = PL[sel.p];
    h += '<div class="grp"><span>Gastspieler</span></div><div class="plist"><button type="button" class="prow" data-pick="p:' + esc(sel.p) + '" aria-pressed="true">' + avatar(sel.p) +
      '<span><b>' + esc(g.n) + ' <i class="tag">Gast</i></b><span class="ps">' + esc(CL[g.c].n) + '</span></span><span></span><span class="ck">✓</span></button></div>';
  }
  if (!forms.guest) return h + '<button type="button" class="add-row" data-pick="add-guest"><span class="plus">+</span><span>Gastspieler hinzufügen<small>nur für dieses Spiel</small></span></button>';
  const opts = CLUB_LIST.map(c => '<option value="' + c.id + '"' + (c.id === 'vfr' ? ' selected' : '') + '>' + esc(c.n) + ' (' + c.lg + ')</option>').join('');
  return h + '<form class="card inline-form" id="guestForm"><div class="fl">Gastspieler</div>' +
    '<label class="nf"><span>Name</span><input class="fi" name="name" maxlength="20" required autocomplete="off" placeholder="z. B. Max Muster"></label>' +
    '<label class="nf"><span>Spielt für</span><select class="fi" name="club">' + opts + '</select></label>' +
    (forms.err ? '<div class="form-msg bad">' + esc(forms.err) + '</div>' : '') +
    '<div class="duo"><button type="submit" class="btn primary">Hinzufügen</button><button type="button" class="btn" data-pick="close-forms">Abbrechen</button></div></form>';
}

export function render() {
  if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'setup' && games.list) render(); });
  $('setupBody').innerHTML = html();
  $('goBtn').disabled = !(sel.p && sel.o);
  $('goBtn').textContent = sel.manual ? 'Weiter zum Nachtrag' : 'Spiel starten';
  $('adminBtn').classList.toggle('on', isAdmin());
  applyTier(0);
}

function start() {
  if (!(sel.p && sel.o)) return;
  if (sel.manual && !isAdmin()) return;
  const g = freshGame({ pos: sel.pos });
  g.match = { p: sel.p, o: sel.o, home: sel.home };
  g.uid = randomId();
  if (!isGuest(sel.p) && !isCustomClub(sel.o)) writeJson(KEYS.lastSelection, { p: sel.p, o: sel.o, home: sel.home });
  replaceGame(g);
  applyMatchNames();
  resetTab();
  if (sel.manual) { prepareManual(g); show('edit'); }
  else show('home');
}

export function initSetup() {
  registerView('setup', { elements: ['setup'], render });
  $('setup').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target), name = String(f.get('name') || '').trim().replace(/[:<>"]/g, '');
    if (e.target.id === 'guestForm') {
      if (name.length < 2) { forms.err = 'Bitte einen Namen eingeben.'; render(); return; }
      sel.p = guestId(String(f.get('club')), name);
      sel.pos = 'MIT'; forms.guest = false; forms.err = '';
      if (sel.o && CL[sel.o].lg !== CL[PL[sel.p].c].lg && !isCustomClub(sel.o)) sel.o = null;
      render();
      const t = $('oppH'); if (t) t.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    } else if (e.target.id === 'oppForm') {
      if (name.length < 2) return;
      sel.o = customClubId(name); forms.opp = false; render();
    }
  });
  $('setup').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const k = b.getAttribute('data-pick'), v = k.slice(2);
    if (k === 'back') { show('home'); return; }
    if (k === 'go') { start(); return; }
    if (k === 'add-guest') { forms.guest = true; forms.opp = false; forms.err = ''; render(); const i = document.querySelector('#guestForm [name=name]'); if (i) i.focus(); return; }
    if (k === 'add-opp') { forms.opp = !forms.opp; forms.guest = false; render(); const i = document.querySelector('#oppForm [name=name]'); if (i) i.focus(); return; }
    if (k === 'close-forms') { forms.guest = false; forms.opp = false; render(); return; }
    if (k.startsWith('p:')) {
      sel.p = v; sel.pos = PL[v].pos || 'ABW';
      if (sel.o && !isCustomClub(sel.o) && CL[sel.o].lg !== CL[PL[v].c].lg) sel.o = null;
      render();
      const t = $('oppH'); if (t) t.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (k.startsWith('o:')) sel.o = v;
    else if (k.startsWith('h:')) sel.home = v === '1';
    else if (k.startsWith('s:')) sel.pos = v;
    render();
  });
}
