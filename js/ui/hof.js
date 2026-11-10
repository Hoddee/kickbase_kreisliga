/* Hall of Fame: Top-Spiele, Tabelle, Neueste, Rekorde, Spielerprofil und Spielansicht.
   Admins können Spiele hier bearbeiten und löschen. */
import { $, esc, eur, signedEur, trendClass, tierOf, dateShort, applyTier, toast, cleanSheet } from '../core/util.js';
import { PL, PLAYER_LIST, POS_NAME, POS_SHORT, POS_ORDER, photoUrl } from '../data/players.js';
import { CL, CLUB_LIST, LEAGUES, crestUrl } from '../data/clubs.js';
import { TEAMS } from '../data/schedule.js';
import { CAT, scoreText, recordTeam } from '../core/game.js';
import { marketOf, byDate } from '../core/market.js';
import { games, loadGames, loadEvents, cachedEvents, forgetEvents, updateGame, deleteGame } from '../services/api.js';
import { isAdmin, canManage } from '../services/auth.js';
import { ICON } from '../core/icons.js';
import { avatar, nameWithStatus, rowLi, rowsFromRecord, whistleLi, areaBars, gameRow } from './components.js';
import { registerView, show, back as goBack, nav } from '../router.js';

const ui = { tab: 'best', league: 'ALL', returnTo: null, player: null, game: null, eventsError: false, edit: false, confirmDelete: false, busy: false };

const leagueOf = id => CL[PL[id].c].lg;
const inLeague = g => ui.league === 'ALL' || (CL[recordTeam(g)] || {}).lg === ui.league;
const gamesOf = id => byDate((games.list || []).filter(g => g.player === id));

/* Form: die letzten fünf Spiele als farbige Punkte (wie Kickbase-Formkurve) */
function formDots(id) {
  const last = gamesOf(id).slice(-5);
  return '<span class="fdots" aria-label="Form der letzten Spiele">' + last.map(g => '<i class="tc" data-tier="' + tierOf(g.points) + '" title="' + g.points + '"></i>').join('') + '</span>';
}

function potw(list) {
  const now = Date.now();
  let best = null;
  for (const g of list) if (now - new Date(g.played_at).getTime() < 7 * 864e5 && (!best || g.points > best.points)) best = g;
  if (!best) return '';
  const mine = recordTeam(best), l = best.home ? mine : best.opp, r = best.home ? best.opp : mine;
  return '<button type="button" class="potw tc" data-tier="' + tierOf(best.points) + '" data-hof="g:' + esc(best.uid) + '"><img class="pw-ph" src="' + esc(photoUrl(best.player)) + '" alt="">' +
    '<div class="pw-tx"><span class="pw-k">Spieler der Woche</span><b class="pw-n">' + nameWithStatus(best.player) + '</b><span class="pw-v">' + best.points + '</span>' +
    '<span class="pw-m"><img src="' + esc(crestUrl(l)) + '" alt="">' + scoreText(best, best.home) + '<img src="' + esc(crestUrl(r)) + '" alt=""></span></div></button>';
}

function table(list) {
  const agg = new Map();
  for (const g of list) {
    const a = agg.get(g.player) || { p: g.player, n: 0, sum: 0 };
    a.n++; a.sum += g.points; agg.set(g.player, a);
  }
  const rows = [...agg.values()].map(a => Object.assign(a, { avg: Math.round(a.sum / a.n) })).sort((x, y) => y.sum - x.sum);
  return '<ul class="glist">' + rows.map((a, i) => {
    const mw = marketOf(a.p, games.list), last = gamesOf(a.p).slice(-1)[0];
    return '<li><button type="button" class="gr tc" data-tier="' + tierOf(a.avg) + '" data-open="p:' + a.p + '"><span class="rk' + (i < 3 ? ' r' + (i + 1) : '') + '">' + (i + 1) + '</span>' + avatar(a.p) +
      '<div class="gi"><b>' + nameWithStatus(a.p) + '</b><span class="gs">' + (last ? '<i class="pbadge">' + POS_SHORT[last.pos] + '</i>' : '') + 'Ø ' + a.avg + ' ' + formDots(a.p) + '</span></div>' +
      '<div class="gp"><span class="gv">' + a.sum + '</span><span class="gd">' + eur(mw.v) + '</span></div></button></li>';
  }).join('') + '</ul>';
}

/* Rekorde der Saison */
function records(list) {
  const cards = [];
  const best = list.slice().sort((a, b) => b.points - a.points)[0];
  if (best) cards.push(['Meiste Punkte in einem Spiel', best.player, best.points + ' Pkt.', 'g:' + best.uid, best.points]);
  const per = new Map();
  for (const g of list) {
    const a = per.get(g.player) || { n: 0, sum: 0, goals: 0, assists: 0, clean: 0 };
    a.n++; a.sum += g.points; a.goals += g.goals || 0; a.assists += g.assists || 0;
    if (cleanSheet(g)) a.clean++;
    per.set(g.player, a);
  }
  /* Bester Spieler nach Kennzahl; "eligible" filtert (z. B. mindestens 2 Spiele) */
  const leader = (metric, eligible = () => true) => {
    const c = [...per].filter(([, a]) => eligible(a)).sort((x, y) => metric(y[1]) - metric(x[1]))[0];
    return c && metric(c[1]) > 0 ? c : null;
  };
  const add = (title, entry, metric, unit) => { if (entry) cards.push([title, entry[0], metric(entry[1]) + unit, 'p:' + entry[0], null]); };
  const avg = a => Math.round(a.sum / a.n);
  add('Meiste Saisonpunkte', leader(a => a.sum), a => a.sum, ' Pkt.');
  add('Bester Schnitt (ab 2 Spielen)', leader(avg, a => a.n >= 2), avg, ' Ø');
  add('Meiste Tore', leader(a => a.goals), a => a.goals, '');
  add('Meiste Vorlagen', leader(a => a.assists), a => a.assists, '');
  add('Meiste Zu-null-Spiele', leader(a => a.clean), a => a.clean, '');
  /* Marktwerte über den ganzen Kader der gewählten Liga */
  const ids = PLAYER_LIST.filter(p => p.active !== false && (ui.league === 'ALL' || leagueOf(p.id) === ui.league)).map(p => p.id);
  const mws = ids.map(id => [id, marketOf(id, games.list)]);
  const richest = mws.sort((a, b) => b[1].v - a[1].v)[0];
  if (richest) cards.push(['Höchster Marktwert', richest[0], eur(richest[1].v), 'p:' + richest[0], null]);
  const jump = ids.map(id => [id, marketOf(id, games.list).last]).sort((a, b) => b[1] - a[1])[0];
  if (jump && jump[1] > 0) cards.push(['Größter Marktwert-Sprung', jump[0], signedEur(jump[1]), 'p:' + jump[0], null]);
  return '<div class="recs">' + cards.map(([t, id, v, link, pts]) =>
    '<button type="button" class="rec tc"' + (pts != null ? ' data-tier="' + tierOf(pts) + '"' : '') + ' data-' + (link[0] === 'p' ? 'open' : 'hof') + '="' + esc(link) + '">' + avatar(id) +
    '<span class="rec-t">' + esc(t) + '</span><b class="rec-n">' + nameWithStatus(id) + '</b><span class="rec-v">' + esc(v) + '</span></button>').join('') + '</div>';
}

/* ---------- Spielansicht ---------- */
function editForm(g) {
  const own = recordTeam(g);
  const opt = (v, t, cur) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(t) + '</option>';
  const teams = [...new Set([...TEAMS, own])];
  const oppOpts = (CL[g.opp].custom ? opt(g.opp, CL[g.opp].n + ' (eigener Gegner)', g.opp) : '') +
    LEAGUES.map(lg => '<optgroup label="Kreisliga ' + lg + '">' + CLUB_LIST.filter(c => c.lg === lg).map(c => opt(c.id, c.n, g.opp)).join('') + '</optgroup>').join('');
  return '<div class="card admin-edit"><div class="fl">Spiel bearbeiten</div><form id="gameEdit" class="form">' +
    '<label class="nf"><span>Datum</span><input class="fi" type="date" name="date" value="' + g.played_at.slice(0, 10) + '"></label>' +
    '<label class="nf"><span>Mannschaft</span><select class="fi" name="team">' + teams.map(t => opt(t, CL[t].n + ' (' + CL[t].lg + ')', own)).join('') + '</select></label>' +
    '<label class="nf"><span>Gegner</span><select class="fi" name="opp">' + oppOpts + '</select></label>' +
    '<div class="nf2"><label class="nf"><span>Spielort</span><select class="fi" name="home">' + opt('1', 'Heim', g.home ? '1' : '0') + opt('0', 'Auswärts', g.home ? '1' : '0') + '</select></label>' +
    '<label class="nf"><span>Position</span><select class="fi" name="pos">' + POS_ORDER.map(k => opt(k, POS_NAME[k], g.pos)).join('') + '</select></label>' +
    '<label class="nf"><span>Tore eigenes Team</span><input class="fi" type="number" min="0" max="50" name="us" value="' + g.us + '"></label>' +
    '<label class="nf"><span>Gegentore</span><input class="fi" type="number" min="0" max="50" name="them" value="' + g.them + '"></label>' +
    '<label class="nf"><span>Minuten</span><input class="fi" type="number" min="0" max="150" name="minutes" value="' + g.minutes + '"></label>' +
    '<label class="nf"><span>Punkte</span><input class="fi" type="number" min="-1000" max="3000" name="points" value="' + g.points + '"></label></div>' +
    '<div class="duo"><button type="submit" class="btn primary">Speichern</button><button type="button" class="btn" data-hof="edit-cancel">Abbrechen</button></div></form></div>';
}
function adminTools(g) {
  if (!canManage(g.player)) return '';
  if (ui.edit) return editForm(g);
  return '<div class="admin-tools"><div class="fl">' + ICON.shield + (isAdmin() ? 'Admin' : 'Dein Spiel') + '</div><div class="duo">' +
    '<button type="button" class="btn" data-hof="edit">' + ICON.edit + 'Bearbeiten</button>' +
    (ui.confirmDelete ? '<button type="button" class="btn danger" data-hof="del-yes">Wirklich löschen?</button>' : '<button type="button" class="btn danger" data-hof="del">' + ICON.trash + 'Löschen</button>') +
    '</div></div>';
}
function gameHtml() {
  const g = (games.list || []).find(x => x.uid === ui.game);
  const back = '<button type="button" class="back" style="margin-left:-8px" data-hof="gback"><b aria-hidden="true">‹</b>Zurück</button>';
  if (!g) return back + '<p class="hmsg">Spiel nicht gefunden.</p>';
  const mine = recordTeam(g), l = g.home ? mine : g.opp, r = g.home ? g.opp : mine, ev = cachedEvents(g.uid);
  const head = back + '<div class="gh tc" data-tier="' + tierOf(g.points) + '"><button type="button" class="hb2" data-open="p:' + g.player + '" aria-label="Profil">' + avatar(g.player) + '</button>' +
    '<div class="gname">' + nameWithStatus(g.player) + '</div><div class="gbig">' + g.points + '</div>' +
    '<div class="gm"><img src="' + esc(crestUrl(l)) + '" alt="">' + scoreText(g, g.home) + '<img src="' + esc(crestUrl(r)) + '" alt=""></div>' +
    '<div class="gsub">' + dateShort(g.played_at) + ' · ' + POS_NAME[g.pos] + ' · ' + g.minutes + ' Min.' + (g.manual ? ' · Nachtrag' : '') + '</div></div>' + adminTools(g);
  if (!ev) return head + (ui.eventsError ? '<p class="hmsg">Keine Verbindung.</p><button type="button" class="btn full" data-hof="g:' + esc(g.uid) + '">Nochmal versuchen</button>' : '<p class="hmsg">Lädt …</p>');
  const sums = new Map();
  for (const x of ev) {
    if (x.k === 'ht' || x.k === 'sub' || x.x) continue;
    const c = x.k === 'auto' ? 'Einsatz & Team' : (CAT[x.k] || 'Sonstiges');
    sums.set(c, (sums.get(c) || 0) + x.p);
  }
  const bd = [...sums].map(([n, p]) => ({ n, p })).filter(b => b.p !== 0).sort((a, b) => b.p - a.p);
  return head + (bd.length ? '<h2>Punkte nach Bereich</h2>' + areaBars(bd) : '') +
    '<h2>Alle Punkte</h2><ul class="rows">' + rowsFromRecord(ev).map(rowLi).join('') + whistleLi() + '</ul>';
}

/* ---------- Übersicht ---------- */
function overviewHtml() {
  let h = '<div class="seg full htabs">' + [['best', 'Top'], ['players', 'Tabelle'], ['new', 'Neueste'], ['records', 'Rekorde']].map(([k, t]) =>
    '<button type="button" data-hof="t:' + k + '" aria-pressed="' + (ui.tab === k) + '">' + t + '</button>').join('') + '</div>' +
    '<div class="lgs">' + [['ALL', 'Alle'], ['A2', 'Kreisliga A2'], ['B2', 'Kreisliga B2'], ['B5', 'B5']].map(([k, t]) =>
      '<button type="button" data-hof="l:' + k + '" aria-pressed="' + (ui.league === k) + '">' + t + '</button>').join('') + '</div>';
  if (games.busy && !games.list) return h + '<p class="hmsg">Lädt …</p>';
  if (!games.list) return h + '<p class="hmsg">Keine Verbindung.</p><button type="button" class="btn full" data-hof="reload">Nochmal versuchen</button>';
  const list = games.list.filter(inLeague);
  if (!list.length) return h + '<p class="hmsg">Noch keine Spiele gespeichert.</p>';
  if (ui.tab === 'best') return h + potw(list) + '<ul class="glist">' + list.slice().sort((a, b) => b.points - a.points).slice(0, 30).map((g, i) => gameRow(g, i + 1)).join('') + '</ul>';
  if (ui.tab === 'new') return h + potw(list) + '<ul class="glist">' + list.slice(0, 40).map(g => gameRow(g, 0)).join('') + '</ul>';
  if (ui.tab === 'records') return h + records(list);
  return h + table(list);
}

export function render() {
  $('hofBody').innerHTML = ui.game ? gameHtml() : overviewHtml();
  applyTier(0);
}
async function reload() {
  forgetEvents();
  render();
  await loadGames(true);
  if (nav.current === 'hof') render();
}
async function openGame(uid) {
  ui.game = uid; ui.edit = false; ui.confirmDelete = false; ui.eventsError = false;
  window.scrollTo(0, 0);
  render();
  try { await loadEvents(uid); } catch (e) { ui.eventsError = true; }
  if (nav.current === 'hof' && ui.game === uid) render();
}

async function saveEdit(form) {
  const f = new FormData(form), uid = ui.game;
  const g = games.list.find(x => x.uid === uid);
  const patch = {
    played_at: new Date(f.get('date') + 'T' + (g.played_at.slice(11, 19) || '15:00:00') + 'Z').toISOString(),
    team: f.get('team'), opp: f.get('opp'), home: f.get('home') === '1', pos: f.get('pos'),
    us: +f.get('us'), them: +f.get('them'), minutes: +f.get('minutes'), points: +f.get('points')
  };
  try {
    const row = await updateGame(uid, patch);
    Object.assign(g, row);
    ui.edit = false; toast('Gespeichert');
  } catch (e) { toast('Speichern fehlgeschlagen: ' + e.message, 'bad'); }
  render();
}
async function remove() {
  try {
    await deleteGame(ui.game);
    games.list = games.list.filter(x => x.uid !== ui.game);
    forgetEvents(ui.game);
    ui.game = null; ui.confirmDelete = false;
    toast('Spiel gelöscht');
  } catch (e) { toast('Löschen fehlgeschlagen: ' + e.message, 'bad'); ui.confirmDelete = false; }
  render();
}

export function resetHof() { ui.player = null; ui.game = null; ui.edit = false; ui.confirmDelete = false; ui.returnTo = null; }
/* Spiel aus einer anderen Ansicht (z. B. Profil) öffnen; „Zurück“ führt dorthin zurück */
export function openHofGame(uid) {
  if (nav.current !== 'hof') { resetHof(); ui.returnTo = nav.current; show('hof'); }
  openGame(uid);
}
/* Interner Schritt zurück: Spieldetail schließen (außer es wurde von außen geöffnet) */
function hofBack() {
  if (ui.game && !ui.returnTo) { ui.game = null; ui.edit = false; ui.confirmDelete = false; return true; }
  ui.game = null; ui.returnTo = null;
  return false;
}

export function initHof() {
  registerView('hof', { elements: ['hof'], render, back: hofBack, enter: () => { reload(); } });
  $('hof').addEventListener('click', e => {
    const b = e.target.closest('[data-hof]');
    if (!b) return;
    const k = b.getAttribute('data-hof'), v = k.slice(2);
    if (k === 'reload') { reload(); return; }
    if (k.startsWith('g:')) { openGame(v); return; }
    if (k === 'gback') { goBack(); return; }
    else if (k === 'edit') ui.edit = true;
    else if (k === 'edit-cancel') ui.edit = false;
    else if (k === 'del') ui.confirmDelete = true;
    else if (k === 'del-yes') { remove(); return; }
    else if (k.startsWith('t:')) ui.tab = v;
    else if (k.startsWith('l:')) ui.league = v;
    render();
  });
  $('hof').addEventListener('submit', e => {
    if (e.target.id === 'gameEdit') { e.preventDefault(); saveEdit(e.target); }
  });
}
