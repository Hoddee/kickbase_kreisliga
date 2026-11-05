/* Admin-Bereich: Login, Passwort, Spiel nachtragen, Kader pflegen (Status, Position, Marktwert) */
import { $, esc, eur, toast, applyTier } from '../core/util.js';
import { PL, PLAYER_LIST, POS_NAME, POS_ORDER, STATUS_NAME, fullName } from '../data/players.js';
import { CL, CLUB_LIST } from '../data/clubs.js';
import { login, logout, currentUser, isLoggedIn, isAdmin, refreshAdminFlag, requestPasswordReset, updatePassword, onAuthChange } from '../services/auth.js';
import { loadRoster, updatePlayer, insertPlayer, uploadPhoto, games } from '../services/api.js';
import { marketOf } from '../core/market.js';
import { ICON, statusIcon } from '../core/icons.js';
import { avatar } from './components.js';
import { registerView, show, nav } from '../router.js';
import { openSetup } from './setup.js';

const ui = { mode: 'login', busy: false, msg: '', editing: null, passwordMode: false, email: '', adding: false };

/* ---------- Login-Ansicht ---------- */
function loginHtml() {
  if (ui.mode === 'forgot') {
    return '<div class="auth card"><h3>Passwort vergessen</h3><p class="muted">Du bekommst einen Link per E-Mail. Er öffnet die App, dort legst du ein neues Passwort fest.</p>' +
      '<form id="forgotForm" class="form"><label class="nf"><span>E-Mail</span><input class="fi" type="email" name="email" autocomplete="username" required value="' + esc(ui.email || (currentUser() || {}).email || '') + '"></label>' +
      (ui.msg ? '<div class="form-msg">' + esc(ui.msg) + '</div>' : '') +
      '<button type="submit" class="btn primary full"' + (ui.busy ? ' disabled' : '') + '>Link senden</button></form>' +
      '<button type="button" class="lnk" data-adm="mode-login">Zurück zum Login</button></div>';
  }
  return '<div class="auth card"><div class="auth-icon">' + ICON.shield + '</div><h3>Admin-Login</h3><p class="muted">Nur für die Spielleitung: Spiele nachtragen, bearbeiten und den Kader pflegen.</p>' +
    '<form id="loginForm" class="form"><label class="nf"><span>E-Mail</span><input class="fi" type="email" name="email" autocomplete="username" required value="' + esc(ui.email) + '"></label>' +
    '<label class="nf"><span>Passwort</span><input class="fi" type="password" name="password" autocomplete="current-password" required></label>' +
    (ui.msg ? '<div class="form-msg bad">' + esc(ui.msg) + '</div>' : '') +
    '<button type="submit" class="btn primary full"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? 'Anmelden …' : 'Anmelden') + '</button></form>' +
    '<button type="button" class="lnk" data-adm="mode-forgot">Passwort vergessen?</button></div>';
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

const photoField = label => '<label class="nf"><span>' + label + '</span><input class="fi file" type="file" name="photo" accept="image/png,image/jpeg,image/webp"></label>' +
  '<p class="muted small" style="margin:-4px 0 0">Am besten ein freigestelltes Hochformat-Foto (PNG mit transparentem Hintergrund).</p>';

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
/* Foto verkleinern (max. 907 px breit wie die vorhandenen Fotos), Transparenz bleibt erhalten */
async function preparePhoto(file) {
  if (!file || !file.size) return null;
  if (file.size > 15e6) throw new Error('Foto ist zu groß (max. 15 MB).');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 907 / bmp.width), cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
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
    '</div>' +
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
  else h = '<div class="auth card"><h3>Kein Admin</h3><p class="muted">Dieses Konto hat keine Admin-Rechte.</p><button type="button" class="btn full" data-adm="logout">Abmelden</button></div>';
  $('adminBody').innerHTML = h;
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
      toast(isAdmin() ? 'Angemeldet' : 'Angemeldet, aber ohne Admin-Rechte');
    } catch (e) { ui.msg = e.message; }
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

export function initAdmin() {
  registerView('admin', {
    elements: ['admin'], render,
    enter: () => { ui.msg = ''; if (isLoggedIn()) refreshAdminFlag(); loadRoster().then(() => { if (nav.current === 'admin') render(); }); }
  });
  onAuthChange(() => { if (nav.current === 'admin') render(); });
  $('admin').addEventListener('submit', e => { e.preventDefault(); onSubmit(e.target); });
  $('admin').addEventListener('click', async e => {
    const b = e.target.closest('[data-adm]');
    if (!b) return;
    const k = b.getAttribute('data-adm');
    if (k === 'mode-forgot') { ui.mode = 'forgot'; ui.msg = ''; }
    else if (k === 'mode-login') { ui.mode = 'login'; ui.msg = ''; }
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
