/* Spiel einrichten: Spieler, Mannschaft, Gegner (automatisch nach Spielplan oder manuell), Spielort, Position */
import { $, esc, eur, tierOf, trendClass, applyTier, readJson, writeJson, randomId, reducedMotion, pad2, toast } from '../core/util.js';
import { KEYS } from '../config.js';
import { PL, PLAYER_LIST, POS_NAME, POS_SHORT, POS_ORDER, fullName, guestId, isGuest } from '../data/players.js';
import { CL, CLUB_LIST, LEAGUES, OWN_CLUBS, crestUrl, customClubId, isCustomClub } from '../data/clubs.js';
import { TEAMS, nextFixture, lastFixture, pastFixtures } from '../data/schedule.js';
import { store, replaceGame, freshGame, applyMatchNames, applyMedia, eachPlayer, isMulti, newSlot, MAX_SQUAD } from '../core/game.js';
import { marketOf } from '../core/market.js';
import { cutout } from '../core/cutout.js';
import { games, loadGames, uploadGuestImage } from '../services/api.js';
import { isAdmin, canManage } from '../services/auth.js';
import { avatar, nameWithStatus, playerRow as baseRow } from './components.js';
import { registerView, show, nav } from '../router.js';
import { prepareManual, resetTab } from './booking.js';

/* p Spieler · team eigene Mannschaft · o Gegner · plan Gegner aus dem Spielplan · lg Liga der manuellen Auswahl
   pf/of hochgeladene Bilder für Gastspieler / eigenen Gegner */
let sel = blank();
/* Offene Formulare (Gastspieler, eigener Gegner) inkl. Eingaben und Bild */
const forms = { guest: false, opp: false, err: '', busy: false, status: '', gname: '', gclub: 'vfr', oname: '', gimg: null, oimg: null };

function blank() { return { p: null, team: null, o: null, home: true, pos: 'ABW', manual: false, plan: true, lg: null, fx: null, pf: null, of: null, multi: false, ps: [], poss: {} }; }

const defaultTeam = p => (PL[p] && CL[PL[p].c] ? PL[p].c : 'vfr');
const fixtureFor = team => (sel.manual ? lastFixture(team) : nextFixture(team));

/* Spieler gewechselt: Spielplan neu anwenden, ein eigener Gegner (z. B. Pokal) bleibt aber erhalten */
function newPlayerTeam(team) {
  const keep = isCustomClub(sel.o) ? { o: sel.o, home: sel.home } : null;
  sel.team = team; sel.plan = !keep; sel.lg = null; applyPlan();
  if (keep) Object.assign(sel, keep);
}
/* Gegner und Spielort aus dem Spielplan übernehmen (falls vorhanden) */
function applyPlan() {
  sel.fx = sel.team ? fixtureFor(sel.team) : null;
  if (!sel.fx) { sel.plan = false; }
  if (sel.plan && sel.fx) { sel.o = sel.fx.o; sel.home = sel.fx.home; }
  if (!sel.lg || !LEAGUES.includes(sel.lg)) sel.lg = (sel.team && CL[sel.team].lg) || 'A2';
}

function lastSelection() {
  const s = blank(), l = readJson(KEYS.lastSelection, null);
  if (l && PL[l.p] && !isGuest(l.p)) {
    s.p = l.p; s.pos = PL[l.p].pos || 'ABW';
    s.team = l.team && CL[l.team] ? l.team : defaultTeam(l.p);
  }
  return s;
}

/* Öffnet die Auswahl; mit match = vorhandene Auswahl bearbeiten, manual = Nachtrag (nur Admin) */
export function openSetup(match = null, { manual = false, player = null, squad = false } = {}) {
  if (match) {
    sel = Object.assign(blank(), { p: match.p, o: match.o, home: !!match.home, pos: store.S.pos, team: match.team || defaultTeam(match.p), pf: match.pf || null, of: match.of || null });
    const fx = nextFixture(sel.team);
    sel.plan = !!(fx && fx.o === match.o);
    /* Spiel mit mehreren Spielern: Auswahl übernehmen */
    if (squad && isMulti()) {
      sel.multi = true;
      for (const [p, pos] of eachPlayer(() => [store.S.match.p, store.S.pos])) { sel.ps.push(p); sel.poss[p] = pos; }
      sel.p = sel.ps[0];
    }
  } else sel = lastSelection();
  if (!match && player && PL[player]) { sel = blank(); sel.p = player; sel.pos = PL[player].pos || 'ABW'; sel.team = defaultTeam(player); }
  sel.manual = !!manual;
  /* Spieler (kein Admin) tragen nur für sich selbst nach */
  sel.lock = sel.manual && !isAdmin();
  if (sel.team) {
    const o = sel.o, home = sel.home;
    applyPlan();
    if (match && !sel.plan) { sel.o = o; sel.home = home; }
  }
  Object.assign(forms, { guest: false, opp: false, err: '', busy: false, status: '', gimg: null, oimg: null });
  show('setup');
}

/* Einzelauswahl: Haken; Mehrfachauswahl: Nummer in der Reihenfolge der Auswahl */
function checkMark(id) {
  if (!sel.multi) return '<span class="ck">✓</span>';
  const i = sel.ps.indexOf(id);
  return '<span class="ck num">' + (i >= 0 ? i + 1 : '') + '</span>';
}
const isPicked = id => (sel.multi ? sel.ps.includes(id) : sel.p === id);
const playerRow = p => baseRow(p, 'data-pick="p:' + p.id + '" aria-pressed="' + isPicked(p.id) + '"', checkMark(p.id));
/* Spieler in der Mehrfachauswahl an- oder abwählen */
function togglePick(id) {
  const i = sel.ps.indexOf(id);
  if (i >= 0) { sel.ps.splice(i, 1); delete sel.poss[id]; }
  else {
    if (sel.ps.length >= MAX_SQUAD) { toast('Maximal ' + MAX_SQUAD + ' Spieler gleichzeitig'); return false; }
    sel.ps.push(id); sel.poss[id] = (PL[id] && PL[id].pos) || 'MIT';
  }
  const first = sel.ps[0] || null;
  if (first !== sel.p) { sel.p = first; if (first) newPlayerTeam(defaultTeam(first)); }
  if (sel.p) sel.pos = sel.poss[sel.p];
  return true;
}

/* Bild-Auswahl mit Vorschau (Hintergrund wird automatisch entfernt) */
function imageField(which, img, label) {
  return '<div class="imgfield">' +
    '<div class="imgprev' + (which === 'oimg' ? ' crest' : '') + '">' + (img ? '<img src="' + esc(img.url) + '" alt="Vorschau">' : '<span>' + (which === 'oimg' ? 'Wappen' : 'Foto') + '</span>') + '</div>' +
    '<div class="imgctl"><label class="btn small-btn"><input type="file" accept="image/*" data-img="' + which + '" hidden' + (forms.busy ? ' disabled' : '') + '>' + (img ? 'Anderes Bild' : label) + '</label>' +
    (img ? '<button type="button" class="lnk inline" data-pick="img-clear:' + which + '">Bild entfernen</button>' : '') +
    '<p class="muted small" id="imgStatus-' + which + '">' + esc(forms.status && forms.statusFor === which ? forms.status : 'Optional · Hintergrund wird automatisch entfernt') + '</p></div></div>';
}

const dayLabel = d => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today) / 864e5);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ' + pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.';
};

function fixtureCard(fx) {
  const home = fx.home ? fx.team : fx.o, away = fx.home ? fx.o : fx.team;
  return '<div class="fx" aria-live="polite"><div class="fx-h"><span>' + (sel.manual ? 'Letztes Spiel laut Spielplan' : 'Nächstes Spiel laut Spielplan') + '</span><b>' +
    dayLabel(fx.at) + ' · ' + pad2(fx.at.getHours()) + ':' + pad2(fx.at.getMinutes()) + ' Uhr</b></div>' +
    '<div class="fx-m"><div><img src="' + esc(crestUrl(home)) + '" alt=""><span>' + esc(CL[home].n) + '</span></div><i>vs</i>' +
    '<div><img src="' + esc(crestUrl(away)) + '" alt=""><span>' + esc(CL[away].n) + '</span></div></div>' +
    '<div class="fx-f">Kreisliga ' + CL[fx.team].lg + ' · ' + (fx.home ? 'Heimspiel' : 'Auswärtsspiel') + '</div></div>' + pastPicker(fx) +
    '<button type="button" class="add-row" data-pick="manual-opp"><span class="plus">⇄</span><span>Anderen Gegner wählen<small>z. B. Pokal, Nachholspiel oder andere Liga</small></span></button>';
}

/* Nachtrag: die letzten Spiele laut Spielplan zur Auswahl (Datum wird übernommen) */
function pastPicker(cur) {
  if (!sel.manual) return '';
  const l = pastFixtures(sel.team, 6);
  if (l.length < 2) return '';
  return '<div class="fxpick" role="group" aria-label="Anderes Spiel aus dem Spielplan">' + l.map((f, i) =>
    '<button type="button" data-pick="fx:' + i + '" aria-pressed="' + (f.at.getTime() === cur.at.getTime()) + '"><img src="' + esc(crestUrl(f.o)) + '" alt=""><span>' +
    pad2(f.at.getDate()) + '.' + pad2(f.at.getMonth() + 1) + '.</span></button>').join('') + '</div>';
}
function oppPicker() {
  let h = '';
  if (sel.fx) h += '<button type="button" class="back" data-pick="plan"><b aria-hidden="true">‹</b>Zurück zum Spielplan</button>';
  else if (sel.team) h += '<p class="muted small" style="margin:0 0 10px">Für diese Mannschaft gibt es ' + (sel.manual ? 'kein vergangenes' : 'kein anstehendes') + ' Spiel im Spielplan – bitte den Gegner wählen.</p>';
  h += '<div class="seg full lgseg">' + LEAGUES.map(lg => '<button type="button" data-pick="lg:' + lg + '" aria-pressed="' + (sel.lg === lg) + '">Kreisliga ' + lg + '</button>').join('') + '</div>';
  const tiles = CLUB_LIST.filter(c => c.lg === sel.lg && c.id !== sel.team).map(c =>
    '<button type="button" class="otile" data-pick="o:' + c.id + '" aria-pressed="' + (sel.o === c.id) + '"><img src="' + esc(crestUrl(c.id)) + '" alt="" loading="lazy"><span>' + esc(c.n) + '</span></button>');
  if (isCustomClub(sel.o)) tiles.unshift('<button type="button" class="otile" data-pick="o:' + esc(sel.o) + '" aria-pressed="true"><img src="' + esc(crestUrl(sel.o)) + '" alt=""><span>' + esc(CL[sel.o].n) + '</span></button>');
  tiles.push('<button type="button" class="otile add" data-pick="add-opp" aria-expanded="' + forms.opp + '"><span class="plus">+</span><span>Mannschaft hinzufügen</span></button>');
  h += '<div class="ogrid">' + tiles.join('') + '</div>';
  if (forms.opp) {
    h += '<form class="card inline-form" id="oppForm"><div class="fl">Eigener Gegner</div>' +
      '<label class="nf"><span>Name (nur für dieses Spiel, z. B. Pokal)</span><input class="fi" name="name" maxlength="30" required autocomplete="off" placeholder="z. B. TSV Musterstadt" value="' + esc(forms.oname) + '"></label>' +
      imageField('oimg', forms.oimg, 'Wappen hochladen') +
      (forms.err && forms.errFor === 'opp' ? '<div class="form-msg bad">' + esc(forms.err) + '</div>' : '') +
      '<div class="duo"><button type="submit" class="btn primary"' + (forms.busy ? ' disabled' : '') + '>' + (forms.busy ? 'Bitte warten …' : 'Übernehmen') + '</button><button type="button" class="btn" data-pick="close-forms">Abbrechen</button></div></form>';
  }
  return h;
}

function teamChips() {
  const teams = [...new Set([...TEAMS, sel.team].filter(t => t && CL[t]))];
  return '<div class="tchips">' + teams.map(t => '<button type="button" class="tchip" data-pick="t:' + t + '" aria-pressed="' + (sel.team === t) + '"><img src="' + esc(crestUrl(t)) + '" alt=""><span><b>' + esc(CL[t].n) + '</b><small>' + (CL[t].lg ? 'Kreisliga ' + CL[t].lg : '') + '</small></span></button>').join('') + '</div>';
}

function html() {
  let h = '';
  if (sel.manual) h += '<div class="note-badge">Nachtrag: Spiel nachträglich eintragen</div>';
  else if (store.S.match) h += '<button type="button" class="back" data-pick="back"><b aria-hidden="true">‹</b>Zurück zum Spiel</button>';
  h += '<div class="sh2"><h2>Spieler</h2>' + (sel.manual ? '' : '<button type="button" class="multibtn" data-pick="multi" aria-pressed="' + sel.multi + '">' +
    '<span class="mbi" aria-hidden="true"><i></i><i></i><i></i></span>' + (sel.multi ? 'Mehrere · ' + sel.ps.length + '/' + MAX_SQUAD : 'Mehrere Spieler') + '</button>') + '</div>' +
    (sel.multi ? '<p class="muted small hint">Tippe bis zu ' + MAX_SQUAD + ' Spieler an. Beim Punkte vergeben wechselst du oben mit einem Tipp zwischen ihnen.</p>' : '');
  if (sel.lock) {
    h += '<div class="plist">' + (PL[sel.p] ? playerRow(PL[sel.p]) : '') + '</div>';
    return h + matchHtml();
  }
  /* Gruppen: erst die eigenen Vereine, dann Vereine weiterer Stammspieler */
  const active = PLAYER_LIST.filter(p => p.active !== false);
  const clubIds = [...new Set([...OWN_CLUBS, ...active.map(p => p.c)])].filter(id => CL[id]);
  for (const clubId of clubIds) {
    const c = CL[clubId], players = active.filter(p => p.c === clubId);
    if (!players.length) continue;
    h += '<div class="grp"><img src="' + esc(crestUrl(c.id)) + '" alt=""><span>Kreisliga ' + c.lg + ' · ' + esc(c.n) + '</span></div><div class="plist">' + players.map(playerRow).join('') + '</div>';
  }
  h += guestHtml();
  return h + matchHtml();
}
function matchHtml() {
  let h = '';
  if (sel.p) {
    h += '<h2 id="oppH">Spielt für</h2>' + teamChips();
    h += '<h2>Gegner</h2>' + (sel.plan && sel.fx ? fixtureCard(sel.fx) : oppPicker());
    h += '<h2>Spielort</h2><div class="seg full"><button type="button" data-pick="h:1" aria-pressed="' + sel.home + '">Heim</button><button type="button" data-pick="h:0" aria-pressed="' + !sel.home + '">Auswärts</button></div>';
    if (sel.multi && sel.ps.length > 1) {
      h += '<h2>Positionen</h2><ul class="poslist">' + sel.ps.map(id => '<li>' + avatar(id) + '<b>' + esc(PL[id].n) + '</b><span class="seg">' +
        POS_ORDER.map(k => '<button type="button" data-pick="ps:' + esc(id) + ':' + k + '" aria-pressed="' + (sel.poss[id] === k) + '">' + POS_SHORT[k] + '</button>').join('') + '</span></li>').join('') + '</ul>';
    } else h += '<h2>Position</h2><div class="seg full">' + POS_ORDER.map(k => '<button type="button" data-pick="s:' + k + '" aria-pressed="' + (sel.pos === k) + '">' + POS_NAME[k] + '</button>').join('') + '</div>';
  }
  return h;
}

/* Gastspieler: nur für dieses Spiel, optional mit Foto */
function guestHtml() {
  let h = '';
  const guests = (sel.multi ? sel.ps : [sel.p]).filter(isGuest);
  if (guests.length) {
    h += '<div class="grp"><span>Gastspieler</span></div><div class="plist">' + guests.map(id => '<button type="button" class="prow" data-pick="p:' + esc(id) + '" aria-pressed="true">' + avatar(id) +
      '<span><b>' + esc(PL[id].n) + ' <i class="tag">Gast</i></b><span class="ps">' + esc(CL[PL[id].c].n) + '</span></span><span></span>' + checkMark(id) + '</button>').join('') + '</div>';
  }
  if (!forms.guest) return h + '<button type="button" class="add-row" data-pick="add-guest"><span class="plus">+</span><span>Gastspieler hinzufügen<small>nur für dieses Spiel</small></span></button>';
  const opts = LEAGUES.map(lg => '<optgroup label="Kreisliga ' + lg + '">' + CLUB_LIST.filter(c => c.lg === lg).map(c => '<option value="' + c.id + '"' + (c.id === forms.gclub ? ' selected' : '') + '>' + esc(c.n) + '</option>').join('') + '</optgroup>').join('');
  return h + '<form class="card inline-form" id="guestForm"><div class="fl">Gastspieler</div>' +
    '<label class="nf"><span>Name</span><input class="fi" name="name" maxlength="20" required autocomplete="off" placeholder="z. B. Max Muster" value="' + esc(forms.gname) + '"></label>' +
    '<label class="nf"><span>Verein</span><select class="fi" name="club">' + opts + '</select></label>' +
    imageField('gimg', forms.gimg, 'Foto hochladen') +
    (forms.err && forms.errFor === 'guest' ? '<div class="form-msg bad">' + esc(forms.err) + '</div>' : '') +
    '<div class="duo"><button type="submit" class="btn primary"' + (forms.busy ? ' disabled' : '') + '>' + (forms.busy ? 'Bitte warten …' : 'Hinzufügen') + '</button><button type="button" class="btn" data-pick="close-forms">Abbrechen</button></div></form>';
}

export function render() {
  if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'setup' && games.list) render(); });
  $('setupBody').innerHTML = html();
  $('goBtn').disabled = !(sel.p && sel.o) || forms.busy;
  $('goBtn').textContent = sel.manual ? 'Weiter zum Nachtrag' : sel.multi && sel.ps.length > 1 ? 'Spiel starten · ' + sel.ps.length + ' Spieler' : 'Spiel starten';
  applyTier(0);
}

function start() {
  if (!(sel.p && sel.o) || forms.busy) return;
  if (sel.manual && !canManage(sel.p)) return;
  const g = freshGame({ pos: sel.pos });
  g.match = { p: sel.p, o: sel.o, home: sel.home, team: sel.team || defaultTeam(sel.p) };
  if (isGuest(sel.p) && sel.pf) g.match.pf = sel.pf;
  if (isCustomClub(sel.o) && sel.of) g.match.of = sel.of;
  g.uid = randomId();
  if (!sel.manual && sel.multi && sel.ps.length > 1) {
    /* Mehrere Spieler: jeder bekommt einen eigenen Eintrag, der erste ist zuerst aktiv */
    g.squad = sel.ps.map((p, i) => newSlot(p, sel.poss[p] || 'MIT', i === 0 ? g.uid : randomId()));
    g.cur = 0;
    g.match.p = sel.ps[0]; g.pos = g.squad[0].pos;
    if (g.squad[0].pf) g.match.pf = g.squad[0].pf; else delete g.match.pf;
  }
  if (sel.manual && sel.plan && sel.fx) g.playedAt = sel.fx.at.toISOString();
  if (!isGuest(sel.p)) writeJson(KEYS.lastSelection, { p: sel.p, team: g.match.team });
  replaceGame(g);
  applyMatchNames();
  resetTab();
  if (sel.manual) { prepareManual(g); show('edit'); }
  else show('home');
}

const scrollToOpp = () => { const t = $('oppH'); if (t) t.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' }); };
function setStatus(which, text) {
  forms.status = text; forms.statusFor = which;
  const el = document.getElementById('imgStatus-' + which);
  if (el) el.textContent = text;
}

/* Bild gewählt: sofort freistellen und Vorschau zeigen */
async function onImage(input) {
  const which = input.dataset.img, file = input.files && input.files[0];
  if (!file) return;
  forms.busy = true; forms.err = ''; render();
  try {
    const res = await cutout(file, which === 'oimg' ? 'crest' : 'guest', t => setStatus(which, t));
    if (forms[which]) URL.revokeObjectURL(forms[which].url);
    forms[which] = res;
    forms.status = res.method === 'none' ? 'Hintergrund konnte nicht entfernt werden – Bild wird so übernommen.' : 'Fertig – Hintergrund entfernt.';
  } catch (e) {
    forms.err = e.message; forms.errFor = which === 'oimg' ? 'opp' : 'guest'; forms.status = '';
  }
  forms.busy = false; render();
}

async function uploadIfAny(which) {
  const img = forms[which];
  if (!img) return null;
  setStatus(which, 'Bild wird hochgeladen …');
  try { return await uploadGuestImage(img.blob); }
  catch (e) { toast('Bild konnte nicht hochgeladen werden – es geht ohne weiter.', 'bad'); return null; }
}

export function initSetup() {
  registerView('setup', { elements: ['setup'], render });
  $('setup').addEventListener('input', e => {
    if (e.target.closest('#guestForm') && e.target.name === 'name') forms.gname = e.target.value;
    if (e.target.closest('#oppForm') && e.target.name === 'name') forms.oname = e.target.value;
  });
  $('setup').addEventListener('change', e => {
    if (e.target.matches('[data-img]')) onImage(e.target);
    else if (e.target.closest('#guestForm') && e.target.name === 'club') forms.gclub = e.target.value;
  });
  $('setup').addEventListener('submit', async e => {
    e.preventDefault();
    if (forms.busy) return;
    const f = new FormData(e.target), name = String(f.get('name') || '').trim().replace(/[:<>"]/g, '');
    if (e.target.id === 'guestForm') {
      if (name.length < 2) { forms.err = 'Bitte einen Namen eingeben.'; forms.errFor = 'guest'; render(); return; }
      forms.busy = true; render();
      const path = await uploadIfAny('gimg');
      const id = guestId(String(f.get('club')), name);
      if (path) { PL[id].foto = path; sel.pf = path; } else sel.pf = PL[id].foto || null;
      if (sel.multi) { if (!sel.ps.includes(id)) togglePick(id); }
      else { sel.p = id; sel.pos = 'MIT'; newPlayerTeam(PL[id].c); }
      Object.assign(forms, { guest: false, busy: false, err: '', status: '', gname: '', gimg: null });
      render(); scrollToOpp();
    } else if (e.target.id === 'oppForm') {
      if (name.length < 2) { forms.err = 'Bitte einen Namen eingeben.'; forms.errFor = 'opp'; render(); return; }
      forms.busy = true; render();
      const path = await uploadIfAny('oimg');
      const id = customClubId(name);
      applyMedia(null, id, null, path);
      sel.o = id; sel.of = path || CL[id].f || null; sel.plan = false;
      Object.assign(forms, { opp: false, busy: false, err: '', status: '', oname: '', oimg: null });
      render();
    }
  });
  $('setup').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const k = b.getAttribute('data-pick'), v = k.slice(2);
    if (k === 'back') { show('home'); return; }
    if (k === 'go') { start(); return; }
    if (k === 'add-guest') { Object.assign(forms, { guest: true, opp: false, err: '', status: '' }); render(); const i = document.querySelector('#guestForm [name=name]'); if (i) i.focus(); return; }
    if (k === 'add-opp') { Object.assign(forms, { opp: !forms.opp, guest: false, err: '', status: '' }); render(); const i = document.querySelector('#oppForm [name=name]'); if (i) i.focus(); return; }
    if (k === 'close-forms') { if (!forms.busy) Object.assign(forms, { guest: false, opp: false, err: '', status: '', gimg: null, oimg: null }); render(); return; }
    if (k.startsWith('img-clear:')) { forms[k.slice(10)] = null; forms.status = ''; render(); return; }
    if (k === 'manual-opp') { sel.plan = false; sel.lg = CL[sel.team].lg || 'A2'; render(); return; }
    if (k === 'plan') { sel.plan = true; applyPlan(); render(); return; }
    if (k.startsWith('fx:')) {
      const f = pastFixtures(sel.team, 6)[+k.slice(3)];
      if (f) { sel.fx = f; sel.o = f.o; sel.home = f.home; sel.plan = true; }
      render(); return;
    }
    if (k === 'multi') {
      sel.multi = !sel.multi;
      if (sel.multi) { sel.ps = sel.p ? [sel.p] : []; sel.poss = sel.p ? { [sel.p]: sel.pos } : {}; }
      else { sel.ps = []; sel.poss = {}; }
      render(); return;
    }
    if (k.startsWith('ps:')) {
      const [, id, pos] = k.split(':').length > 3 ? [null, k.slice(3, k.lastIndexOf(':')), k.slice(k.lastIndexOf(':') + 1)] : k.split(':');
      sel.poss[id] = pos; if (id === sel.p) sel.pos = pos;
      render(); return;
    }
    if (k.startsWith('p:') && sel.multi && !sel.lock) {
      if (togglePick(v)) render();
      return;
    }
    if (k.startsWith('p:')) {
      const changed = sel.p !== v;
      sel.p = v; sel.pos = PL[v].pos || 'ABW';
      if (changed) newPlayerTeam(defaultTeam(v));
      render(); scrollToOpp();
      return;
    }
    if (k.startsWith('t:')) {
      sel.team = v; sel.lg = null;
      if (sel.plan || !isCustomClub(sel.o)) sel.plan = true;
      applyPlan();
      if (sel.o === sel.team) sel.o = null;
    }
    else if (k.startsWith('lg:')) sel.lg = k.slice(3);
    else if (k.startsWith('o:')) sel.o = v;
    else if (k.startsWith('h:')) sel.home = v === '1';
    else if (k.startsWith('s:')) sel.pos = v;
    render();
  });
}
