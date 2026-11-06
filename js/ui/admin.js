/* Konto-Bereich: Anmelden, Registrieren (Spielerkonto), Passwort.
   Spieler: Freigabe-Status, eigene Spiele nachtragen. Admin: Anfragen freischalten, Spiel nachtragen, Kader pflegen. */
import { $, esc, eur, toast, applyTier } from '../core/util.js';
import { PL, PLAYER_LIST, POS_NAME, POS_ORDER, STATUS_NAME, fullName } from '../data/players.js';
import { CL, CLUB_LIST, LEAGUES, crestUrl } from '../data/clubs.js';
import { TEAMS, allFixtures } from '../data/schedule.js';
import { pad2 } from '../core/util.js';
import { login, logout, signup, currentUser, isLoggedIn, isAdmin, myAccount, myPlayer, requestAccount, refreshAdminFlag, requestPasswordReset, updatePassword, onAuthChange } from '../services/auth.js';
import { cutout } from '../core/cutout.js';
import { loadRoster, updatePlayer, insertPlayer, uploadPhoto, games, loadAccounts, decideAccount, loadSchedule, saveFixture, deleteFixture } from '../services/api.js';
import { openProfile } from './profile.js';
import { showIntro } from './intro.js';
import { marketOf } from '../core/market.js';
import { ICON, statusIcon } from '../core/icons.js';
import { avatar } from './components.js';
import { registerView, show, nav } from '../router.js';
import { openSetup } from './setup.js';

const ui = { spTeam: 'vfr', spEdit: null, spDel: null, mode: 'login', busy: false, msg: '', editing: null, passwordMode: false, email: '', adding: false, accounts: null, changePlayer: false };

/* Auswahl „Welcher Spieler bist du?“ (alle aktiven Kaderspieler, nach Verein gruppiert) */
function playerSelect(cur) {
  const groups = new Map();
  for (const p of PLAYER_LIST.filter(x => x.active !== false)) { if (!groups.has(p.c)) groups.set(p.c, []); groups.get(p.c).push(p); }
  return '<select class="fi" name="spieler" required><option value="">Bitte wählen …</option>' + [...groups].map(([c, l]) => '<optgroup label="' + esc(CL[c] ? CL[c].n : c) + '">' +
    l.map(p => '<option value="' + esc(p.id) + '"' + (p.id === cur ? ' selected' : '') + '>' + esc(fullName(p)) + '</option>').join('') + '</optgroup>').join('') + '</select>';
}

/* ---------- Login-Ansicht ---------- */
function loginHtml() {
  if (ui.mode === 'forgot') {
    return '<div class="auth card"><h3>Passwort vergessen</h3><p class="muted">Du bekommst einen Link per E-Mail. Er öffnet die App, dort legst du ein neues Passwort fest.</p>' +
      '<form id="forgotForm" class="form"><label class="nf"><span>E-Mail</span><input class="fi" type="email" name="email" autocomplete="username" required value="' + esc(ui.email || (currentUser() || {}).email || '') + '"></label>' +
      (ui.msg ? '<div class="form-msg">' + esc(ui.msg) + '</div>' : '') +
      '<button type="submit" class="btn primary full"' + (ui.busy ? ' disabled' : '') + '>Link senden</button></form>' +
      '<button type="button" class="lnk" data-adm="mode-login">Zurück zum Login</button></div>';
  }
  if (ui.mode === 'register') {
    return '<div class="auth card"><div class="auth-icon">' + ICON.user + '</div><h3>Registrieren</h3><p class="muted">Leg dir ein Konto an und wähle aus, welcher Spieler du bist. Sobald die Spielleitung dich freischaltet, kannst du deine Spiele selbst nachtragen.</p>' +
      '<form id="registerForm" class="form"><label class="nf"><span>E-Mail</span><input class="fi" type="email" name="email" autocomplete="username" required value="' + esc(ui.email) + '"></label>' +
      '<label class="nf"><span>Passwort (mind. 8 Zeichen)</span><input class="fi" type="password" name="pw" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="nf"><span>Passwort wiederholen</span><input class="fi" type="password" name="pw2" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="nf"><span>Welcher Spieler bist du?</span>' + playerSelect(ui.regPlayer) + '</label>' +
      (ui.msg ? '<div class="form-msg bad">' + esc(ui.msg) + '</div>' : '') +
      '<button type="submit" class="btn primary full"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? 'Konto wird angelegt …' : 'Konto anlegen') + '</button></form>' +
      '<button type="button" class="lnk" data-adm="mode-login">Schon ein Konto? Anmelden</button></div>';
  }
  return '<div class="auth card"><div class="auth-icon">' + ICON.shield + '</div><h3>Anmelden</h3><p class="muted">Für Spieler mit Konto und die Spielleitung.</p>' +
    '<form id="loginForm" class="form"><label class="nf"><span>E-Mail</span><input class="fi" type="email" name="email" autocomplete="username" required value="' + esc(ui.email) + '"></label>' +
    '<label class="nf"><span>Passwort</span><input class="fi" type="password" name="password" autocomplete="current-password" required></label>' +
    (ui.msg ? '<div class="form-msg bad">' + esc(ui.msg) + '</div>' : '') +
    '<button type="submit" class="btn primary full"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? 'Anmelden …' : 'Anmelden') + '</button></form>' +
    '<button type="button" class="lnk" data-adm="mode-forgot">Passwort vergessen?</button></div>' +
    '<button type="button" class="add-row" data-adm="mode-register"><span class="plus">+</span><span>Noch kein Konto? Registrieren<small>für Spieler: eigene Spiele nachtragen</small></span></button>';
}

/* ---------- Spielerkonto (angemeldet, kein Admin) ---------- */
function playerHtml() {
  const u = currentUser(), acc = myAccount(), mine = myPlayer();
  let h = '<div class="card acct"><div>' + ICON.user + '</div><div><b>' + esc(u && u.email ? u.email : 'Angemeldet') + '</b><small>' + (mine ? 'Spieler' : acc && acc.status === 'offen' ? 'Wartet auf Freigabe' : 'Konto') + '</small></div>' +
    '<button type="button" class="btn" data-adm="logout">Abmelden</button></div>';
  const choose = (title, text) => '<div class="card inline-form"><div class="fl">' + title + '</div><p class="muted small" style="margin:0">' + text + '</p>' +
    '<form id="requestForm" class="form"><label class="nf"><span>Welcher Spieler bist du?</span>' + playerSelect(acc && acc.spieler_id) + '</label>' +
    (ui.msg ? '<div class="form-msg bad">' + esc(ui.msg) + '</div>' : '') +
    '<div class="duo"><button type="submit" class="btn primary"' + (ui.busy ? ' disabled' : '') + '>Anfrage senden</button>' + (acc && acc.status === 'offen' ? '<button type="button" class="btn" data-adm="change-cancel">Abbrechen</button>' : '') + '</div></form></div>';
  if (mine && PL[mine]) {
    h += '<button type="button" class="pcard" data-adm="my-area">' + avatar(mine) + '<span><small>Mein Bereich</small><b>' + esc(fullName(PL[mine])) + '</b></span><span class="chev">›</span></button>' +
      '<div class="tiles"><button type="button" class="tile" data-adm="my-manual">' + ICON.plus + '<b>Spiel nachtragen</b><small>Mit Datum, Einsatzminuten und Aktionen</small></button>' +
      '<button type="button" class="tile" data-adm="my-profile">' + ICON.trophy + '<b>Mein Profil</b><small>Verlauf, Marktwert – dort jedes Spiel öffnen und bearbeiten</small></button></div>';
  } else if (!acc) h += choose('Spieler auswählen', 'Wähle aus, welcher Spieler du bist. Die Spielleitung bekommt die Anfrage und schaltet dich frei.');
  else if (acc.status === 'abgelehnt') h += choose('Anfrage abgelehnt', 'Deine Anfrage wurde nicht freigegeben. Falls du den falschen Spieler gewählt hast, kannst du es hier nochmal versuchen.');
  else if (ui.changePlayer) h += choose('Anderen Spieler wählen', 'Deine Anfrage bleibt offen, bis die Spielleitung entscheidet.');
  else {
    const p = PL[acc.spieler_id];
    h += '<div class="card waitc"><div class="waiti">⏳</div><div><b>Wartet auf Freigabe</b><p class="muted small">Du hast <b>' + esc(p ? fullName(p) : acc.spieler_id) + '</b> gewählt. Sobald die Spielleitung dein Konto freischaltet, kannst du hier deine Spiele nachtragen.</p>' +
      '<button type="button" class="lnk inline" data-adm="change-player">Falscher Spieler? Ändern</button> · <button type="button" class="lnk inline" data-adm="refresh">Status prüfen</button></div></div>';
  }
  return h + '<button type="button" class="lnk" data-adm="pw-open">Passwort ändern</button>';
}

/* ---------- Spielerkonten freischalten (Admin) ---------- */
function accountsHtml() {
  const l = ui.accounts;
  if (!l) return '<h2>Spielerkonten</h2><p class="muted small">Lädt …</p>';
  const open = l.filter(a => a.status === 'offen'), active = l.filter(a => a.status === 'frei');
  const when = a => new Date(a.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const row = (a, buttons) => '<li class="kreq">' + (PL[a.spieler_id] ? avatar(a.spieler_id) : '<span class="hav"></span>') +
    '<span><b>' + esc(PL[a.spieler_id] ? fullName(PL[a.spieler_id]) : a.spieler_id) + '</b><small>' + esc(a.email || '') + ' · ' + when(a) + '</small></span>' + buttons + '</li>';
  let h = '<h2>Spielerkonten' + (open.length ? ' <i class="nb">' + open.length + '</i>' : '') + '</h2>';
  h += open.length
    ? '<ul class="klist">' + open.map(a => row(a, '<span class="kreq-b"><button type="button" class="btn primary sm" data-adm="ok:' + a.user_id + '">Freischalten</button><button type="button" class="btn sm" data-adm="no:' + a.user_id + '">Ablehnen</button></span>')).join('') + '</ul>'
    : '<p class="muted small">Keine offenen Anfragen.</p>';
  if (active.length) h += '<details class="kact"><summary>Freigeschaltet (' + active.length + ')</summary><ul class="klist">' + active.map(a => row(a, '<span class="kreq-b"><button type="button" class="btn sm" data-adm="no:' + a.user_id + '">Entziehen</button></span>')).join('') + '</ul></details>';
  return h;
}

/* ---------- Spielplan pflegen (Admin) ---------- */
const localInput = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
function fixtureForm(f) {
  const team = ui.spTeam, opt = (v, t, cur) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(t) + '</option>';
  const opps = LEAGUES.map(lg => '<optgroup label="Kreisliga ' + lg + '">' + CLUB_LIST.filter(c => c.lg === lg && c.id !== team).map(c => opt(c.id, c.n, f ? f.o : '')).join('') + '</optgroup>').join('');
  const when = f ? localInput(f.at) : localInput(new Date(Date.now() + 7 * 864e5)).slice(0, 11) + '15:00';
  return '<form class="card inline-form" id="fxForm" data-id="' + (f && f.id ? f.id : '') + '"><div class="fl">' + (f ? 'Spiel bearbeiten' : 'Spiel hinzufügen') + ' · ' + esc(CL[team].n) + '</div>' +
    '<label class="nf"><span>Anstoß</span><input class="fi" type="datetime-local" name="at" required value="' + when + '"></label>' +
    '<div class="nf2" style="margin-top:0"><label class="nf"><span>Gegner</span><select class="fi" name="opp" required>' + opps + '</select></label>' +
    '<label class="nf"><span>Spielort</span><select class="fi" name="home">' + opt('1', 'Heim', f && !f.home ? '0' : '1') + opt('0', 'Auswärts', f && !f.home ? '0' : '1') + '</select></label></div>' +
    '<div class="duo"><button type="submit" class="btn primary"' + (ui.busy ? ' disabled' : '') + '>Speichern</button><button type="button" class="btn" data-adm="fx-cancel">Abbrechen</button></div>' +
    (f && f.id ? (ui.spDel === f.id ? '<button type="button" class="btn danger full" data-adm="fx-del-yes:' + f.id + '">Wirklich löschen?</button>' : '<button type="button" class="lnk" data-adm="fx-del:' + f.id + '">Spiel löschen</button>') : '') + '</form>';
}
function scheduleHtml() {
  const team = ui.spTeam, list = allFixtures(team), now = Date.now();
  let h = '<h2>Spielplan</h2><div class="seg full spteams">' + TEAMS.map(t => '<button type="button" data-adm="sp:' + t + '" aria-pressed="' + (t === team) + '">' + esc(CL[t].n.replace('VfR Murrhardt/ Kirchenkirnberg II', 'VfR II').replace('SGM Fornsbach II', 'SGM II')) + '<small>' + CL[t].lg + '</small></button>').join('') + '</div>';
  if (ui.spEdit === 'new') h += fixtureForm(null);
  else h += '<button type="button" class="add-row" data-adm="fx-new"><span class="plus">+</span><span>Spiel hinzufügen<small>z. B. Nachholspiel oder verlegtes Spiel</small></span></button>';
  h += '<ul class="fxlist">' + list.map(f => {
    if (ui.spEdit === f.id) return '<li>' + fixtureForm(f) + '</li>';
    const past = f.at.getTime() + 4 * 3600e3 < now;
    return '<li><button type="button" class="fxr' + (past ? ' past' : '') + '" data-adm="fx-edit:' + f.id + '"' + (f.id ? '' : ' disabled') + '>' +
      '<span class="fxr-d"><b>' + pad2(f.at.getDate()) + '.' + pad2(f.at.getMonth() + 1) + '.</b><small>' + pad2(f.at.getHours()) + ':' + pad2(f.at.getMinutes()) + '</small></span>' +
      '<img src="' + esc(crestUrl(f.o)) + '" alt=""><span class="fxr-n">' + esc(CL[f.o] ? CL[f.o].n : f.o) + '<small>' + (f.home ? 'Heim' : 'Auswärts') + '</small></span><i class="kr-e">' + ICON.edit + '</i></button></li>';
  }).join('') + '</ul>' + (list.length && !list[0].id ? '<p class="muted small">Spielplan wird geladen …</p>' : '');
  return h;
}

/* ---------- Passwort setzen (nach E-Mail-Link) ---------- */
function passwordHtml() {
  return '<div class="auth card"><h3>Neues Passwort</h3><p class="muted">Mindestens 8 Zeichen.</p>' +
    '<form id="pwForm" class="form"><label class="nf"><span>Neues Passwort</span><input class="fi" type="password" name="pw" autocomplete="new-password" minlength="8" required></label>' +
    '<label class="nf"><span>Wiederholen</span><input class="fi" type="password" name="pw2" autocomplete="new-password" minlength="8" required></label>' +
    (ui.msg ? '<div class="form-msg bad">' + esc(ui.msg) + '</div>' : '') +
    '<button type="submit" class="btn primary full"' + (ui.busy ? ' disabled' : '') + '>Passwort speichern</button></form>' +
    (isAdmin() ? '<button type="button" class="lnk" data-adm="pw-cancel">Abbrechen</button>' : '') + '</div>';
}

/* ---------- Kader ---------- */
function rosterRow(p) {
  const mw = marketOf(p.id, games.list || []);
  if (ui.editing === p.id) {
    const opt = (v, t, cur) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + esc(t) + '</option>';
    return '<li class="kr open"><div class="kr-h">' + avatar(p.id) + '<b>' + esc(fullName(p)) + '</b></div>' +
      '<form class="form" data-player="' + p.id + '">' +
      '<div class="fl">Status</div><div class="seg full" role="group">' + ['fit', 'hit', 'inj'].map(s => '<label class="segl"><input type="radio" name="status" value="' + s + '"' + (p.status === s ? ' checked' : '') + '><span>' + STATUS_NAME[s] + '</span></label>').join('') + '</div>' +
      '<label class="nf"><span>Info zum Status (optional, z. B. „Kreuzband, bis Winter“)</span><input class="fi" name="info" maxlength="80" value="' + esc(p.info || '') + '"></label>' +
      '<div class="nf2"><label class="nf"><span>Stammposition</span><select class="fi" name="pos">' + POS_ORDER.map(k => opt(k, POS_NAME[k], p.pos)).join('') + '</select></label>' +
      '<label class="nf"><span>Start-Marktwert (€)</span><input class="fi" type="number" name="mw" min="0" max="500000000" step="1" value="' + p.mw + '"></label></div>' +
      '<label class="chk"><input type="checkbox" name="exact"' + (p.exact ? ' checked' : '') + '><span>Marktwert exakt übernehmen (nicht „krumm“ machen)</span></label>' +
      '<label class="chk"><input type="checkbox" name="active"' + (p.active !== false ? ' checked' : '') + '><span>In der Spielerauswahl anzeigen</span></label>' +
      photoField('Foto ändern (optional)') +
      '<div class="duo"><button type="submit" class="btn primary"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? 'Speichere …' : 'Speichern') + '</button><button type="button" class="btn" data-adm="close">Abbrechen</button></div></form></li>';
  }
  return '<li class="kr"><button type="button" class="kr-h" data-adm="edit:' + p.id + '">' + avatar(p.id) +
    '<span><b>' + esc(fullName(p)) + statusIcon(p.id) + '</b><small>' + esc(CL[p.c].n) + ' · ' + POS_NAME[p.pos] + ' · ' + eur(mw.v) + (p.active === false ? ' · ausgeblendet' : '') + '</small></span>' +
    '<i class="kr-e">' + ICON.edit + '</i></button></li>';
}

const photoField = label => '<label class="nf"><span>' + label + '</span><input class="fi file" type="file" name="photo" accept="image/*"></label>' +
  '<p class="muted small" style="margin:-4px 0 0" id="admPhotoStatus">' + (ui.busy ? 'Foto wird verarbeitet …' : 'Der Hintergrund wird automatisch entfernt. Am besten ein Hochformat-Foto mit Oberkörper.') + '</p>';

/* Neuer Stammspieler */
function newPlayerHtml() {
  if (!ui.adding) return '<button type="button" class="add-row" data-adm="add"><span class="plus">+</span><span>Spieler hinzufügen<small>erscheint dauerhaft für alle</small></span></button>';
  const clubs = CLUB_LIST.map(c => '<option value="' + c.id + '">' + esc(c.n) + ' (' + c.lg + ')</option>').join('');
  return '<form class="card inline-form" id="newPlayerForm"><div class="fl">Neuer Spieler</div>' +
    '<div class="nf2" style="margin-top:0"><label class="nf"><span>Vorname</span><input class="fi" name="vn" maxlength="30" autocomplete="off"></label>' +
    '<label class="nf"><span>Nachname</span><input class="fi" name="n" maxlength="40" required autocomplete="off"></label>' +
    '<label class="nf"><span>Verein</span><select class="fi" name="club">' + clubs + '</select></label>' +
    '<label class="nf"><span>Position</span><select class="fi" name="pos">' + POS_ORDER.map(k => '<option value="' + k + '"' + (k === 'MIT' ? ' selected' : '') + '>' + POS_NAME[k] + '</option>').join('') + '</select></label></div>' +
    '<label class="nf"><span>Start-Marktwert (€)</span><input class="fi" type="number" name="mw" min="0" max="500000000" value="3000000"></label>' +
    photoField('Foto (optional)') +
    (ui.msg ? '<div class="form-msg bad">' + esc(ui.msg) + '</div>' : '') +
    '<div class="duo"><button type="submit" class="btn primary"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? 'Speichere …' : 'Anlegen') + '</button><button type="button" class="btn" data-adm="add-cancel">Abbrechen</button></div></form>';
}
/* Foto freistellen (Hintergrund entfernen) und ins Kickbase-Format bringen */
async function preparePhoto(file) {
  if (!file || !file.size) return null;
  const res = await cutout(file, 'player', t => { const el = document.getElementById('admPhotoStatus'); if (el) el.textContent = t; });
  URL.revokeObjectURL(res.url);
  return res.blob;
}
function makeId(vn, n) {
  const base = (n + (vn ? vn[0] : '')).replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[^A-Za-z0-9]/g, '').slice(0, 26) || 'Spieler';
  const cap = base[0].toUpperCase() + base.slice(1);
  let id = cap, i = 2;
  while (PL[id]) id = cap + i++;
  return id;
}

function adminHtml() {
  const u = currentUser();
  return '<div class="card acct"><div>' + ICON.user + '</div><div><b>' + esc(u && u.email ? u.email : 'Angemeldet') + '</b><small>Admin</small></div>' +
      '<button type="button" class="btn" data-adm="logout">Abmelden</button></div>' +
    '<div class="tiles">' +
      '<button type="button" class="tile" data-adm="manual">' + ICON.plus + '<b>Spiel nachtragen</b><small>Mit Datum, Einsatzminuten und Aktionen</small></button>' +
      '<button type="button" class="tile" data-nav="hof">' + ICON.trophy + '<b>Spiele verwalten</b><small>In der Hall of Fame ein Spiel öffnen → Bearbeiten/Löschen</small></button>' +
    '</div>' + accountsHtml() + scheduleHtml() +
    '<h2>Kader</h2><p class="muted small">Status (Verletzung), Stammposition und Start-Marktwert gelten sofort für alle.</p>' +
    newPlayerHtml() +
    '<ul class="klist">' + PLAYER_LIST.map(rosterRow).join('') + '</ul>' +
    '<button type="button" class="lnk" data-adm="pw-open">Passwort ändern</button>';
}

export function render() {
  let h;
  if (ui.passwordMode && isLoggedIn()) h = passwordHtml();
  else if (!isLoggedIn()) h = loginHtml();
  else if (isAdmin()) h = adminHtml();
  else h = playerHtml();
  $('adminBody').innerHTML = h + '<button type="button" class="lnk" data-adm="intro">Einführung ansehen</button>';
  $('admTitle').textContent = isLoggedIn() && isAdmin() ? 'Admin' : 'Konto';
  applyTier(0);
}

async function onSubmit(form) {
  const f = new FormData(form);
  if (form.id === 'loginForm') {
    ui.email = String(f.get('email')).trim();
    ui.busy = true; ui.msg = ''; render();
    try {
      await login(String(f.get('email')).trim(), String(f.get('password')));
      ui.msg = '';
      toast('Angemeldet');
      if (isAdmin()) reloadAccounts();
    } catch (e) { ui.msg = e.message; }
    ui.busy = false; render();
  } else if (form.id === 'registerForm') {
    const email = String(f.get('email')).trim(), pw = String(f.get('pw')), pw2 = String(f.get('pw2')), sp = String(f.get('spieler') || '');
    ui.email = email; ui.regPlayer = sp;
    if (pw.length < 8) { ui.msg = 'Das Passwort braucht mindestens 8 Zeichen.'; render(); return; }
    if (pw !== pw2) { ui.msg = 'Die Passwörter stimmen nicht überein.'; render(); return; }
    if (!PL[sp]) { ui.msg = 'Bitte auswählen, welcher Spieler du bist.'; render(); return; }
    ui.busy = true; ui.msg = ''; render();
    try {
      const loggedIn = await signup(email, pw, sp);
      ui.mode = 'login';
      toast(loggedIn ? 'Konto angelegt – wartet auf Freigabe' : 'Fast geschafft: bitte die E-Mail bestätigen');
    } catch (e) { ui.msg = e.message; }
    ui.busy = false; render();
  } else if (form.id === 'fxForm') {
    const id = form.dataset.id ? +form.dataset.id : null, at = new Date(String(f.get('at')));
    if (isNaN(at)) { toast('Bitte Datum und Uhrzeit eingeben.', 'bad'); return; }
    ui.busy = true; render();
    try {
      await saveFixture({ team: ui.spTeam, anstoss: at.toISOString(), gegner: String(f.get('opp')), heim: f.get('home') === '1' }, id);
      ui.spEdit = null; toast('Spielplan gespeichert');
    } catch (e) { toast(/duplicate|unique/i.test(e.message) ? 'Zu dieser Zeit gibt es schon ein Spiel.' : 'Speichern fehlgeschlagen: ' + e.message, 'bad'); }
    ui.busy = false; render();
  } else if (form.id === 'requestForm') {
    const sp = String(f.get('spieler') || '');
    if (!PL[sp]) { ui.msg = 'Bitte einen Spieler auswählen.'; render(); return; }
    ui.busy = true; ui.msg = ''; render();
    try { await requestAccount(sp); ui.changePlayer = false; toast('Anfrage gesendet'); }
    catch (e) { ui.msg = 'Das hat nicht geklappt: ' + e.message; }
    ui.busy = false; render();
  } else if (form.id === 'forgotForm') {
    ui.busy = true; render();
    try { await requestPasswordReset(String(f.get('email')).trim()); ui.msg = 'Falls die Adresse registriert ist, ist der Link unterwegs. Schau auch im Spam-Ordner.'; }
    catch (e) { ui.msg = 'Das hat nicht geklappt: ' + e.message; }
    ui.busy = false; render();
  } else if (form.id === 'pwForm') {
    const pw = String(f.get('pw')), pw2 = String(f.get('pw2'));
    if (pw.length < 8) { ui.msg = 'Mindestens 8 Zeichen.'; render(); return; }
    if (pw !== pw2) { ui.msg = 'Die Passwörter stimmen nicht überein.'; render(); return; }
    ui.busy = true; ui.msg = ''; render();
    try { await updatePassword(pw); ui.passwordMode = false; toast('Passwort gespeichert'); await refreshAdminFlag(); }
    catch (e) { ui.msg = e.message; }
    ui.busy = false; render();
  } else if (form.id === 'newPlayerForm') {
    const vn = String(f.get('vn') || '').trim(), n = String(f.get('n') || '').trim();
    if (!n) { ui.msg = 'Bitte einen Nachnamen eingeben.'; render(); return; }
    ui.busy = true; ui.msg = ''; render();
    try {
      const id = makeId(vn, n), blob = await preparePhoto(f.get('photo'));
      const foto = blob ? await uploadPhoto(id, blob) : '';
      const sort = Math.max(0, ...PLAYER_LIST.map(p => p.sort || 0)) + 10;
      await insertPlayer({ id, vorname: vn, nachname: n, verein: f.get('club'), pos: f.get('pos'), mw_start: Math.max(0, Math.round(+f.get('mw') || 0)), mw_exakt: false, status: 'fit', aktiv: true, sort, foto });
      ui.adding = false; toast(fullName({ vn, n }) + ' angelegt');
    } catch (e) { ui.msg = 'Anlegen fehlgeschlagen: ' + e.message; }
    ui.busy = false; render();
  } else if (form.dataset.player) {
    const id = form.dataset.player;
    const patch = {
      status: f.get('status') || 'fit', status_info: String(f.get('info') || '').trim(), pos: f.get('pos'),
      mw_start: Math.max(0, Math.round(+f.get('mw') || 0)), mw_exakt: f.get('exact') === 'on', aktiv: f.get('active') === 'on'
    };
    ui.busy = true; render();
    try {
      const blob = await preparePhoto(f.get('photo'));
      if (blob) patch.foto = await uploadPhoto(id, blob);
      await updatePlayer(id, patch); ui.editing = null; toast('Kader gespeichert');
    } catch (e) { toast('Speichern fehlgeschlagen: ' + e.message, 'bad'); }
    ui.busy = false; render();
  }
}

/* Nach Klick auf einen Passwort-Link aus der E-Mail */
export function startPasswordFlow() { ui.passwordMode = true; ui.msg = ''; show('admin'); }

async function reloadAccounts() {
  try { ui.accounts = await loadAccounts(); } catch (e) { ui.accounts = []; }
  if (nav.current === 'admin') render();
}
async function decide(userId, status) {
  try {
    await decideAccount(userId, status);
    toast(status === 'frei' ? 'Konto freigeschaltet' : 'Erledigt');
  } catch (e) {
    toast(/duplicate|unique/i.test(e.message) ? 'Für diesen Spieler ist schon ein anderes Konto freigeschaltet.' : 'Fehlgeschlagen: ' + e.message, 'bad');
  }
  await reloadAccounts();
  refreshAdminFlag();
}

export function initAdmin() {
  registerView('admin', {
    elements: ['admin'], render,
    enter: () => {
      ui.msg = ''; ui.changePlayer = false;
      if (isLoggedIn()) refreshAdminFlag().then(a => { if (a) { reloadAccounts(); loadSchedule().then(() => { if (nav.current === 'admin') render(); }); } });
      loadRoster().then(() => { if (nav.current === 'admin') render(); });
    }
  });
  onAuthChange(() => { if (nav.current === 'admin') render(); });
  $('admin').addEventListener('submit', e => { e.preventDefault(); onSubmit(e.target); });
  $('admin').addEventListener('click', async e => {
    const b = e.target.closest('[data-adm]');
    if (!b) return;
    const k = b.getAttribute('data-adm');
    if (k === 'mode-forgot') { ui.mode = 'forgot'; ui.msg = ''; }
    else if (k === 'mode-login') { ui.mode = 'login'; ui.msg = ''; }
    else if (k === 'mode-register') { ui.mode = 'register'; ui.msg = ''; }
    else if (k === 'intro') { showIntro(); return; }
    else if (k === 'change-player') { ui.changePlayer = true; ui.msg = ''; }
    else if (k === 'change-cancel') ui.changePlayer = false;
    else if (k === 'refresh') { await refreshAdminFlag(); toast(myPlayer() ? 'Du bist freigeschaltet!' : 'Noch nicht freigeschaltet'); }
    else if (k === 'my-manual') { openSetup(null, { manual: true, player: myPlayer() }); return; }
    else if (k === 'my-profile') { openProfile(myPlayer()); return; }
    else if (k === 'my-area') { show('me'); return; }
    else if (k.startsWith('sp:')) { ui.spTeam = k.slice(3); ui.spEdit = null; }
    else if (k === 'fx-new') { ui.spEdit = 'new'; ui.spDel = null; }
    else if (k === 'fx-cancel') { ui.spEdit = null; ui.spDel = null; }
    else if (k.startsWith('fx-edit:')) { ui.spEdit = +k.slice(8); ui.spDel = null; }
    else if (k.startsWith('fx-del:')) ui.spDel = +k.slice(7);
    else if (k.startsWith('fx-del-yes:')) {
      try { await deleteFixture(+k.slice(11)); toast('Spiel gelöscht'); ui.spEdit = null; } catch (e) { toast('Löschen fehlgeschlagen: ' + e.message, 'bad'); }
    }
    else if (k.startsWith('ok:')) { decide(k.slice(3), 'frei'); return; }
    else if (k.startsWith('no:')) { decide(k.slice(3), 'abgelehnt'); return; }
    else if (k === 'logout') { await logout(); toast('Abgemeldet'); }
    else if (k === 'manual') { openSetup(null, { manual: true }); return; }
    else if (k === 'pw-open') { ui.passwordMode = true; ui.msg = ''; }
    else if (k === 'pw-cancel') ui.passwordMode = false;
    else if (k === 'close') ui.editing = null;
    else if (k === 'add') { ui.adding = true; ui.editing = null; ui.msg = ''; }
    else if (k === 'add-cancel') { ui.adding = false; ui.msg = ''; }
    else if (k.startsWith('edit:')) ui.editing = k.slice(5);
    render();
  });
}
